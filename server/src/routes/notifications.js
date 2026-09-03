/**
 * 4ANG Notifications Routes — Supabase PostgreSQL only.
 */
import express from "express";
import { shapeNotification } from "../db.js";
import { requireAuth } from "../auth.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
  const { data: rows } = await supabaseAdmin
    .from("notifications").select("*").eq("username", req.user.username)
    .order("created_at", { ascending: false }).limit(limit);
  const { count: unreadCount } = await supabaseAdmin
    .from("notifications").select("*", { count: "exact", head: true })
    .eq("username", req.user.username).eq("is_read", false);
  res.json({ notifications: (rows || []).map(shapeNotification), unreadCount: unreadCount || 0 });
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin
    .from("notifications").select("id").eq("id", req.params.id).eq("username", req.user.username).maybeSingle();
  if (!row) return res.status(404).json({ error: "Không tìm thấy thông báo." });
  await supabaseAdmin.from("notifications").update({ is_read: true }).eq("id", row.id);
  res.json({ ok: true });
});

router.post("/read-all", requireAuth, async (req, res) => {
  await supabaseAdmin.from("notifications").update({ is_read: true }).eq("username", req.user.username).eq("is_read", false);
  res.json({ ok: true });
});

router.get("/unread-count", requireAuth, async (req, res) => {
  const { count } = await supabaseAdmin
    .from("notifications").select("*", { count: "exact", head: true })
    .eq("username", req.user.username).eq("is_read", false);
  res.json({ count: count || 0 });
});

export default router;
