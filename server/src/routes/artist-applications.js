/**
 * 4ANG Artist Applications Routes — Supabase PostgreSQL only.
 */
import express from "express";
import { shapeArtistApplication, shapeVerifiedArtistApplication, createNotification, recordAdminAudit, recordActivity } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { GENRES } from "./artists.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
const appLimit = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "artist-app" });

// User: get my latest application
router.get("/me", requireAuth, async (req, res) => {
  const { data: app } = await supabaseAdmin
    .from("artist_applications").select("*").eq("user_id", req.user.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  res.json({ application: app ? shapeArtistApplication(app) : null });
});

// User: submit artist application
router.post("/", requireAuth, appLimit, async (req, res) => {
  const userId = req.user.id;

  // Check: already has artist profile
  const { data: existingArtist } = await supabaseAdmin
    .from("artist_profiles").select("username").eq("username", req.user.username).maybeSingle();
  if (existingArtist) return res.status(409).json({ error: "Bạn đã có hồ sơ nghệ sĩ." });

  // Check: no pending application
  const { data: pending } = await supabaseAdmin
    .from("artist_applications").select("id").eq("user_id", userId).eq("status", "pending").maybeSingle();
  if (pending) return res.status(409).json({ error: "Bạn đã có yêu cầu đang chờ xử lý." });

  const body = req.body || {};
  const artistName = (body.artistName || "").trim();
  const fullName = (body.fullName || "").trim().slice(0, 100);
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim().slice(0, 20);
  const bio = (body.bio || "").trim().slice(0, 1000);
  const mainGenre = (body.mainGenre || "").trim();
  const country = (body.country || "").trim().slice(0, 60);
  const socialLinks = Array.isArray(body.socialLinks) ? body.socialLinks.slice(0, 5).map(l => ({
    label: String(l?.label || "").trim().slice(0, 30),
    url: String(l?.url || "").trim(),
  })).filter(l => l.label && l.url) : [];

  if (!artistName || artistName.length < 2 || artistName.length > 60) return res.status(400).json({ error: "Tên nghệ sĩ cần 2-60 ký tự." });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Email không hợp lệ." });
  if (mainGenre && !GENRES.includes(mainGenre)) return res.status(400).json({ error: "Thể loại không hợp lệ." });

  const now = new Date().toISOString();
  const { data: app, error: insertErr } = await supabaseAdmin.from("artist_applications").insert({
    user_id: userId,
    username: req.user.username,
    artist_name: artistName,
    full_name: fullName,
    email,
    phone,
    bio,
    main_genre: mainGenre,
    country,
    social_links: socialLinks,
    status: "pending",
    submitted_at: now,
    created_at: now,
  }).select("*").single();

  if (insertErr) {
    console.error("[artist-app submit]", insertErr.message);
    return res.status(500).json({ error: "Lỗi server khi gửi hồ sơ." });
  }

  res.status(201).json({ application: shapeArtistApplication(app) });
});

// User: check phone verification status
router.get("/verified/check-phone", requireAuth, async (req, res) => {
  const { data: profile } = await supabaseAdmin.from("profiles").select("phone_verified").eq("id", req.user.id).single();
  res.json({ phoneVerified: !!profile?.phone_verified });
});

// User: get my latest verified artist application
router.get("/verified/me", requireAuth, async (req, res) => {
  const { data: app } = await supabaseAdmin
    .from("verified_artist_applications").select("*").eq("user_id", req.user.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  res.json({ application: app ? shapeVerifiedArtistApplication(app) : null });
});

// User: submit verified artist application
router.post("/verified", requireAuth, appLimit, async (req, res) => {
  const userId = req.user.id;

  const { data: profile } = await supabaseAdmin.from("profiles").select("phone_verified").eq("id", userId).single();
  if (!profile?.phone_verified) return res.status(403).json({ error: "Cần xác minh số điện thoại trước." });

  const { data: artist } = await supabaseAdmin.from("artist_profiles").select("username, verification_status").eq("username", req.user.username).maybeSingle();
  if (!artist) return res.status(403).json({ error: "Bạn cần có hồ sơ nghệ sĩ trước." });
  if (artist.verification_status === "verified") return res.status(409).json({ error: "Tài khoản đã được xác minh." });

  const { data: pending } = await supabaseAdmin
    .from("verified_artist_applications").select("id").eq("user_id", userId).eq("status", "pending").maybeSingle();
  if (pending) return res.status(409).json({ error: "Bạn đã có yêu cầu xác minh đang chờ xử lý." });

  const body = req.body || {};
  const artistName = (body.artistName || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const bio = (body.bio || "").trim().slice(0, 1000);
  const mainGenre = (body.mainGenre || "").trim();
  const socialLinks = Array.isArray(body.socialLinks) ? body.socialLinks.slice(0, 5).map(l => ({
    label: String(l?.label || "").trim().slice(0, 30),
    url: String(l?.url || "").trim(),
  })).filter(l => l.label && l.url) : [];
  const officialLinks = Array.isArray(body.officialLinks) ? body.officialLinks.slice(0, 5).map(l => ({
    label: String(l?.label || "").trim().slice(0, 30),
    url: String(l?.url || "").trim(),
  })).filter(l => l.label && l.url) : [];
  const additionalInfo = (body.additionalInfo || "").trim().slice(0, 1000);

  if (!artistName || artistName.length < 2 || artistName.length > 60) return res.status(400).json({ error: "Tên nghệ sĩ cần 2-60 ký tự." });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Email không hợp lệ." });

  const now = new Date().toISOString();
  const { data: app, error: insertErr } = await supabaseAdmin.from("verified_artist_applications").insert({
    user_id: userId,
    username: req.user.username,
    artist_name: artistName,
    email,
    phone: profile.phone || "",
    bio,
    main_genre: mainGenre,
    social_links: socialLinks,
    official_links: officialLinks,
    additional_info: additionalInfo,
    status: "pending",
    submitted_at: now,
    created_at: now,
  }).select("*").single();

  if (insertErr) {
    console.error("[verified-app submit]", insertErr.message);
    return res.status(500).json({ error: "Lỗi server khi gửi hồ sơ." });
  }

  res.status(201).json({ application: shapeVerifiedArtistApplication(app) });
});

export default router;
