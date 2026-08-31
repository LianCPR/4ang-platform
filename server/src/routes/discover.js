import express from "express";
import { db, shapeTrack, shapeArtistProfile } from "../db.js";
import { optionalAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { GENRES } from "./artists.js";

const router = express.Router();
const discoverLimit = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "discover" });

// --- Trending Tracks ---
// Weighted score: plays (1) + likes (3) + shares (5), with a time decay
// favoring more recent activity. Real signals only.
router.get("/trending", discoverLimit, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  // Recent engagement signals
  const recentLikes = db.prepare("SELECT track_id, COUNT(*) AS c FROM likes WHERE track_id IN (SELECT id FROM tracks WHERE status = 'approved') GROUP BY track_id").all();
  const recentShares = db.prepare("SELECT id AS track_id, share_count FROM tracks WHERE status = 'approved' AND share_count > 0").all();
  const recentPlays = db.prepare("SELECT track_id, COUNT(*) AS c FROM play_events WHERE created_at >= ? GROUP BY track_id").all(since);

  const scores = {};
  for (const r of recentLikes) scores[r.track_id] = (scores[r.track_id] || 0) + r.c * 3;
  for (const r of recentShares) scores[r.track_id] = (scores[r.track_id] || 0) + r.share_count * 5;
  for (const r of recentPlays) scores[r.track_id] = (scores[r.track_id] || 0) + r.c;

  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const tracks = sorted.length > 0
    ? db.prepare(`SELECT * FROM tracks WHERE id IN (${sorted.map(() => "?").join(",")}) AND status = 'approved'`).all(...sorted)
    : [];
  // Preserve score order
  const trackMap = new Map(tracks.map((t) => [t.id, t]));
  res.json({ tracks: sorted.map((id) => shapeTrack(trackMap.get(id))).filter(Boolean) });
});

// --- New Releases ---
router.get("/new-releases", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
  const genre = (req.query.genre || "").trim();
  let rows;
  if (genre && GENRES.includes(genre)) {
    rows = db.prepare("SELECT * FROM tracks WHERE status = 'approved' AND genres LIKE ? ORDER BY created_at DESC LIMIT ?")
      .all('%"' + genre + '"%', limit);
  } else {
    rows = db.prepare("SELECT * FROM tracks WHERE status = 'approved' ORDER BY created_at DESC LIMIT ?").all(limit);
  }
  res.json({ tracks: rows.map(shapeTrack) });
});

// --- Rising Artists ---
// Artists with recent follower growth and unique listeners.
router.get("/rising-artists", discoverLimit, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  const since30d = Date.now() - 30 * 24 * 60 * 60 * 1000;

  // Get artists with recent followers
  const artists = db.prepare("SELECT * FROM artist_profiles WHERE verification_status IN ('independent', 'verified')").all();
  if (artists.length === 0) return res.json({ artists: [] });

  // Batch: get recent follower counts for all artists in one query
  const artistUsernames = artists.map((a) => a.username);
  const ph = artistUsernames.map(() => "?").join(",");
  const recentFollowRows = db.prepare(`SELECT artist_username, COUNT(*) AS c FROM artist_follows WHERE artist_username IN (${ph}) AND created_at >= ? GROUP BY artist_username`).all(...artistUsernames, since30d);
  const recentFollowMap = {};
  recentFollowRows.forEach((r) => { recentFollowMap[r.artist_username] = r.c; });

  // Batch: get total follower counts for all artists in one query
  const totalFollowRows = db.prepare(`SELECT artist_username, COUNT(*) AS c FROM artist_follows WHERE artist_username IN (${ph}) GROUP BY artist_username`).all(...artistUsernames);
  const totalFollowMap = {};
  totalFollowRows.forEach((r) => { totalFollowMap[r.artist_username] = r.c; });

  // Batch: get all track IDs for these artists in one query
  const allTrackRows = db.prepare(`SELECT id, uploader_username FROM tracks WHERE uploader_username IN (${ph}) AND status = 'approved'`).all(...artistUsernames);
  const artistTrackMap = {};
  allTrackRows.forEach((r) => { (artistTrackMap[r.uploader_username] = artistTrackMap[r.uploader_username] || []).push(r.id); });

  // Batch: get listener counts for all tracks in one query
  const allTrackIds = allTrackRows.map((r) => r.id);
  const listenerMap = {};
  if (allTrackIds.length > 0) {
    const trackPh = allTrackIds.map(() => "?").join(",");
    const listenerRows = db.prepare(`SELECT track_id, COUNT(DISTINCT username) AS c FROM play_events WHERE track_id IN (${trackPh}) AND created_at >= ? AND username IS NOT NULL GROUP BY track_id`).all(...allTrackIds, since30d);
    listenerRows.forEach((r) => { listenerMap[r.track_id] = r.c; });
  }

  // Compute scores
  const scores = [];
  for (const artist of artists) {
    const recentFollowers = recentFollowMap[artist.username] || 0;
    const trackIds = artistTrackMap[artist.username] || [];
    let recentListeners = 0;
    for (const tid of trackIds) recentListeners += (listenerMap[tid] || 0);
    const score = recentFollowers * 5 + recentListeners * 2;
    if (score > 0) {
      const stats = { followers: totalFollowMap[artist.username] || 0 };
      scores.push({ artist, score, stats });
    }
  }
  scores.sort((a, b) => b.score - a.score);
  const result = scores.slice(0, limit).map(({ artist, stats }) => shapeArtistProfile(artist, { ...stats }));
  res.json({ artists: result });
});

// --- Personalized Recommendations ---
// Rule-based scoring: genre affinity from listening history, likes, follows.
router.get("/recommendations", optionalAuth, discoverLimit, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
  const username = req.user ? req.user.username : null;

  if (!username) {
    // Cold start: return trending tracks
    const rows = db.prepare("SELECT * FROM tracks WHERE status = 'approved' ORDER BY play_count DESC, created_at DESC LIMIT ?").all(limit);
    return res.json({ tracks: rows.map(shapeTrack), reason: null });
  }

  // Gather signals
  const likedGenres = {};
  const likedTracks = db.prepare("SELECT track_id FROM likes WHERE username = ?").all(username).map((r) => r.track_id);
  if (likedTracks.length > 0) {
    const placeholders = likedTracks.map(() => "?").join(",");
    const likedTrackRows = db.prepare(`SELECT genres FROM tracks WHERE id IN (${placeholders})`).all(...likedTracks);
    for (const t of likedTrackRows) {
      const g = JSON.parse(t.genres || "[]");
      for (const genre of g) likedGenres[genre] = (likedGenres[genre] || 0) + 1;
    }
  }

  // Listening history genres
  const playedGenres = {};
  const recentPlays = db.prepare("SELECT track_id FROM play_events WHERE username = ? ORDER BY created_at DESC LIMIT 50").all(username);
  if (recentPlays.length > 0) {
    const placeholders = recentPlays.map(() => "?").join(",");
    const playedTrackRows = db.prepare(`SELECT genres FROM tracks WHERE id IN (${placeholders})`).all(...recentPlays);
    for (const t of playedTrackRows) {
      const g = JSON.parse(t.genres || "[]");
      for (const genre of g) playedGenres[genre] = (playedGenres[genre] || 0) + 1;
    }
  }

  // Followed artists
  const followedArtists = db.prepare("SELECT artist_username FROM artist_follows WHERE follower_username = ?").all(username).map((r) => r.artist_username);
  const followedSet = new Set(followedArtists);

  // Combine genre signals: liked genres weigh more
  const allGenres = {};
  for (const [g, c] of Object.entries(likedGenres)) allGenres[g] = (allGenres[g] || 0) + c * 3;
  for (const [g, c] of Object.entries(playedGenres)) allGenres[g] = (allGenres[g] || 0) + c;

  const sortedGenres = Object.entries(allGenres).sort((a, b) => b[1] - a[1]);
  const topGenres = sortedGenres.slice(0, 3).map(([g]) => g);

  // Build candidate pool: exclude already liked tracks
  const likedSet = new Set(likedTracks);
  const allApproved = db.prepare("SELECT * FROM tracks WHERE status = 'approved'").all();
  const candidates = allApproved.filter((t) => !likedSet.has(t.id));

  // Score candidates
  const scored = candidates.map((t) => {
    let score = 0;
    const trackGenres = t.genres || [];
    for (const g of trackGenres) {
      const genreRank = topGenres.indexOf(g);
      if (genreRank >= 0) score += (3 - genreRank) * 10;
    }
    // Bonus for followed artists
    const trackCredits = db.prepare("SELECT artist_username FROM track_credits WHERE track_id = ?").all(t.id);
    for (const c of trackCredits) {
      if (c.artist_username && followedSet.has(c.artist_username)) score += 15;
    }
    // Base popularity score
    score += (t.play_count || 0) * 0.1 + t.likedBy.length * 2;
    return { track: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const result = scored.slice(0, limit).map((x) => shapeTrack(x.track));

  let reason = null;
  if (topGenres.length > 0 && likedTracks.length > 0) {
    reason = "Dựa trên thể loại bạn thích";
  } else if (followedArtists.length > 0) {
    reason = "Dựa trên nghệ sĩ bạn theo dõi";
  }

  res.json({ tracks: result, reason, topGenres });
});

// --- Because You Listened To (genre-based) ---
router.get("/because-you-listened", optionalAuth, discoverLimit, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  const username = req.user ? req.user.username : null;
  if (!username) return res.json({ tracks: [], genre: null });

  // Find most-listened genre from recent history
  const recentPlays = db.prepare("SELECT track_id FROM play_events WHERE username = ? ORDER BY created_at DESC LIMIT 30").all(username);
  if (recentPlays.length === 0) return res.json({ tracks: [], genre: null });

  const genreCounts = {};
  const placeholders = recentPlays.map(() => "?").join(",");
  const trackRows = db.prepare(`SELECT id, genres FROM tracks WHERE id IN (${placeholders})`).all(...recentPlays);
  for (const t of trackRows) {
    const g = JSON.parse(t.genres || "[]");
    for (const genre of g) genreCounts[genre] = (genreCounts[genre] || 0) + 1;
  }
  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];
  if (!topGenre) return res.json({ tracks: [], genre: null });

  const playedIds = new Set(recentPlays.map((r) => r.track_id));
  const tracks = db.prepare("SELECT * FROM tracks WHERE status = 'approved' AND genres LIKE ? ORDER BY play_count DESC LIMIT ?")
    .all('%"' + topGenre[0] + '"%', limit + 10)
    .filter((t) => !playedIds.has(t.id))
    .slice(0, limit);

  res.json({ tracks: tracks.map(shapeTrack), genre: topGenre[0] });
});

// --- Genre listing ---
router.get("/genres", (req, res) => {
  // Show all genres from the defined list, with real counts from published tracks
  const genreCounts = {};
  const rows = db.prepare("SELECT genres FROM tracks WHERE status = 'approved'").all();
  for (const r of rows) {
    const g = JSON.parse(r.genres || "[]");
    for (const genre of g) genreCounts[genre] = (genreCounts[genre] || 0) + 1;
  }
  // Always show all genres, even those with 0 tracks — users can explore them
  const result = GENRES
    .map((g) => ({ name: g, trackCount: genreCounts[g] || 0 }))
    .sort((a, b) => b.trackCount - a.trackCount);
  res.json({ genres: result });
});

// --- Genre detail ---
router.get("/genres/:name", (req, res) => {
  const name = req.params.name;
  if (!GENRES.includes(name)) return res.status(404).json({ error: "Thể loại không tồn tại." });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
  const tracks = db.prepare("SELECT * FROM tracks WHERE status = 'approved' AND genres LIKE ? ORDER BY play_count DESC LIMIT ?")
    .all('%"' + name + '"%', limit);
  const recentTracks = db.prepare("SELECT * FROM tracks WHERE status = 'approved' AND genres LIKE ? ORDER BY created_at DESC LIMIT ?")
    .all('%"' + name + '"%', 8);
  // Artists in this genre
  const artistUsernames = new Set();
  for (const t of tracks) {
    const credits = db.prepare("SELECT artist_username FROM track_credits WHERE track_id = ? AND artist_username IS NOT NULL").all(t.id);
    for (const c of credits) artistUsernames.add(c.artist_username);
  }
  const artists = [];
  for (const uname of artistUsernames) {
    const artist = db.prepare("SELECT * FROM artist_profiles WHERE username = ?").get(uname);
    if (artist) {
      const followers = db.prepare("SELECT COUNT(*) AS c FROM artist_follows WHERE artist_username = ?").get(uname).c;
      artists.push(shapeArtistProfile(artist, { followers }));
    }
  }
  artists.sort((a, b) => b.followers - a.followers);

  res.json({
    genre: name,
    trackCount: db.prepare("SELECT COUNT(*) AS c FROM tracks WHERE status = 'approved' AND genres LIKE ?").get('%"' + name + '"%').c,
    popularTracks: tracks.map(shapeTrack),
    recentTracks: recentTracks.map(shapeTrack),
    artists: artists.slice(0, 10),
  });
});

// --- Artist releases (for "New from artists you follow") ---
router.get("/artist-releases", optionalAuth, (req, res) => {
  const username = req.user ? req.user.username : null;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
  if (!username) return res.json({ tracks: [] });
  const following = db.prepare("SELECT artist_username FROM artist_follows WHERE follower_username = ?").all(username).map((r) => r.artist_username);
  if (following.length === 0) return res.json({ tracks: [] });
  const placeholders = following.map(() => "?").join(",");
  const tracks = db.prepare(`SELECT * FROM tracks WHERE uploader_username IN (${placeholders}) AND status = 'approved' ORDER BY created_at DESC LIMIT ?`)
    .all(...following, limit);
  res.json({ tracks: tracks.map(shapeTrack) });
});

// --- Smart Mix ---
// Generates a personalized queue based on user's listening data.
// Score = likes*3 + recent_plays*2 + genre_affinity*4 + artist_affinity*3 + freshness*1 + popularity*0.5
router.get("/smart-mix", optionalAuth, discoverLimit, (req, res) => {
  const type = (req.query.type || "my-mix").trim(); // my-mix | chill | energy | late-night | artist | genre
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 5), 50);
  const username = req.user ? req.user.username : null;

  // Get all approved tracks
  const allTracks = db.prepare("SELECT * FROM tracks WHERE status = 'approved'").all();
  if (allTracks.length === 0) return res.json({ tracks: [], type });

  if (!username) {
    // Cold start: return top tracks
    const top = allTracks.sort((a, b) => (b.play_count || 0) - (a.play_count || 0)).slice(0, limit);
    return res.json({ tracks: top.map(shapeTrack), type });
  }

  // Gather user signals
  const likedTrackIds = db.prepare("SELECT track_id FROM likes WHERE username = ?").all(username).map(r => r.track_id);
  const followedArtists = db.prepare("SELECT artist_username FROM artist_follows WHERE follower_username = ?").all(username).map(r => r.artist_username);
  const recentPlayIds = db.prepare("SELECT track_id FROM play_events WHERE username = ? ORDER BY created_at DESC LIMIT 50").all(username).map(r => r.track_id);

  // Genre affinity from likes + plays
  const genreAffinity = {};
  const allSignalTracks = [...new Set([...likedTrackIds, ...recentPlayIds])];
  if (allSignalTracks.length > 0) {
    const placeholders = allSignalTracks.map(() => "?").join(",");
    const signalRows = db.prepare(`SELECT genres FROM tracks WHERE id IN (${placeholders})`).all(...allSignalTracks);
    for (const row of signalRows) {
      const gs = JSON.parse(row.genres || "[]");
      for (const g of gs) genreAffinity[g] = (genreAffinity[g] || 0) + 1;
    }
  }
  const likedSet = new Set(likedTrackIds);
  const followedSet = new Set(followedArtists);
  const playedSet = new Set(recentPlayIds);

  // Filter by mix type
  let pool = allTracks;
  if (type === "chill") {
    pool = allTracks.filter(t => {
      const gs = JSON.parse(t.genres || "[]");
      return gs.some(g => ["Ballad", "Acoustic", "Bolero", "Nhạc trữ tình"].includes(g));
    });
    if (pool.length < 5) pool = allTracks;
  } else if (type === "energy") {
    pool = allTracks.filter(t => {
      const gs = JSON.parse(t.genres || "[]");
      return gs.some(g => ["Rock", "EDM/Dance", "Rap/Hip-hop", "Pop"].includes(g));
    });
    if (pool.length < 5) pool = allTracks;
  } else if (type === "late-night") {
    pool = allTracks.filter(t => {
      const gs = JSON.parse(t.genres || "[]");
      return gs.some(g => ["Ballad", "R&B", "Nhạc trữ tình", "Bolero", "Indie"].includes(g));
    });
    if (pool.length < 5) pool = allTracks;
  } else if (type === "artist") {
    // Artist Mix: prioritize tracks from followed artists
    if (followedSet.size > 0) {
      pool = allTracks.filter(t => {
        if (followedSet.has(t.uploader_username)) return true;
        const credits = db.prepare("SELECT artist_username FROM track_credits WHERE track_id = ?").all(t.id);
        return credits.some(c => c.artist_username && followedSet.has(c.artist_username));
      });
      if (pool.length < 5) pool = allTracks;
    }
  } else if (type === "genre") {
    // Genre Mix: prioritize user's top genres
    const topGenres = Object.entries(genreAffinity).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
    if (topGenres.length > 0) {
      pool = allTracks.filter(t => {
        const gs = JSON.parse(t.genres || "[]");
        return gs.some(g => topGenres.includes(g));
      });
      if (pool.length < 5) pool = allTracks;
    }
  }

  // Score each track
  const scored = pool.map(t => {
    let score = 0;
    const gs = JSON.parse(t.genres || "[]");

    // Like affinity
    if (likedSet.has(t.id)) score += 30;

    // Play recency
    const playIndex = recentPlayIds.indexOf(t.id);
    if (playIndex >= 0) score += Math.max(0, 20 - playIndex * 2);

    // Genre affinity
    for (const g of gs) score += (genreAffinity[g] || 0) * 4;

    // Artist affinity
    const credits = db.prepare("SELECT artist_username FROM track_credits WHERE track_id = ?").all(t.id);
    for (const c of credits) {
      if (c.artist_username && followedSet.has(c.artist_username)) score += 25;
    }
    if (followedSet.has(t.uploader_username)) score += 20;

    // Popularity
    score += (t.play_count || 0) * 0.5;
    score += (t.likedBy ? t.likedBy.length : 0) * 1.5;

    // Freshness (newer tracks get a boost)
    const ageDays = (Date.now() - t.created_at) / (24 * 60 * 60 * 1000);
    score += Math.max(0, 10 - ageDays * 0.5);

    return { track: t, score };
  });

  // Smart shuffle: avoid consecutive same artist
  scored.sort((a, b) => b.score - a.score);
  const result = [];
  const usedIds = new Set();
  for (const s of scored) {
    if (result.length >= limit) break;
    if (usedIds.has(s.track.id)) continue;
    // Check artist diversity
    const lastTrack = result[result.length - 1];
    if (lastTrack) {
      const lastCredits = db.prepare("SELECT artist_username FROM track_credits WHERE track_id = ?").all(lastTrack.id);
      const thisCredits = db.prepare("SELECT artist_username FROM track_credits WHERE track_id = ?").all(s.track.id);
      const lastArtists = new Set(lastCredits.map(c => c.artist_username).filter(Boolean));
      const thisArtists = new Set(thisCredits.map(c => c.artist_username).filter(Boolean));
      lastArtists.add(lastTrack.uploader_username);
      thisArtists.add(s.track.uploader_username);
      const overlap = [...lastArtists].filter(a => thisArtists.has(a));
      if (overlap.length > 0 && result.length < limit - 2) continue; // skip if same artist, unless we're running low
    }
    result.push(s.track);
    usedIds.add(s.track.id);
  }

  // Fill remaining if filtered pool was too small
  if (result.length < limit) {
    for (const s of scored) {
      if (result.length >= limit) break;
      if (!usedIds.has(s.track.id)) {
        result.push(s.track);
        usedIds.add(s.track.id);
      }
    }
  }

  res.json({ tracks: result.slice(0, limit).map(shapeTrack), type });
});

// --- Charts ---
router.get("/charts", discoverLimit, (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 90);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  // Top songs by play count + likes
  const topSongs = db.prepare(`
    SELECT t.*, 
      (SELECT COUNT(*) FROM likes WHERE track_id = t.id) AS like_count,
      (SELECT COUNT(*) FROM play_events WHERE track_id = t.id AND created_at >= ?) AS recent_plays
    FROM tracks t WHERE t.status = 'approved'
    ORDER BY (t.play_count * 1 + like_count * 3 + recent_plays * 2) DESC
    LIMIT 20
  `).all(since);

  // Top artists by total plays + followers
  const artistScores = {};
  const artistMap = {};
  const artists = db.prepare("SELECT * FROM artist_profiles").all();
  for (const a of artists) {
    const trackRows = db.prepare("SELECT id, play_count FROM tracks WHERE uploader_username = ? AND status = 'approved'").all(a.username);
    const totalPlays = trackRows.reduce((sum, t) => sum + (t.play_count || 0), 0);
    const followers = db.prepare("SELECT COUNT(*) AS c FROM artist_follows WHERE artist_username = ?").get(a.username).c;
    const recentPlays = trackRows.length > 0 ? db.prepare(
      `SELECT COUNT(*) AS c FROM play_events WHERE track_id IN (${trackRows.map(() => "?").join(",")}) AND created_at >= ?`
    ).get(...trackRows.map(t => t.id), since).c : 0;
    const score = totalPlays * 1 + followers * 5 + recentPlays * 3;
    if (score > 0) {
      artistScores[a.username] = score;
      artistMap[a.username] = a;
    }
  }
  const topArtists = Object.entries(artistScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([username]) => {
      const a = artistMap[username];
      const followers = db.prepare("SELECT COUNT(*) AS c FROM artist_follows WHERE artist_username = ?").get(username).c;
      return shapeArtistProfile(a, { followers });
    });

  res.json({
    topSongs: topSongs.slice(0, 20).map(shapeTrack),
    topArtists,
    period: days + " days",
  });
});

export default router;
