/**
 * 4ANG Support Routes — Supabase PostgreSQL only.
 */
import express from "express";
import { requireAuth, requireAdmin } from "../auth.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  const { type, subject, message } = req.body || {};
  if (!subject || !message) return res.status(400).json({ error: "Thiếu chủ đề hoặc nội dung." });
  const { error } = await supabaseAdmin.from("support_tickets").insert({
    user_id: req.user.id, type: type || "general",
    subject: subject.trim().slice(0, 200), message: message.trim().slice(0, 5000),
    status: "pending", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  if (error) return res.status(500).json({ error: "Lỗi gửi yêu cầu." });
  res.status(201).json({ ok: true });
});

router.get("/mine", requireAuth, async (req, res) => {
  const { data: rows } = await supabaseAdmin
    .from("support_tickets").select("*").eq("user_id", req.user.id).order("created_at", { ascending: false });
  res.json({ tickets: rows || [] });
});

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const { data: rows } = await supabaseAdmin.from("support_tickets").select("*").order("created_at", { ascending: false });
  res.json({ tickets: rows || [] });
});

router.post("/:id/reply", requireAuth, requireAdmin, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("support_tickets").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy." });
  const reply = (req.body?.reply || "").trim().slice(0, 5000);
  if (!reply) return res.status(400).json({ error: "Cần nội dung phản hồi." });
  await supabaseAdmin.from("support_tickets").update({ admin_reply: reply, status: "open", updated_at: new Date().toISOString() }).eq("id", row.id);
  res.json({ ok: true });
});

router.post("/:id/close", requireAuth, requireAdmin, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("support_tickets").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy." });
  await supabaseAdmin.from("support_tickets").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", row.id);
  res.json({ ok: true });
});

export default router;
