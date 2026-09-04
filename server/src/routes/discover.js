/**
 * 4ANG Discover Routes — Supabase PostgreSQL only.
 */
import express from "express";
import { shapeTrack, shapeArtistProfile } from "../db.js";
import { optionalAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { GENRES } from "./artists.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
const discoverLimit = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "discover" });

// Trending tracks
router.get("/trending", discoverLimit, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: allTracks } = await supabaseAdmin
    .from("tracks").select("id, play_count, share_count").eq("status", "approved");

  if (!allTracks || allTracks.length === 0) return res.json({ tracks: [] });

  const trackIds = allTracks.map(t => t.id);

  // Get recent likes per track
  const { data: likeData } = await supabaseAdmin
    .from("track_likes").select("track_id").in("track_id", trackIds);
  const likeCounts = {};
  (likeData || []).forEach(l => { likeCounts[l.track_id] = (likeCounts[l.track_id] || 0) + 1; });

  // Get recent plays
  const { data: playData } = await supabaseAdmin
    .from("play_events").select("track_id").in("track_id", trackIds).gte("created_at", since);
  const playCounts = {};
  (playData || []).forEach(p => { playCounts[p.track_id] = (playCounts[p.track_id] || 0) + 1; });

  // Score: likes*3 + shares*5 + recent_plays*1
  const scores = {};
  for (const t of allTracks) {
    scores[t.id] = (likeCounts[t.id] || 0) * 3 + (t.share_count || 0) * 5 + (playCounts[t.id] || 0);
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);

  if (sorted.length === 0) return res.json({ tracks: [] });

  const { data: trackRows } = await supabaseAdmin.from("tracks").select("*").in("id", sorted);
  const trackMap = new Map((trackRows || []).map(t => [t.id, t]));
  const tracks = await Promise.all(sorted.map(id => trackMap.get(id)).filter(Boolean).map(shapeTrack));
  res.json({ tracks: tracks.filter(Boolean) });
});

// New releases
router.get("/new-releases", async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
  const genre = (req.query.genre || "").trim();
  let query = supabaseAdmin.from("tracks").select("*").eq("status", "approved").order("created_at", { ascending: false }).limit(limit);
  if (genre && GENRES.includes(genre)) {
    query = query.contains("genres", [genre]);
  }
  const { data: rows } = await query;
  const tracks = await Promise.all((rows || []).map(shapeTrack));
  res.json({ tracks });
});

// Rising artists
router.get("/rising-artists", discoverLimit, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: artists } = await supabaseAdmin
    .from("artist_profiles").select("*")
    .in("verification_status", ["independent", "verified"]);
  if (!artists || artists.length === 0) return res.json({ artists: [] });

  const usernames = artists.map(a => a.username);

  // Get recent follower counts
  const { data: recentFollows } = await supabaseAdmin
    .from("artist_follows").select("artist_username").in("artist_username", usernames).gte("created_at", since30d);
  const recentFollowMap = {};
  (recentFollows || []).forEach(f => { recentFollowMap[f.artist_username] = (recentFollowMap[f.artist_username] || 0) + 1; });

  // Get total follower counts
  const { data: totalFollows } = await supabaseAdmin
    .from("artist_follows").select("artist_username").in("artist_username", usernames);
  const totalFollowMap = {};
  (totalFollows || []).forEach(f => { totalFollowMap[f.artist_username] = (totalFollowMap[f.artist_username] || 0) + 1; });

  const scores = [];
  for (const artist of artists) {
    const score = (recentFollowMap[artist.username] || 0) * 5;
    if (score > 0) {
      scores.push({ artist, score, followers: totalFollowMap[artist.username] || 0 });
    }
  }
  scores.sort((a, b) => b.score - a.score);
  res.json({ artists: scores.slice(0, limit).map(({ artist, followers }) => shapeArtistProfile(artist, { followers })) });
});

// Recommendations
router.get("/recommendations", optionalAuth, discoverLimit, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
  const username = req.user?.username;

  const { data: allApproved } = await supabaseAdmin
    .from("tracks").select("*").eq("status", "approved").order("play_count", { ascending: false });
  if (!allApproved || allApproved.length === 0) return res.json({ tracks: [], reason: null });

  if (!username) {
    const tracks = await Promise.all(allApproved.slice(0, limit).map(shapeTrack));
    return res.json({ tracks, reason: null });
  }

  // Gather user signals
  const { data: likedTracks } = await supabaseAdmin.from("track_likes").select("track_id").eq("username", username);
  const likedSet = new Set((likedTracks || []).map(l => l.track_id));

  const { data: recentPlays } = await supabaseAdmin.from("play_events").select("track_id").eq("username", username).order("created_at", { ascending: false }).limit(50);
  const playedIds = new Set((recentPlays || []).map(p => p.track_id));

  const { data: followed } = await supabaseAdmin.from("artist_follows").select("artist_username").eq("follower_username", username);
  const followedSet = new Set((followed || []).map(f => f.artist_username));

  // Score candidates (exclude already liked)
  const candidates = allApproved.filter(t => !likedSet.has(t.id));
  const scored = candidates.map(t => {
    let score = (t.play_count || 0) * 0.1;
    if (playedIds.has(t.id)) score += 20;
    if (followedSet.has(t.uploader_username)) score += 15;
    return { track: t, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const result = await Promise.all(scored.slice(0, limit).map(x => shapeTrack(x.track)));
  res.json({ tracks: result, reason: likedSet.size > 0 ? "Dựa trên thể loại bạn thích" : (followedSet.size > 0 ? "Dựa trên nghệ sĩ bạn theo dõi" : null) });
});

// Genre listing
router.get("/genres", async (req, res) => {
  const { data: rows } = await supabaseAdmin.from("tracks").select("genres").eq("status", "approved");
  const genreCounts = {};
  for (const r of (rows || [])) {
    const gs = Array.isArray(r.genres) ? r.genres : [];
    for (const g of gs) genreCounts[g] = (genreCounts[g] || 0) + 1;
  }
  res.json({ genres: GENRES.map(g => ({ name: g, trackCount: genreCounts[g] || 0 })).sort((a, b) => b.trackCount - a.trackCount) });
});

// Genre detail
router.get("/genres/:name", async (req, res) => {
  const name = req.params.name;
  if (!GENRES.includes(name)) return res.status(404).json({ error: "Thể loại không tồn tại." });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
  const { data: rows } = await supabaseAdmin
    .from("tracks").select("*").eq("status", "approved").contains("genres", [name])
    .order("play_count", { ascending: false }).limit(limit);
  const tracks = await Promise.all((rows || []).map(shapeTrack));
  const { count: trackCount } = await supabaseAdmin
    .from("tracks").select("*", { count: "exact", head: true })
    .eq("status", "approved").contains("genres", [name]);
  res.json({ genre: name, trackCount: trackCount || 0, popularTracks: tracks, recentTracks: tracks.slice(0, 8), artists: [] });
});

// Artist releases
router.get("/artist-releases", optionalAuth, async (req, res) => {
  const username = req.user?.username;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
  if (!username) return res.json({ tracks: [] });

  const { data: following } = await supabaseAdmin.from("artist_follows").select("artist_username").eq("follower_username", username);
  const usernames = (following || []).map(f => f.artist_username);
  if (usernames.length === 0) return res.json({ tracks: [] });

  const { data: rows } = await supabaseAdmin
    .from("tracks").select("*").in("uploader_username", usernames).eq("status", "approved")
    .order("created_at", { ascending: false }).limit(limit);
  const tracks = await Promise.all((rows || []).map(shapeTrack));
  res.json({ tracks });
});

// Charts
router.get("/charts", discoverLimit, async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: tracks } = await supabaseAdmin
    .from("tracks").select("*").eq("status", "approved")
    .order("play_count", { ascending: false }).limit(20);

  const { data: artists } = await supabaseAdmin.from("artist_profiles").select("*");
  const artistScores = {};
  for (const a of (artists || [])) {
    const { data: artistTracks } = await supabaseAdmin
      .from("tracks").select("play_count").eq("uploader_username", a.username).eq("status", "approved");
    const totalPlays = (artistTracks || []).reduce((sum, t) => sum + (t.play_count || 0), 0);
    const { count: followers } = await supabaseAdmin
      .from("artist_follows").select("*", { count: "exact", head: true }).eq("artist_username", a.username);
    const score = totalPlays + (followers || 0) * 5;
    if (score > 0) artistScores[a.username] = { artist: a, score, followers: followers || 0 };
  }

  const topArtists = Object.values(artistScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ artist, followers }) => shapeArtistProfile(artist, { followers }));

  const topTracks = await Promise.all((tracks || []).slice(0, 20).map(shapeTrack));
  res.json({ topSongs: topTracks, topArtists, period: days + " days" });
});

// Smart mix
router.get("/smart-mix", optionalAuth, discoverLimit, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 5), 50);
  const { data: allTracks } = await supabaseAdmin
    .from("tracks").select("*").eq("status", "approved").order("play_count", { ascending: false });
  if (!allTracks || allTracks.length === 0) return res.json({ tracks: [], type: "my-mix" });
  const tracks = await Promise.all(allTracks.slice(0, limit).map(shapeTrack));
  res.json({ tracks, type: "my-mix" });
});

export default router;
