/**
 * 4ANG Admin Routes — Supabase PostgreSQL only.
 */
import express from "express";
import multer from "multer";
import { shapeTrack, shapeArtistProfile, shapePublicUserSummary, recordAdminAudit, shapeAuditEntry, shapeArtistApplication, shapeVerifiedArtistApplication, shapeRelease, createNotification, getSetting, setSetting } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { GENRES } from "./artists.js";
import { supabaseAdmin } from "../supabase.js";
import { uploadFile, deleteFile } from "../storage.js";

const router = express.Router();
router.use(requireAuth, requireAdmin);

const adminActionLimit = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "admin-action" });

// Helper: count rows matching filters
async function count(table, filters = {}) {
  let query = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined) query = query.is(k, null);
    else if (typeof v === "object" && v._op) {
      switch (v._op) {
        case "gte": query = query.gte(k, v.v); break;
        case "lte": query = query.lte(k, v.v); break;
        case "gt": query = query.gt(k, v.v); break;
        case "in": query = query.in(k, v.v); break;
        default: query = query.eq(k, v);
      }
    } else query = query.eq(k, v);
  }
  const { count: c, error } = await query;
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return c || 0;
}

// ======================== DASHBOARD ========================
router.get("/stats", async (req, res) => {
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const userTotal = await count("profiles");
    const userNewToday = await count("profiles", { created_at: { _op: "gte", v: dayAgo } });
    const restricted = await count("profiles", { is_restricted: true });

    const artistTotal = await count("artist_profiles");
    const artistVerified = await count("artist_profiles", { verification_status: "verified" });
    const artistPending = await count("artist_profiles", { verification_status: "pending" });

    const pendingApps = await count("artist_applications", { status: { _op: "in", v: ["pending", "reviewing"] } });

    const submissionsPending = await count("submissions", { status: "pending_review" });
    const submissionsUnderReview = await count("submissions", { status: "under_review" });
    const submissionsChangesRequested = await count("submissions", { status: "changes_requested" });
    const submissionsApproved = await count("submissions", { status: "approved" });
    const submissionsApprovedToday = await count("submissions", { status: { _op: "in", v: ["approved", "published"] }, reviewed_at: { _op: "gte", v: dayAgo } });
    const submissionsRejectedToday = await count("submissions", { status: "rejected", reviewed_at: { _op: "gte", v: dayAgo } });
    const submissionsPublished = await count("submissions", { status: "published" });
    const submissionsRejected = await count("submissions", { status: "rejected" });

    const musicPublished = await count("tracks", { status: "approved" });
    const reportsOpen = await count("reports", { status: "open" });

    // Total plays
    const { data: playData } = await supabaseAdmin
      .from("tracks").select("play_count").eq("status", "approved");
    const totalPlays = (playData || []).reduce((sum, t) => sum + (t.play_count || 0), 0);

    res.json({
      stats: {
        submissions: {
          pendingReview: submissionsPending, underReview: submissionsUnderReview,
          changesRequested: submissionsChangesRequested, approvedAwaitingPublish: submissionsApproved,
          approvedToday: submissionsApprovedToday, rejectedToday: submissionsRejectedToday,
          publishedTotal: submissionsPublished, rejectedTotal: submissionsRejected,
        },
        users: { total: userTotal, newToday: userNewToday, restricted },
        artists: { total: artistTotal, verified: artistVerified, verificationPending: artistPending + pendingApps },
        music: { published: musicPublished, unpublished: 0, totalPlays },
        reports: { open: reportsOpen },
      },
    });
  } catch (e) {
    console.error("[ADMIN STATS]", e);
    res.status(500).json({ error: "Không thể tải thống kê. Vui lòng thử lại." });
  }
});

// ======================== ACTIVITY ========================
router.get("/activity", async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);

  // Submission events
  const { data: subEvents } = await supabaseAdmin
    .from("submission_events").select("*, submissions!inner(id, title)")
    .not("action", "in", "('submitted','resubmitted')")
    .order("created_at", { ascending: false }).limit(limit);

  const events = (subEvents || []).map(e => ({
    id: "sub-" + e.id, actorUsername: e.actor_username, action: e.action, note: e.note,
    targetType: "submission", targetId: e.submission_id, targetLabel: e.submissions?.title,
    createdAt: new Date(e.created_at).getTime(),
  }));

  // Audit log (non-submission)
  const { data: auditRows } = await supabaseAdmin
    .from("admin_audit_log").select("*")
    .neq("target_type", "submission")
    .order("created_at", { ascending: false }).limit(limit);

  const audits = (auditRows || []).map(r => ({
    ...shapeAuditEntry(r), id: "aud-" + r.id,
  }));

  const merged = [...events, ...audits].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  res.json({ activity: merged });
});

// ======================== VERIFICATIONS ========================
router.get("/verifications", async (req, res) => {
  try {
    const status = (req.query.status || "pending").trim();

    // Artist profile verifications
    let profileQuery = supabaseAdmin.from("artist_profiles").select("*");
    if (status !== "all") profileQuery = profileQuery.eq("verification_status", status);
    profileQuery = profileQuery.order("created_at", { ascending: status === "all" ? false : true });
    const { data: profileRows } = await profileQuery;
    const profiles = (profileRows || []).map(r => ({ ...shapeArtistProfile(r), _type: "profile" }));

    // Artist applications
    let appQuery = supabaseAdmin.from("artist_applications").select("*");
    if (status === "all") {
      appQuery = appQuery.order("submitted_at", { ascending: false });
    } else if (status === "pending" || status === "reviewing") {
      appQuery = appQuery.in("status", ["pending", "reviewing"]).order("submitted_at");
    } else {
      const mapped = { pending: "pending", reviewing: "pending", verified: "approved", rejected: "rejected" };
      appQuery = appQuery.eq("status", mapped[status] || status).order("submitted_at");
    }
    const { data: appRows } = await appQuery;
    const applications = (appRows || []).map(r => ({
      ...shapeArtistApplication(r), _type: "application",
      verificationStatus: r.status === "approved" ? "verified" : r.status === "rejected" ? "rejected" : "pending",
      verificationNote: r.review_note || null,
      avatarUrl: null,
    }));

    const merged = [...profiles, ...applications];
    merged.sort((a, b) => {
      const aP = a.verificationStatus === "pending" ? 0 : 1;
      const bP = b.verificationStatus === "pending" ? 0 : 1;
      if (aP !== bP) return aP - bP;
      const aT = a._type === "application" ? (a.submittedAt || 0) : (a.createdAt || 0);
      const bT = b._type === "application" ? (b.submittedAt || 0) : (b.createdAt || 0);
      return aT - bT;
    });
    res.json({ artists: merged });
  } catch (e) {
    console.error("[VERIFICATIONS]", e);
    res.status(500).json({ error: "Không thể tải danh sách xác minh. Vui lòng thử lại." });
  }
});

// ======================== USERS ========================
router.get("/users", async (req, res) => {
  const q = ((req.query.q || "") + "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  let query = supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }).limit(limit);
  if (q) {
    query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%`);
  }
  const { data: rows } = await query;
  res.json({ users: (rows || []).map(shapePublicUserSummary) });
});

router.get("/users/:username", async (req, res) => {
  const { data: row } = await supabaseAdmin.from("profiles").select("*").eq("username", req.params.username).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  const { data: artist } = await supabaseAdmin.from("artist_profiles").select("*").eq("username", req.params.username).maybeSingle();
  const trackCount = await count("tracks", { uploader_username: req.params.username, status: "approved" });
  res.json({ user: shapePublicUserSummary(row), artist: artist ? shapeArtistProfile(artist) : null, publishedTrackCount: trackCount });
});

router.post("/users/:username/restrict", adminActionLimit, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("profiles").select("*").eq("username", req.params.username).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  if (row.role === "admin") return res.status(400).json({ error: "Không thể hạn chế tài khoản Admin." });
  const reason = ((req.body && req.body.reason) || "").trim().slice(0, 500);
  await supabaseAdmin.from("profiles").update({
    is_restricted: true, restricted_at: new Date().toISOString(), restricted_reason: reason || null, restricted_by: req.user.id,
  }).eq("username", req.params.username);
  await recordAdminAudit(req.user.username, "user_restricted", "user", req.params.username, { reason: reason || null });
  const { data: updated } = await supabaseAdmin.from("profiles").select("*").eq("username", req.params.username).single();
  res.json({ user: shapePublicUserSummary(updated) });
});

router.post("/users/:username/restore", adminActionLimit, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("profiles").select("*").eq("username", req.params.username).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  await supabaseAdmin.from("profiles").update({
    is_restricted: false, restricted_at: null, restricted_reason: null, restricted_by: null,
  }).eq("username", req.params.username);
  await recordAdminAudit(req.user.username, "user_restored", "user", req.params.username, null);
  const { data: updated } = await supabaseAdmin.from("profiles").select("*").eq("username", req.params.username).single();
  res.json({ user: shapePublicUserSummary(updated) });
});

// ======================== MUSIC ========================
router.get("/tracks", async (req, res) => {
  const q = ((req.query.q || "") + "").trim();
  const status = (req.query.status || "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  let query = supabaseAdmin.from("tracks").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`title.ilike.%${q}%,uploader_display_name.ilike.%${q}%,uploader_username.ilike.%${q}%`);
  const { data: rows } = await query;
  const tracks = await Promise.all((rows || []).map(shapeTrack));
  res.json({ tracks });
});

router.patch("/tracks/:id", adminActionLimit, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  const body = req.body || {};
  const title = body.title !== undefined ? String(body.title).trim() : row.title;
  if (!title || title.length < 2 || title.length > 120) return res.status(400).json({ error: "Tên bài hát cần 2-120 ký tự." });
  const updates = { title };
  if (body.releaseDate !== undefined) updates.release_date = String(body.releaseDate).trim() || null;
  if (body.genres !== undefined) updates.genres = Array.isArray(body.genres) ? body.genres.filter(g => GENRES.includes(g)).slice(0, 5) : [];
  await supabaseAdmin.from("tracks").update(updates).eq("id", req.params.id);
  await recordAdminAudit(req.user.username, "track_metadata_edited", "track", req.params.id, { title });
  const { data: updated } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
  res.json({ track: await shapeTrack(updated) });
});

router.post("/tracks/:id/unpublish", adminActionLimit, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  if (row.status !== "approved") return res.status(409).json({ error: "Bài hát này hiện không được phát hành." });
  const reason = ((req.body && req.body.reason) || "").trim().slice(0, 500);
  await supabaseAdmin.from("tracks").update({ status: "removed" }).eq("id", req.params.id);
  await recordAdminAudit(req.user.username, "track_unpublished", "track", req.params.id, { title: row.title, reason: reason || null });
  const { data: updated } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
  res.json({ track: await shapeTrack(updated) });
});

router.post("/tracks/:id/republish", adminActionLimit, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });
  await supabaseAdmin.from("tracks").update({ status: "approved" }).eq("id", req.params.id);
  await recordAdminAudit(req.user.username, "track_republished", "track", req.params.id, { title: row.title });
  const { data: updated } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
  res.json({ track: await shapeTrack(updated) });
});

// ======================== RELEASES ========================
router.get("/releases", async (req, res) => {
  const status = (req.query.status || "").trim();
  const type = (req.query.type || "").trim();
  const q = ((req.query.q || "") + "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  let query = supabaseAdmin.from("releases").select("*, release_tracks(id)").order("updated_at", { ascending: false }).limit(limit);
  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (q) query = query.or(`title.ilike.%${q}%,created_by_username.ilike.%${q}%`);
  const { data: rows } = await query;
  res.json({ releases: (rows || []).map(r => ({
    id: r.id, title: r.title, type: r.type, status: r.status,
    createdBy: r.created_by_username || r.created_by,
    coverUrl: r.cover_url || null,
    trackCount: r.release_tracks?.length || 0,
    releaseDate: r.release_date, createdAt: r.created_at, updatedAt: r.updated_at,
  }))});
});

router.get("/releases/:id", async (req, res) => {
  const { data: row } = await supabaseAdmin.from("releases").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy." });
  res.json({ release: await shapeRelease(row, { includeTracks: true }) });
});

router.post("/releases/:id/approve", adminActionLimit, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("releases").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy." });
  const now = new Date().toISOString();
  await supabaseAdmin.from("releases").update({ status: "published", reviewed_at: now, reviewed_by: req.user.id, updated_at: now }).eq("id", req.params.id);
  await recordAdminAudit(req.user.username, "release_approved", "release", req.params.id, { title: row.title });
  const { data: updated } = await supabaseAdmin.from("releases").select("*").eq("id", req.params.id).single();
  res.json({ release: await shapeRelease(updated) });
});

router.post("/releases/:id/reject", adminActionLimit, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("releases").select("*").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy." });
  const reason = ((req.body && req.body.reason) || "").trim().slice(0, 1000);
  const now = new Date().toISOString();
  await supabaseAdmin.from("releases").update({ status: "rejected", rejection_reason: reason || null, reviewed_at: now, reviewed_by: req.user.id, updated_at: now }).eq("id", req.params.id);
  await recordAdminAudit(req.user.username, "release_rejected", "release", req.params.id, { title: row.title, reason: reason || null });
  const { data: updated } = await supabaseAdmin.from("releases").select("*").eq("id", req.params.id).single();
  res.json({ release: await shapeRelease(updated) });
});

// ======================== SETTINGS ========================
router.get("/settings", async (req, res) => {
  res.json({
    settings: {
      submissionsPaused: await getSetting("submissionsPaused", false),
      submissionsPausedMessage: await getSetting("submissionsPausedMessage", ""),
    },
  });
});

router.post("/settings", adminActionLimit, async (req, res) => {
  const body = req.body || {};
  if (typeof body.submissionsPaused === "boolean") {
    await setSetting("submissionsPaused", body.submissionsPaused, req.user.username);
    await recordAdminAudit(req.user.username, body.submissionsPaused ? "submissions_paused" : "submissions_resumed", "platform_settings", "submissionsPaused", null);
  }
  if (typeof body.submissionsPausedMessage === "string") {
    await setSetting("submissionsPausedMessage", body.submissionsPausedMessage.trim().slice(0, 300), req.user.username);
  }
  res.json({
    settings: {
      submissionsPaused: await getSetting("submissionsPaused", false),
      submissionsPausedMessage: await getSetting("submissionsPausedMessage", ""),
    },
  });
});

// ======================== AUDIT LOG ========================
router.get("/audit-log", async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const { data: rows } = await supabaseAdmin
    .from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
  res.json({ entries: (rows || []).map(shapeAuditEntry) });
});

// ======================== ARTIST APPLICATIONS ========================
router.get("/artist-applications", async (req, res) => {
  const status = (req.query.status || "pending").trim();
  let query = supabaseAdmin.from("artist_applications").select("*").order("submitted_at", { ascending: status !== "all" });
  if (status !== "all") query = query.eq("status", status);
  const { data: rows } = await query;
  res.json({ applications: (rows || []).map(shapeArtistApplication) });
});

router.post("/artist-applications/:id/approve", async (req, res) => {
  try {
    const { data: app } = await supabaseAdmin.from("artist_applications").select("*").eq("id", req.params.id).single();
    if (!app) return res.status(404).json({ error: "Không tìm thấy yêu cầu." });
    if (app.status !== "pending") return res.status(409).json({ error: "Yêu cầu đã được xử lý." });

    const now = new Date().toISOString();
    await supabaseAdmin.from("artist_applications").update({ status: "approved", reviewed_at: now, reviewed_by: req.user.id }).eq("id", req.params.id);

    // Create artist profile if not exists
    const { data: existingArtist } = await supabaseAdmin.from("artist_profiles").select("username").eq("username", app.username).maybeSingle();
    if (!existingArtist) {
      // Get the user_id from the application or find it from the profile
      const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("username", app.username).maybeSingle();
      if (profile) {
        await supabaseAdmin.from("artist_profiles").insert({
          user_id: profile.id, username: app.username, artist_name: app.artist_name,
          bio: app.bio || "", genres: app.main_genre ? [app.main_genre] : [],
          links: app.social_links || [], verification_status: "independent",
          created_at: now, updated_at: now,
        });
      }
    }

    await supabaseAdmin.from("profiles").update({ role: "artist" }).eq("username", app.username);

    try {
      await createNotification(app.username, "ARTIST_APPROVED", "Chào mừng bạn đến với 4ANG Artist",
        "Yêu cầu trở thành Nghệ sĩ của bạn đã được chấp thuận.",
        { actorUsername: req.user.username, targetType: "artist_application", targetId: app.id });
    } catch (e) { console.error("[approve notification]", e.message); }

    await recordAdminAudit(req.user.username, "artist_application_approved", "artist_application", app.id, { artistName: app.artist_name, username: app.username });
    const { data: updated } = await supabaseAdmin.from("artist_applications").select("*").eq("id", req.params.id).single();
    res.json({ application: shapeArtistApplication(updated) });
  } catch (e) {
    console.error("[APPROVE ERROR]", e);
    res.status(500).json({ error: "Lỗi server khi duyệt hồ sơ." });
  }
});

router.post("/artist-applications/:id/reject", async (req, res) => {
  try {
    const { data: app } = await supabaseAdmin.from("artist_applications").select("*").eq("id", req.params.id).single();
    if (!app) return res.status(404).json({ error: "Không tìm thấy yêu cầu." });
    if (app.status !== "pending") return res.status(409).json({ error: "Yêu cầu đã được xử lý." });
    const note = ((req.body && req.body.note) || "").trim().slice(0, 500);
    const now = new Date().toISOString();
    await supabaseAdmin.from("artist_applications").update({ status: "rejected", review_note: note || null, reviewed_at: now, reviewed_by: req.user.id }).eq("id", req.params.id);
    try {
      await createNotification(app.username, "ARTIST_REJECTED", "Yêu cầu chưa được chấp thuận", "Vui lòng xem chi tiết trong hồ sơ.",
        { actorUsername: req.user.username, targetType: "artist_application", targetId: app.id });
    } catch (e) { console.error("[reject notification]", e.message); }
    await recordAdminAudit(req.user.username, "artist_application_rejected", "artist_application", app.id, { note: note || null });
    const { data: updated } = await supabaseAdmin.from("artist_applications").select("*").eq("id", req.params.id).single();
    res.json({ application: shapeArtistApplication(updated) });
  } catch (e) {
    console.error("[REJECT ERROR]", e);
    res.status(500).json({ error: "Lỗi server khi từ chối hồ sơ." });
  }
});

// ═══════════════════════════════════════════════════════════════
// BANNERS — Admin-managed homepage carousel
// ═══════════════════════════════════════════════════════════════
const bannerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/admin/banners — list all banners (sorted)
router.get("/banners", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("banners")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ banners: data || [] });
  } catch (e) {
    console.error("[BANNERS LIST]", e);
    res.status(500).json({ error: "Không thể tải danh sách banner." });
  }
});

// POST /api/admin/banners — create banner
router.post("/banners", adminActionLimit, async (req, res) => {
  try {
    const { title, description, button_text, link_url, sort_order, is_active } = req.body || {};
    const { data, error } = await supabaseAdmin
      .from("banners")
      .insert({
        image_url: "",
        title: (title || "").trim().slice(0, 200),
        description: (description || "").trim().slice(0, 500),
        button_text: (button_text || "PLAY").trim().slice(0, 50),
        link_url: (link_url || "").trim().slice(0, 500),
        sort_order: sort_order || 0,
        is_active: is_active !== false,
      })
      .select()
      .single();
    if (error) throw error;
    await recordAdminAudit(req.user.username, "banner_created", "banner", data.id, { title: data.title });
    res.status(201).json({ banner: data });
  } catch (e) {
    console.error("[BANNER CREATE]", e);
    res.status(500).json({ error: "Không thể tạo banner." });
  }
});

// PATCH /api/admin/banners/:id — update banner metadata
router.patch("/banners/:id", adminActionLimit, async (req, res) => {
  try {
    const { title, description, button_text, link_url, sort_order, is_active } = req.body || {};
    const updates = {};
    if (title !== undefined) updates.title = title.trim().slice(0, 200);
    if (description !== undefined) updates.description = description.trim().slice(0, 500);
    if (button_text !== undefined) updates.button_text = button_text.trim().slice(0, 50);
    if (link_url !== undefined) updates.link_url = link_url.trim().slice(0, 500);
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("banners")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ banner: data });
  } catch (e) {
    console.error("[BANNER UPDATE]", e);
    res.status(500).json({ error: "Không thể cập nhật banner." });
  }
});

// POST /api/admin/banners/:id/image — upload banner image
router.post("/banners/:id/image", adminActionLimit, bannerUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Chưa chọn ảnh." });
    const bannerId = req.params.id;
    // Get current banner to delete old image
    const { data: existing } = await supabaseAdmin.from("banners").select("image_url").eq("id", bannerId).single();
    // Upload new image
    const ext = req.file.originalname.split(".").pop() || "jpg";
    const fileName = `banner-${bannerId}-${Date.now()}.${ext}`;
    const { url } = await uploadFile("artwork", req.user.id, req.file.buffer, req.file.mimetype, fileName);
    // Update banner image_url
    const { error } = await supabaseAdmin
      .from("banners")
      .update({ image_url: url, updated_at: new Date().toISOString() })
      .eq("id", bannerId);
    if (error) throw error;
    // Delete old image if it was a Supabase Storage URL
    if (existing?.image_url && existing.image_url !== url && existing.image_url.includes("supabase")) {
      try { await deleteFile(existing.image_url); } catch (e) { console.error("[banner delete old]", e.message); }
    }
    const { data: updated } = await supabaseAdmin.from("banners").select("*").eq("id", bannerId).single();
    res.json({ banner: updated });
  } catch (e) {
    console.error("[BANNER IMAGE]", e);
    res.status(500).json({ error: "Không thể tải ảnh banner." });
  }
});

// DELETE /api/admin/banners/:id — delete banner
router.delete("/banners/:id", adminActionLimit, async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin.from("banners").select("image_url").eq("id", req.params.id).single();
    const { error } = await supabaseAdmin.from("banners").delete().eq("id", req.params.id);
    if (error) throw error;
    // Delete image from storage
    if (existing?.image_url && existing.image_url.includes("supabase")) {
      try { await deleteFile(existing.image_url); } catch (e) { console.error("[banner delete img]", e.message); }
    }
    await recordAdminAudit(req.user.username, "banner_deleted", "banner", req.params.id, {});
    res.json({ ok: true });
  } catch (e) {
    console.error("[BANNER DELETE]", e);
    res.status(500).json({ error: "Không thể xóa banner." });
  }
});

// GET /api/banners — public endpoint for homepage (active banners only)
// This is mounted separately in index.js
export const publicBannerRouter = express.Router();
publicBannerRouter.get("/banners", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("banners")
      .select("id, image_url, title, description, button_text, link_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ banners: data || [] });
  } catch (e) {
    console.error("[PUBLIC BANNERS]", e);
    res.json({ banners: [] });
  }
});

export default router;
