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



export default router;
