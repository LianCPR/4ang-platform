/**
 * 4ANG Reports Routes — Supabase PostgreSQL only.
 */
import express from "express";
import { randomUUID } from "node:crypto";
import { shapeReport, recordAdminAudit } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  const { targetType, targetId, reason, note } = req.body || {};
  if (!targetType || !targetId || !reason) return res.status(400).json({ error: "Thiếu thông tin." });
  const { error } = await supabaseAdmin.from("reports").insert({
    reporter_id: req.user.id, reporter_username: req.user.username,
    target_type: targetType, target_id: targetId, reason, note: note || null,
    status: "open", created_at: new Date().toISOString(),
  });
  if (error) return res.status(500).json({ error: "Lỗi gửi báo cáo." });
  res.status(201).json({ ok: true });
});

router.get("/mine", requireAuth, async (req, res) => {
  const { data: rows } = await supabaseAdmin
    .from("reports").select("*").eq("reporter_username", req.user.username).order("created_at", { ascending: false });
  res.json({ reports: (rows || []).map(shapeReport) });
});

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const { data: rows } = await supabaseAdmin.from("reports").select("*").order("created_at", { ascending: false });
  res.json({ reports: (rows || []).map(shapeReport) });
});

router.post("/:id/resolve", requireAuth, requireAdmin, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("reports").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy." });
  const resolutionNote = (req.body?.resolutionNote || "").trim().slice(0, 500);
  await supabaseAdmin.from("reports").update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: req.user.id, resolution_note: resolutionNote || null }).eq("id", row.id);
  await recordAdminAudit(req.user.username, "report_resolved", "report", row.id, { resolutionNote: resolutionNote || null });
  const { data: updated } = await supabaseAdmin.from("reports").select("*").eq("id", row.id).single();
  res.json({ report: shapeReport(updated) });
});

router.post("/:id/dismiss", requireAuth, requireAdmin, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("reports").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy." });
  await supabaseAdmin.from("reports").update({ status: "dismissed" }).eq("id", row.id);
  res.json({ ok: true });
});

export default router;
