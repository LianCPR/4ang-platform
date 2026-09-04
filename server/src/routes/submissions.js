/**
 * 4ANG Submissions Routes — Supabase PostgreSQL only.
 */
import express from "express";
import multer from "multer";
import { randomUUID, createHash } from "node:crypto";
import { shapeSubmission, shapeTrack, recordAdminAudit, getSetting, createNotification, recordActivity } from "../db.js";
import { requireAuth, optionalAuth, requireAdmin } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { GENRES } from "./artists.js";
import { uploadFile, deleteFile, getFileUrl, MAX_AUDIO_BYTES, MAX_COVER_BYTES, MAX_VIDEO_BYTES } from "../storage.js";
import { supabaseAdmin } from "../supabase.js";

export const CREDIT_ROLES = ["featured", "producer", "composer", "lyricist", "remixer", "dj", "vocalist", "other"];
export const TERMS_VERSION = "2026-08";

const submissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "audio") {
      if (!file.mimetype.startsWith("audio/")) return cb(new Error("Chỉ nhận file âm thanh (MP3, WAV, FLAC, M4A...)."));
      return cb(null, true);
    }
    if (file.fieldname === "cover" || file.fieldname === "video") return cb(null, true);
    cb(new Error("Trường file không hợp lệ."));
  },
}).fields([{ name: "audio", maxCount: 1 }, { name: "cover", maxCount: 1 }, { name: "video", maxCount: 1 }]);

async function uploadToStorage(req, fieldName, bucket) {
  const file = req.files?.[fieldName]?.[0];
  if (!file) return null;
  const result = await uploadFile(bucket, req.user.username, file.buffer, file.mimetype, file.originalname);
  return { path: result.path, url: result.url || result.publicUrl || null };
}

function friendlyMulterError(err) {
  if (err?.code === "LIMIT_FILE_SIZE") return "File vượt quá dung lượng cho phép.";
  if (err?.code === "LIMIT_UNEXPECTED_FILE") return "Trường file không hợp lệ.";
  return err?.message || "Lỗi tải file.";
}

async function requireArtistMiddleware(req, res, next) {
  const { data: artist } = await supabaseAdmin.from("artist_profiles").select("*").eq("username", req.user.username).maybeSingle();
  if (!artist) return res.status(403).json({ error: "Chỉ nghệ sĩ mới có thể gửi bài. Hãy tạo hồ sơ nghệ sĩ trước." });
  req.artist = artist;
  next();
}

function parseFields(body) {
  return {
    title: ((body?.title) || "").trim(),
    releaseType: ((body?.releaseType) || "single").trim(),
    lyrics: ((body?.lyrics) || "").toString(),
    language: ((body?.language) || "").trim(),
    releaseDate: ((body?.releaseDate) || "").trim(),
    isExplicit: body?.isExplicit === "true" || body?.isExplicit === true,
    rightsConfirmed: body?.rightsConfirmed === "true" || body?.rightsConfirmed === true,
    termsAccepted: body?.termsAccepted === "true" || body?.termsAccepted === true,
  };
}

function validateGenres(raw) {
  let genres;
  try { genres = JSON.parse(raw || "[]"); } catch { return { error: "Thể loại không hợp lệ." }; }
  if (!Array.isArray(genres)) return { error: "Thể loại không hợp lệ." };
  const cleaned = [...new Set(genres.filter(g => GENRES.includes(g)))];
  if (cleaned.length === 0 && genres.length > 0) return { error: "Thể loại không hợp lệ." };
  return { value: cleaned.slice(0, 5) };
}

async function validateCredits(raw, submitterUsername) {
  let parsed;
  try { parsed = JSON.parse(raw || "[]"); } catch { return { error: "Danh sách nghệ sĩ không hợp lệ." }; }
  if (!Array.isArray(parsed)) return { error: "Danh sách nghệ sĩ không hợp lệ." };
  if (parsed.length > 9) return { error: "Tối đa 9 nghệ sĩ được credit thêm (ngoài bạn)." };
  const cleaned = [];
  const seen = new Set();
  for (const c of parsed) {
    const role = String(c?.role || "").trim();
    if (!CREDIT_ROLES.includes(role)) return { error: "Vai trò nghệ sĩ không hợp lệ." };
    const artistUsername = c?.artistUsername ? String(c.artistUsername).trim() : null;
    const externalName = !artistUsername && c?.externalName ? String(c.externalName).trim().slice(0, 60) : "";
    if (!artistUsername && !externalName) return { error: "Mỗi nghệ sĩ credit cần chọn hồ sơ trên 4ANG hoặc nhập tên nghệ sĩ ngoài." };
    if (artistUsername) {
      if (artistUsername === submitterUsername) return { error: "Bạn đã là Nghệ sĩ chính, không cần thêm lại." };
      const { data: exists } = await supabaseAdmin.from("artist_profiles").select("username").eq("username", artistUsername).maybeSingle();
      if (!exists) return { error: "Không tìm thấy nghệ sĩ 4ANG đã chọn." };
    }
    const dupKey = (artistUsername || "ext:" + externalName.toLowerCase()) + ":" + role;
    if (seen.has(dupKey)) return { error: "Không thể thêm cùng một nghệ sĩ với cùng vai trò hai lần." };
    seen.add(dupKey);
    cleaned.push({ artistUsername: artistUsername || null, externalName: artistUsername ? null : externalName, role, isPrimary: false });
  }
  return { value: [{ artistUsername: submitterUsername, externalName: null, role: "main", isPrimary: true }, ...cleaned] };
}

async function insertCredits(submissionId, credits) {
  for (let i = 0; i < credits.length; i++) {
    const c = credits[i];
    await supabaseAdmin.from("submission_credits").insert({
      id: randomUUID(), submission_id: submissionId,
      artist_username: c.artistUsername, external_name: c.externalName,
      role: c.role, is_primary: c.isPrimary, position: i,
    });
  }
}

export async function recordEvent(submissionId, actorUsername, action, note) {
  await supabaseAdmin.from("submission_events").insert({
    id: randomUUID(), submission_id: submissionId, actor_username: actorUsername,
    action, note: note || null, created_at: new Date().toISOString(),
  });
}

const router = express.Router();

router.get("/mine", requireAuth, requireArtistMiddleware, async (req, res) => {
  const { data: rows } = await supabaseAdmin
    .from("submissions").select("*").eq("artist_username", req.user.username).order("created_at", { ascending: false });
  const submissions = await Promise.all((rows || []).map(r => shapeSubmission(r)));
  res.json({ submissions });
});

// Admin review queue
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const status = (req.query.status || "").trim();
  const q = ((req.query.q || "") + "").trim();
  let query = supabaseAdmin.from("submissions").select("*");
  if (status === "all") {
    query = query.order("submitted_at", { ascending: false });
  } else if (status) {
    query = query.eq("status", status).order("submitted_at", { ascending: false });
  } else {
    query = query.in("status", ["pending_review", "under_review"]).order("submitted_at");
  }
  const { data: rows } = await query;
  let filtered = rows || [];
  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter(r => r.title?.toLowerCase().includes(needle) || r.artist_username?.toLowerCase().includes(needle));
  }
  const submissions = await Promise.all(filtered.map(r => shapeSubmission(r)));
  res.json({ submissions });
});

// Create submission
router.post("/", requireAuth, requireArtistMiddleware, rateLimit({ windowMs: 60_000, max: 12, keyPrefix: "submission-write" }), (req, res) => {
  submissionUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: friendlyMulterError(err) });
    try {
      const action = req.body.action === "submit" ? "submit" : "draft";
      if (action === "submit" && await getSetting("submissionsPaused", false)) {
        return res.status(423).json({ error: (await getSetting("submissionsPausedMessage", "")) || "4ANG hiện tạm dừng nhận bài gửi mới." });
      }
      const f = parseFields(req.body);
      if (!f.title) return res.status(400).json({ error: "Cần tên bài hát." });
      if (f.title.length < 2 || f.title.length > 120) return res.status(400).json({ error: "Tên bài hát cần 2-120 ký tự." });
      if (f.releaseType !== "single") return res.status(400).json({ error: "Hiện 4ANG chỉ nhận Đĩa đơn (Single)." });

      const genreResult = validateGenres(req.body.genres);
      if (genreResult.error) return res.status(400).json({ error: genreResult.error });
      const creditResult = await validateCredits(req.body.credits, req.user.username);
      if (creditResult.error) return res.status(400).json({ error: creditResult.error });

      const audioFile = req.files?.audio?.[0];
      const coverFile = req.files?.cover?.[0];
      const videoFile = req.files?.video?.[0];

      if (audioFile && audioFile.size > MAX_AUDIO_BYTES) return res.status(400).json({ error: "File nhạc tối đa 30MB." });
      if (coverFile && coverFile.size > MAX_COVER_BYTES) return res.status(400).json({ error: "Ảnh bìa tối đa 8MB." });
      if (videoFile && videoFile.size > MAX_VIDEO_BYTES) return res.status(400).json({ error: "Video tối đa 150MB." });

      if (action === "submit") {
        if (!audioFile) return res.status(400).json({ error: "Cần tải lên file nhạc." });
        if (!coverFile) return res.status(400).json({ error: "Cần tải lên ảnh bìa." });
        if (genreResult.value.length === 0) return res.status(400).json({ error: "Cần chọn ít nhất 1 thể loại." });
        if (!f.rightsConfirmed) return res.status(400).json({ error: "Cần xác nhận bạn có quyền gửi nội dung này." });
        if (!f.termsAccepted) return res.status(400).json({ error: "Cần đồng ý Quy định gửi bài của 4ANG." });
      }

      let audioChecksum = null;
      if (audioFile) {
        const hash = createHash("sha256");
        hash.update(audioFile.buffer);
        audioChecksum = hash.digest("hex");
      }

      if (action === "submit" && audioChecksum) {
        const { count: dupeCount } = await supabaseAdmin
          .from("submissions").select("*", { count: "exact", head: true })
          .eq("artist_username", req.user.username).eq("audio_checksum", audioChecksum)
          .in("status", ["pending_review", "under_review", "changes_requested", "approved", "published"]);
        if (dupeCount > 0) return res.status(409).json({ error: "Bạn đã gửi file nhạc này trong một yêu cầu khác rồi." });
      }

      const audioResult = audioFile ? await uploadToStorage(req, "audio", "audio") : null;
      const coverResult = coverFile ? await uploadToStorage(req, "cover", "artwork") : null;
      const videoResult = videoFile ? await uploadToStorage(req, "video", "videos") : null;

      const now = new Date().toISOString();
      const status = action === "submit" ? "pending_review" : "draft";

      const { data: sub, error: insertErr } = await supabaseAdmin.from("submissions").insert({
        id: randomUUID(), artist_username: req.user.username, artist_id: req.artist.user_id,
        title: f.title, release_type: "single",
        audio_path: audioResult?.path || null, audio_original_name: audioFile?.originalname || null, audio_checksum: audioChecksum,
        cover_path: coverResult?.path || null, video_path: videoResult?.path || null,
        lyrics: f.lyrics.trim(), genres: genreResult.value, language: f.language || null,
        is_explicit: f.isExplicit, release_date: f.releaseDate || null,
        rights_confirmed: f.rightsConfirmed, terms_accepted: f.termsAccepted,
        terms_version: f.termsAccepted ? TERMS_VERSION : null,
        terms_accepted_at: f.termsAccepted ? now : null,
        status, created_at: now, updated_at: now,
        submitted_at: action === "submit" ? now : null,
      }).select("*").single();

      if (insertErr) {
        console.error("[submission create]", insertErr.message);
        return res.status(500).json({ error: "Lỗi server khi tạo yêu cầu gửi bài." });
      }

      await insertCredits(sub.id, creditResult.value);
      if (action === "submit") await recordEvent(sub.id, req.user.username, "submitted", null);

      const result = await shapeSubmission(sub, { includeEvents: true });
      res.status(201).json({ submission: result });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Lỗi server khi tạo yêu cầu gửi bài." });
    }
  });
});

// Get submission detail
router.get("/:id", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("submissions").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy yêu cầu gửi bài." });
  if (row.artist_username !== req.user.username && !req.user.isAdmin) return res.status(403).json({ error: "Bạn không có quyền xem yêu cầu này." });
  res.json({ submission: await shapeSubmission(row, { includeEvents: true }) });
});

// Update submission
router.patch("/:id", requireAuth, rateLimit({ windowMs: 60_000, max: 12, keyPrefix: "submission-write" }), (req, res) => {
  submissionUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: friendlyMulterError(err) });
    try {
      const { data: row } = await supabaseAdmin.from("submissions").select("*").eq("id", req.params.id).single();
      if (!row) return res.status(404).json({ error: "Không tìm thấy yêu cầu gửi bài." });
      if (row.artist_username !== req.user.username) return res.status(403).json({ error: "Bạn không có quyền sửa yêu cầu này." });
      if (row.status !== "draft" && row.status !== "changes_requested") return res.status(409).json({ error: "Chỉ có thể sửa bản nháp hoặc yêu cầu cần chỉnh sửa." });

      const action = req.body.action === "submit" ? "submit" : "draft";
      const f = parseFields(req.body);
      if (!f.title) return res.status(400).json({ error: "Cần tên bài hát." });
      if (f.title.length < 2 || f.title.length > 120) return res.status(400).json({ error: "Tên bài hát cần 2-120 ký tự." });

      const genreResult = validateGenres(req.body.genres);
      if (genreResult.error) return res.status(400).json({ error: genreResult.error });
      const creditResult = await validateCredits(req.body.credits, req.user.username);
      if (creditResult.error) return res.status(400).json({ error: creditResult.error });

      const audioFile = req.files?.audio?.[0];
      const coverFile = req.files?.cover?.[0];
      const videoFile = req.files?.video?.[0];
      if (audioFile && audioFile.size > MAX_AUDIO_BYTES) return res.status(400).json({ error: "File nhạc tối đa 30MB." });
      if (coverFile && coverFile.size > MAX_COVER_BYTES) return res.status(400).json({ error: "Ảnh bìa tối đa 8MB." });
      if (videoFile && videoFile.size > MAX_VIDEO_BYTES) return res.status(400).json({ error: "Video tối đa 150MB." });

      const removeVideo = req.body.removeVideo === "true";
      const newAudioPath = audioFile ? await uploadToStorage(req, "audio", "audio") : null;
      const newCoverPath = coverFile ? await uploadToStorage(req, "cover", "artwork") : null;
      const newVideoPath = videoFile ? await uploadToStorage(req, "video", "videos") : null;

      let audioChecksum = row.audio_checksum;
      if (audioFile) {
        const hash = createHash("sha256");
        hash.update(audioFile.buffer);
        audioChecksum = hash.digest("hex");
      }

      if (action === "submit" && !newAudioPath && !row.audio_path) return res.status(400).json({ error: "Cần tải lên file nhạc." });
      if (action === "submit" && !newCoverPath && !row.cover_path) return res.status(400).json({ error: "Cần tải lên ảnh bìa." });
      if (action === "submit" && genreResult.value.length === 0) return res.status(400).json({ error: "Cần chọn ít nhất 1 thể loại." });
      if (action === "submit" && !f.rightsConfirmed) return res.status(400).json({ error: "Cần xác nhận bạn có quyền gửi nội dung này." });
      if (action === "submit" && !f.termsAccepted) return res.status(400).json({ error: "Cần đồng ý Quy định gửi bài của 4ANG." });

      const now = new Date().toISOString();
      const newStatus = action === "submit" ? "pending_review" : row.status;

      await supabaseAdmin.from("submissions").update({
        title: f.title, audio_path: newAudioPath || row.audio_path,
        audio_original_name: audioFile?.originalname || row.audio_original_name,
        audio_checksum: audioChecksum,
        cover_path: newCoverPath || row.cover_path,
        video_path: removeVideo ? null : (newVideoPath || row.video_path),
        lyrics: f.lyrics.trim(), genres: genreResult.value,
        language: f.language || null, is_explicit: f.isExplicit,
        release_date: f.releaseDate || null,
        rights_confirmed: f.rightsConfirmed, terms_accepted: f.termsAccepted,
        terms_version: f.termsAccepted ? TERMS_VERSION : row.terms_version,
        terms_accepted_at: f.termsAccepted ? now : row.terms_accepted_at,
        status: newStatus, admin_note: action === "submit" ? null : row.admin_note,
        updated_at: now, submitted_at: action === "submit" ? now : row.submitted_at,
      }).eq("id", row.id);

      if (audioFile && row.audio_path) deleteFile("audio", row.audio_path).catch(() => {});
      if (coverFile && row.cover_path) deleteFile("artwork", row.cover_path).catch(() => {});
      if ((videoFile || removeVideo) && row.video_path) deleteFile("videos", row.video_path).catch(() => {});

      await supabaseAdmin.from("submission_credits").delete().eq("submission_id", row.id);
      await insertCredits(row.id, creditResult.value);

      if (action === "submit") await recordEvent(row.id, req.user.username, row.status === "changes_requested" ? "resubmitted" : "submitted", null);

      const { data: updated } = await supabaseAdmin.from("submissions").select("*").eq("id", row.id).single();
      res.json({ submission: await shapeSubmission(updated, { includeEvents: true }) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Lỗi server khi cập nhật yêu cầu gửi bài." });
    }
  });
});

const adminReviewLimit = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "admin-action" });

function adminTransition(routeName, { toStatus, allowedFrom, eventAction, noteRequired = false }) {
  router.post("/:id/" + routeName, requireAuth, requireAdmin, adminReviewLimit, async (req, res) => {
    const { data: row } = await supabaseAdmin.from("submissions").select("*").eq("id", req.params.id).single();
    if (!row) return res.status(404).json({ error: "Không tìm thấy yêu cầu gửi bài." });
    if (!allowedFrom.includes(row.status)) return res.status(409).json({ error: "Yêu cầu này không ở trạng thái cho phép thao tác đó." });
    const note = (req.body?.note || "").trim().slice(0, 1000);
    if (noteRequired && !note) return res.status(400).json({ error: "Cần nhập lý do/ghi chú." });
    const now = new Date().toISOString();
    if (row.status === "pending_review" && routeName !== "review") {
      await recordEvent(row.id, req.user.username, "review_started", null);
    }
    await supabaseAdmin.from("submissions").update({
      status: toStatus, admin_note: note || null, reviewed_at: now, reviewed_by: req.user.id, updated_at: now,
    }).eq("id", row.id);
    await recordEvent(row.id, req.user.username, eventAction, note || null);
    await recordAdminAudit(req.user.username, "submission_" + eventAction, "submission", row.id, { title: row.title, note: note || null });

    if (toStatus === "approved") {
      await createNotification(row.artist_username, "SUBMISSION_APPROVED", "Tác phẩm đã được duyệt", row.title + " đã được chấp thuận và sẵn sàng xuất bản.",
        { actorUsername: req.user.username, targetType: "submission", targetId: row.id });
    } else if (toStatus === "rejected") {
      await createNotification(row.artist_username, "SUBMISSION_REJECTED", "Tác phẩm bị từ chối", row.title + " chưa được chấp thuận." + (note ? " Lý do: " + note : ""),
        { actorUsername: req.user.username, targetType: "submission", targetId: row.id });
    } else if (toStatus === "changes_requested") {
      await createNotification(row.artist_username, "SUBMISSION_REJECTED", "Yêu cầu chỉnh sửa", row.title + " cần chỉnh sửa: " + (note || "Xem chi tiết trong hồ sơ."),
        { actorUsername: req.user.username, targetType: "submission", targetId: row.id });
    }

    const { data: updated } = await supabaseAdmin.from("submissions").select("*").eq("id", row.id).single();
    res.json({ submission: await shapeSubmission(updated, { includeEvents: true }) });
  });
}

adminTransition("review", { toStatus: "under_review", allowedFrom: ["pending_review"], eventAction: "review_started" });
adminTransition("request-changes", { toStatus: "changes_requested", allowedFrom: ["pending_review", "under_review"], eventAction: "changes_requested", noteRequired: true });
adminTransition("reject", { toStatus: "rejected", allowedFrom: ["pending_review", "under_review"], eventAction: "rejected" });
adminTransition("approve", { toStatus: "approved", allowedFrom: ["pending_review", "under_review"], eventAction: "approved" });

// Publish: submission → track
router.post("/:id/publish", requireAuth, requireAdmin, adminReviewLimit, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("submissions").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy yêu cầu gửi bài." });
  if (row.status !== "approved") return res.status(409).json({ error: "Chỉ có thể phát hành yêu cầu đã được duyệt." });

  const { data: user } = await supabaseAdmin.from("profiles").select("display_name").eq("username", row.artist_username).maybeSingle();
  if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản nghệ sĩ gửi bài." });

  const trackId = randomUUID();
  const now = new Date().toISOString();

  await supabaseAdmin.from("tracks").insert({
    id: trackId, title: row.title, composer: "", description: "",
    release_date: row.release_date, lyrics: row.lyrics,
    audio_path: row.audio_path, audio_original_name: row.audio_original_name,
    cover_path: row.cover_path, video_path: row.video_path,
    genres: row.genres, language: row.language, is_explicit: row.is_explicit,
    uploader_id: row.artist_id, uploader_username: row.artist_username,
    uploader_display_name: user.display_name,
    status: "approved", share_count: 0, play_count: 0,
    submission_id: row.id,
    created_at: now, reviewed_at: now, reviewed_by: req.user.id,
  });

  // Copy credits
  const { data: credits } = await supabaseAdmin.from("submission_credits").select("*").eq("submission_id", row.id).order("position");
  for (const c of (credits || [])) {
    await supabaseAdmin.from("track_credits").insert({
      id: randomUUID(), track_id: trackId,
      artist_username: c.artist_username, user_id: c.user_id,
      external_name: c.external_name, role: c.role,
      is_primary: c.is_primary, position: c.position,
    });
  }

  await supabaseAdmin.from("submissions").update({ status: "published", published_track_id: trackId, updated_at: now }).eq("id", row.id);
  await recordEvent(row.id, req.user.username, "published", null);
  await recordAdminAudit(req.user.username, "submission_published", "submission", row.id, { title: row.title, trackId });
  await recordActivity(row.artist_username, "TRACK_PUBLISHED", "track", trackId, { title: row.title });

  // Notify followers
  const { data: followers } = await supabaseAdmin.from("artist_follows").select("follower_username").eq("artist_username", row.artist_username);
  const { data: ap } = await supabaseAdmin.from("artist_profiles").select("artist_name").eq("username", row.artist_username).maybeSingle();
  const artistName = ap?.artist_name || row.artist_username;
  for (const f of (followers || [])) {
    await createNotification(f.follower_username, "NEW_RELEASE", artistName + " vừa phát hành mới",
      artistName + ' đã phát hành "' + row.title + '".',
      { actorUsername: row.artist_username, targetType: "track", targetId: trackId });
  }

  const { data: track } = await supabaseAdmin.from("tracks").select("*").eq("id", trackId).single();
  const { data: sub } = await supabaseAdmin.from("submissions").select("*").eq("id", row.id).single();
  res.json({ track: await shapeTrack(track), submission: await shapeSubmission(sub, { includeEvents: true }) });
});

// Serve submission assets (owner or admin only)
function serveSubmissionAsset(kind) {
  const bucket = kind === "cover" ? "artwork" : kind === "video" ? "videos" : "audio";
  return async (req, res) => {
    try {
      const { data: row } = await supabaseAdmin.from("submissions").select("*").eq("id", req.params.id).single();
      if (!row) return res.status(404).end();
      const isOwner = req.user && req.user.username === row.artist_username;
      const isAdmin = req.user && req.user.isAdmin;
      if (!isOwner && !isAdmin) return res.status(403).end();
      const filePath = kind === "cover" ? row.cover_path : kind === "video" ? row.video_path : row.audio_path;
      if (!filePath) return res.status(404).end();
      const url = await getFileUrl(bucket, filePath);
      if (!url) return res.status(404).end();
      res.redirect(url);
    } catch (e) {
      console.error("[serveSubmissionAsset]", e);
      res.status(500).end();
    }
  };
}
router.get("/:id/audio", optionalAuth, serveSubmissionAsset("audio"));
router.get("/:id/cover", optionalAuth, serveSubmissionAsset("cover"));
router.get("/:id/video", optionalAuth, serveSubmissionAsset("video"));

export default router;
