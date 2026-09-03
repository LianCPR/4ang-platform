/**
 * 4ANG Library Routes — Supabase PostgreSQL only.
 */
import express from "express";
import { shapeTrack, shapeArtistProfile } from "../db.js";
import { requireAuth } from "../auth.js";
import { supabaseAdmin } from "../supabase.js";
import { normalizeSearch, removeDiacritics } from "../lib/normalize.js";
import { GENRES } from "./artists.js";

const router = express.Router();

router.get("/recently-played", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const { data: plays } = await supabaseAdmin
    .from("play_events").select("track_id, created_at").eq("username", req.user.username)
    .not("track_id", "is", null).order("created_at", { ascending: false }).limit(limit * 3);
  // Deduplicate: keep most recent per track
  const seen = new Set();
  const trackIds = [];
  for (const p of (plays || [])) {
    if (!seen.has(p.track_id)) { seen.add(p.track_id); trackIds.push(p.track_id); }
    if (trackIds.length >= limit) break;
  }
  if (trackIds.length === 0) return res.json({ tracks: [] });
  const { data: trackRows } = await supabaseAdmin.from("tracks").select("*").in("id", trackIds).eq("status", "approved");
  const trackMap = new Map((trackRows || []).map(t => [t.id, t]));
  const tracks = await Promise.all(trackIds.map(id => trackMap.get(id)).filter(Boolean).map(shapeTrack));
  res.json({ tracks });
});

router.get("/liked", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const { data: likes } = await supabaseAdmin
    .from("track_likes").select("track_id").eq("username", req.user.username)
    .order("created_at", { ascending: false }).limit(limit);
  const ids = (likes || []).map(l => l.track_id);
  if (ids.length === 0) return res.json({ tracks: [] });
  const { data: rows } = await supabaseAdmin.from("tracks").select("*").in("id", ids).eq("status", "approved");
  const tracks = await Promise.all((rows || []).map(shapeTrack));
  res.json({ tracks });
});

router.get("/followed-artists", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
  const { data: follows } = await supabaseAdmin
    .from("artist_follows").select("artist_username, created_at").eq("follower_username", req.user.username)
    .order("created_at", { ascending: false }).limit(limit);
  const usernames = (follows || []).map(f => f.artist_username);
  if (usernames.length === 0) return res.json({ artists: [] });
  const { data: artistRows } = await supabaseAdmin.from("artist_profiles").select("*").in("username", usernames);
  const artists = await Promise.all((artistRows || []).map(a => {
    const follow = follows.find(f => f.artist_username === a.username);
    return shapeArtistProfile(a, { followedAt: follow?.created_at, isFollowing: true });
  }));
  res.json({ artists });
});

router.get("/saved", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const { data: saves } = await supabaseAdmin
    .from("track_saves").select("track_id").eq("username", req.user.username)
    .order("created_at", { ascending: false }).limit(limit);
  const ids = (saves || []).map(s => s.track_id);
  if (ids.length === 0) return res.json({ tracks: [] });
  const { data: rows } = await supabaseAdmin.from("tracks").select("*").in("id", ids).eq("status", "approved");
  const tracks = await Promise.all((rows || []).map(shapeTrack));
  res.json({ tracks });
});

router.get("/search", async (req, res) => {
  const q = ((req.query.q || "") + "").trim();
  if (q.length < 1) return res.json({ tracks: [], artists: [], playlists: [], genres: [] });
  const normalizedQuery = normalizeSearch(q);

  function matches(text) {
    if (!text) return false;
    return removeDiacritics(text).includes(normalizedQuery);
  }

  const { data: rawTracks } = await supabaseAdmin
    .from("tracks").select("*").eq("status", "approved").order("play_count", { ascending: false }).limit(200);
  const matchedTracks = (rawTracks || []).filter(t => matches(t.title) || matches(t.composer || "")).slice(0, 10);
  const tracks = await Promise.all(matchedTracks.map(shapeTrack));

  const { data: allArtists } = await supabaseAdmin
    .from("artist_profiles").select("username, artist_name, avatar_url, verification_status").order("artist_name").limit(100);
  const artists = (allArtists || []).filter(a => matches(a.artist_name) || matches(a.username)).slice(0, 8).map(a => ({
    username: a.username, artistName: a.artist_name, avatarUrl: a.avatar_url || null,
    badge: a.verification_status === "verified" ? "verified" : "independent",
  }));

  const { data: allPlaylists } = await supabaseAdmin
    .from("playlists").select("id, title, track_count").eq("is_public", true).order("track_count", { ascending: false }).limit(50);
  const playlists = (allPlaylists || []).filter(p => matches(p.title)).slice(0, 6);

  const matchedGenres = GENRES.filter(g => g.toLowerCase().includes(q.toLowerCase()) || removeDiacritics(g).includes(normalizedQuery)).map(g => ({ name: g }));

  res.json({ tracks, artists, playlists, genres: matchedGenres });
});

router.post("/search-history", requireAuth, async (req, res) => {
  const query = ((req.body?.query) || "").trim();
  if (!query) return res.status(400).json({ error: "Trống." });
  const { count } = await supabaseAdmin
    .from("search_history").select("*", { count: "exact", head: true }).eq("username", req.user.username);
  if ((count || 0) >= 20) {
    const { data: old } = await supabaseAdmin
      .from("search_history").select("id").eq("username", req.user.username).order("created_at").limit(count - 19);
    if (old?.length) await supabaseAdmin.from("search_history").delete().in("id", old.map(r => r.id));
  }
  await supabaseAdmin.from("search_history").insert({ username: req.user.username, query, created_at: Date.now() });
  res.json({ ok: true });
});

router.get("/search-history", requireAuth, async (req, res) => {
  const { data: rows } = await supabaseAdmin
    .from("search_history").select("query").eq("username", req.user.username).order("created_at", { ascending: false }).limit(10);
  const unique = [...new Set((rows || []).map(r => r.query))];
  res.json({ queries: unique });
});

router.delete("/search-history", requireAuth, async (req, res) => {
  await supabaseAdmin.from("search_history").delete().eq("username", req.user.username);
  res.json({ ok: true });
});

router.post("/search-history/item", requireAuth, async (req, res) => {
  const query = ((req.body?.query) || "").trim();
  if (!query) return res.status(400).json({ error: "Trống." });
  await supabaseAdmin.from("search_history").delete().eq("username", req.user.username).eq("query", query);
  res.json({ ok: true });
});

router.post("/progress", requireAuth, async (req, res) => {
  const { trackId, progressSeconds, durationSeconds } = req.body || {};
  if (!trackId) return res.status(400).json({ error: "trackId required" });
  const progress = Math.max(0, parseFloat(progressSeconds) || 0);
  const duration = Math.max(0, parseFloat(durationSeconds) || 0);
  if (duration < 1 || progress < 5) return res.json({ ok: true });
  const pct = progress / duration;
  if (pct > 0.95) {
    await supabaseAdmin.from("listening_progress").delete().eq("username", req.user.username).eq("track_id", trackId);
    return res.json({ ok: true, finished: true });
  }
  await supabaseAdmin.from("listening_progress").upsert({
    username: req.user.username, track_id: trackId,
    progress_seconds: progress, duration_seconds: duration,
    source_type: "track", source_id: trackId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "username,track_id" });
  res.json({ ok: true });
});

router.get("/continue-listening", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);
  const { data: rows } = await supabaseAdmin
    .from("listening_progress").select("*, tracks(title, composer, cover_url, cover_filename)")
    .eq("username", req.user.username).order("updated_at", { ascending: false }).limit(limit);
  const tracks = (rows || []).filter(r => r.tracks).map(r => ({
    id: r.track_id, title: r.tracks.title, artistName: r.tracks.composer || "",
    coverUrl: r.tracks.cover_url || null,
    progressSeconds: r.progress_seconds, durationSeconds: r.duration_seconds, lastUpdated: r.updated_at,
  }));
  res.json({ tracks });
});

router.get("/stats", requireAuth, async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { count: totalPlays } = await supabaseAdmin
    .from("play_events").select("*", { count: "exact", head: true })
    .eq("username", req.user.username).gte("created_at", since);

  res.json({ days, totalPlays: totalPlays || 0, totalMinutes: 0, topArtist: null, topTrack: null, topGenre: null, mostActiveDay: null, uniqueArtistsCount: 0 });
});

export default router;
