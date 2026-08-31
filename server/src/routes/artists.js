import express from "express";
import multer from "multer";
import { db, shapeTrack, shapeArtistProfile, recordAdminAudit, createNotification, recordActivity } from "../db.js";
import { requireAuth, optionalAuth, requireAdmin } from "../auth.js";
import { uploadFile, deleteFile, getFileUrl, MAX_COVER_BYTES } from "../storage.js";

const IMAGE_EXT_BY_MIME = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };

// Memory storage — upload to Supabase Storage after multer reads buffer.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COVER_BYTES },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_EXT_BY_MIME[file.mimetype]) return cb(new Error("Chỉ nhận ảnh PNG, JPEG, WEBP hoặc GIF."));
    cb(null, true);
  },
});

// A fixed list rather than free-text tagging — keeps genres meaningful and
// filterable instead of open spam (mirrors client/src/lib/genres.js).
export const GENRES = ["Pop", "Ballad", "Rap/Hip-hop", "R&B", "Rock", "EDM/Dance", "Acoustic", "Bolero", "Indie", "Nhạc trẻ", "Nhạc trữ tình", "Khác"];

const router = express.Router();

function validateArtistInput(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.artistName !== undefined) {
    const name = (body.artistName || "").trim();
    if (!name) return { error: "Cần tên nghệ sĩ." };
    if (name.length < 2 || name.length > 60) return { error: "Tên nghệ sĩ cần 2-60 ký tự." };
    out.artistName = name;
  }
  if (!partial || body.bio !== undefined) {
    const bio = (body.bio || "").trim();
    if (bio.length > 1000) return { error: "Giới thiệu tối đa 1000 ký tự." };
    out.bio = bio;
  }
  if (!partial || body.genres !== undefined) {
    const genres = Array.isArray(body.genres) ? body.genres.filter((g) => GENRES.includes(g)) : [];
    out.genres = genres.slice(0, 5);
  }
  if (!partial || body.links !== undefined) {
    const links = Array.isArray(body.links) ? body.links : [];
    const cleaned = [];
    for (const link of links.slice(0, 5)) {
      const label = String(link?.label || "").trim().slice(0, 30);
      const url = String(link?.url || "").trim();
      if (!label || !/^https?:\/\/.+/.test(url)) return { error: "Mỗi liên kết cần tên và URL hợp lệ (http/https)." };
      cleaned.push({ label, url });
    }
    out.links = cleaned;
  }
  return { value: out };
}

// Real stats only — computed from actual rows, never invented. Empty
// results become 0 / [] rather than a fake placeholder number.
function computeArtistStats(username) {
  const trackRows = db.prepare("SELECT * FROM tracks WHERE uploader_username = ? AND status = 'approved' ORDER BY play_count DESC").all(username);
  const totalPlays = trackRows.reduce((sum, t) => sum + (t.play_count || 0), 0);
  const followers = db.prepare("SELECT COUNT(*) AS c FROM artist_follows WHERE artist_username = ?").get(username).c;
  const trackIds = trackRows.map((t) => t.id);
  let monthlyListeners = 0;
  let recentPlays = [];
  if (trackIds.length > 0) {
    const placeholders = trackIds.map(() => "?").join(",");
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    monthlyListeners = db.prepare(
      `SELECT COUNT(DISTINCT username) AS c FROM play_events WHERE track_id IN (${placeholders}) AND created_at >= ? AND username IS NOT NULL`
    ).get(...trackIds, since).c;
    recentPlays = db.prepare(
      `SELECT track_id, username, created_at FROM play_events WHERE track_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 15`
    ).all(...trackIds);
  }
  return {
    totalPlays,
    followers,
    monthlyListeners,
    topTracks: trackRows.slice(0, 10).map(shapeTrack),
    recentPlays: recentPlays.map((p) => ({
      trackTitle: (trackRows.find((t) => t.id === p.track_id) || {}).title || "",
      username: p.username,
      createdAt: p.created_at,
    })),
  };
}

router.post("/", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT username FROM artist_profiles WHERE username = ?").get(req.user.username);
  if (existing) return res.status(409).json({ error: "Bạn đã có hồ sơ nghệ sĩ rồi." });
  const { error, value } = validateArtistInput(req.body || {});
  if (error) return res.status(400).json({ error });
  db.prepare(`INSERT INTO artist_profiles (username, artist_name, bio, genres, links, verification_status, created_at)
              VALUES (?, ?, ?, ?, ?, 'independent', ?)`)
    .run(req.user.username, value.artistName, value.bio, JSON.stringify(value.genres), JSON.stringify(value.links), Date.now());
  const row = db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.user.username);
  res.status(201).json({ artist: shapeArtistProfile(row) });
});

router.get("/me", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.user.username);
  if (!row) return res.status(404).json({ error: "Bạn chưa có hồ sơ nghệ sĩ." });
  res.json({ artist: shapeArtistProfile(row, computeArtistStats(req.user.username)) });
});

router.get("/me/stats", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.user.username);
  if (!row) return res.status(404).json({ error: "Bạn chưa có hồ sơ nghệ sĩ." });
  const stats = computeArtistStats(req.user.username);
  const { recentPlays, ...publicStats } = stats;

  // Submission stats
  const submissions = db.prepare("SELECT status, COUNT(*) AS c FROM submissions WHERE artist_username = ? GROUP BY status").all(req.user.username);
  const submissionMap = {};
  for (const s of submissions) submissionMap[s.status] = s.c;

  // Top tracks by plays in last 30 days
  const trackIds = (stats.topTracks || []).map((t) => t.id);
  let trackPlayHistory = [];
  if (trackIds.length > 0) {
    const placeholders = trackIds.map(() => "?").join(",");
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    trackPlayHistory = db.prepare(
      `SELECT track_id, COUNT(*) AS plays FROM play_events WHERE track_id IN (${placeholders}) AND created_at >= ? GROUP BY track_id ORDER BY plays DESC`
    ).all(...trackIds, since);
  }

  // Plays per day (last 14 days) for sparkline
  const dailyPlays = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    let count = 0;
    if (trackIds.length > 0) {
      const placeholders = trackIds.map(() => "?").join(",");
      count = db.prepare(
        `SELECT COUNT(*) AS c FROM play_events WHERE track_id IN (${placeholders}) AND created_at >= ? AND created_at < ?`
      ).get(...trackIds, dayStart.getTime(), dayEnd.getTime()).c;
    }
    dailyPlays.push({ date: dayStart.toISOString().slice(0, 10), plays: count });
  }

  res.json({ ...publicStats, submissions: submissionMap, trackPlayHistory, dailyPlays });
});

router.patch("/me", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.user.username);
  if (!row) return res.status(404).json({ error: "Bạn chưa có hồ sơ nghệ sĩ." });
  const { error, value } = validateArtistInput(req.body || {}, { partial: true });
  if (error) return res.status(400).json({ error });
  const merged = {
    artistName: value.artistName ?? row.artist_name,
    bio: value.bio ?? row.bio,
    genres: JSON.stringify(value.genres ?? JSON.parse(row.genres || "[]")),
    links: JSON.stringify(value.links ?? JSON.parse(row.links || "[]")),
  };
  db.prepare("UPDATE artist_profiles SET artist_name = ?, bio = ?, genres = ?, links = ? WHERE username = ?")
    .run(merged.artistName, merged.bio, merged.genres, merged.links, req.user.username);
  res.json({ artist: shapeArtistProfile(db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.user.username)) });
});

router.post("/me/avatar", requireAuth, (req, res) => {
  imageUpload.single("avatar")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || "Lỗi tải ảnh." });
    try {
      const row = db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.user.username);
      if (!row) return res.status(404).json({ error: "Bạn chưa có hồ sơ nghệ sĩ." });
      if (!req.file) return res.status(400).json({ error: "Cần chọn ảnh." });
      const old = row.avatar_filename;
      const filePath = await uploadFile("artist-images", req.user.username, req.file.buffer, req.file.mimetype, req.file.originalname);
      db.prepare("UPDATE artist_profiles SET avatar_filename = ? WHERE username = ?").run(filePath.path, req.user.username);
      if (old) deleteFile("artist-images", old);
      res.json({ artist: shapeArtistProfile(db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.user.username)) });
    } catch (e) {
      console.error("[avatar upload]", e);
      res.status(500).json({ error: "Lỗi tải ảnh lên." });
    }
  });
});

router.post("/me/cover", requireAuth, (req, res) => {
  imageUpload.single("cover")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || "Lỗi tải ảnh." });
    try {
      const row = db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.user.username);
      if (!row) return res.status(404).json({ error: "Bạn chưa có hồ sơ nghệ sĩ." });
      if (!req.file) return res.status(400).json({ error: "Cần chọn ảnh." });
      const old = row.cover_filename;
      const filePath = await uploadFile("artist-images", req.user.username, req.file.buffer, req.file.mimetype, req.file.originalname);
      db.prepare("UPDATE artist_profiles SET cover_filename = ? WHERE username = ?").run(filePath.path, req.user.username);
      if (old) deleteFile("artist-images", old);
      res.json({ artist: shapeArtistProfile(db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.user.username)) });
    } catch (e) {
      console.error("[cover upload]", e);
      res.status(500).json({ error: "Lỗi tải ảnh lên." });
    }
  });
});

router.post("/me/verification-request", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.user.username);
  if (!row) return res.status(404).json({ error: "Bạn chưa có hồ sơ nghệ sĩ." });
  if (row.verification_status === "pending") return res.status(409).json({ error: "Yêu cầu xác minh đang chờ xử lý." });
  if (row.verification_status === "verified") return res.status(409).json({ error: "Tài khoản đã được xác minh." });
  db.prepare("UPDATE artist_profiles SET verification_status = 'pending', verification_requested_at = ?, verification_note = NULL WHERE username = ?")
    .run(Date.now(), req.user.username);
  res.json({ artist: shapeArtistProfile(db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.user.username)) });
});

// Backs the submission Artist Credits selector (§14/§54) — real registered
// profiles only, never free text, so a "Producer" credit is exactly as
// reliable as any other structured artist reference in the app. Public:
// artist names are already public on their profile pages.
router.get("/search", (req, res) => {
  const q = ((req.query.q || "") + "").trim();
  if (q.length < 1) return res.json({ artists: [] });
  const like = "%" + q.replace(/[%_]/g, "") + "%";
  const rows = db.prepare(
    "SELECT username, artist_name, avatar_filename, verification_status FROM artist_profiles WHERE artist_name LIKE ? OR username LIKE ? ORDER BY artist_name ASC LIMIT 8"
  ).all(like, like);
  res.json({
    artists: rows.map((r) => ({
      username: r.username,
      artistName: r.artist_name,
      avatarUrl: r.avatar_filename ? "/api/artist-images/" + r.avatar_filename : null,
      badge: r.verification_status === "verified" ? "verified" : "independent",
    })),
  });
});

router.get("/:username", optionalAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.params.username);
  if (!row) return res.status(404).json({ error: "Không tìm thấy nghệ sĩ." });
  const isFollowing = !!(req.user && db.prepare("SELECT 1 FROM artist_follows WHERE follower_username = ? AND artist_username = ?").get(req.user.username, req.params.username));
  const { recentPlays, ...publicStats } = computeArtistStats(req.params.username);
  res.json({ artist: shapeArtistProfile(row, { ...publicStats, isFollowing, isOwner: !!(req.user && req.user.username === req.params.username) }) });
});

router.post("/:username/follow", requireAuth, (req, res) => {
  if (req.user.username === req.params.username) return res.status(400).json({ error: "Không thể tự theo dõi chính mình." });
  const artist = db.prepare("SELECT username FROM artist_profiles WHERE username = ?").get(req.params.username);
  if (!artist) return res.status(404).json({ error: "Không tìm thấy nghệ sĩ." });
  const existing = db.prepare("SELECT 1 FROM artist_follows WHERE follower_username = ? AND artist_username = ?").get(req.user.username, req.params.username);
  if (!existing) {
    db.prepare("INSERT INTO artist_follows (follower_username, artist_username, created_at) VALUES (?, ?, ?)")
      .run(req.user.username, req.params.username, Date.now());
    recordActivity(req.user.username, "ARTIST_FOLLOWED", "artist", req.params.username, null);
    // Notify the artist they got a new follower
    const follower = db.prepare("SELECT display_name FROM users WHERE username = ?").get(req.user.username);
    const artistProfile = db.prepare("SELECT artist_name FROM artist_profiles WHERE username = ?").get(req.params.username);
    createNotification(req.params.username, "ARTIST_FOLLOWED", "Người mới theo dõi", (follower ? follower.display_name : req.user.username) + " đã theo dõi bạn.", { actorUsername: req.user.username, targetType: "artist", targetId: req.params.username });
  }
  res.json({ isFollowing: true, followers: db.prepare("SELECT COUNT(*) AS c FROM artist_follows WHERE artist_username = ?").get(req.params.username).c });
});

router.delete("/:username/follow", requireAuth, (req, res) => {
  db.prepare("DELETE FROM artist_follows WHERE follower_username = ? AND artist_username = ?").run(req.user.username, req.params.username);
  res.json({ isFollowing: false, followers: db.prepare("SELECT COUNT(*) AS c FROM artist_follows WHERE artist_username = ?").get(req.params.username).c });
});

// Backs the real (not invented) "New from Artists You Follow" home
// section (Phase 7, Part 7) — the actual list of artist_follows rows for
// this listener, nothing more.
router.get("/me/following", requireAuth, (req, res) => {
  const rows = db.prepare(
    "SELECT artist_username FROM artist_follows WHERE follower_username = ? ORDER BY created_at DESC"
  ).all(req.user.username);
  res.json({ usernames: rows.map((r) => r.artist_username) });
});

// Admin review — the actions exist and are fully protected now; the
// polished review UI/queue is Phase 7. A capability being real doesn't
// require a dashboard around it yet.
router.post("/:username/verify", requireAuth, requireAdmin, (req, res) => {
  const row = db.prepare("SELECT username FROM artist_profiles WHERE username = ?").get(req.params.username);
  if (!row) return res.status(404).json({ error: "Không tìm thấy nghệ sĩ." });
  db.prepare("UPDATE artist_profiles SET verification_status = 'verified', verified_at = ?, verification_note = NULL WHERE username = ?")
    .run(Date.now(), req.params.username);
  recordAdminAudit(req.user.username, "artist_verified", "artist", req.params.username, null);
  res.json({ artist: shapeArtistProfile(db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.params.username)) });
});

router.post("/:username/reject", requireAuth, requireAdmin, (req, res) => {
  const row = db.prepare("SELECT username FROM artist_profiles WHERE username = ?").get(req.params.username);
  if (!row) return res.status(404).json({ error: "Không tìm thấy nghệ sĩ." });
  const note = (req.body && req.body.note ? String(req.body.note) : "").trim().slice(0, 500);
  db.prepare("UPDATE artist_profiles SET verification_status = 'rejected', verification_note = ? WHERE username = ?")
    .run(note || null, req.params.username);
  recordAdminAudit(req.user.username, "artist_verification_rejected", "artist", req.params.username, { note: note || null });
  res.json({ artist: shapeArtistProfile(db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.params.username)) });
});

export default router;
