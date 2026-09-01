import express from "express";
import { db, shapeTrack, shapeArtistProfile } from "../db.js";
import { requireAuth } from "../auth.js";
import { GENRES } from "./artists.js";
import { removeDiacritics, normalizeSearch } from "../lib/normalize.js";

const router = express.Router();

// --- Recently Played ---
// Returns the user's listening history, deduplicated by track.
router.get("/recently-played", requireAuth, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  // Deduplicate: keep the most recent play event per track
  const rows = db.prepare(`
    SELECT pe.track_id, MAX(pe.created_at) AS last_played
    FROM play_events pe
    WHERE pe.username = ? AND pe.track_id IS NOT NULL
    GROUP BY pe.track_id
    ORDER BY last_played DESC
    LIMIT ?
  `).all(req.user.username, limit);

  // Batch: fetch all tracks in one query instead of N+1
  const trackIds = rows.map((r) => r.track_id);
  let trackMap = {};
  if (trackIds.length > 0) {
    const ph = trackIds.map(() => "?").join(",");
    const trackRows = db.prepare(`SELECT * FROM tracks WHERE id IN (${ph}) AND status = 'approved'`).all(...trackIds);
    trackRows.forEach((t) => { trackMap[t.id] = t; });
  }
  const tracks = [];
  for (const r of rows) {
    const track = trackMap[r.track_id];
    if (track) {
      const shaped = shapeTrack(track);
      shaped.lastPlayed = r.last_played;
      tracks.push(shaped);
    }
  }
  res.json({ tracks });
});

// --- Liked Tracks ---
router.get("/liked", requireAuth, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const rows = db.prepare(`
    SELECT t.*, l.username AS like_username
    FROM likes l
    JOIN tracks t ON t.id = l.track_id
    WHERE l.username = ? AND t.status = 'approved'
    ORDER BY l.rowid DESC
    LIMIT ?
  `).all(req.user.username, limit);
  res.json({ tracks: rows.map(shapeTrack) });
});

// --- Followed Artists ---
router.get("/followed-artists", requireAuth, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
  const rows = db.prepare(`
    SELECT af.artist_username, af.created_at AS followed_at, ap.*
    FROM artist_follows af
    JOIN artist_profiles ap ON ap.username = af.artist_username
    WHERE af.follower_username = ?
    ORDER BY af.created_at DESC
    LIMIT ?
  `).all(req.user.username, limit);
  res.json({
    artists: rows.map((r) => {
      const followers = db.prepare("SELECT COUNT(*) AS c FROM artist_follows WHERE artist_username = ?").get(r.artist_username).c;
      return shapeArtistProfile(r, { followers, followedAt: r.followed_at, isFollowing: true });
    }),
  });
});

// --- Saved Tracks (bookmark) ---
router.get("/saved", requireAuth, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const rows = db.prepare(`
    SELECT t.*
    FROM saves s
    JOIN tracks t ON t.id = s.track_id
    WHERE s.username = ? AND t.status = 'approved'
    ORDER BY s.rowid DESC
    LIMIT ?
  `).all(req.user.username, limit);
  res.json({ tracks: rows.map(shapeTrack) });
});

// --- Search (unified across tracks, artists, playlists, genres) ---
// Public: published tracks and public playlists are discoverable by anyone.
// Supports Vietnamese diacritics normalization: "me" matches "Mẹ", "mo" matches "Mưa".
router.get("/search", (req, res) => {
  const q = ((req.query.q || "") + "").trim();
  if (q.length < 1) return res.json({ tracks: [], artists: [], playlists: [], genres: [] });
  const like = "%" + q.replace(/[%_]/g, "") + "%";
  const normalizedQuery = normalizeSearch(q);

  // Helper: check if a text matches the normalized query
  function matches(text) {
    if (!text) return false;
    const normalized = removeDiacritics(text);
    return normalized.includes(normalizedQuery);
  }

  // Tracks — fetch raw rows first (fast), normalize-match in JS, then shapeTrack only the small result set.
  // SQLite LIKE can't handle Vietnamese diacritics, so we do all matching in JS.
  const rawTracks = db.prepare(
    "SELECT * FROM tracks WHERE status = 'approved' ORDER BY play_count DESC LIMIT 200"
  ).all();
  const matchedTrackRows = rawTracks.filter((r) => {
    return matches(r.title) || matches(r.composer || '') || matches(r.uploader_display_name || '');
  }).slice(0, 10);
  const tracks = matchedTrackRows.map(shapeTrack);

  // Artists — fetch all, normalize-match in JS
  const allArtists = db.prepare(
    "SELECT username, artist_name, avatar_filename, verification_status FROM artist_profiles ORDER BY artist_name ASC LIMIT 100"
  ).all().map((r) => ({
    username: r.username,
    artistName: r.artist_name,
    avatarUrl: r.avatar_filename ? "/api/avatars/" + r.avatar_filename : null,
    badge: r.verification_status === "verified" ? "verified" : "independent",
  }));
  const artists = allArtists.filter((a) => {
    return matches(a.artistName) || matches(a.username);
  }).slice(0, 8);

  // Playlists (public only) — normalize-match in JS
  const allPlaylists = db.prepare(
    "SELECT * FROM playlists WHERE is_public = 1 ORDER BY track_count DESC LIMIT 50"
  ).all();
  const playlists = allPlaylists.filter((p) => {
    return matches(p.title);
  }).slice(0, 6);

  // Genres (from the fixed list) — normalize for matching
  const matchedGenres = GENRES.filter((g) => {
    return g.toLowerCase().includes(q.toLowerCase()) || removeDiacritics(g).includes(normalizedQuery);
  }).map((g) => ({ name: g }));

  res.json({ tracks, artists, playlists: playlists.map((p) => ({ id: p.id, title: p.title, trackCount: p.track_count })), genres: matchedGenres });
});

// --- Search History ---
router.post("/search-history", requireAuth, (req, res) => {
  const query = ((req.body && req.body.query) || "").trim();
  if (!query) return res.status(400).json({ error: "Trống." });
  // Keep only last 20 searches per user
  const count = db.prepare("SELECT COUNT(*) AS c FROM search_history WHERE username = ?").get(req.user.username).c;
  if (count >= 20) {
    db.prepare("DELETE FROM search_history WHERE username = ? AND id IN (SELECT id FROM search_history WHERE username = ? ORDER BY created_at ASC LIMIT ?)")
      .run(req.user.username, req.user.username, count - 19);
  }
  db.prepare("INSERT INTO search_history (username, query, created_at) VALUES (?, ?, ?)").run(req.user.username, query, Date.now());
  res.json({ ok: true });
});

router.get("/search-history", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT DISTINCT query FROM search_history WHERE username = ? ORDER BY created_at DESC LIMIT 10").all(req.user.username);
  res.json({ queries: rows.map((r) => r.query) });
});

router.delete("/search-history", requireAuth, (req, res) => {
  db.prepare("DELETE FROM search_history WHERE username = ?").run(req.user.username);
  res.json({ ok: true });
});

// Delete single search history item
router.post("/search-history/item", requireAuth, (req, res) => {
  const query = ((req.body && req.body.query) || "").trim();
  if (!query) return res.status(400).json({ error: "Trống." });
  db.prepare("DELETE FROM search_history WHERE username = ? AND query = ?").run(req.user.username, query);
  res.json({ ok: true });
});

// --- Save playback progress (Continue Listening) ---
router.post("/progress", requireAuth, (req, res) => {
  const { trackId, progressSeconds, durationSeconds } = req.body || {};
  if (!trackId) return res.status(400).json({ error: "trackId required" });
  const progress = Math.max(0, parseFloat(progressSeconds) || 0);
  const duration = Math.max(0, parseFloat(durationSeconds) || 0);
  if (duration < 1) return res.json({ ok: true }); // skip if duration too short
  const pct = progress / duration;
  // If >95% complete, remove from progress (finished)
  if (pct > 0.95) {
    db.prepare("DELETE FROM listening_progress WHERE username = ? AND track_id = ?").run(req.user.username, trackId);
    return res.json({ ok: true, finished: true });
  }
  // Don't save if progress < 5 seconds
  if (progress < 5) return res.json({ ok: true });
  db.prepare(`
    INSERT INTO listening_progress (username, track_id, progress_seconds, duration_seconds, source_type, source_id, updated_at)
    VALUES (?, ?, ?, ?, 'track', ?, ?)
    ON CONFLICT(username, track_id) DO UPDATE SET progress_seconds = ?, duration_seconds = ?, updated_at = ?
  `).run(req.user.username, trackId, progress, duration, trackId, Date.now(), progress, duration, Date.now());
  res.json({ ok: true });
});

// --- Get continue listening ---
router.get("/continue-listening", requireAuth, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);
  const rows = db.prepare(`
    SELECT lp.*, t.title, t.composer, t.cover_filename AS coverFilename, t.audio_filename AS audioFilename
    FROM listening_progress lp
    JOIN tracks t ON t.id = lp.track_id
    WHERE lp.username = ? AND t.status = 'approved'
    ORDER BY lp.updated_at DESC
    LIMIT ?
  `).all(req.user.username, limit);
  const tracks = rows.map((r) => ({
    id: r.track_id,
    title: r.title,
    artistName: r.composer || '',
    coverUrl: r.coverFilename ? '/api/track-covers/' + r.coverFilename : null,
    progressSeconds: r.progress_seconds,
    durationSeconds: r.duration_seconds,
    lastUpdated: r.updated_at,
  }));
  res.json({ tracks });
});

// --- Listening Stats ---
router.get("/stats", requireAuth, (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 365);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const username = req.user.username;

  // Total plays
  const totalPlays = db.prepare("SELECT COUNT(*) AS c FROM play_events WHERE username = ? AND created_at >= ?").get(username, since).c;

  // Total listening time (estimate from duration of tracks played)
  const playEvents = db.prepare(
    `SELECT pe.track_id, t.duration FROM play_events pe
     JOIN tracks t ON t.id = pe.track_id
     WHERE pe.username = ? AND pe.created_at >= ?`
  ).all(username, since);
  const totalMinutes = Math.round(playEvents.reduce((sum, pe) => sum + ((pe.duration || 0) / 60), 0));

  // Top artist
  const artistPlays = {};
  for (const pe of playEvents) {
    const credits = db.prepare("SELECT artist_username FROM track_credits WHERE track_id = ? AND is_primary = 1").all(pe.track_id);
    const artist = credits.length > 0 ? credits[0].artist_username : null;
    if (artist) artistPlays[artist] = (artistPlays[artist] || 0) + 1;
  }
  let topArtist = null;
  const sortedArtists = Object.entries(artistPlays).sort((a, b) => b[1] - a[1]);
  if (sortedArtists.length > 0) {
    const ap = db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(sortedArtists[0][0]);
    if (ap) topArtist = shapeArtistProfile(ap, { plays: sortedArtists[0][1] });
  }

  // Top track
  const trackPlays = {};
  for (const pe of playEvents) trackPlays[pe.track_id] = (trackPlays[pe.track_id] || 0) + 1;
  let topTrack = null;
  const sortedTracks = Object.entries(trackPlays).sort((a, b) => b[1] - a[1]);
  if (sortedTracks.length > 0) {
    const tr = db.prepare("SELECT * FROM tracks WHERE id = ? AND status = 'approved'").get(sortedTracks[0][0]);
    if (tr) { topTrack = shapeTrack(tr); topTrack.playsInRange = sortedTracks[0][1]; }
  }

  // Top genre
  const genrePlays = {};
  for (const pe of playEvents) {
    const tr = db.prepare("SELECT genres FROM tracks WHERE id = ?").get(pe.track_id);
    if (tr) {
      const gs = JSON.parse(tr.genres || "[]");
      for (const g of gs) genrePlays[g] = (genrePlays[g] || 0) + 1;
    }
  }
  const sortedGenres = Object.entries(genrePlays).sort((a, b) => b[1] - a[1]);
  const topGenre = sortedGenres.length > 0 ? { name: sortedGenres[0][0], plays: sortedGenres[0][1] } : null;

  // Most active day of week
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const pe of playEvents) {
    const d = new Date(pe.track_id ? playEvents.find(x => x.track_id === pe.track_id)?.created_at || 0 : 0);
    // Use play_events created_at instead
  }
  // Recalculate with proper dates
  const playDates = db.prepare(
    `SELECT created_at FROM play_events WHERE username = ? AND created_at >= ?`
  ).all(username, since);
  for (const pd of playDates) {
    const d = new Date(pd.created_at);
    dayCounts[d.getDay()]++;
  }
  const maxDayIdx = dayCounts.indexOf(Math.max(...dayCounts));
  const mostActiveDay = dayCounts[maxDayIdx] > 0 ? dayNames[maxDayIdx] : null;

  // Unique artists listened to
  const uniqueArtists = new Set();
  for (const pe of playEvents) {
    const credits = db.prepare("SELECT artist_username FROM track_credits WHERE track_id = ?").all(pe.track_id);
    for (const c of credits) if (c.artist_username) uniqueArtists.add(c.artist_username);
  }

  res.json({
    days,
    totalPlays,
    totalMinutes,
    topArtist,
    topTrack,
    topGenre,
    mostActiveDay,
    uniqueArtistsCount: uniqueArtists.size,
  });
});

export default router;
