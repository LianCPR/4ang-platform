import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { db, shapePlaylist, shapePlaylistDetail, recordActivity } from "../db.js";
import { requireAuth, optionalAuth } from "../auth.js";

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

// --- List user's own playlists ---
router.get("/mine", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM playlists WHERE owner_username = ? ORDER BY updated_at DESC").all(req.user.username);
  res.json({ playlists: rows.map(shapePlaylist) });
});

// --- Create playlist ---
router.post("/", requireAuth, (req, res) => {
  const title = ((req.body && req.body.title) || "").trim();
  if (!title || title.length > 100) return res.status(400).json({ error: "Tên playlist cần 1-100 ký tự." });
  const description = ((req.body && req.body.description) || "").trim().slice(0, 500);
  const isPublic = req.body && req.body.isPublic !== undefined ? (req.body.isPublic ? 1 : 0) : 1;
  const id = randomUUID();
  const now = Date.now();
  db.prepare("INSERT INTO playlists (id, owner_username, title, description, is_public, track_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)")
    .run(id, req.user.username, title, description, isPublic, now, now);
  const row = db.prepare("SELECT * FROM playlists WHERE id = ?").get(id);
  res.status(201).json({ playlist: shapePlaylist(row) });
});

// --- Get playlist detail (public if public, or owner only) ---
router.get("/:id", optionalAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM playlists WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
  if (!row.is_public && (!req.user || req.user.username !== row.owner_username)) {
    return res.status(404).json({ error: "Không tìm thấy playlist." });
  }
  const playlist = shapePlaylistDetail(row, {
    includeTracks: true,
    viewerUsername: req.user ? req.user.username : null,
  });
  res.json({ playlist });
});

// --- Update playlist (owner only) ---
router.patch("/:id", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM playlists WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
  if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Không có quyền chỉnh sửa playlist này." });
  const title = req.body && req.body.title !== undefined ? ((req.body.title || "").trim()) : row.title;
  if (!title || title.length > 100) return res.status(400).json({ error: "Tên playlist cần 1-100 ký tự." });
  const description = req.body && req.body.description !== undefined ? ((req.body.description || "").trim().slice(0, 500)) : row.description;
  const isPublic = req.body && req.body.isPublic !== undefined ? (req.body.isPublic ? 1 : 0) : row.is_public;
  db.prepare("UPDATE playlists SET title = ?, description = ?, is_public = ?, updated_at = ? WHERE id = ?")
    .run(title, description, isPublic, Date.now(), row.id);
  res.json({ playlist: shapePlaylist(db.prepare("SELECT * FROM playlists WHERE id = ?").get(row.id)) });
});

// --- Upload/change playlist cover (owner only) ---
router.post("/:id/cover", requireAuth, (req, res) => {
  coverUpload.single("cover")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Lỗi tải ảnh." });
    const row = db.prepare("SELECT * FROM playlists WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
    if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
    if (!req.file) return res.status(400).json({ error: "Cần chọn ảnh." });
    const old = row.cover_filename;
    db.prepare("UPDATE playlists SET cover_filename = ?, updated_at = ? WHERE id = ?").run(req.file.filename, Date.now(), row.id);
    if (old) fs.unlink(path.join(COVER_DIR, old), () => {});
    res.json({ playlist: shapePlaylist(db.prepare("SELECT * FROM playlists WHERE id = ?").get(row.id)) });
  });
});

// --- Delete playlist (owner only) ---
router.delete("/:id", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM playlists WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
  if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  db.prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?").run(row.id);
  db.prepare("DELETE FROM playlists WHERE id = ?").run(row.id);
  if (row.cover_filename) fs.unlink(path.join(COVER_DIR, row.cover_filename), () => {});
  res.json({ ok: true });
});

// --- Add track to playlist ---
router.post("/:id/tracks", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM playlists WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
  if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  const trackId = (req.body && req.body.trackId || "").trim();
  if (!trackId) return res.status(400).json({ error: "Cần chọn bài hát." });
  const track = db.prepare("SELECT id FROM tracks WHERE id = ? AND status = 'approved'").get(trackId);
  if (!track) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  const existing = db.prepare("SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?").get(row.id, trackId);
  if (existing) return res.status(409).json({ error: "Bài hát đã có trong playlist." });
  if (row.track_count >= 500) return res.status(400).json({ error: "Playlist đã đạt giới hạn 500 bài." });
  const maxPos = db.prepare("SELECT COALESCE(MAX(position), -1) AS pos FROM playlist_tracks WHERE playlist_id = ?").get(row.id).pos;
  db.prepare("INSERT INTO playlist_tracks (id, playlist_id, track_id, added_by, position, added_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), row.id, trackId, req.user.username, maxPos + 1, Date.now());
  db.prepare("UPDATE playlists SET track_count = track_count + 1, updated_at = ? WHERE id = ?").run(Date.now(), row.id);
  res.json({ playlist: shapePlaylistDetail(db.prepare("SELECT * FROM playlists WHERE id = ?").get(row.id), { includeTracks: true }) });
});

// --- Remove track from playlist ---
router.delete("/:id/tracks/:trackId", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM playlists WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
  if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  const pt = db.prepare("SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?").get(row.id, req.params.trackId);
  if (!pt) return res.status(404).json({ error: "Bài hát không có trong playlist." });
  db.prepare("DELETE FROM playlist_tracks WHERE id = ?").run(pt.id);
  db.prepare("UPDATE playlists SET track_count = MAX(track_count - 1, 0), updated_at = ? WHERE id = ?").run(Date.now(), row.id);
  // Re-index positions
  const tracks = db.prepare("SELECT id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC").all(row.id);
  const updatePos = db.prepare("UPDATE playlist_tracks SET position = ? WHERE id = ?");
  tracks.forEach((t, i) => updatePos.run(i, t.id));
  res.json({ playlist: shapePlaylistDetail(db.prepare("SELECT * FROM playlists WHERE id = ?").get(row.id), { includeTracks: true }) });
});

// --- Reorder tracks in playlist ---
router.put("/:id/tracks/reorder", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM playlists WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy playlist." });
  if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  const order = req.body && Array.isArray(req.body.order) ? req.body.order : [];
  if (order.length === 0) return res.status(400).json({ error: "Thứ tự không hợp lệ." });
  // Validate all IDs belong to this playlist
  const existing = db.prepare("SELECT id FROM playlist_tracks WHERE playlist_id = ?").all(row.id).map((r) => r.id);
  const orderSet = new Set(order);
  if (order.length !== existing.length || !existing.every((id) => orderSet.has(id))) {
    return res.status(400).json({ error: "Danh sách thứ tự không khớp." });
  }
  const updatePos = db.prepare("UPDATE playlist_tracks SET position = ? WHERE id = ?");
  order.forEach((id, i) => updatePos.run(i, id));
  db.prepare("UPDATE playlists SET updated_at = ? WHERE id = ?").run(Date.now(), row.id);
  res.json({ playlist: shapePlaylistDetail(db.prepare("SELECT * FROM playlists WHERE id = ?").get(row.id), { includeTracks: true }) });
});

// --- Public playlists (discoverable) ---
router.get("/", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const rows = db.prepare("SELECT * FROM playlists WHERE is_public = 1 ORDER BY track_count DESC, updated_at DESC LIMIT ?").all(limit);
  res.json({ playlists: rows.map(shapePlaylist) });
});

// --- Playlist covers (static) ---
export const PLAYLIST_COVER_DIR = COVER_DIR;

export default router;
