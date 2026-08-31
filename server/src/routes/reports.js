import express from "express";
import { randomUUID } from "node:crypto";
import { db, shapeReport, recordAdminAudit } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { rateLimit } from "../rateLimit.js";

const router = express.Router();

const REASONS = ["copyright", "metadata", "inappropriate", "spam", "other"];
const TARGET_TYPES = ["track", "artist", "comment"];

// A real, minimal reporting entry point (Part 49) — any signed-in user can
// flag a track, artist, or comment. Nothing here is fabricated for the
// Admin Reports queue to have something to show; if nobody reports
// anything, that queue is genuinely empty.
router.post("/", requireAuth, rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "report-create" }), (req, res) => {
  const body = req.body || {};
  const targetType = String(body.targetType || "").trim();
  const targetId = String(body.targetId || "").trim();
  const reason = String(body.reason || "").trim();
  const note = String(body.note || "").trim().slice(0, 500);
  if (!TARGET_TYPES.includes(targetType)) return res.status(400).json({ error: "Loại nội dung báo cáo không hợp lệ." });
  if (!targetId) return res.status(400).json({ error: "Thiếu nội dung cần báo cáo." });
  if (!REASONS.includes(reason)) return res.status(400).json({ error: "Lý do báo cáo không hợp lệ." });

  if (targetType === "track") {
    const exists = db.prepare("SELECT id FROM tracks WHERE id = ?").get(targetId);
    if (!exists) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  } else if (targetType === "artist") {
    const exists = db.prepare("SELECT username FROM artist_profiles WHERE username = ?").get(targetId);
    if (!exists) return res.status(404).json({ error: "Không tìm thấy nghệ sĩ." });
  }

  const id = randomUUID();
  db.prepare(`INSERT INTO reports (id, reporter_username, target_type, target_id, reason, note, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`)
    .run(id, req.user.username, targetType, targetId, reason, note || null, Date.now());
  res.status(201).json({ report: shapeReport(db.prepare("SELECT * FROM reports WHERE id = ?").get(id)) });
});

router.get("/", requireAuth, requireAdmin, (req, res) => {
  const status = (req.query.status || "open").trim();
  const rows = status === "all"
    ? db.prepare("SELECT * FROM reports ORDER BY created_at DESC").all()
    : db.prepare("SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC").all(status);
  res.json({ reports: rows.map(shapeReport) });
});

router.post("/:id/resolve", requireAuth, requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy báo cáo." });
  const note = ((req.body && req.body.note) || "").trim().slice(0, 500);
  const outcome = (req.body && req.body.outcome === "dismissed") ? "dismissed" : "resolved";
  db.prepare("UPDATE reports SET status = ?, resolved_at = ?, resolved_by = ?, resolution_note = ? WHERE id = ?")
    .run(outcome, Date.now(), req.user.username, note || null, req.params.id);
  recordAdminAudit(req.user.username, "report_" + outcome, "report", req.params.id, { targetType: row.target_type, targetId: row.target_id });
  res.json({ report: shapeReport(db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id)) });
});

export default router;
