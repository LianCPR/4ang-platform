/**
 * 4ANG Playlists Routes — Supabase PostgreSQL only.
 */
import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { shapePlaylist, shapePlaylistDetail, recordActivity } from "../db.js";
import { requireAuth, optionalAuth } from "../auth.js";
import { supabaseAdmin } from "../supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVER_DIR = process.env.PLAYLIST_COVER_DIR || path.join(__dirname, "..", "..", "uploads", "playlist-covers");
fs.mkdirSync(COVER_DIR, { recursive: true });

const IMAGE_EXT_BY_MIME = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };
const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, COVER_DIR),
    filename: (req, file, cb) => cb(null, randomUUID() + (IMAGE_EXT_BY_MIME[file.mimetype] || "")),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_EXT_BY_MIME[file.mimetype]) return cb(new Error("Chỉ nhận ảnh PNG, JPEG, WEBP hoặc GIF."));
    cb(null, true);
  },
});

const router = express.Router();

router.get("/mine", requireAuth, async (req, res) => {
  const { data: rows } = await supabaseAdmin
    .from("playlists").select("*").eq("owner_username", req.user.username).order("updated_at", { ascending: false });
  const playlists = await Promise.all((rows || []).map(shapePlaylist));
  res.json({ playlists });
});

router.post("/", requireAuth, async (req, res) => {
  const title = ((req.body?.title) || "").trim();
  if (!title || title.length > 100) return res.status(400).json({ error: "Tên playlist cần 1-100 ký tự." });
  const description = ((req.body?.description) || "").trim().slice(0, 500);
  const isPublic = req.body?.isPublic !== undefined ? !!req.body.isPublic : true;
  const now = new Date().toISOString();
  const { data: row, error } = await supabaseAdmin.from("playlists").insert({
    owner_username: req.user.username, title, description, is_public: isPublic,
    track_count: 0, created_at: now, updated_at: now,
  }).select("*").single();
  if (error) return res.status(500).json({ error: "Lỗi tạo playlist." });
  res.status(201).json({ playlist: await shapePlaylist(row) });
});

router.get("/:id", optionalAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("playlists").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
  if (!row.is_public && (!req.user || req.user.username !== row.owner_username)) {
    return res.status(404).json({ error: "Không tìm thấy playlist." });
  }
  const playlist = await shapePlaylistDetail(row, { includeTracks: true });
  res.json({ playlist });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("playlists").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
  if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Không có quyền chỉnh sửa playlist này." });
  const title = req.body?.title !== undefined ? String(req.body.title).trim() : row.title;
  if (!title || title.length > 100) return res.status(400).json({ error: "Tên playlist cần 1-100 ký tự." });
  const description = req.body?.description !== undefined ? String(req.body.description).trim().slice(0, 500) : row.description;
  const isPublic = req.body?.isPublic !== undefined ? !!req.body.isPublic : row.is_public;
  await supabaseAdmin.from("playlists").update({ title, description, is_public: isPublic, updated_at: new Date().toISOString() }).eq("id", row.id);
  const { data: updated } = await supabaseAdmin.from("playlists").select("*").eq("id", row.id).single();
  res.json({ playlist: await shapePlaylist(updated) });
});

router.post("/:id/cover", requireAuth, (req, res) => {
  coverUpload.single("cover")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || "Lỗi tải ảnh." });
    try {
      const { data: row } = await supabaseAdmin.from("playlists").select("*").eq("id", req.params.id).single();
      if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
      if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
      if (!req.file) return res.status(400).json({ error: "Cần chọn ảnh." });
      await supabaseAdmin.from("playlists").update({ cover_path: req.file.filename, updated_at: new Date().toISOString() }).eq("id", row.id);
      const { data: updated } = await supabaseAdmin.from("playlists").select("*").eq("id", row.id).single();
      res.json({ playlist: await shapePlaylist(updated) });
    } catch (e) {
      console.error("[playlist cover]", e);
      res.status(500).json({ error: "Lỗi tải ảnh." });
    }
  });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("playlists").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
  if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  await supabaseAdmin.from("playlist_tracks").delete().eq("playlist_id", row.id);
  await supabaseAdmin.from("playlists").delete().eq("id", row.id);
  res.json({ ok: true });
});

router.post("/:id/tracks", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("playlists").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
  if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  const { trackId } = req.body || {};
  if (!trackId) return res.status(400).json({ error: "Cần trackId." });
  const { data: existing } = await supabaseAdmin
    .from("playlist_tracks").select("id").eq("playlist_id", row.id).eq("track_id", trackId).maybeSingle();
  if (existing) return res.status(409).json({ error: "Bài hát đã có trong playlist." });

  const maxPos = row.track_count || 0;
  await supabaseAdmin.from("playlist_tracks").insert({
    playlist_id: row.id, track_id: trackId, added_by: req.user.username,
    position: maxPos, added_at: new Date().toISOString(),
  });
  await supabaseAdmin.from("playlists").update({ track_count: maxPos + 1, updated_at: new Date().toISOString() }).eq("id", row.id);
  res.json({ ok: true });
});

router.delete("/:id/tracks/:trackId", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("playlists").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
  if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  await supabaseAdmin.from("playlist_tracks").delete().eq("playlist_id", row.id).eq("track_id", req.params.trackId);
  const { count } = await supabaseAdmin.from("playlist_tracks").select("*", { count: "exact", head: true }).eq("playlist_id", row.id);
  await supabaseAdmin.from("playlists").update({ track_count: count || 0, updated_at: new Date().toISOString() }).eq("id", row.id);
  res.json({ ok: true });
});

export default router;
