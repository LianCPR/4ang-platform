import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { db, shapeSubmission, shapeTrack, recordAdminAudit, getSetting, createNotification, recordActivity } from "../db.js";
import { requireAuth, optionalAuth, requireAdmin } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { GENRES } from "./artists.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Submission audio shares the exact same folder tracks.js already streams
// from — on approval a track is published by pointing straight at these
// filenames, never by copying/moving files around.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "uploads");
export const COVER_DIR = process.env.COVER_DIR || path.join(__dirname, "..", "..", "uploads", "covers");
export const VIDEO_DIR = process.env.VIDEO_DIR || path.join(__dirname, "..", "..", "uploads", "videos");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(COVER_DIR, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

// Same "derive the extension from a trusted whitelist, never from the
// client" rule artists.js already applies to profile images — these files
// get served back to browsers, so a spoofed mimetype must never earn a
// dangerous extension.
const IMAGE_EXT_BY_MIME = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };
const VIDEO_EXT_BY_MIME = { "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov" };

const MAX_AUDIO_BYTES = 30 * 1024 * 1024; // matches tracks.js
const MAX_COVER_BYTES = 8 * 1024 * 1024; // matches artists.js profile images
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

export const CREDIT_ROLES = ["featured", "producer", "composer", "lyricist", "remixer", "dj", "vocalist", "other"];
export const TERMS_VERSION = "2026-08";

const submissionUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === "cover") return cb(null, COVER_DIR);
      if (file.fieldname === "video") return cb(null, VIDEO_DIR);
      return cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      if (file.fieldname === "cover") return cb(null, randomUUID() + (IMAGE_EXT_BY_MIME[file.mimetype] || ""));
      if (file.fieldname === "video") return cb(null, randomUUID() + (VIDEO_EXT_BY_MIME[file.mimetype] || ""));
      return cb(null, randomUUID() + (path.extname(file.originalname) || ""));
    },
  }),
  // One global ceiling (multer can't do per-field limits); the tighter
  // real per-field limits (30MB audio / 8MB cover) are enforced by hand
  // right after upload, once we know which field each file belongs to.
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "audio") {
      if (!file.mimetype.startsWith("audio/")) return cb(new Error("Chỉ nhận file âm thanh (MP3, WAV, FLAC, M4A...)."));
      return cb(null, true);
    }
    if (file.fieldname === "cover") {
      if (!IMAGE_EXT_BY_MIME[file.mimetype]) return cb(new Error("Ảnh bìa cần là PNG, JPEG, WEBP hoặc GIF."));
      return cb(null, true);
    }
    if (file.fieldname === "video") {
      if (!VIDEO_EXT_BY_MIME[file.mimetype]) return cb(new Error("Video cần là MP4, WEBM hoặc MOV."));
      return cb(null, true);
    }
    cb(new Error("Trường file không hợp lệ."));
  },
}).fields([{ name: "audio", maxCount: 1 }, { name: "cover", maxCount: 1 }, { name: "video", maxCount: 1 }]);

function friendlyMulterError(err) {
  if (err && err.code === "LIMIT_FILE_SIZE") return "File vượt quá dung lượng cho phép.";
  if (err && err.code === "LIMIT_UNEXPECTED_FILE") return "Trường file không hợp lệ.";
  return (err && err.message) || "Lỗi tải file.";
}

function cleanupUploadedFiles(files) {
  if (!files) return;
  for (const key of Object.keys(files)) {
    for (const f of files[key]) {
      const dir = key === "cover" ? COVER_DIR : key === "video" ? VIDEO_DIR : UPLOAD_DIR;
      fs.unlink(path.join(dir, f.filename), () => {});
    }
  }
}

function fileChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

// Only 4ANG Artists (independent or verified) may submit a request —
// normal accounts never see or reach this at all, and this check happens
// server-side so it's real access control, not a hidden client-side gate.
function requireArtist(req, res, next) {
  const artist = db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.user.username);
  if (!artist) return res.status(403).json({ error: "Chỉ nghệ sĩ mới có thể gửi bài. Hãy tạo hồ sơ nghệ sĩ trước." });
  req.artist = artist;
  next();
}

function parseFields(body) {
  return {
    title: ((body && body.title) || "").trim(),
    releaseType: ((body && body.releaseType) || "single").trim(),
    lyrics: ((body && body.lyrics) || "").toString(),
    language: ((body && body.language) || "").trim(),
    releaseDate: ((body && body.releaseDate) || "").trim(),
    isExplicit: body && (body.isExplicit === "true" || body.isExplicit === true),
    rightsConfirmed: body && (body.rightsConfirmed === "true" || body.rightsConfirmed === true),
    termsAccepted: body && (body.termsAccepted === "true" || body.termsAccepted === true),
  };
}

function validateGenres(raw) {
  let genres;
  try { genres = JSON.parse(raw || "[]"); } catch (e) { return { error: "Thể loại không hợp lệ." }; }
  if (!Array.isArray(genres)) return { error: "Thể loại không hợp lệ." };
  const cleaned = [...new Set(genres.filter((g) => GENRES.includes(g)))];
  if (cleaned.length === 0 && genres.length > 0) return { error: "Thể loại không hợp lệ." };
  return { value: cleaned.slice(0, 5) };
}

// The submitter is always, unconditionally, the one Main Artist credit —
// never trusted from the client, so a submission can never be missing its
// primary artist or have that credit swapped out for someone else (§17).
function validateCredits(raw, submitterUsername) {
  let parsed;
  try { parsed = JSON.parse(raw || "[]"); } catch (e) { return { error: "Danh sách nghệ sĩ không hợp lệ." }; }
  if (!Array.isArray(parsed)) return { error: "Danh sách nghệ sĩ không hợp lệ." };
  if (parsed.length > 9) return { error: "Tối đa 9 nghệ sĩ được credit thêm (ngoài bạn)." };
  const cleaned = [];
  const seen = new Set();
  for (const c of parsed) {
    const role = String((c && c.role) || "").trim();
    if (!CREDIT_ROLES.includes(role)) return { error: "Vai trò nghệ sĩ không hợp lệ." };
    const artistUsername = c && c.artistUsername ? String(c.artistUsername).trim() : null;
    const externalName = !artistUsername && c && c.externalName ? String(c.externalName).trim().slice(0, 60) : "";
    if (!artistUsername && !externalName) return { error: "Mỗi nghệ sĩ credit cần chọn hồ sơ trên 4ANG hoặc nhập tên nghệ sĩ ngoài." };
    if (artistUsername) {
      if (artistUsername === submitterUsername) return { error: "Bạn đã là Nghệ sĩ chính, không cần thêm lại." };
      const exists = db.prepare("SELECT username FROM artist_profiles WHERE username = ?").get(artistUsername);
      if (!exists) return { error: "Không tìm thấy nghệ sĩ 4ANG đã chọn." };
    }
    const dupKey = (artistUsername || "ext:" + externalName.toLowerCase()) + ":" + role;
    if (seen.has(dupKey)) return { error: "Không thể thêm cùng một nghệ sĩ với cùng vai trò hai lần." };
    seen.add(dupKey);
    cleaned.push({ artistUsername: artistUsername || null, externalName: artistUsername ? null : externalName, role, isPrimary: false });
  }
  const final = [{ artistUsername: submitterUsername, externalName: null, role: "main", isPrimary: true }, ...cleaned];
  return { value: final };
}

function insertCredits(submissionId, credits) {
  const stmt = db.prepare("INSERT INTO submission_credits (id, submission_id, artist_username, external_name, role, is_primary, position) VALUES (?, ?, ?, ?, ?, ?, ?)");
  credits.forEach((c, i) => stmt.run(randomUUID(), submissionId, c.artistUsername, c.externalName, c.role, c.isPrimary ? 1 : 0, i));
}

export function recordEvent(submissionId, actorUsername, action, note) {
  db.prepare("INSERT INTO submission_events (id, submission_id, actor_username, action, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), submissionId, actorUsername, action, note || null, Date.now());
}

const router = express.Router();

router.get("/mine", requireAuth, requireArtist, (req, res) => {
  const rows = db.prepare("SELECT * FROM submissions WHERE artist_username = ? ORDER BY created_at DESC").all(req.user.username);
  res.json({ submissions: rows.map((r) => shapeSubmission(r)) });
});

// Admin review queue — defaults to what actually needs attention
// (pending_review + under_review); ?status= narrows to any single state
// (or "all") so the Phase 7 Admin queue can build history/filter views on
// the same endpoint without a second one. ?q= searches title/artist so
// the queue UI never needs a bespoke search endpoint either.
router.get("/", requireAuth, requireAdmin, (req, res) => {
  const status = (req.query.status || "").trim();
  const q = ((req.query.q || "") + "").trim();
  let rows;
  if (status === "all") {
    rows = db.prepare("SELECT * FROM submissions ORDER BY submitted_at DESC, created_at DESC").all();
  } else if (status) {
    rows = db.prepare("SELECT * FROM submissions WHERE status = ? ORDER BY submitted_at DESC, created_at DESC").all(status);
  } else {
    rows = db.prepare("SELECT * FROM submissions WHERE status IN ('pending_review','under_review') ORDER BY submitted_at ASC").all();
  }
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) => r.title.toLowerCase().includes(needle) || r.artist_username.toLowerCase().includes(needle));
  }
  res.json({ submissions: rows.map((r) => shapeSubmission(r)) });
});

router.post("/", requireAuth, requireArtist, rateLimit({ windowMs: 60_000, max: 12, keyPrefix: "submission-write" }), (req, res) => {
  submissionUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: friendlyMulterError(err) });
    function fail(code, message) {
      cleanupUploadedFiles(req.files);
      res.status(code).json({ error: message });
    }
    try {
      const action = req.body.action === "submit" ? "submit" : "draft";
      // An Admin can pause new submissions platform-wide (Part 54, a real
      // enforced setting — never a decorative toggle). Drafts still save
      // locally either way; only actually *submitting for review* is paused.
      if (action === "submit" && getSetting("submissionsPaused", false)) {
        return fail(423, getSetting("submissionsPausedMessage", "") || "4ANG hiện tạm dừng nhận bài gửi mới. Vui lòng quay lại sau.");
      }
      const f = parseFields(req.body);

      if (!f.title) return fail(400, "Cần tên bài hát.");
      if (f.title.length < 2 || f.title.length > 120) return fail(400, "Tên bài hát cần 2-120 ký tự.");
      if (f.releaseType !== "single") return fail(400, "Hiện 4ANG chỉ nhận Đĩa đơn (Single).");
      if (f.language && !["vi", "en", "other"].includes(f.language)) return fail(400, "Ngôn ngữ không hợp lệ.");
      if (f.releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(f.releaseDate)) return fail(400, "Ngày phát hành không hợp lệ.");

      const genreResult = validateGenres(req.body.genres);
      if (genreResult.error) return fail(400, genreResult.error);
      const creditResult = validateCredits(req.body.credits, req.user.username);
      if (creditResult.error) return fail(400, creditResult.error);

      const audioFile = (req.files && req.files.audio && req.files.audio[0]) || null;
      const coverFile = (req.files && req.files.cover && req.files.cover[0]) || null;
      const videoFile = (req.files && req.files.video && req.files.video[0]) || null;

      if (audioFile && audioFile.size > MAX_AUDIO_BYTES) return fail(400, "File nhạc tối đa 30MB.");
      if (coverFile && coverFile.size > MAX_COVER_BYTES) return fail(400, "Ảnh bìa tối đa 8MB.");
      if (videoFile && videoFile.size > MAX_VIDEO_BYTES) return fail(400, "Video tối đa 150MB.");

      if (action === "submit") {
        if (!audioFile) return fail(400, "Cần tải lên file nhạc.");
        if (!coverFile) return fail(400, "Cần tải lên ảnh bìa.");
        if (genreResult.value.length === 0) return fail(400, "Cần chọn ít nhất 1 thể loại.");
        if (!f.rightsConfirmed) return fail(400, "Cần xác nhận bạn có quyền gửi nội dung này.");
        if (!f.termsAccepted) return fail(400, "Cần đồng ý Quy định gửi bài của 4ANG.");
      }

      let audioChecksum = null;
      if (audioFile) audioChecksum = await fileChecksum(audioFile.path);

      if (action === "submit" && audioChecksum) {
        const dupe = db.prepare(
          "SELECT id FROM submissions WHERE artist_username = ? AND audio_checksum = ? AND status IN ('pending_review','under_review','changes_requested','approved','published')"
        ).get(req.user.username, audioChecksum);
        if (dupe) return fail(409, "Bạn đã gửi file nhạc này trong một yêu cầu khác rồi.");
      }

      const id = randomUUID();
      const now = Date.now();
      const status = action === "submit" ? "pending_review" : "draft";

      db.prepare(`INSERT INTO submissions
        (id, artist_username, title, release_type, audio_filename, audio_original_name, audio_checksum,
         cover_filename, video_filename, lyrics, genres, language, is_explicit, release_date,
         rights_confirmed, terms_accepted, terms_version, terms_accepted_at, status, created_at, updated_at, submitted_at)
        VALUES (?, ?, ?, 'single', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          id, req.user.username, f.title,
          audioFile ? audioFile.filename : null, audioFile ? audioFile.originalname : null, audioChecksum,
          coverFile ? coverFile.filename : null, videoFile ? videoFile.filename : null,
          f.lyrics.trim(), JSON.stringify(genreResult.value), f.language || null, f.isExplicit ? 1 : 0, f.releaseDate || null,
          f.rightsConfirmed ? 1 : 0, f.termsAccepted ? 1 : 0, f.termsAccepted ? TERMS_VERSION : null, f.termsAccepted ? now : null,
          status, now, now, action === "submit" ? now : null
        );

      insertCredits(id, creditResult.value);
      if (action === "submit") recordEvent(id, req.user.username, "submitted", null);

      const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(id);
      res.status(201).json({ submission: shapeSubmission(row, { includeEvents: true }) });
    } catch (e) {
      cleanupUploadedFiles(req.files);
      console.error(e);
      res.status(500).json({ error: "Lỗi server khi tạo yêu cầu gửi bài." });
    }
  });
});

router.get("/:id", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy yêu cầu gửi bài." });
  if (row.artist_username !== req.user.username && !req.user.isAdmin) return res.status(403).json({ error: "Bạn không có quyền xem yêu cầu này." });
  res.json({ submission: shapeSubmission(row, { includeEvents: true }) });
});

router.patch("/:id", requireAuth, rateLimit({ windowMs: 60_000, max: 12, keyPrefix: "submission-write" }), (req, res) => {
  submissionUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: friendlyMulterError(err) });
    function fail(code, message) {
      cleanupUploadedFiles(req.files);
      res.status(code).json({ error: message });
    }
    try {
      const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
      if (!row) return fail(404, "Không tìm thấy yêu cầu gửi bài.");
      if (row.artist_username !== req.user.username) return fail(403, "Bạn không có quyền sửa yêu cầu này.");
      if (row.status !== "draft" && row.status !== "changes_requested") return fail(409, "Chỉ có thể sửa bản nháp hoặc yêu cầu cần chỉnh sửa.");

      const action = req.body.action === "submit" ? "submit" : "draft";
      const f = parseFields(req.body);
      if (!f.title) return fail(400, "Cần tên bài hát.");
      if (f.title.length < 2 || f.title.length > 120) return fail(400, "Tên bài hát cần 2-120 ký tự.");
      if (f.releaseType !== "single") return fail(400, "Hiện 4ANG chỉ nhận Đĩa đơn (Single).");
      if (f.language && !["vi", "en", "other"].includes(f.language)) return fail(400, "Ngôn ngữ không hợp lệ.");
      if (f.releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(f.releaseDate)) return fail(400, "Ngày phát hành không hợp lệ.");

      const genreResult = validateGenres(req.body.genres);
      if (genreResult.error) return fail(400, genreResult.error);
      const creditResult = validateCredits(req.body.credits, req.user.username);
      if (creditResult.error) return fail(400, creditResult.error);

      const audioFile = (req.files && req.files.audio && req.files.audio[0]) || null;
      const coverFile = (req.files && req.files.cover && req.files.cover[0]) || null;
      const videoFile = (req.files && req.files.video && req.files.video[0]) || null;
      if (audioFile && audioFile.size > MAX_AUDIO_BYTES) return fail(400, "File nhạc tối đa 30MB.");
      if (coverFile && coverFile.size > MAX_COVER_BYTES) return fail(400, "Ảnh bìa tối đa 8MB.");
      if (videoFile && videoFile.size > MAX_VIDEO_BYTES) return fail(400, "Video tối đa 150MB.");

      const removeVideo = req.body.removeVideo === "true";
      const finalAudioFilename = audioFile ? audioFile.filename : row.audio_filename;
      const finalAudioOriginal = audioFile ? audioFile.originalname : row.audio_original_name;
      const finalCoverFilename = coverFile ? coverFile.filename : row.cover_filename;
      const finalVideoFilename = videoFile ? videoFile.filename : (removeVideo ? null : row.video_filename);

      if (action === "submit") {
        if (!finalAudioFilename) return fail(400, "Cần tải lên file nhạc.");
        if (!finalCoverFilename) return fail(400, "Cần tải lên ảnh bìa.");
        if (genreResult.value.length === 0) return fail(400, "Cần chọn ít nhất 1 thể loại.");
        if (!f.rightsConfirmed) return fail(400, "Cần xác nhận bạn có quyền gửi nội dung này.");
        if (!f.termsAccepted) return fail(400, "Cần đồng ý Quy định gửi bài của 4ANG.");
      }

      let finalChecksum = row.audio_checksum;
      if (audioFile) finalChecksum = await fileChecksum(audioFile.path);

      if (action === "submit" && finalChecksum) {
        const dupe = db.prepare(
          "SELECT id FROM submissions WHERE artist_username = ? AND audio_checksum = ? AND id != ? AND status IN ('pending_review','under_review','changes_requested','approved','published')"
        ).get(req.user.username, finalChecksum, row.id);
        if (dupe) return fail(409, "Bạn đã có yêu cầu khác dùng cùng file nhạc này.");
      }

      const now = Date.now();
      const newStatus = action === "submit" ? "pending_review" : row.status;
      const wasChangesRequested = row.status === "changes_requested";

      db.prepare(`UPDATE submissions SET
          title = ?, audio_filename = ?, audio_original_name = ?, audio_checksum = ?,
          cover_filename = ?, video_filename = ?, lyrics = ?, genres = ?, language = ?,
          is_explicit = ?, release_date = ?, rights_confirmed = ?, terms_accepted = ?,
          terms_version = ?, terms_accepted_at = ?, status = ?, admin_note = ?, updated_at = ?, submitted_at = ?
        WHERE id = ?`)
        .run(
          f.title, finalAudioFilename, finalAudioOriginal, finalChecksum,
          finalCoverFilename, finalVideoFilename, f.lyrics.trim(), JSON.stringify(genreResult.value), f.language || null,
          f.isExplicit ? 1 : 0, f.releaseDate || null, f.rightsConfirmed ? 1 : 0, f.termsAccepted ? 1 : 0,
          f.termsAccepted ? TERMS_VERSION : row.terms_version, f.termsAccepted ? now : row.terms_accepted_at,
          newStatus, action === "submit" ? null : row.admin_note, now, action === "submit" ? now : row.submitted_at,
          row.id
        );

      // Only delete the old file once the DB row that referenced it has
      // actually been overwritten — never before.
      if (audioFile && row.audio_filename) fs.unlink(path.join(UPLOAD_DIR, row.audio_filename), () => {});
      if (coverFile && row.cover_filename) fs.unlink(path.join(COVER_DIR, row.cover_filename), () => {});
      if ((videoFile || removeVideo) && row.video_filename) fs.unlink(path.join(VIDEO_DIR, row.video_filename), () => {});

      db.prepare("DELETE FROM submission_credits WHERE submission_id = ?").run(row.id);
      insertCredits(row.id, creditResult.value);

      if (action === "submit") recordEvent(row.id, req.user.username, wasChangesRequested ? "resubmitted" : "submitted", null);

      const updated = db.prepare("SELECT * FROM submissions WHERE id = ?").get(row.id);
      res.json({ submission: shapeSubmission(updated, { includeEvents: true }) });
    } catch (e) {
      cleanupUploadedFiles(req.files);
      console.error(e);
      res.status(500).json({ error: "Loi server khi cap nhat yeu cau gui bai." });
    }
  });
});

const adminReviewLimit = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "admin-action" });

function adminTransition(routeName, { toStatus, allowedFrom, eventAction, noteRequired = false }) {
  router.post("/:id/" + routeName, requireAuth, requireAdmin, adminReviewLimit, (req, res) => {
      const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
      if (!row) return res.status(404).json({ error: "Không tìm thấy yêu cầu gửi bài." });
      if (!allowedFrom.includes(row.status)) return res.status(409).json({ error: "Yêu cầu này không ở trạng thái cho phép thao tác đó." });
      const note = (req.body && req.body.note ? String(req.body.note) : "").trim().slice(0, 1000);
      if (noteRequired && !note) return res.status(400).json({ error: "Cần nhập lý do/ghi chú." });
      const now = Date.now();
      if (row.status === "pending_review" && routeName !== "review") {
        recordEvent(row.id, req.user.username, "review_started", null);
      }
      db.prepare("UPDATE submissions SET status = ?, admin_note = ?, reviewed_at = ?, reviewed_by = ?, updated_at = ? WHERE id = ?")
        .run(toStatus, note || null, now, req.user.username, now, row.id);
      recordEvent(row.id, req.user.username, eventAction, note || null);
      recordAdminAudit(req.user.username, "submission_" + eventAction, "submission", row.id, { title: row.title, note: note || null });

      // Notify the artist about status changes
      if (toStatus === "approved") {
        createNotification(row.artist_username, "SUBMISSION_APPROVED", "Tác phẩm đã được duyệt", row.title + " đã được chấp thuận và sẵn sàng xuất bản.", { actorUsername: req.user.username, targetType: "submission", targetId: row.id });
      } else if (toStatus === "rejected") {
        createNotification(row.artist_username, "SUBMISSION_REJECTED", "Tác phẩm bị từ chối", row.title + " chưa được chấp thuận." + (note ? " Lý do: " + note : ""), { actorUsername: req.user.username, targetType: "submission", targetId: row.id });
      } else if (toStatus === "changes_requested") {
        createNotification(row.artist_username, "SUBMISSION_REJECTED", "Yêu cầu chỉnh sửa", row.title + " cần chỉnh sửa: " + (note || "Xem chi tiết trong hồ sơ."), { actorUsername: req.user.username, targetType: "submission", targetId: row.id });
      }

      const updated = db.prepare("SELECT * FROM submissions WHERE id = ?").get(row.id);
      res.json({ submission: shapeSubmission(updated, { includeEvents: true }) });
    });
  }
  adminTransition("review", { toStatus: "under_review", allowedFrom: ["pending_review"], eventAction: "review_started" });
adminTransition("request-changes", { toStatus: "changes_requested", allowedFrom: ["pending_review", "under_review"], eventAction: "changes_requested", noteRequired: true });
adminTransition("reject", { toStatus: "rejected", allowedFrom: ["pending_review", "under_review"], eventAction: "rejected" });
adminTransition("approve", { toStatus: "approved", allowedFrom: ["pending_review", "under_review"], eventAction: "approved" });

// The only place a `tracks` row is ever created from a submission — an
// Artist can never reach this route (§59: no self-approval, no
// self-publish). Audio is already sitting in the folder tracks.js streams
// from, so publishing never moves/copies that file, only points a new
// tracks row at the same filename; cover/video already live in their own
// served directories, so those filenames carry over unchanged too.
router.post("/:id/publish", requireAuth, requireAdmin, adminReviewLimit, (req, res) => {
  const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy yêu cầu gửi bài." });
  if (row.status !== "approved") return res.status(409).json({ error: "Chỉ có thể phát hành yêu cầu đã được duyệt." });
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(row.artist_username);
  if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản nghệ sĩ gửi bài." });

  const trackId = randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO tracks
      (id, title, composer, description, release_date, lyrics, audio_filename,
       uploader_username, uploader_display_name, status, share_count, play_count,
       created_at, reviewed_at, reviewed_by, cover_filename, video_filename, genres, submission_id)
      VALUES (?, ?, '', '', ?, ?, ?, ?, ?, 'approved', 0, 0, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      trackId, row.title, row.release_date, row.lyrics, row.audio_filename,
      row.artist_username, user.display_name, now, now, req.user.username,
      row.cover_filename, row.video_filename, row.genres, row.id
    );

  const credits = db.prepare("SELECT * FROM submission_credits WHERE submission_id = ? ORDER BY is_primary DESC, position ASC").all(row.id);
  const insertCredit = db.prepare("INSERT INTO track_credits (id, track_id, artist_username, external_name, role, is_primary, position) VALUES (?, ?, ?, ?, ?, ?, ?)");
  credits.forEach((c, i) => insertCredit.run(randomUUID(), trackId, c.artist_username, c.external_name, c.role, c.is_primary, i));

  db.prepare("UPDATE submissions SET status = 'published', published_track_id = ?, updated_at = ? WHERE id = ?").run(trackId, now, row.id);
  recordEvent(row.id, req.user.username, "published", null);
  recordAdminAudit(req.user.username, "submission_published", "submission", row.id, { title: row.title, trackId });
  // Notify followers of the artist that new music is available.
  recordActivity(row.artist_username, "TRACK_PUBLISHED", "track", trackId, { title: row.title });
  const followers = db.prepare("SELECT follower_username FROM artist_follows WHERE artist_username = ?").all(row.artist_username);
  const artistProfile = db.prepare("SELECT artist_name FROM artist_profiles WHERE username = ?").get(row.artist_username);
  const artistName = artistProfile ? artistProfile.artist_name : row.artist_username;
  for (const f of followers) {
    createNotification(f.follower_username, "NEW_RELEASE", artistName + " vừa phát hành mới", artistName + " đã phát hành \"" + row.title + "\".", { actorUsername: row.artist_username, targetType: "track", targetId: trackId });
  }

  res.json({
    track: shapeTrack(db.prepare("SELECT * FROM tracks WHERE id = ?").get(trackId)),
    submission: shapeSubmission(db.prepare("SELECT * FROM submissions WHERE id = ?").get(row.id), { includeEvents: true }),
  });
});

// Submission assets are never public — unlike a published track's cover,
// a submission might still be an unreviewed draft, so every stream here
// requires the owner or an admin, the same trust model tracks.js already
// uses for gated (non-approved) track audio.
function serveSubmissionAsset(kind) {
  return (req, res) => {
    const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).end();
    const isOwner = req.user && req.user.username === row.artist_username;
    const isAdmin = req.user && req.user.isAdmin;
    if (!isOwner && !isAdmin) return res.status(403).end();
    const filename = kind === "cover" ? row.cover_filename : kind === "video" ? row.video_filename : row.audio_filename;
    if (!filename) return res.status(404).end();
    const dir = kind === "cover" ? COVER_DIR : kind === "video" ? VIDEO_DIR : UPLOAD_DIR;
    res.sendFile(path.join(dir, filename));
  };
}
router.get("/:id/audio", optionalAuth, serveSubmissionAsset("audio"));
router.get("/:id/cover", optionalAuth, serveSubmissionAsset("cover"));
router.get("/:id/video", optionalAuth, serveSubmissionAsset("video"));

export default router;
