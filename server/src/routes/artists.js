/**
 * 4ANG Artists Routes — Supabase PostgreSQL only.
 */
import express from "express";
import multer from "multer";
import { shapeTrack, shapeArtistProfile, recordAdminAudit, createNotification, recordActivity } from "../db.js";
import { requireAuth, optionalAuth, requireAdmin } from "../auth.js";
import { uploadFile, deleteFile, MAX_COVER_BYTES } from "../storage.js";
import { supabaseAdmin } from "../supabase.js";

const IMAGE_EXT_BY_MIME = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COVER_BYTES },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_EXT_BY_MIME[file.mimetype]) return cb(new Error("Chỉ nhận ảnh PNG, JPEG, WEBP hoặc GIF."));
    cb(null, true);
  },
});

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
    const genres = Array.isArray(body.genres) ? body.genres.filter(g => GENRES.includes(g)) : [];
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

async function computeArtistStats(username) {
  const { data: trackRows } = await supabaseAdmin
    .from("tracks").select("*")
    .eq("uploader_username", username).eq("status", "approved")
    .order("play_count", { ascending: false });

  const totalPlays = (trackRows || []).reduce((sum, t) => sum + (t.play_count || 0), 0);
  const { count: followers } = await supabaseAdmin
    .from("artist_follows").select("*", { count: "exact", head: true })
    .eq("artist_username", username);

  return {
    totalPlays,
    followers: followers || 0,
    monthlyListeners: 0,
    topTracks: await Promise.all((trackRows || []).slice(0, 10).map(shapeTrack)),
    recentPlays: [],
  };
}

// Create artist profile
router.post("/", requireAuth, async (req, res) => {
  const { data: existing } = await supabaseAdmin
    .from("artist_profiles").select("username").eq("username", req.user.username).maybeSingle();
  if (existing) return res.status(409).json({ error: "Bạn đã có hồ sơ nghệ sĩ rồi." });

  const { error, value } = validateArtistInput(req.body || {});
  if (error) return res.status(400).json({ error });

  const { data: row, error: insertErr } = await supabaseAdmin.from("artist_profiles").insert({
    user_id: req.user.id,
    username: req.user.username,
    artist_name: value.artistName,
    bio: value.bio,
    genres: value.genres,
    links: value.links,
    verification_status: "independent",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select("*").single();

  if (insertErr) {
    console.error("[artist create]", insertErr.message);
    return res.status(500).json({ error: "Lỗi tạo hồ sơ nghệ sĩ." });
  }
  res.status(201).json({ artist: shapeArtistProfile(row) });
});

// My artist profile
router.get("/me", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin
    .from("artist_profiles").select("*").eq("username", req.user.username).single();
  if (!row) return res.status(404).json({ error: "Bạn chưa có hồ sơ nghệ sĩ." });
  const stats = await computeArtistStats(req.user.username);
  res.json({ artist: shapeArtistProfile(row, stats) });
});

// My artist stats
router.get("/me/stats", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin
    .from("artist_profiles").select("*").eq("username", req.user.username).single();
  if (!row) return res.status(404).json({ error: "Bạn chưa có hồ sơ nghệ sĩ." });
  const stats = await computeArtistStats(req.user.username);

  // Submission stats
  const { data: submissions } = await supabaseAdmin
    .from("submissions").select("status").eq("artist_username", req.user.username);
  const submissionMap = {};
  for (const s of (submissions || [])) submissionMap[s.status] = (submissionMap[s.status] || 0) + 1;

  res.json({ ...stats, submissions: submissionMap, trackPlayHistory: [], dailyPlays: [] });
});

// Update artist profile
router.patch("/me", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin
    .from("artist_profiles").select("*").eq("username", req.user.username).single();
  if (!row) return res.status(404).json({ error: "Bạn chưa có hồ sơ nghệ sĩ." });

  const { error, value } = validateArtistInput(req.body || {}, { partial: true });
  if (error) return res.status(400).json({ error });

  const updates = { updated_at: new Date().toISOString() };
  if (value.artistName !== undefined) updates.artist_name = value.artistName;
  if (value.bio !== undefined) updates.bio = value.bio;
  if (value.genres !== undefined) updates.genres = value.genres;
  if (value.links !== undefined) updates.links = value.links;

  await supabaseAdmin.from("artist_profiles").update(updates).eq("username", req.user.username);
  const { data: updated } = await supabaseAdmin.from("artist_profiles").select("*").eq("username", req.user.username).single();
  res.json({ artist: shapeArtistProfile(updated) });
});

// Upload avatar
router.post("/me/avatar", requireAuth, (req, res) => {
  imageUpload.single("avatar")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || "Lỗi tải ảnh." });
    try {
      const { data: row } = await supabaseAdmin.from("artist_profiles").select("*").eq("username", req.user.username).single();
      if (!row) return res.status(404).json({ error: "Bạn chưa có hồ sơ nghệ sĩ." });
      if (!req.file) return res.status(400).json({ error: "Cần chọn ảnh." });
      const filePath = await uploadFile("avatars", req.user.username, req.file.buffer, req.file.mimetype, req.file.originalname);
      await supabaseAdmin.from("artist_profiles").update({ avatar_url: filePath.url || filePath.path, updated_at: new Date().toISOString() }).eq("username", req.user.username);
      if (row.avatar_url && row.avatar_url.startsWith("http")) deleteFile("avatars", row.avatar_url);
      const { data: updated } = await supabaseAdmin.from("artist_profiles").select("*").eq("username", req.user.username).single();
      res.json({ artist: shapeArtistProfile(updated) });
    } catch (e) {
      console.error("[avatar upload]", e);
      res.status(500).json({ error: "Lỗi tải ảnh lên." });
    }
  });
});

// Upload cover
router.post("/me/cover", requireAuth, (req, res) => {
  imageUpload.single("cover")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || "Lỗi tải ảnh." });
    try {
      const { data: row } = await supabaseAdmin.from("artist_profiles").select("*").eq("username", req.user.username).single();
      if (!row) return res.status(404).json({ error: "Bạn chưa có hồ sơ nghệ sĩ." });
      if (!req.file) return res.status(400).json({ error: "Cần chọn ảnh." });
      const filePath = await uploadFile("artwork", req.user.username, req.file.buffer, req.file.mimetype, req.file.originalname);
      await supabaseAdmin.from("artist_profiles").update({ cover_url: filePath.url || filePath.path, updated_at: new Date().toISOString() }).eq("username", req.user.username);
      if (row.cover_url && row.cover_url.startsWith("http")) deleteFile("artwork", row.cover_url);
      const { data: updated } = await supabaseAdmin.from("artist_profiles").select("*").eq("username", req.user.username).single();
      res.json({ artist: shapeArtistProfile(updated) });
    } catch (e) {
      console.error("[cover upload]", e);
      res.status(500).json({ error: "Lỗi tải ảnh lên." });
    }
  });
});

// Request verification
router.post("/me/verification-request", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("artist_profiles").select("*").eq("username", req.user.username).single();
  if (!row) return res.status(404).json({ error: "Bạn chưa có hồ sơ nghệ sĩ." });
  if (row.verification_status === "pending") return res.status(409).json({ error: "Yêu cầu xác minh đang chờ xử lý." });
  if (row.verification_status === "verified") return res.status(409).json({ error: "Tài khoản đã được xác minh." });

  await supabaseAdmin.from("artist_profiles").update({
    verification_status: "pending",
    verification_requested_at: new Date().toISOString(),
    verification_note: null,
    updated_at: new Date().toISOString(),
  }).eq("username", req.user.username);

  const { data: updated } = await supabaseAdmin.from("artist_profiles").select("*").eq("username", req.user.username).single();
  res.json({ artist: shapeArtistProfile(updated) });
});

// All artists (onboarding / discovery)
router.get("/all", async (req, res) => {
  const { data: rows } = await supabaseAdmin
    .from("artist_profiles").select("*").order("artist_name");
  const artists = await Promise.all((rows || []).map(async (r) => {
    const { count: followerCount } = await supabaseAdmin
      .from("artist_follows").select("*", { count: "exact", head: true })
      .eq("artist_username", r.username);
    return {
      username: r.username,
      artistName: r.artist_name,
      avatarUrl: r.avatar_url || null,
      coverUrl: r.cover_url || null,
      bio: r.bio || "",
      genres: r.genres || [],
      verificationStatus: r.verification_status,
      followerCount: followerCount || 0,
    };
  }));
  // Sort by follower count desc
  artists.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));
  res.json({ artists });
});

// Search artists
router.get("/search", async (req, res) => {
  const q = ((req.query.q || "") + "").trim();
  if (q.length < 1) return res.json({ artists: [] });
  const { data: rows } = await supabaseAdmin
    .from("artist_profiles").select("username, artist_name, avatar_url, verification_status")
    .or(`artist_name.ilike.%${q}%,username.ilike.%${q}%`)
    .order("artist_name").limit(8);
  res.json({
    artists: (rows || []).map(r => ({
      username: r.username,
      artistName: r.artist_name,
      avatarUrl: r.avatar_url || null,
      badge: r.verification_status === "verified" ? "verified" : "independent",
    })),
  });
});

// Get artist by username
router.get("/:username", optionalAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("artist_profiles").select("*").eq("username", req.params.username).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy nghệ sĩ." });

  let isFollowing = false;
  if (req.user) {
    const { data } = await supabaseAdmin
      .from("artist_follows").select("follower_id").eq("follower_username", req.user.username).eq("artist_username", req.params.username).maybeSingle();
    isFollowing = !!data;
  }

  const stats = await computeArtistStats(req.params.username);
  res.json({ artist: shapeArtistProfile(row, { ...stats, isFollowing, isOwner: !!(req.user && req.user.username === req.params.username) }) });
});

// Follow
router.post("/:username/follow", requireAuth, async (req, res) => {
  if (req.user.username === req.params.username) return res.status(400).json({ error: "Không thể tự theo dõi chính mình." });
  const { data: artist } = await supabaseAdmin.from("artist_profiles").select("username").eq("username", req.params.username).single();
  if (!artist) return res.status(404).json({ error: "Không tìm thấy nghệ sĩ." });

  const { data: existing } = await supabaseAdmin
    .from("artist_follows").select("follower_id").eq("follower_username", req.user.username).eq("artist_username", req.params.username).maybeSingle();

  if (!existing) {
    await supabaseAdmin.from("artist_follows").insert({
      follower_id: req.user.id, artist_id: artist.user_id,
      follower_username: req.user.username, artist_username: req.params.username,
      created_at: new Date().toISOString(),
    });
    await recordActivity(req.user.username, "ARTIST_FOLLOWED", "artist", req.params.username, null);

    const { data: follower } = await supabaseAdmin.from("profiles").select("display_name").eq("username", req.user.username).maybeSingle();
    const { data: ap } = await supabaseAdmin.from("artist_profiles").select("artist_name").eq("username", req.params.username).maybeSingle();
    createNotification(req.params.username, "ARTIST_FOLLOWED", "Người mới theo dõi",
      (follower?.display_name || req.user.username) + " đã theo dõi bạn.",
      { actorUsername: req.user.username, targetType: "artist", targetId: req.params.username });
  }

  const { count: followers } = await supabaseAdmin
    .from("artist_follows").select("*", { count: "exact", head: true }).eq("artist_username", req.params.username);
  res.json({ isFollowing: true, followers: followers || 0 });
});

// Unfollow
router.delete("/:username/follow", requireAuth, async (req, res) => {
  await supabaseAdmin.from("artist_follows")
    .delete().eq("follower_username", req.user.username).eq("artist_username", req.params.username);
  const { count: followers } = await supabaseAdmin
    .from("artist_follows").select("*", { count: "exact", head: true }).eq("artist_username", req.params.username);
  res.json({ isFollowing: false, followers: followers || 0 });
});

// Following list
router.get("/me/following", requireAuth, async (req, res) => {
  const { data: rows } = await supabaseAdmin
    .from("artist_follows").select("artist_username").eq("follower_username", req.user.username)
    .order("created_at", { ascending: false });
  res.json({ usernames: (rows || []).map(r => r.artist_username) });
});

// Admin: verify artist
router.post("/:username/verify", requireAuth, requireAdmin, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("artist_profiles").select("username").eq("username", req.params.username).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy nghệ sĩ." });
  await supabaseAdmin.from("artist_profiles").update({
    verification_status: "verified", verified_at: new Date().toISOString(), verification_note: null, updated_at: new Date().toISOString(),
  }).eq("username", req.params.username);
  await recordAdminAudit(req.user.username, "artist_verified", "artist", req.params.username, null);
  const { data: updated } = await supabaseAdmin.from("artist_profiles").select("*").eq("username", req.params.username).single();
  res.json({ artist: shapeArtistProfile(updated) });
});

// Admin: reject artist
router.post("/:username/reject", requireAuth, requireAdmin, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("artist_profiles").select("username").eq("username", req.params.username).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy nghệ sĩ." });
  const note = (req.body?.note || "").trim().slice(0, 500);
  await supabaseAdmin.from("artist_profiles").update({
    verification_status: "rejected", verification_note: note || null, updated_at: new Date().toISOString(),
  }).eq("username", req.params.username);
  await recordAdminAudit(req.user.username, "artist_verification_rejected", "artist", req.params.username, { note: note || null });
  const { data: updated } = await supabaseAdmin.from("artist_profiles").select("*").eq("username", req.params.username).single();
  res.json({ artist: shapeArtistProfile(updated) });
});

export default router;
