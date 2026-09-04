/**
 * 4ANG Tracks Routes — Supabase PostgreSQL only.
 */
import express from "express";
import { shapeTrack, recordActivity } from "../db.js";
import { requireAuth, optionalAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { getFileUrl } from "../storage.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();

// Public: approved tracks
router.get("/", async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const { data: rows, count } = await supabaseAdmin
    .from("tracks").select("*", { count: "exact" })
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  const tracks = await Promise.all((rows || []).map(shapeTrack));
  res.json({ tracks, total: count || 0 });
});

// My tracks (any status)
router.get("/mine", requireAuth, async (req, res) => {
  const { data: rows } = await supabaseAdmin
    .from("tracks").select("*")
    .eq("uploader_username", req.user.username)
    .order("created_at", { ascending: false });
  const tracks = await Promise.all((rows || []).map(shapeTrack));
  res.json({ tracks });
});

// Serve audio
router.get("/:id/audio", optionalAuth, async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
    if (!row) return res.status(404).end();
    const isOwner = req.user && req.user.username === row.uploader_username;
    const isAdmin = req.user && req.user.isAdmin;
    if (row.status !== "approved" && !isOwner && !isAdmin) return res.status(403).end();
    const filePath = row.audio_path;
    if (!filePath) return res.status(404).end();
    const url = await getFileUrl("audio", filePath);
    if (!url) return res.status(404).end();
    res.redirect(url);
  } catch (e) {
    console.error("[serveAudio]", e);
    res.status(500).end();
  }
});

// Serve video
router.get("/:id/video", optionalAuth, async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
    if (!row || !row.video_path) return res.status(404).end();
    const isOwner = req.user && req.user.username === row.uploader_username;
    const isAdmin = req.user && req.user.isAdmin;
    if (row.status !== "approved" && !isOwner && !isAdmin) return res.status(403).end();
    const filePath = row.video_path;
    const url = await getFileUrl("videos", filePath);
    if (!url) return res.status(404).end();
    res.redirect(url);
  } catch (e) {
    console.error("[serveVideo]", e);
    res.status(500).end();
  }
});

// Like / Unlike (toggle)
router.post("/:id/like", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("tracks").select("id").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });

  const { data: existing } = await supabaseAdmin
    .from("track_likes").select("track_id").eq("track_id", req.params.id).eq("username", req.user.username).maybeSingle();

  if (existing) {
    await supabaseAdmin.from("track_likes").delete().eq("track_id", req.params.id).eq("username", req.user.username);
  } else {
    await supabaseAdmin.from("track_likes").insert({ track_id: req.params.id, username: req.user.username, created_at: new Date().toISOString() });
    await recordActivity(req.user.username, "TRACK_LIKED", "track", req.params.id, null);
  }

  const { data: updated } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
  res.json({ track: await shapeTrack(updated) });
});

// Save / Unsave (toggle)
router.post("/:id/save", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin.from("tracks").select("id").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });

  const { data: existing } = await supabaseAdmin
    .from("track_saves").select("track_id").eq("track_id", req.params.id).eq("username", req.user.username).maybeSingle();

  if (existing) {
    await supabaseAdmin.from("track_saves").delete().eq("track_id", req.params.id).eq("username", req.user.username);
  } else {
    await supabaseAdmin.from("track_saves").insert({ track_id: req.params.id, username: req.user.username, created_at: new Date().toISOString() });
  }

  const { data: updated } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
  res.json({ track: await shapeTrack(updated) });
});

// Share count
router.post("/:id/share", rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "share" }), async (req, res) => {
  const { data: row } = await supabaseAdmin.from("tracks").select("id").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });

  await supabaseAdmin.rpc("increment_share_count", { tid: req.params.id }).then(() => {}).catch(async () => {
    // Fallback: read + write
    const { data: t } = await supabaseAdmin.from("tracks").select("share_count").eq("id", req.params.id).single();
    await supabaseAdmin.from("tracks").update({ share_count: (t?.share_count || 0) + 1 }).eq("id", req.params.id);
  });

  const { data: updated } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
  res.json({ track: await shapeTrack(updated) });
});

// Play event
router.post("/:id/play", optionalAuth, rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "play" }), async (req, res) => {
  const { data: row } = await supabaseAdmin.from("tracks").select("id, play_count").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });

  // Increment play count
  await supabaseAdmin.from("tracks").update({ play_count: (row.play_count || 0) + 1 }).eq("id", req.params.id);

  // Record play event
  const { randomUUID } = await import("node:crypto");
  await supabaseAdmin.from("play_events").insert({
    id: randomUUID(),
    track_id: req.params.id,
    username: req.user?.username || null,
    created_at: new Date().toISOString(),
  });

  await recordActivity(req.user?.username || null, "TRACK_PLAYED", "track", req.params.id, null);

  const { data: updated } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
  res.json({ track: await shapeTrack(updated) });
});

// Add comment
router.post("/:id/comments", requireAuth, rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "comment" }), async (req, res) => {
  const { data: row } = await supabaseAdmin.from("tracks").select("id").eq("id", req.params.id).single();
  if (!row) return res.status(404).json({ error: "Không tìm thấy bài hát." });

  const text = ((req.body && req.body.text) || "").trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: "Bình luận trống." });

  const { data: profile } = await supabaseAdmin.from("profiles").select("display_name").eq("username", req.user.username).maybeSingle();
  const { randomUUID } = await import("node:crypto");

  await supabaseAdmin.from("track_comments").insert({
    id: randomUUID(),
    track_id: req.params.id,
    username: req.user.username,
    display_name: profile?.display_name || req.user.username,
    text,
    created_at: new Date().toISOString(),
  });

  const { data: updated } = await supabaseAdmin.from("tracks").select("*").eq("id", req.params.id).single();
  res.json({ track: await shapeTrack(updated) });
});

export default router;
