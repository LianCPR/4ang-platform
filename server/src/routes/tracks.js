import express from "express";
import { randomUUID } from "node:crypto";
import { db, shapeTrack, recordActivity } from "../db.js";
import { requireAuth, optionalAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { getFileUrl } from "../storage.js";

const router = express.Router();

// Công khai: danh sách bài đã được duyệt — ai ở đâu cũng xem/nghe được, không cần đăng nhập
// Chỉ status='approved' — một bài bị Admin gỡ (status='unpublished', Phase 7)
// biến mất khỏi đây ngay lập tức, không cần thêm điều kiện lọc nào khác.
router.get("/", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const rows = db.prepare("SELECT * FROM tracks WHERE status = 'approved' ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset);
  const total = db.prepare("SELECT COUNT(*) AS c FROM tracks WHERE status = 'approved'").get().c;
  res.json({ tracks: rows.map(shapeTrack), total });
});

// Cần đăng nhập: bài của chính mình (mọi trạng thái, để tự theo dõi việc duyệt)
router.get("/mine", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM tracks WHERE uploader_username = ? ORDER BY created_at DESC").all(req.user.username);
  res.json({ tracks: rows.map(shapeTrack) });
});

// Note: the old direct "POST /" track upload (pre-Phase-6) has been
// removed. Every track now reaches `tracks` through exactly one path —
// POST /api/submissions -> Admin review -> POST /api/submissions/:id/publish
// (server/src/routes/submissions.js) — so there is only ever one
// publication pipeline, per the Phase 7 "no duplicate systems" directive.

// Phát file âm thanh — chỉ khi bài đã duyệt (hoặc chính người đăng / admin xem trước)
router.get("/:id/audio", optionalAuth, async (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).end();
    const isOwner = req.user && req.user.username === row.uploader_username;
    const isAdmin = req.user && req.user.isAdmin;
    if (row.status !== "approved" && !isOwner && !isAdmin) return res.status(403).end();
    const url = await getFileUrl("audio", row.audio_filename);
    if (!url) return res.status(404).end();
    res.redirect(url);
  } catch (e) {
    console.error("[serveAudio]", e);
    res.status(500).end();
  }
});

// Music video — same gating as audio (approved, or the uploader/admin
// previewing). Optional: most tracks have no video_filename at all, and
// that 404s cleanly rather than serving anything.
router.get("/:id/video", optionalAuth, async (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id);
    if (!row || !row.video_filename) return res.status(404).end();
    const isOwner = req.user && req.user.username === row.uploader_username;
    const isAdmin = req.user && req.user.isAdmin;
    if (row.status !== "approved" && !isOwner && !isAdmin) return res.status(403).end();
    const url = await getFileUrl("videos", row.video_filename);
    if (!url) return res.status(404).end();
    res.redirect(url);
  } catch (e) {
    console.error("[serveVideo]", e);
    res.status(500).end();
  }
});

router.post("/:id/like", requireAuth, (req, res) => {
  const row = db.prepare("SELECT id FROM tracks WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  const existing = db.prepare("SELECT 1 FROM likes WHERE track_id = ? AND username = ?").get(req.params.id, req.user.username);
  if (existing) db.prepare("DELETE FROM likes WHERE track_id = ? AND username = ?").run(req.params.id, req.user.username);
  else {
    db.prepare("INSERT INTO likes (track_id, username) VALUES (?, ?)").run(req.params.id, req.user.username);
    recordActivity(req.user.username, "TRACK_LIKED", "track", req.params.id, null);
  }
  res.json({ track: shapeTrack(db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id)) });
});

router.post("/:id/save", requireAuth, (req, res) => {
  const row = db.prepare("SELECT id FROM tracks WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  const existing = db.prepare("SELECT 1 FROM saves WHERE track_id = ? AND username = ?").get(req.params.id, req.user.username);
  if (existing) db.prepare("DELETE FROM saves WHERE track_id = ? AND username = ?").run(req.params.id, req.user.username);
  else db.prepare("INSERT INTO saves (track_id, username) VALUES (?, ?)").run(req.params.id, req.user.username);
  res.json({ track: shapeTrack(db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id)) });
});

router.post("/:id/share", rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "share" }), (req, res) => {
  const row = db.prepare("SELECT id FROM tracks WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  db.prepare("UPDATE tracks SET share_count = share_count + 1 WHERE id = ?").run(req.params.id);
  res.json({ track: shapeTrack(db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id)) });
});

// Real playback signal — the client calls this once when a track's audio
// actually starts, never on hover/preview. This is what powers "Trending"
// on the home page, and (via play_events) real monthly-listener stats for
// artists; there is no synthetic play-count or listener figure anywhere.
router.post("/:id/play", optionalAuth, rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "play" }), (req, res) => {
  const row = db.prepare("SELECT id FROM tracks WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  db.prepare("UPDATE tracks SET play_count = play_count + 1 WHERE id = ?").run(req.params.id);
  db.prepare("INSERT INTO play_events (id, track_id, username, created_at) VALUES (?, ?, ?, ?)")
    .run(randomUUID(), req.params.id, (req.user && req.user.username) || null, Date.now());
  // Record activity event for personalization and analytics.
  recordActivity(req.user ? req.user.username : null, "TRACK_PLAYED", "track", req.params.id, null);
  res.json({ track: shapeTrack(db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id)) });
});

router.post("/:id/comments", requireAuth, rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "comment" }), (req, res) => {
  const row = db.prepare("SELECT id FROM tracks WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  const text = ((req.body && req.body.text) || "").trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: "Bình luận trống." });
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.user.username);
  const id = randomUUID();
  db.prepare(`INSERT INTO comments (id, track_id, username, display_name, text, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, req.params.id, user.username, user.display_name, text, Date.now());
  res.json({ track: shapeTrack(db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id)) });
});

export default router;
