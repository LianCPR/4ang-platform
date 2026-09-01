import express from "express";
import { randomUUID } from "node:crypto";
import { db, shapeTrack, shapeArtistProfile, shapePublicUserSummary, recordAdminAudit, shapeAuditEntry, shapeArtistApplication, shapeVerifiedArtistApplication, createNotification, getSetting, setSetting } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { GENRES } from "./artists.js";

const router = express.Router();
// Every route below is Admin-only — this is the one place that
// distinction actually matters (Part 32/55): a frontend route guard is
// convenience, this middleware is the real access control.
router.use(requireAuth, requireAdmin);

const adminActionLimit = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "admin-action" });

/* ============================== DASHBOARD ============================== */
// Every number here is a real COUNT(*) against real rows — never a
// placeholder, never rounded up to "look alive" (Part 34/62).
router.get("/stats", (req, res) => {
  const c = (sql, ...args) => db.prepare(sql).get(...args).c;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const stats = {
    submissions: {
      pendingReview: c("SELECT COUNT(*) AS c FROM submissions WHERE status = 'pending_review'"),
      underReview: c("SELECT COUNT(*) AS c FROM submissions WHERE status = 'under_review'"),
      changesRequested: c("SELECT COUNT(*) AS c FROM submissions WHERE status = 'changes_requested'"),
      approvedAwaitingPublish: c("SELECT COUNT(*) AS c FROM submissions WHERE status = 'approved'"),
      approvedToday: c("SELECT COUNT(*) AS c FROM submissions WHERE status IN ('approved','published') AND reviewed_at >= ?", dayAgo),
      rejectedToday: c("SELECT COUNT(*) AS c FROM submissions WHERE status = 'rejected' AND reviewed_at >= ?", dayAgo),
      publishedTotal: c("SELECT COUNT(*) AS c FROM submissions WHERE status = 'published'"),
      rejectedTotal: c("SELECT COUNT(*) AS c FROM submissions WHERE status = 'rejected'"),
    },
    users: {
      total: c("SELECT COUNT(*) AS c FROM users"),
      newToday: c("SELECT COUNT(*) AS c FROM users WHERE created_at >= ?", dayAgo),
      restricted: c("SELECT COUNT(*) AS c FROM users WHERE is_restricted = 1"),
    },
    artists: {
      total: c("SELECT COUNT(*) AS c FROM artist_profiles"),
      verified: c("SELECT COUNT(*) AS c FROM artist_profiles WHERE verification_status = 'verified'"),
      verificationPending: c("SELECT COUNT(*) AS c FROM artist_profiles WHERE verification_status = 'pending'"),
    },
    music: {
      published: c("SELECT COUNT(*) AS c FROM tracks WHERE status = 'approved'"),
      unpublished: c("SELECT COUNT(*) AS c FROM tracks WHERE status = 'unpublished'"),
      totalPlays: db.prepare("SELECT COALESCE(SUM(play_count),0) AS c FROM tracks WHERE status='approved'").get().c,
    },
    reports: {
      open: c("SELECT COUNT(*) AS c FROM reports WHERE status = 'open'"),
    },
  };
  res.json({ stats });
});

// Recent moderation activity — a real merge of submission events and the
// general admin audit log, newest first. Nothing synthetic; an empty
// platform simply shows an empty list.
router.get("/activity", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const events = db.prepare(`
    SELECT e.id, e.actor_username, e.action, e.note, e.created_at, s.title AS submission_title, s.id AS submission_id
    FROM submission_events e JOIN submissions s ON s.id = e.submission_id
    WHERE e.action != 'submitted' AND e.action != 'resubmitted'
    ORDER BY e.created_at DESC LIMIT ?
  `).all(limit).map((r) => ({
    id: "sub-" + r.id, actorUsername: r.actor_username, action: r.action, note: r.note,
    targetType: "submission", targetId: r.submission_id, targetLabel: r.submission_title, createdAt: r.created_at,
  }));
  // Submission decisions are already fully represented above via
  // submission_events (with their note text) — exclude the mirrored
  // admin_audit_log copy here so the dashboard feed shows each real
  // action once, not twice. (The raw /audit-log endpoint below still
  // shows the complete, unfiltered trail.)
  const audits = db.prepare("SELECT * FROM admin_audit_log WHERE target_type != 'submission' ORDER BY created_at DESC LIMIT ?").all(limit)
    .map((r) => ({ ...shapeAuditEntry(r), id: "aud-" + r.id }));
  const merged = [...events, ...audits].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  res.json({ activity: merged });
});

/* =============================== ANALYTICS =============================== */
// Real day-bucketed aggregates for the requested window — never randomly
// generated points (Part 51/52). Days with zero activity are real zeros.
function dayBuckets(days) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const start = Date.parse(key + "T00:00:00.000Z");
    out.push({ date: key, start, end: start + 24 * 60 * 60 * 1000 });
  }
  return out;
}
function countInRange(sql, start, end, extra = []) {
  return db.prepare(sql).get(start, end, ...extra).c;
}
router.get("/analytics", (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 90);
  const buckets = dayBuckets(days);
  const series = buckets.map((b) => ({
    date: b.date,
    newUsers: countInRange("SELECT COUNT(*) AS c FROM users WHERE created_at >= ? AND created_at < ?", b.start, b.end),
    submissionsCreated: countInRange("SELECT COUNT(*) AS c FROM submissions WHERE submitted_at >= ? AND submitted_at < ?", b.start, b.end),
    tracksPublished: countInRange("SELECT COUNT(*) AS c FROM tracks WHERE created_at >= ? AND created_at < ?", b.start, b.end),
    plays: countInRange("SELECT COUNT(*) AS c FROM play_events WHERE created_at >= ? AND created_at < ?", b.start, b.end),
  }));
  const totals = series.reduce((acc, d) => ({
    newUsers: acc.newUsers + d.newUsers,
    submissionsCreated: acc.submissionsCreated + d.submissionsCreated,
    tracksPublished: acc.tracksPublished + d.tracksPublished,
    plays: acc.plays + d.plays,
  }), { newUsers: 0, submissionsCreated: 0, tracksPublished: 0, plays: 0 });
  res.json({ days, series, totals });
});

/* ============================ VERIFICATIONS ============================ */
router.get("/verifications", (req, res) => {
  const status = (req.query.status || "pending").trim();
  const rows = status === "all"
    ? db.prepare("SELECT * FROM artist_profiles ORDER BY verification_requested_at DESC, created_at DESC").all()
    : db.prepare("SELECT * FROM artist_profiles WHERE verification_status = ? ORDER BY verification_requested_at ASC, created_at ASC").all(status);
  res.json({ artists: rows.map((r) => shapeArtistProfile(r)) });
});

/* ================================ USERS ================================ */
router.get("/users", (req, res) => {
  const q = ((req.query.q || "") + "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  let rows;
  if (q) {
    const like = "%" + q.replace(/[%_]/g, "") + "%";
    rows = db.prepare("SELECT * FROM users WHERE username LIKE ? OR display_name LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT ?").all(like, like, like, limit);
  } else {
    rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT ?").all(limit);
  }
  res.json({ users: rows.map(shapePublicUserSummary) });
});

router.get("/users/:username", (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(req.params.username);
  if (!row) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  const artist = db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(req.params.username);
  const trackCount = db.prepare("SELECT COUNT(*) AS c FROM tracks WHERE uploader_username = ? AND status = 'approved'").get(req.params.username).c;
  res.json({
    user: shapePublicUserSummary(row),
    artist: artist ? shapeArtistProfile(artist) : null,
    publishedTrackCount: trackCount,
  });
});

// Never targets an admin account — restriction is for moderating normal
// users/artists, not an escalation path against platform staff (Part 55).
router.post("/users/:username/restrict", adminActionLimit, (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(req.params.username);
  if (!row) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  if (row.is_admin) return res.status(400).json({ error: "Không thể hạn chế tài khoản Admin." });
  const reason = ((req.body && req.body.reason) || "").trim().slice(0, 500);
  db.prepare("UPDATE users SET is_restricted = 1, restricted_at = ?, restricted_reason = ?, restricted_by = ? WHERE username = ?")
    .run(Date.now(), reason || null, req.user.username, req.params.username);
  recordAdminAudit(req.user.username, "user_restricted", "user", req.params.username, { reason: reason || null });
  res.json({ user: shapePublicUserSummary(db.prepare("SELECT * FROM users WHERE username = ?").get(req.params.username)) });
});

router.post("/users/:username/restore", adminActionLimit, (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(req.params.username);
  if (!row) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  db.prepare("UPDATE users SET is_restricted = 0, restricted_at = NULL, restricted_reason = NULL, restricted_by = NULL WHERE username = ?")
    .run(req.params.username);
  recordAdminAudit(req.user.username, "user_restored", "user", req.params.username, null);
  res.json({ user: shapePublicUserSummary(db.prepare("SELECT * FROM users WHERE username = ?").get(req.params.username)) });
});

/* ================================ MUSIC ================================= */
router.get("/tracks", (req, res) => {
  const q = ((req.query.q || "") + "").trim();
  const status = (req.query.status || "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const clauses = [];
  const args = [];
  if (q) {
    const like = "%" + q.replace(/[%_]/g, "") + "%";
    clauses.push("(title LIKE ? OR uploader_display_name LIKE ? OR uploader_username LIKE ?)");
    args.push(like, like, like);
  }
  if (status) { clauses.push("status = ?"); args.push(status); }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const rows = db.prepare(`SELECT * FROM tracks ${where} ORDER BY created_at DESC LIMIT ?`).all(...args, limit);
  res.json({ tracks: rows.map(shapeTrack) });
});

router.patch("/tracks/:id", adminActionLimit, (req, res) => {
  const row = db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  const body = req.body || {};
  const title = body.title !== undefined ? String(body.title).trim() : row.title;
  if (!title || title.length < 2 || title.length > 120) return res.status(400).json({ error: "Tên bài hát cần 2-120 ký tự." });
  const releaseDate = body.releaseDate !== undefined ? String(body.releaseDate).trim() : row.release_date;
  if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) return res.status(400).json({ error: "Ngày phát hành không hợp lệ." });
  let genres = row.genres;
  if (body.genres !== undefined) {
    const arr = Array.isArray(body.genres) ? body.genres.filter((g) => GENRES.includes(g)) : [];
    genres = JSON.stringify(arr.slice(0, 5));
  }
  db.prepare("UPDATE tracks SET title = ?, release_date = ?, genres = ? WHERE id = ?").run(title, releaseDate || null, genres, req.params.id);
  recordAdminAudit(req.user.username, "track_metadata_edited", "track", req.params.id, { title });
  res.json({ track: shapeTrack(db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id)) });
});

router.post("/tracks/:id/unpublish", adminActionLimit, (req, res) => {
  const row = db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  if (row.status !== "approved") return res.status(409).json({ error: "Bài hát này hiện không được phát hành." });
  const reason = ((req.body && req.body.reason) || "").trim().slice(0, 500);
  db.prepare("UPDATE tracks SET status = 'unpublished' WHERE id = ?").run(req.params.id);
  recordAdminAudit(req.user.username, "track_unpublished", "track", req.params.id, { title: row.title, reason: reason || null });
  res.json({ track: shapeTrack(db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id)) });
});

router.post("/tracks/:id/republish", adminActionLimit, (req, res) => {
  const row = db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  if (row.status !== "unpublished") return res.status(409).json({ error: "Bài hát này không ở trạng thái đã gỡ." });
  db.prepare("UPDATE tracks SET status = 'approved' WHERE id = ?").run(req.params.id);
  recordAdminAudit(req.user.username, "track_republished", "track", req.params.id, { title: row.title });
  res.json({ track: shapeTrack(db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.id)) });
});

/* =============================== RELEASES ================================ */
router.get("/releases", (req, res) => {
  const status = (req.query.status || "").trim();
  const type = (req.query.type || "").trim();
  const q = ((req.query.q || "") + "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const clauses = [];
  const args = [];
  if (status) { clauses.push("r.status = ?"); args.push(status); }
  if (type) { clauses.push("r.type = ?"); args.push(type); }
  if (q) { clauses.push("(r.title LIKE ? OR r.created_by LIKE ?)"); args.push("%" + q + "%", "%" + q + "%"); }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const rows = db.prepare(`SELECT r.*, COUNT(rt.id) AS track_count FROM releases r LEFT JOIN release_tracks rt ON rt.release_id = r.id ${where} GROUP BY r.id ORDER BY r.updated_at DESC LIMIT ?`).all(...args, limit);
  res.json({ releases: rows.map((r) => ({ id: r.id, title: r.title, type: r.type, status: r.status, createdBy: r.created_by, coverFilename: r.cover_filename, trackCount: r.track_count, releaseDate: r.release_date, createdAt: r.created_at, updatedAt: r.updated_at })) });
});

router.get("/releases/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy." });
  const tracks = db.prepare(`SELECT rt.*, t.title, t.audio_filename, t.duration, t.lyrics, t.timed_lyrics, t.cover_filename, t.composer, t.play_count FROM release_tracks rt LEFT JOIN tracks t ON t.id = rt.track_id WHERE rt.release_id = ? ORDER BY rt.track_number ASC`).all(req.params.id);
  res.json({ release: { ...shapeRelease(row), tracks: tracks.map((t) => ({ id: t.track_id, title: t.title, trackNumber: t.track_number, audioFilename: t.audio_filename, duration: t.duration, coverFilename: t.cover_filename, composer: t.composer, playCount: t.play_count })) } });
});

router.post("/releases/:id/approve", adminActionLimit, (req, res) => {
  const row = db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy." });
  if (!['pending_review', 'under_review'].includes(row.status)) return res.status(409).json({ error: "Trạng thái không hợp lệ." });
  const now = Date.now();
  const releaseDate = row.release_date ? Date.parse(row.release_date) : 0;
  const newStatus = releaseDate && releaseDate > now ? 'approved' : 'published';
  db.prepare("UPDATE releases SET status = ?, reviewed_at = ?, reviewed_by = ?, updated_at = ? WHERE id = ?").run(newStatus, now, req.user.username, now, req.params.id);
  recordAdminAudit(req.user.username, "release_approved", "release", req.params.id, { title: row.title, newStatus });
  res.json({ release: shapeRelease(db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id)) });
});

router.post("/releases/:id/reject", adminActionLimit, (req, res) => {
  const row = db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy." });
  if (!['pending_review', 'under_review'].includes(row.status)) return res.status(409).json({ error: "Trạng thái không hợp lệ." });
  const reason = ((req.body && req.body.reason) || "").trim().slice(0, 1000);
  const now = Date.now();
  db.prepare("UPDATE releases SET status = 'rejected', rejection_reason = ?, reviewed_at = ?, reviewed_by = ?, updated_at = ? WHERE id = ?").run(reason || null, now, req.user.username, now, req.params.id);
  recordAdminAudit(req.user.username, "release_rejected", "release", req.params.id, { title: row.title, reason: reason || null });
  res.json({ release: shapeRelease(db.prepare("SELECT * FROM releases WHERE id = ?").get(req.params.id)) });
});

/* =============================== SETTINGS ================================ */
// Only real, currently-enforced platform settings — never a fake toggle
// (Part 54/63). submissionsPaused is actually checked in submissions.js.
router.get("/settings", (req, res) => {
  res.json({
    settings: {
      submissionsPaused: getSetting("submissionsPaused", false),
      submissionsPausedMessage: getSetting("submissionsPausedMessage", ""),
    },
  });
});

router.post("/settings", adminActionLimit, (req, res) => {
  const body = req.body || {};
  if (typeof body.submissionsPaused === "boolean") {
    setSetting("submissionsPaused", body.submissionsPaused, req.user.username);
    recordAdminAudit(req.user.username, body.submissionsPaused ? "submissions_paused" : "submissions_resumed", "platform_settings", "submissionsPaused", null);
  }
  if (typeof body.submissionsPausedMessage === "string") {
    setSetting("submissionsPausedMessage", body.submissionsPausedMessage.trim().slice(0, 300), req.user.username);
  }
  res.json({
    settings: {
      submissionsPaused: getSetting("submissionsPaused", false),
      submissionsPausedMessage: getSetting("submissionsPausedMessage", ""),
    },
  });
});

/* =============================== AUDIT LOG =============================== */
router.get("/audit-log", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const rows = db.prepare("SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT ?").all(limit);
  res.json({ entries: rows.map(shapeAuditEntry) });
});

// ═══════════════════════════════════════════════════════════
// ADMIN: Artist Applications
// ═══════════════════════════════════════════════════════════

router.get("/artist-applications", (req, res) => {
  const status = (req.query.status || "pending").trim();
  const rows = status === "all"
    ? db.prepare("SELECT * FROM artist_applications ORDER BY submitted_at DESC").all()
    : db.prepare("SELECT * FROM artist_applications WHERE status = ? ORDER BY submitted_at ASC").all(status);
  res.json({ applications: rows.map(shapeArtistApplication) });
});

router.post("/artist-applications/:id/approve", (req, res) => {
  const app = db.prepare("SELECT * FROM artist_applications WHERE id = ?").get(req.params.id);
  if (!app) return res.status(404).json({ error: "Không tìm thấy yêu cầu." });
  if (app.status !== "pending") return res.status(409).json({ error: "Yêu cầu đã được xử lý." });
  const now = Date.now();
  db.prepare("UPDATE artist_applications SET status = 'approved', reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(now, req.user.username, req.params.id);
  const existingArtist = db.prepare("SELECT username FROM artist_profiles WHERE username = ?").get(app.username);
  if (!existingArtist) {
    db.prepare(`INSERT INTO artist_profiles (username, artist_name, bio, genres, links, verification_status, created_at) VALUES (?, ?, ?, ?, ?, 'independent', ?)`)
      .run(app.username, app.artist_name, app.bio, JSON.stringify(app.main_genre ? [app.main_genre] : []), app.social_links, now);
  }
  db.prepare("UPDATE users SET is_artist = 1 WHERE id = ?").run(app.user_id);
  createNotification(app.username, "ARTIST_APPROVED", "Chào mừng bạn đến với 4ANG Artist", "Yêu cầu trở thành Nghệ sĩ của bạn đã được chấp thuận.", { actorUsername: req.user.username, targetType: "artist_application", targetId: app.id });
  recordAdminAudit(req.user.username, "artist_application_approved", "artist_application", app.id, { artistName: app.artist_name, username: app.username });
  const updated = db.prepare("SELECT * FROM artist_applications WHERE id = ?").get(req.params.id);
  res.json({ application: shapeArtistApplication(updated) });
});

router.post("/artist-applications/:id/reject", (req, res) => {
  const app = db.prepare("SELECT * FROM artist_applications WHERE id = ?").get(req.params.id);
  if (!app) return res.status(404).json({ error: "Không tìm thấy yêu cầu." });
  if (app.status !== "pending") return res.status(409).json({ error: "Yêu cầu đã được xử lý." });
  const note = ((req.body && req.body.note) || "").trim().slice(0, 500);
  const now = Date.now();
  db.prepare("UPDATE artist_applications SET status = 'rejected', review_note = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(note || null, now, req.user.username, req.params.id);
  createNotification(app.username, "ARTIST_REJECTED", "Yêu cầu chưa được chấp thuận", "Vui lòng xem chi tiết trong hồ sơ.", { actorUsername: req.user.username, targetType: "artist_application", targetId: app.id });
  recordAdminAudit(req.user.username, "artist_application_rejected", "artist_application", app.id, { note: note || null });
  const updated = db.prepare("SELECT * FROM artist_applications WHERE id = ?").get(req.params.id);
  res.json({ application: shapeArtistApplication(updated) });
});

export default router;
