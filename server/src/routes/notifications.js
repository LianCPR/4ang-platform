import express from "express";
import { db, shapeNotification } from "../db.js";
import { requireAuth } from "../auth.js";

const router = express.Router();

// --- Get user notifications ---
router.get("/", requireAuth, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
  const rows = db.prepare("SELECT * FROM notifications WHERE username = ? ORDER BY created_at DESC LIMIT ?").all(req.user.username, limit);
  const unreadCount = db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE username = ? AND read = 0").get(req.user.username).c;
  res.json({ notifications: rows.map(shapeNotification), unreadCount });
});

// --- Mark notification as read ---
router.patch("/:id/read", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM notifications WHERE id = ? AND username = ?").get(req.params.id, req.user.username);
  if (!row) return res.status(404).json({ error: "Không tìm thấy thông báo." });
  db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(row.id);
  res.json({ ok: true });
});

// --- Mark all as read ---
router.post("/read-all", requireAuth, (req, res) => {
  db.prepare("UPDATE notifications SET read = 1 WHERE username = ? AND read = 0").run(req.user.username);
  res.json({ ok: true });
});

// --- Unread count ---
router.get("/unread-count", requireAuth, (req, res) => {
  const count = db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE username = ? AND read = 0").get(req.user.username).c;
  res.json({ count });
});

export default router;
