import express from "express";
import { randomUUID } from "node:crypto";
import { db, shapeArtistApplication, shapeVerifiedArtistApplication, createNotification, recordAdminAudit, recordActivity } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { GENRES } from "./artists.js";

const router = express.Router();

const appLimit = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "artist-app" });

// ═══════════════════════════════════════════════════════════════
// ARTIST APPLICATIONS
// ═══════════════════════════════════════════════════════════════

// User: get my latest application
router.get("/me", requireAuth, (req, res) => {
  const app = db.prepare("SELECT * FROM artist_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(req.user.id);
  res.json({ application: app ? shapeArtistApplication(app) : null });
});

// User: submit artist application
router.post("/", requireAuth, appLimit, (req, res) => {
  const userId = req.user.id;
  // Check: already has artist profile
  const existingArtist = db.prepare("SELECT username FROM artist_profiles WHERE username = ?").get(req.user.username);
  if (existingArtist) return res.status(409).json({ error: "Bạn đã có hồ sơ nghệ sĩ." });
  // Check: no pending application
  const pending = db.prepare("SELECT id FROM artist_applications WHERE user_id = ? AND status = 'pending'").get(userId);
  if (pending) return res.status(409).json({ error: "Bạn đã có yêu cầu đang chờ xử lý." });

  const body = req.body || {};
  const artistName = (body.artistName || "").trim();
  const fullName = (body.fullName || "").trim().slice(0, 100);
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim().slice(0, 20);
  const bio = (body.bio || "").trim().slice(0, 1000);
  const mainGenre = (body.mainGenre || "").trim();
  const country = (body.country || "").trim().slice(0, 60);
  const socialLinks = Array.isArray(body.socialLinks) ? body.socialLinks.slice(0, 5).map((l) => ({
    label: String(l?.label || "").trim().slice(0, 30),
    url: String(l?.url || "").trim(),
  })).filter((l) => l.label && l.url) : [];

  if (!artistName || artistName.length < 2 || artistName.length > 60) return res.status(400).json({ error: "Tên nghệ sĩ cần 2-60 ký tự." });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Email không hợp lệ." });
  if (mainGenre && !GENRES.includes(mainGenre)) return res.status(400).json({ error: "Thể loại không hợp lệ." });

  const id = randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO artist_applications (id, user_id, username, artist_name, full_name, email, phone, bio, main_genre, country, social_links, status, submitted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
    .run(id, userId, req.user.username, artistName, fullName, email, phone, bio, mainGenre, country, JSON.stringify(socialLinks), now, now);

  const app = db.prepare("SELECT * FROM artist_applications WHERE id = ?").get(id);
  res.status(201).json({ application: shapeArtistApplication(app) });
});

// ═══════════════════════════════════════════════════════════════
// VERIFIED ARTIST APPLICATIONS
// ═══════════════════════════════════════════════════════════════

// User: check phone verification status (required for verified artist)
router.get("/verified/check-phone", requireAuth, (req, res) => {
  const user = db.prepare("SELECT phone_verified FROM users WHERE id = ?").get(req.user.id);
  res.json({ phoneVerified: !!(user && user.phone_verified) });
});

// User: get my latest verified artist application
router.get("/verified/me", requireAuth, (req, res) => {
  const app = db.prepare("SELECT * FROM verified_artist_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(req.user.id);
  res.json({ application: app ? shapeVerifiedArtistApplication(app) : null });
});

// User: submit verified artist application
router.post("/verified", requireAuth, appLimit, (req, res) => {
  const userId = req.user.id;
  // Must be phone verified
  const user = db.prepare("SELECT phone_verified FROM users WHERE id = ?").get(userId);
  if (!user || !user.phone_verified) {
    return res.status(403).json({ error: "Cần xác minh số điện thoại trước." });
  }
  // Must already be an artist
  const artist = db.prepare("SELECT username FROM artist_profiles WHERE username = ?").get(req.user.username);
  if (!artist) return res.status(403).json({ error: "Bạn cần có hồ sơ nghệ sĩ trước." });
  // Must not already be verified
  if (artist.verification_status === "verified") return res.status(409).json({ error: "Tài khoản đã được xác minh." });
  // No pending request
  const pending = db.prepare("SELECT id FROM verified_artist_applications WHERE user_id = ? AND status = 'pending'").get(userId);
  if (pending) return res.status(409).json({ error: "Bạn đã có yêu cầu xác minh đang chờ xử lý." });

  const body = req.body || {};
  const artistName = (body.artistName || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const bio = (body.bio || "").trim().slice(0, 1000);
  const mainGenre = (body.mainGenre || "").trim();
  const socialLinks = Array.isArray(body.socialLinks) ? body.socialLinks.slice(0, 5).map((l) => ({
    label: String(l?.label || "").trim().slice(0, 30),
    url: String(l?.url || "").trim(),
  })).filter((l) => l.label && l.url) : [];
  const officialLinks = Array.isArray(body.officialLinks) ? body.officialLinks.slice(0, 5).map((l) => ({
    label: String(l?.label || "").trim().slice(0, 30),
    url: String(l?.url || "").trim(),
  })).filter((l) => l.label && l.url) : [];
  const additionalInfo = (body.additionalInfo || "").trim().slice(0, 1000);

  if (!artistName || artistName.length < 2 || artistName.length > 60) return res.status(400).json({ error: "Tên nghệ sĩ cần 2-60 ký tự." });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Email không hợp lệ." });

  const id = randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO verified_artist_applications (id, user_id, username, artist_name, email, phone, bio, main_genre, social_links, official_links, additional_info, status, submitted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
    .run(id, userId, req.user.username, artistName, email, user.phone || "", bio, mainGenre, JSON.stringify(socialLinks), JSON.stringify(officialLinks), additionalInfo, now, now);

  const app = db.prepare("SELECT * FROM verified_artist_applications WHERE id = ?").get(id);
  res.status(201).json({ application: shapeVerifiedArtistApplication(app) });
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Review Applications
// ═══════════════════════════════════════════════════════════════

router.get("/admin/artist-applications", requireAuth, requireAdmin, (req, res) => {
  const status = (req.query.status || "pending").trim();
  const rows = status === "all"
    ? db.prepare("SELECT * FROM artist_applications ORDER BY submitted_at DESC").all()
    : db.prepare("SELECT * FROM artist_applications WHERE status = ? ORDER BY submitted_at ASC").all(status);
  res.json({ applications: rows.map(shapeArtistApplication) });
});

router.post("/admin/artist-applications/:id/approve", requireAuth, requireAdmin, (req, res) => {
  const app = db.prepare("SELECT * FROM artist_applications WHERE id = ?").get(req.params.id);
  if (!app) return res.status(404).json({ error: "Không tìm thấy yêu cầu." });
  if (app.status !== "pending") return res.status(409).json({ error: "Yêu cầu đã được xử lý." });

  const now = Date.now();
  db.prepare("UPDATE artist_applications SET status = 'approved', reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(now, req.user.username, req.params.id);

  // Create artist profile if not exists
  const existingArtist = db.prepare("SELECT username FROM artist_profiles WHERE username = ?").get(app.username);
  if (!existingArtist) {
    db.prepare(`INSERT INTO artist_profiles (username, artist_name, bio, genres, links, verification_status, created_at) VALUES (?, ?, ?, ?, ?, 'independent', ?)`)
      .run(app.username, app.artist_name, app.bio, JSON.stringify(app.main_genre ? [app.main_genre] : []), app.social_links, now);
  }

  // Set user as artist
  db.prepare("UPDATE users SET is_artist = 1 WHERE id = ?").run(app.user_id);

  // Notify user
  createNotification(app.username, "ARTIST_APPROVED", "Chào mừng bạn đến với 4ANG Artist", "Yêu cầu trở thành Nghệ sĩ của bạn đã được chấp thuận. Bạn hiện có thể truy cập Artist Dashboard.", { actorUsername: req.user.username, targetType: "artist_application", targetId: app.id });

  // Log email notification (real email sending would happen via Edge Function / server-side)
  db.prepare("INSERT INTO email_notifications (id, user_id, recipient, type, subject, status, sent_at, metadata, created_at) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?)")
    .run(randomUUID(), app.user_id, app.email, "artist_approved", "Chào mừng bạn đến với 4ANG Artist", now, JSON.stringify({ artistName: app.artist_name }), now);

  recordAdminAudit(req.user.username, "artist_application_approved", "artist_application", app.id, { artistName: app.artist_name, username: app.username });

  const updated = db.prepare("SELECT * FROM artist_applications WHERE id = ?").get(req.params.id);
  res.json({ application: shapeArtistApplication(updated) });
});

router.post("/admin/artist-applications/:id/reject", requireAuth, requireAdmin, (req, res) => {
  const app = db.prepare("SELECT * FROM artist_applications WHERE id = ?").get(req.params.id);
  if (!app) return res.status(404).json({ error: "Không tìm thấy yêu cầu." });
  if (app.status !== "pending") return res.status(409).json({ error: "Yêu cầu đã được xử lý." });
  const note = ((req.body && req.body.note) || "").trim().slice(0, 500);
  const now = Date.now();
  db.prepare("UPDATE artist_applications SET status = 'rejected', review_note = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(note || null, now, req.user.username, req.params.id);
  createNotification(app.username, "ARTIST_REJECTED", "Yêu cầu chưa được chấp thuận", "Yêu cầu trở thành Nghệ sĩ chưa được chấp thuận. Vui lòng xem chi tiết trong hồ sơ.", { actorUsername: req.user.username, targetType: "artist_application", targetId: app.id });
  recordAdminAudit(req.user.username, "artist_application_rejected", "artist_application", app.id, { note: note || null });
  const updated = db.prepare("SELECT * FROM artist_applications WHERE id = ?").get(req.params.id);
  res.json({ application: shapeArtistApplication(updated) });
});

// Admin: verified artist applications
router.get("/admin/verified-applications", requireAuth, requireAdmin, (req, res) => {
  const status = (req.query.status || "pending").trim();
  const rows = status === "all"
    ? db.prepare("SELECT * FROM verified_artist_applications ORDER BY submitted_at DESC").all()
    : db.prepare("SELECT * FROM verified_artist_applications WHERE status = ? ORDER BY submitted_at ASC").all(status);
  res.json({ applications: rows.map(shapeVerifiedArtistApplication) });
});

router.post("/admin/verified-applications/:id/approve", requireAuth, requireAdmin, (req, res) => {
  const app = db.prepare("SELECT * FROM verified_artist_applications WHERE id = ?").get(req.params.id);
  if (!app) return res.status(404).json({ error: "Không tìm thấy yêu cầu." });
  if (app.status !== "pending") return res.status(409).json({ error: "Yêu cầu đã được xử lý." });

  const now = Date.now();
  db.prepare("UPDATE verified_artist_applications SET status = 'approved', reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(now, req.user.username, req.params.id);

  // Update artist profile to verified
  db.prepare("UPDATE artist_profiles SET verification_status = 'verified', verified_at = ?, verification_note = NULL WHERE username = ?").run(now, app.username);

  // Notify user
  createNotification(app.username, "ARTIST_VERIFIED", "Tài khoản của bạn đã được xác minh", "Bạn hiện là Nghệ sĩ được xác minh trên 4ANG. Dấu xác minh sẽ hiển thị trên hồ sơ của bạn.", { actorUsername: req.user.username, targetType: "verified_application", targetId: app.id });

  // Log email notification
  db.prepare("INSERT INTO email_notifications (id, user_id, recipient, type, subject, status, sent_at, metadata, created_at) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?)")
    .run(randomUUID(), app.user_id, app.email, "verified_artist_approved", "Tài khoản Nghệ sĩ của bạn đã được xác minh trên 4ANG", now, JSON.stringify({ artistName: app.artist_name }), now);

  recordAdminAudit(req.user.username, "verified_artist_approved", "verified_application", app.id, { artistName: app.artist_name, username: app.username });

  const updated = db.prepare("SELECT * FROM verified_artist_applications WHERE id = ?").get(req.params.id);
  res.json({ application: shapeVerifiedArtistApplication(updated) });
});

router.post("/admin/verified-applications/:id/reject", requireAuth, requireAdmin, (req, res) => {
  const app = db.prepare("SELECT * FROM verified_artist_applications WHERE id = ?").get(req.params.id);
  if (!app) return res.status(404).json({ error: "Không tìm thấy yêu cầu." });
  if (app.status !== "pending") return res.status(409).json({ error: "Yêu cầu đã được xử lý." });
  const note = ((req.body && req.body.note) || "").trim().slice(0, 500);
  const now = Date.now();
  db.prepare("UPDATE verified_artist_applications SET status = 'rejected', review_note = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(note || null, now, req.user.username, req.params.id);
  createNotification(app.username, "ARTIST_VERIFICATION_REJECTED", "Yêu cầu xác minh chưa được chấp thuận", "Yêu cầu xác minh Nghệ sĩ chưa được chấp thuận. Vui lòng xem chi tiết trong hồ sơ.", { actorUsername: req.user.username, targetType: "verified_application", targetId: app.id });
  recordAdminAudit(req.user.username, "verified_artist_rejected", "verified_application", app.id, { note: note || null });
  const updated = db.prepare("SELECT * FROM verified_artist_applications WHERE id = ?").get(req.params.id);
  res.json({ application: shapeVerifiedArtistApplication(updated) });
});

export default router;
