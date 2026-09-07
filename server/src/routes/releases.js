/**
 * 4ANG Releases Routes — Supabase PostgreSQL only.
 */
import express from "express";
import { randomUUID } from "node:crypto";
import { shapeRelease, shapeTrack, recordActivity } from "../db.js";
import { requireAuth, optionalAuth } from "../auth.js";
import { supabaseAdmin } from "../supabase.js";

const VALID_TYPES = ["single", "ep", "album"];
const router = express.Router();

router.get("/", optionalAuth, async (req, res) => {
  const type = (req.query.type || "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  let query = supabaseAdmin.from("releases").select("*", { count: "exact" }).eq("status", "published").order("release_date", { ascending: false }).range(offset, offset + limit - 1);
  if (type && VALID_TYPES.includes(type)) query = query.eq("type", type);
  const { data: rows, count } = await query;
  const releases = await Promise.all((rows || []).map(r => shapeRelease(r, { includeTracks: true })));
  res.json({ releases, total: count || 0 });
});

router.get("/mine", requireAuth, async (req, res) => {
  const { data: rows } = await supabaseAdmin
    .from("releases").select("*").eq("created_by_username", req.user.username)
    .order("created_at", { ascending: false });
  if (!rows || rows.length === 0) return res.json({ releases: [] });
  res.json({ releases: await Promise.all(rows.map((r) => shapeRelease(r))) });
});

router.get("/:id", optionalAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("releases").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy phát hành." });
  const isOwner = req.user && req.user.username === row.created_by_username;
  const isAdmin = req.user && req.user.isAdmin;
  if (row.status !== "published" && !isOwner && !isAdmin) return res.status(404).json({ error: "Không tìm thấy phát hành." });
  res.json({ release: await shapeRelease(row, { includeTracks: true }) });
});

router.post("/", requireAuth, async (req, res) => {
  const { data: artist } = await supabaseAdmin.from("artist_profiles").select("username").eq("username", req.user.username).maybeSingle();
  if (!artist) return res.status(403).json({ error: "Bạn cần có hồ sơ nghệ sĩ." });
  const body = req.body || {};
  const title = (body.title || "").trim();
  if (!title || title.length < 2 || title.length > 120) return res.status(400).json({ error: "Tên phát hành cần 2-120 ký tự." });
  const type = (body.type || "single").trim().toLowerCase();
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: "Loại phát hành không hợp lệ." });
  const now = new Date().toISOString();
  const { data: row, error } = await supabaseAdmin.from("releases").insert({
    title, type, description: (body.description || "").trim().slice(0, 2000),
    release_date: body.releaseDate?.trim() || null,
    status: "draft", created_by: req.user.id, created_by_username: req.user.username,
    created_at: now, updated_at: now,
  }).select("*").single();
  if (error) { console.error("[release create] " + (error.message || error)); return res.status(500).json({ error: "Lỗi tạo phát hành." }); }
  res.status(201).json({ release: await shapeRelease(row) });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("releases").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy phát hành." });
  if (row.created_by_username !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  const body = req.body || {};
  const updates = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.description !== undefined) updates.description = String(body.description).trim().slice(0, 2000);
  if (body.releaseDate !== undefined) updates.release_date = String(body.releaseDate).trim() || null;
  await supabaseAdmin.from("releases").update(updates).eq("id", row.id);
  const { data: updated } = await supabaseAdmin.from("releases").select("*").eq("id", row.id).single();
  res.json({ release: await shapeRelease(updated) });
});

router.post("/:id/submit", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("releases").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy phát hành." });
  if (row.created_by_username !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  if (row.status !== "draft") return res.status(409).json({ error: "Chỉ có thể gửi bản nháp." });
  await supabaseAdmin.from("releases").update({ status: "pending_review", updated_at: new Date().toISOString() }).eq("id", row.id);
  res.json({ ok: true });
});

export default router;
