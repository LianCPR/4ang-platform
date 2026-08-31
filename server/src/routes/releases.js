import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { db, shapeRelease, shapeTrack, recordActivity } from "../db.js";
import { requireAuth, optionalAuth } from "../auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVER_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "uploads");
const RELEASE_COVER_DIR = path.join(COVER_DIR, "release-covers");
fs.mkdirSync(RELEASE_COVER_DIR, { recursive: true });

const IMAGE_EXT = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, RELEASE_COVER_DIR),
    filename: (req, file, cb) => cb(null, randomUUID() + IMAGE_EXT[file.mimetype]),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_EXT[file.mimetype]) return cb(new Error("Chỉ nhận PNG, JPEG, WEBP."));
    cb(null, true);
  },
});

const VALID_TYPES = ["single", "ep", "album", "postcard"];

const router = express.Router();

// Public: list published releases
router.get("/", optionalAuth, (req, res) => {
  const type = (req.query.type || "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const clauses = ["status = 'published'"];
  const args = [];
  if (type && VALID_TYPES.includes(type)) { clauses.push("type = ?"); args.push(type); }
  const where = "WHERE " + clauses.join(" AND ");
  const rows = db.prepare(`SELECT * FROM releases ${where} ORDER BY release_date DESC, created_at DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM releases ${where}`).all(...args).reduce((s, r) => r.c, 0);
  res.json({ releases: rows.map((r) => shapeRelease(r, { includeTracks: true })), total });
});

// Public: single release detail
router.get("/:id", optionalAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy phát hành." });
  const isOwner = req.user && req.user.username === row.created_by;
  const isAdmin = req.user && req.user.isAdmin;
  if (row.status !== "published" && !isOwner && !isAdmin) return res.status(404).json({ error: "Không tìm thấy phát hành." });
  res.json({ release: shapeRelease(row, { includeTracks: true }) });
});

// Public: release cover image
router.get("/:id/cover", (req, res) => {
  const row = db.prepare("SELECT cover_filename FROM releases WHERE id = ?").get(req.params.id);
  if (!row || !row.cover_filename) return res.status(404).end();
  const filePath = path.join(RELEASE_COVER_DIR, row.cover_filename);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.sendFile(filePath);
});

// Artist: create release
router.post("/", requireAuth, (req, res) => {
  const artist = db.prepare("SELECT username FROM artist_profiles WHERE username = ?").get(req.user.username);
  if (!artist) return res.status(403).json({ error: "Bạn cần có hồ sơ nghệ sĩ." });
  const body = req.body || {};
  const title = (body.title || "").trim();
  if (!title || title.length < 2 || title.length > 120) return res.status(400).json({ error: "Tên phát hành cần 2-120 ký tự." });
  const type = (body.type || "single").trim().toLowerCase();
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: "Loại phát hành không hợp lệ." });
  const description = (body.description || "").trim().slice(0, 2000);
  const artistMessage = (body.artistMessage || "").trim().slice(0, 1000);
  const releaseDate = (body.releaseDate || "").trim();
  const label = (body.label || "").trim().slice(0, 100);
  const copyrightText = (body.copyrightText || "").trim().slice(0, 200);
  const id = randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO releases (id, title, type, description, artist_message, release_date, label, copyright_text, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`)
    .run(id, title, type, description, artistMessage, releaseDate || null, label || null, copyrightText || null, req.user.username, now, now);
  const row = db.prepare("SELECT * FROM releases WHERE id = ?").get(id);
  res.status(201).json({ release: shapeRelease(row) });
});

// Artist: update release
router.patch("/:id", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy phát hành." });
  if (row.created_by !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  const body = req.body || {};
  const title = body.title !== undefined ? String(body.title).trim() : row.title;
  const description = body.description !== undefined ? String(body.description).trim().slice(0, 2000) : row.description;
  const artistMessage = body.artistMessage !== undefined ? String(body.artistMessage).trim().slice(0, 1000) : row.artist_message;
  const releaseDate = body.releaseDate !== undefined ? String(body.releaseDate).trim() : row.release_date;
  const label = body.label !== undefined ? String(body.label).trim().slice(0, 100) : row.label;
  const copyrightText = body.copyrightText !== undefined ? String(body.copyrightText).trim().slice(0, 200) : row.copyright_text;
  db.prepare("UPDATE releases SET title = ?, description = ?, artist_message = ?, release_date = ?, label = ?, copyright_text = ?, updated_at = ? WHERE id = ?")
    .run(title, description, artistMessage, releaseDate || null, label || null, copyrightText || null, Date.now(), req.params.id);
  res.json({ release: shapeRelease(db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id)) });
});

// Artist: upload cover for release
router.post("/:id/cover", requireAuth, (req, res) => {
  coverUpload.single("cover")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Lỗi tải ảnh." });
    const row = db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Không tìm thấy phát hành." });
    if (row.created_by !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
    if (!req.file) return res.status(400).json({ error: "Cần chọn ảnh." });
    const old = row.cover_filename;
    db.prepare("UPDATE releases SET cover_filename = ?, updated_at = ? WHERE id = ?").run(req.file.filename, Date.now(), req.params.id);
    if (old) fs.unlink(path.join(RELEASE_COVER_DIR, old), () => {});
    res.json({ release: shapeRelease(db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id)) });
  });
});

// Artist: add track to release
router.post("/:id/tracks", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy phát hành." });
  if (row.created_by !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  const body = req.body || {};
  const trackId = (body.trackId || "").trim();
  if (!trackId) return res.status(400).json({ error: "Cần track ID." });
  const track = db.prepare("SELECT * FROM tracks WHERE id = ?").get(trackId);
  if (!track) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  const existing = db.prepare("SELECT 1 FROM release_tracks WHERE release_id = ? AND track_id = ?").get(req.params.id, trackId);
  if (existing) return res.status(409).json({ error: "Bài hát đã có trong phát hành." });
  const maxPos = db.prepare("SELECT COALESCE(MAX(track_number), 0) AS m FROM release_tracks WHERE release_id = ?").get(req.params.id).m;
  const id = randomUUID();
  db.prepare("INSERT INTO release_tracks (id, release_id, track_id, track_number, disc_number, created_at) VALUES (?, ?, ?, ?, 1, ?)")
    .run(id, req.params.id, trackId, maxPos + 1, Date.now());
  res.json({ release: shapeRelease(db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id), { includeTracks: true }) });
});

// Artist: remove track from release
router.delete("/:id/tracks/:trackId", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy phát hành." });
  if (row.created_by !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  db.prepare("DELETE FROM release_tracks WHERE release_id = ? AND track_id = ?").run(req.params.id, req.params.trackId);
  res.json({ release: shapeRelease(db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id), { includeTracks: true }) });
});

// Artist: submit release for review
router.post("/:id/submit", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy phát hành." });
  if (row.created_by !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  const trackCount = db.prepare("SELECT COUNT(*) AS c FROM release_tracks WHERE release_id = ?").get(req.params.id).c;
  if (trackCount === 0) return res.status(400).json({ error: "Phát hành cần ít nhất 1 bài hát." });
  db.prepare("UPDATE releases SET status = 'pending_review', updated_at = ? WHERE id = ?").run(Date.now(), req.params.id);
  res.json({ release: shapeRelease(db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id), { includeTracks: true }) });
});

// Artist: delete release (draft only)
router.delete("/:id", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy phát hành." });
  if (row.created_by !== req.user.username) return res.status(403).json({ error: "Không có quyền." });
  db.prepare("DELETE FROM release_tracks WHERE release_id = ?").run(req.params.id);
  db.prepare("DELETE FROM releases WHERE id = ?").run(req.params.id);
  if (row.cover_filename) fs.unlink(path.join(RELEASE_COVER_DIR, row.cover_filename), () => {});
  res.json({ ok: true });
});

export default router;
