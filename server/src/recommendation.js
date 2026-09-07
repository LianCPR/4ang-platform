/**
 * 4ANG RECOMMENDATION ENGINE — Phase 3.0 + 3.1
 *
 * Centralized, explainable, measurable recommendation system.
 * Phase 3.1 adds: Daily Mix, Smart Radio, Similar Songs/Artists,
 * Taste Profile, Not Interested, Skip Learning.
 *
 * Architecture:
 *   Real user data → Taste Profile → Candidate Generation → Scoring → Diversity → Recommendations
 *
 * Every recommendation carries a human-readable reason backed by actual rows.
 */

import { supabaseAdmin } from "./supabase.js";
import { shapeTrack, shapeArtistProfile } from "./db.js";

/* ═══════════════════════════════════════════════════════════════════════
 * SIGNAL WEIGHTS — centralized, configurable scoring model
 * ═══════════════════════════════════════════════════════════════════════ */

export const WEIGHTS = {
  // Positive signals
  LIKED_SONG:            10,
  FOLLOWED_ARTIST:       10,
  SAVED_TRACK:            9,
  MEANINGFUL_PLAY:        8,
  PLAYLIST_INCLUDE:       6,
  COMPLETED_PLAY:         5,
  RECENT_PLAY:            5,
  GENRE_MATCH:            6,
  ARTIST_MATCH:          10,
  SOCIAL_SHARED:          4,
  SOCIAL_FOLLOWED_LIKE:   3,
  POPULARITY_BONUS:       0.1,

  // Negative signals
  SKIP:                  -6,
  REPEATED_SKIP:        -10,
  NOT_INTERESTED:       -20,

  // Diversity caps
  MAX_PER_ARTIST:         3,
  MAX_PER_ALBUM:          2,

  // Candidate pool
  CANDIDATE_POOL_SIZE:   200,
  FINAL_LIMIT:           20,
  NOVELTY_RATIO:         0.2,

  // Daily Mix
  MIX_COUNT:              3,
  MIX_TRACKS:            15,

  // Smart Radio
  RADIO_QUEUE_SIZE:      20,

  // Similar
  SIMILAR_SONGS_LIMIT:   12,
  SIMILAR_ARTISTS_LIMIT:  8,

  // Taste profile
  TOP_ARTISTS_COUNT:      5,
  TOP_GENRES_COUNT:       5,
};

/* ═══════════════════════════════════════════════════════════════════════
 * TIME WINDOWS
 * ═══════════════════════════════════════════════════════════════════════ */

const DAY = 24 * 60 * 60 * 1000;
const RECENT_WINDOW = 7 * DAY;
const LONG_WINDOW = 30 * DAY;

/* ═══════════════════════════════════════════════════════════════════════
 * SKIP & NOT-INTERESTED LEARNING
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Get user's skip/not-interested patterns.
 * Returns { skippedArtists, skippedGenres, notInterestedTracks }
 */
async function getSkipPatterns(username) {
  // Get skip events
  const { data: skips } = await supabaseAdmin
    .from("activity_events")
    .select("target_id, metadata")
    .eq("username", username)
    .eq("event_type", "REC_SKIP")
    .gte("created_at", new Date(Date.now() - 30 * DAY).toISOString());

  // Get not-interested events
  const { data: notInterested } = await supabaseAdmin
    .from("activity_events")
    .select("target_id")
    .eq("username", username)
    .eq("event_type", "REC_NOT_INTERESTED")
    .gte("created_at", new Date(Date.now() - 90 * DAY).toISOString());

  const notInterestedTrackIds = new Set((notInterested || []).map(r => r.target_id));

  // Resolve skipped track metadata
  const skipTrackIds = [...new Set((skips || []).map(r => r.target_id).filter(Boolean))];
  let skippedArtists = {};
  let skippedGenres = {};

  if (skipTrackIds.length > 0) {
    for (let i = 0; i < skipTrackIds.length; i += 100) {
      const chunk = skipTrackIds.slice(i, i + 100);
      const { data: rows } = await supabaseAdmin
        .from("tracks")
        .select("id, uploader_username, genres")
        .in("id", chunk);
      for (const t of (rows || [])) {
        if (t.uploader_username) {
          skippedArtists[t.uploader_username] = (skippedArtists[t.uploader_username] || 0) + 1;
        }
        for (const g of (Array.isArray(t.genres) ? t.genres : [])) {
          skippedGenres[g] = (skippedGenres[g] || 0) + 1;
        }
      }
    }
  }

  // Only return artists/genres skipped 2+ times
  const filteredArtists = {};
  for (const [a, count] of Object.entries(skippedArtists)) {
    if (count >= 2) filteredArtists[a] = count;
  }
  const filteredGenres = {};
  for (const [g, count] of Object.entries(skippedGenres)) {
    if (count >= 2) filteredGenres[g] = count;
  }

  return {
    skippedArtists: filteredArtists,
    skippedGenres: filteredGenres,
    notInterestedTracks,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 * USER TASTE PROFILE — derived from real signals
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Build a taste profile for a user from their actual signals.
 */
export async function buildTasteProfile(username) {
  const [likes, plays, artistFollows, skipPatterns] = await Promise.all([
    supabaseAdmin.from("track_likes").select("track_id, created_at").eq("username", username)
      .order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("play_events").select("track_id, created_at").eq("username", username)
      .order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("artist_follows").select("artist_username").eq("follower_username", username),
    getSkipPatterns(username),
  ]);

  const likedIds = [...new Set((likes.data || []).map(r => r.track_id))];
  const playedIds = [...new Set((plays.data || []).map(r => r.track_id))];
  const followedArtists = new Set((artistFollows.data || []).map(r => r.artist_username));

  const recentPlays = (plays.data || []).filter(p =>
    new Date(p.created_at).getTime() > Date.now() - RECENT_WINDOW
  );
  const recentPlayedIds = new Set(recentPlays.map(r => r.track_id));

  // Resolve track metadata
  const allTrackIds = [...new Set([...likedIds, ...playedIds])];
  let trackInfoMap = {};
  if (allTrackIds.length > 0) {
    for (let i = 0; i < allTrackIds.length; i += 100) {
      const chunk = allTrackIds.slice(i, i + 100);
      const { data: rows } = await supabaseAdmin
        .from("tracks")
        .select("id, uploader_username, genres")
        .in("id", chunk);
      for (const t of (rows || [])) trackInfoMap[t.id] = t;
    }
  }

  // Compute artist/genre affinity
  const artistScores = {};
  const genreScores = {};

  for (const id of likedIds) {
    const info = trackInfoMap[id];
    if (!info) continue;
    if (info.uploader_username) artistScores[info.uploader_username] = (artistScores[info.uploader_username] || 0) + WEIGHTS.LIKED_SONG;
    for (const g of (Array.isArray(info.genres) ? info.genres : [])) genreScores[g] = (genreScores[g] || 0) + WEIGHTS.LIKED_SONG;
  }

  for (const id of playedIds) {
    const info = trackInfoMap[id];
    if (!info) continue;
    const weight = recentPlayedIds.has(id) ? WEIGHTS.RECENT_PLAY : 3;
    if (info.uploader_username) artistScores[info.uploader_username] = (artistScores[info.uploader_username] || 0) + weight;
    for (const g of (Array.isArray(info.genres) ? info.genres : [])) genreScores[g] = (genreScores[g] || 0) + weight;
  }

  for (const a of followedArtists) artistScores[a] = (artistScores[a] || 0) + WEIGHTS.FOLLOWED_ARTIST;

  // Apply skip penalties
  for (const [artist, count] of Object.entries(skipPatterns.skippedArtists)) {
    artistScores[artist] = (artistScores[artist] || 0) + WEIGHTS.REPEATED_SKIP * count;
  }
  for (const [genre, count] of Object.entries(skipPatterns.skippedGenres)) {
    genreScores[genre] = (genreScores[genre] || 0) + WEIGHTS.REPEATED_SKIP * count;
  }

  const topArtists = Object.entries(artistScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, score]) => ({ name, score: Math.max(0, score) }));

  const topGenres = Object.entries(genreScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, score]) => ({ name, score: Math.max(0, score) }));

  return {
    topArtists,
    topGenres,
    likedIds,
    playedIds,
    recentPlayedIds,
    followedArtists,
    trackInfoMap,
    skipPatterns,
  };
}

/**
 * Compute personalization level based on user activity.
 * Returns: 'cold_start' | 'early' | 'moderate' | 'strong'
 */
export function personalizationLevel(taste) {
  const signalCount = taste.likedIds.length + taste.playedIds.length + taste.followedArtists.size;
  if (signalCount < 5) return "cold_start";
  if (signalCount < 20) return "early";
  if (signalCount < 60) return "moderate";
  return "strong";
}

/* ═══════════════════════════════════════════════════════════════════════
 * CANDIDATE GENERATION
 * ═══════════════════════════════════════════════════════════════════════ */

export async function generateCandidates(taste, { exclude: extraExclude = new Set(), limit = WEIGHTS.CANDIDATE_POOL_SIZE } = {}) {
  const exclude = new Set([...taste.likedIds, ...taste.playedIds, ...taste.skipPatterns.notInterestedTracks, ...extraExclude]);
  const candidates = new Map();

  // Source 1: Popular approved tracks
  const { data: popular } = await supabaseAdmin
    .from("tracks").select("*").eq("status", "approved")
    .order("play_count", { ascending: false }).limit(limit);
  for (const t of (popular || [])) { if (!exclude.has(t.id)) candidates.set(t.id, t); }

  // Source 2: Tracks from top artists
  const topArtistNames = taste.topArtists.filter(a => a.score > 0).slice(0, 10).map(a => a.name);
  if (topArtistNames.length > 0) {
    const { data: artistTracks } = await supabaseAdmin
      .from("tracks").select("*").eq("status", "approved")
      .in("uploader_username", topArtistNames)
      .order("created_at", { ascending: false }).limit(50);
    for (const t of (artistTracks || [])) { if (!exclude.has(t.id)) candidates.set(t.id, t); }
  }

  // Source 3: Top genre tracks
  const topGenreNames = taste.topGenres.filter(g => g.score > 0).slice(0, 5).map(g => g.name);
  for (const genre of topGenreNames) {
    const { data: genreTracks } = await supabaseAdmin
      .from("tracks").select("*").eq("status", "approved")
      .contains("genres", [genre])
      .order("play_count", { ascending: false }).limit(30);
    for (const t of (genreTracks || [])) { if (!exclude.has(t.id)) candidates.set(t.id, t); }
  }

  // Source 4: New releases (novelty)
  const { data: newTracks } = await supabaseAdmin
    .from("tracks").select("*").eq("status", "approved")
    .order("created_at", { ascending: false }).limit(30);
  for (const t of (newTracks || [])) { if (!exclude.has(t.id)) candidates.set(t.id, t); }

  return [...candidates.values()];
}

/* ═══════════════════════════════════════════════════════════════════════
 * SCORING
 * ═══════════════════════════════════════════════════════════════════════ */

function scoreCandidate(track, taste) {
  let score = 0;
  const reasons = [];
  const tGenres = Array.isArray(track.genres) ? track.genres : [];
  const uploader = track.uploader_username;

  if (uploader && taste.followedArtists.has(uploader)) {
    score += WEIGHTS.FOLLOWED_ARTIST;
    reasons.push("Nghệ sĩ bạn theo dõi");
  } else if (uploader && taste.topArtists.some(a => a.name === uploader && a.score > 0)) {
    const a = taste.topArtists.find(x => x.name === uploader);
    score += Math.min(WEIGHTS.ARTIST_MATCH, Math.round(a.score / 5));
    reasons.push("Nghệ sĩ bạn hay nghe");
  }

  const matchingGenres = tGenres.filter(g => taste.topGenres.some(tg => tg.name === g && tg.score > 0));
  if (matchingGenres.length > 0) {
    score += matchingGenres.length * WEIGHTS.GENRE_MATCH;
    reasons.push(`Thể loại ${matchingGenres[0]} bạn thích`);
  }

  if (taste.likedIds.includes(track.id)) score += WEIGHTS.LIKED_SONG;
  if (taste.recentPlayedIds.has(track.id)) score += WEIGHTS.RECENT_PLAY;

  score += (track.play_count || 0) * WEIGHTS.POPULARITY_BONUS;

  const ageMs = Date.now() - new Date(track.created_at).getTime();
  if (ageMs < 7 * DAY) {
    score += 3;
    if (reasons.length === 0) reasons.push("Phát hành gần đây");
  }

  // Skip penalty
  if (uploader && taste.skipPatterns.skippedArtists[uploader]) {
    score += WEIGHTS.REPEATED_SKIP;
  }

  // Not-interested penalty
  if (taste.skipPatterns.notInterestedTracks.has(track.id)) {
    score += WEIGHTS.NOT_INTERESTED;
  }

  return { score, reasons: reasons.slice(0, 2) };
}

export function scoreCandidates(candidates, taste) {
  return candidates
    .map(t => ({ track: t, ...scoreCandidate(t, taste) }))
    .sort((a, b) => b.score - a.score);
}

/* ═══════════════════════════════════════════════════════════════════════
 * DIVERSITY
 * ═══════════════════════════════════════════════════════════════════════ */

export function applyDiversity(scoredCandidates, limit = WEIGHTS.FINAL_LIMIT, { exclude: excludeSet = new Set() } = {}) {
  const artistCounts = {};
  const albumCounts = {};
  const result = [];
  const discovery = [];

  for (const item of scoredCandidates) {
    if (excludeSet.has(item.track.id)) continue;
    const uploader = item.track.uploader_username;
    const albumId = item.track.album_id || item.track.title;

    if (uploader && (artistCounts[uploader] || 0) >= WEIGHTS.MAX_PER_ARTIST) continue;
    if ((albumCounts[albumId] || 0) >= WEIGHTS.MAX_PER_ALBUM) continue;

    if (uploader) artistCounts[uploader] = (artistCounts[uploader] || 0) + 1;
    albumCounts[albumId] = (albumCounts[albumId] || 0) + 1;

    if (item.reasons.length === 0) discovery.push(item);
    else result.push(item);
  }

  const noveltySlots = Math.max(2, Math.round(limit * WEIGHTS.NOVELTY_RATIO));
  const discoveryToAdd = discovery.slice(0, noveltySlots);
  const remaining = limit - discoveryToAdd.length;
  const tasteSelected = result.slice(0, remaining);
  const final = [...tasteSelected, ...discoveryToAdd];

  if (final.length < limit) {
    const usedIds = new Set(final.map(f => f.track.id));
    const extra = scoredCandidates.filter(s => !usedIds.has(s.track.id) && !excludeSet.has(s.track.id)).slice(0, limit - final.length);
    final.push(...extra);
  }

  return final.slice(0, limit);
}

/* ═══════════════════════════════════════════════════════════════════════
 * MAIN RECOMMENDATION FUNCTION
 * ═══════════════════════════════════════════════════════════════════════ */

export async function getRecommendations(username, { limit = WEIGHTS.FINAL_LIMIT, context = "home", exclude = new Set() } = {}) {
  const startTime = Date.now();
  const taste = await buildTasteProfile(username);
  const hasData = taste.topArtists.some(a => a.score > 0) || taste.topGenres.some(g => g.score > 0) || taste.likedIds.length > 0;

  if (!hasData) {
    const { data: trending } = await supabaseAdmin
      .from("tracks").select("*").eq("status", "approved")
      .order("play_count", { ascending: false }).limit(limit);
    const tracks = await Promise.all((trending || []).map(t => shapeTrack(t)).filter(Boolean));
    return { tracks, reasons: [], metadata: { strategy: "cold_start", signalCount: 0, durationMs: Date.now() - startTime } };
  }

  const candidates = await generateCandidates(taste, { exclude });
  const scored = scoreCandidates(candidates, taste);
  const diversified = applyDiversity(scored, limit, { exclude });

  const tracks = await Promise.all(
    diversified.map(async (item) => {
      const shaped = await shapeTrack(item.track);
      if (shaped) shaped.reasons = item.reasons;
      return shaped;
    })
  );

  const validTracks = tracks.filter(Boolean);
  return {
    tracks: validTracks,
    reasons: [...new Set(validTracks.flatMap(t => t.reasons || []))].slice(0, 3),
    metadata: {
      strategy: "personalized",
      level: personalizationLevel(taste),
      signalCount: taste.likedIds.length + taste.playedIds.length + taste.followedArtists.size,
      artistCount: taste.topArtists.filter(a => a.score > 0).length,
      genreCount: taste.topGenres.filter(g => g.score > 0).length,
      candidateCount: candidates.length,
      durationMs: Date.now() - startTime,
    },
  };
}

export async function getContextualRecommendations(username, context, { limit = 12 } = {}) {
  return getRecommendations(username, { limit, context });
}

/* ═══════════════════════════════════════════════════════════════════════
 * DAILY MIX — Phase 3.1
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Generate Daily Mixes by clustering the user's taste.
 * Each mix is themed around a dominant artist/genre cluster.
 */
export async function getDailyMixes(username) {
  const taste = await buildTasteProfile(username);
  const level = personalizationLevel(taste);

  if (level === "cold_start") {
    // No data → return trending-based generic mixes
    const { data: tracks } = await supabaseAdmin
      .from("tracks").select("*").eq("status", "approved")
      .order("play_count", { ascending: false }).limit(WEIGHTS.MIX_COUNT * 5);

    const mixTracks = (tracks || []).map(t => shapeTrack(t));
    const shaped = (await Promise.all(mixTracks)).filter(Boolean);

    const genres = ["Pop", "Hip-Hop", "Indie", "Electronic", "Rock"];
    return genres.slice(0, WEIGHTS.MIX_COUNT).map((g, i) => ({
      id: `mix-trending-${i}`,
      title: `Mix — ${g}`,
      description: "Nhạc thịnh hành",
      tracks: shaped.slice(i * 5, (i + 1) * 5),
      reason: "Dựa trên nhạc thịnh hành",
      trackCount: 5,
    }));
  }

  // Cluster by top artists + genres
  const usedTrackIds = new Set();
  const mixes = [];

  // Mix 1: Top artist cluster
  if (taste.topArtists.length > 0) {
    const topA = taste.topArtists.filter(a => a.score > 0).slice(0, 2);
    const artistNames = topA.map(a => a.name);
    const { data: tracks } = await supabaseAdmin
      .from("tracks").select("*").eq("status", "approved")
      .in("uploader_username", artistNames)
      .order("play_count", { ascending: false }).limit(20);
    const shaped = (await Promise.all((tracks || []).map(t => shapeTrack(t)))).filter(Boolean);
    const mixTracks = shaped.filter(t => { if (usedTrackIds.has(t.id)) return false; usedTrackIds.add(t.id); return true; }).slice(0, WEIGHTS.MIX_TRACKS);
    if (mixTracks.length > 0) {
      mixes.push({
        id: `mix-artist-${artistNames[0]}`,
        title: `Mix — ${topA[0].name}${topA.length > 1 ? ` & ${topA[1].name}` : ""}`,
        description: `Nhạc từ ${topA[0].name}`,
        tracks: mixTracks,
        reason: `Nghệ sĩ bạn yêu thích`,
        trackCount: mixTracks.length,
      });
    }
  }

  // Mix 2: Top genre cluster
  if (taste.topGenres.length > 0) {
    const topG = taste.topGenres.filter(g => g.score > 0).slice(0, 2);
    const { data: tracks } = await supabaseAdmin
      .from("tracks").select("*").eq("status", "approved")
      .contains("genres", [topG[0].name])
      .order("play_count", { ascending: false }).limit(20);
    const shaped = (await Promise.all((tracks || []).map(t => shapeTrack(t)))).filter(Boolean);
    const mixTracks = shaped.filter(t => { if (usedTrackIds.has(t.id)) return false; usedTrackIds.add(t.id); return true; }).slice(0, WEIGHTS.MIX_TRACKS);
    if (mixTracks.length > 0) {
      mixes.push({
        id: `mix-genre-${topG[0].name}`,
        title: `Mix — ${topG[0].name}`,
        description: `Nhạc thể loại ${topG[0].name}`,
        tracks: mixTracks,
        reason: `Thể loại bạn yêu thích`,
        trackCount: mixTracks.length,
      });
    }
  }

  // Mix 3: Discovery mix (novelty)
  const discoveryCandidates = await generateCandidates(taste, { exclude: usedTrackIds, limit: 100 });
  const discoveryScored = scoreCandidates(discoveryCandidates, taste);
  const discoveryTracks = discoveryScored.filter(s => s.reasons.length === 0).slice(0, WEIGHTS.MIX_TRACKS);
  const shapedDiscovery = (await Promise.all(discoveryTracks.map(s => shapeTrack(s.track)))).filter(Boolean);
  if (shapedDiscovery.length > 0) {
    mixes.push({
      id: "mix-discovery",
      title: "Mix — Khám phá",
      description: "Nhạc mới cho bạn",
      tracks: shapedDiscovery,
      reason: "Khám phá âm nhạc mới",
      trackCount: shapedDiscovery.length,
    });
  }

  return mixes.slice(0, WEIGHTS.MIX_COUNT);
}

/* ═══════════════════════════════════════════════════════════════════════
 * SMART RADIO — Phase 3.1
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Generate Smart Radio queue from a seed track.
 * Continuously relevant, gradually introducing new music.
 */
export async function getSmartRadio(seedTrackId, username) {
  const { data: seedRow } = await supabaseAdmin
    .from("tracks").select("*").eq("id", seedTrackId).single();
  if (!seedRow) return { tracks: [], seed: null };

  const seed = await shapeTrack(seedRow);
  if (!seed) return { tracks: [], seed: null };

  const seedGenres = Array.isArray(seedRow.genres) ? seedRow.genres : [];
  const seedArtist = seedRow.uploader_username;
  const exclude = new Set([seedTrackId]);

  // Build candidates: same artist, same genres, popular, new
  const candidateMap = new Map();

  // Same artist tracks
  if (seedArtist) {
    const { data: artistTracks } = await supabaseAdmin
      .from("tracks").select("*").eq("status", "approved")
      .eq("uploader_username", seedArtist)
      .order("play_count", { ascending: false }).limit(15);
    for (const t of (artistTracks || [])) {
      if (!exclude.has(t.id)) candidateMap.set(t.id, t);
    }
  }

  // Same genre tracks
  for (const genre of seedGenres.slice(0, 3)) {
    const { data: genreTracks } = await supabaseAdmin
      .from("tracks").select("*").eq("status", "approved")
      .contains("genres", [genre])
      .order("play_count", { ascending: false }).limit(20);
    for (const t of (genreTracks || [])) {
      if (!exclude.has(t.id)) candidateMap.set(t.id, t);
    }
  }

  // Popular tracks (for variety)
  const { data: popular } = await supabaseAdmin
    .from("tracks").select("*").eq("status", "approved")
    .order("play_count", { ascending: false }).limit(50);
  for (const t of (popular || [])) {
    if (!exclude.has(t.id)) candidateMap.set(t.id, t);
  }

  // Score against seed (not user taste — radio is seed-based)
  const candidates = [...candidateMap.values()];
  const scored = candidates.map(t => {
    let score = 0;
    const tGenres = Array.isArray(t.genres) ? t.genres : [];
    if (t.uploader_username === seedArtist) score += 15;
    if (t.composer && t.composer === seedRow.composer) score += 10;
    const genreOverlap = tGenres.filter(g => seedGenres.includes(g)).length;
    score += genreOverlap * 6;
    score += (t.play_count || 0) * 0.1;
    return { track: t, score };
  }).sort((a, b) => b.score - a.score);

  // Apply diversity
  const artistCounts = {};
  const result = [];
  for (const item of scored) {
    const a = item.track.uploader_username;
    if (a && (artistCounts[a] || 0) >= 3) continue;
    if (a) artistCounts[a] = (artistCounts[a] || 0) + 1;
    result.push(item);
  }

  const finalTracks = await Promise.all(
    result.slice(0, WEIGHTS.RADIO_QUEUE_SIZE).map(async (item) => {
      const shaped = await shapeTrack(item.track);
      if (shaped) shaped.reason = item.track.uploader_username === seedArtist ? "Cùng nghệ sĩ" : "Dựa trên bài hát này";
      return shaped;
    })
  );

  return {
    tracks: finalTracks.filter(Boolean),
    seed,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 * SIMILAR SONGS — Phase 3.1
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Get personalized similar songs to a given track.
 */
export async function getSimilarSongs(trackId, username, { limit = WEIGHTS.SIMILAR_SONGS_LIMIT } = {}) {
  const { data: seedRow } = await supabaseAdmin
    .from("tracks").select("*").eq("id", trackId).single();
  if (!seedRow) return [];

  const seedGenres = Array.isArray(seedRow.genres) ? seedRow.genres : [];
  const seedArtist = seedRow.uploader_username;

  // Get user taste if authenticated
  let taste = null;
  if (username) {
    taste = await buildTasteProfile(username);
  }

  // Build candidates
  const exclude = new Set([trackId]);
  const candidateMap = new Map();

  if (seedArtist) {
    const { data: at } = await supabaseAdmin
      .from("tracks").select("*").eq("status", "approved")
      .eq("uploader_username", seedArtist)
      .order("play_count", { ascending: false }).limit(15);
    for (const t of (at || [])) { if (!exclude.has(t.id)) candidateMap.set(t.id, t); }
  }

  for (const genre of seedGenres.slice(0, 3)) {
    const { data: gt } = await supabaseAdmin
      .from("tracks").select("*").eq("status", "approved")
      .contains("genres", [genre])
      .order("play_count", { ascending: false }).limit(20);
    for (const t of (gt || [])) { if (!exclude.has(t.id)) candidateMap.set(t.id, t); }
  }

  const { data: pop } = await supabaseAdmin
    .from("tracks").select("*").eq("status", "approved")
    .order("play_count", { ascending: false }).limit(50);
  for (const t of (pop || [])) { if (!exclude.has(t.id)) candidateMap.set(t.id, t); }

  // Score: seed similarity + user taste boost
  const candidates = [...candidateMap.values()];
  const scored = candidates.map(t => {
    let score = 0;
    const reasons = [];
    const tGenres = Array.isArray(t.genres) ? t.genres : [];

    // Seed similarity
    if (t.uploader_username === seedArtist) { score += 15; reasons.push("Cùng nghệ sĩ"); }
    const genreOverlap = tGenres.filter(g => seedGenres.includes(g)).length;
    if (genreOverlap > 0) { score += genreOverlap * 6; reasons.push(`Thể loại ${tGenres.find(g => seedGenres.includes(g))}`); }
    score += (t.play_count || 0) * 0.05;

    // User taste boost
    if (taste) {
      if (taste.followedArtists.has(t.uploader_username)) { score += 8; reasons.push("Nghệ sĩ bạn theo dõi"); }
      if (taste.likedIds.includes(t.id)) score += 5;
    }

    return { track: t, score, reasons: reasons.slice(0, 1) };
  }).sort((a, b) => b.score - a.score);

  // Diversity
  const artistCounts = {};
  const result = [];
  for (const item of scored) {
    const a = item.track.uploader_username;
    if (a && (artistCounts[a] || 0) >= 3) continue;
    if (a) artistCounts[a] = (artistCounts[a] || 0) + 1;
    result.push(item);
  }

  const tracks = await Promise.all(
    result.slice(0, limit).map(async (item) => {
      const shaped = await shapeTrack(item.track);
      if (shaped) shaped.reasons = item.reasons;
      return shaped;
    })
  );

  return tracks.filter(Boolean);
}

/* ═══════════════════════════════════════════════════════════════════════
 * SIMILAR ARTISTS — Phase 3.1
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Get personalized similar artists.
 */
export async function getSimilarArtists(username, { limit = WEIGHTS.SIMILAR_ARTISTS_LIMIT } = {}) {
  let taste = null;
  if (username) taste = await buildTasteProfile(username);

  // Get all active artists
  const { data: artists } = await supabaseAdmin
    .from("artist_profiles").select("*")
    .in("verification_status", ["independent", "verified"]);

  if (!artists || artists.length === 0) return [];

  const myFollowed = taste ? taste.followedArtists : new Set();
  const myGenres = new Set((taste?.topGenres || []).filter(g => g.score > 0).map(g => g.name));
  const myArtists = new Set((taste?.topArtists || []).filter(a => a.score > 0).map(a => a.name));

  // Score each artist by genre similarity + follow overlap
  const scored = artists.map(a => {
    let score = 0;
    const reasons = [];

    // Genre similarity (via their tracks)
    // We'll approximate by checking if they share genres with user's taste
    // For efficiency, we batch this below

    // Follow overlap: artists followed by people who follow similar artists
    // Simplified: boost if user already follows similar artists

    return { artist: a, score, reasons };
  });

  // For each candidate artist, get their top tracks' genres
  const candidateUsernames = artists.map(a => a.username);
  const { data: artistTracks } = await supabaseAdmin
    .from("tracks").select("uploader_username, genres")
    .in("uploader_username", candidateUsernames)
    .eq("status", "approved");

  const artistGenreMap = {};
  for (const t of (artistTracks || [])) {
    if (!artistGenreMap[t.uploader_username]) artistGenreMap[t.uploader_username] = new Set();
    for (const g of (Array.isArray(t.genres) ? t.genres : [])) artistGenreMap[t.uploader_username].add(g);
  }

  // Get follower counts
  const { data: followCounts } = await supabaseAdmin
    .from("artist_follows").select("artist_username").in("artist_username", candidateUsernames);
  const followMap = {};
  for (const f of (followCounts || [])) followMap[f.artist_username] = (followMap[f.artist_username] || 0) + 1;

  const finalScored = scored.map(({ artist }) => {
    let score = 0;
    const reasons = [];
    const aGenres = artistGenreMap[artist.username] || new Set();

    // Genre overlap
    const genreOverlap = [...aGenres].filter(g => myGenres.has(g)).length;
    if (genreOverlap > 0) {
      score += genreOverlap * 8;
      reasons.push(`Cùng thể loại bạn thích`);
    }

    // Don't recommend already followed
    if (myFollowed.has(artist.username)) {
      score -= 100; // exclude followed artists
    }

    // Popularity baseline
    score += (followMap[artist.username] || 0) * 0.5;

    return { artist, score, reasons: reasons.slice(0, 1) };
  }).filter(a => a.score > -50)
    .sort((a, b) => b.score - a.score);

  // Get profiles
  const topUsernames = finalScored.slice(0, limit + 5).map(a => a.artist.username);
  const { data: profiles } = await supabaseAdmin
    .from("artist_profiles").select("*").in("username", topUsernames);
  const profileMap = {};
  for (const p of (profiles || [])) profileMap[p.username] = p;

  return finalScored
    .filter(a => profileMap[a.artist.username])
    .slice(0, limit)
    .map(({ artist, reasons }) => {
      const shaped = shapeArtistProfile(profileMap[artist.username], {
        followers: followMap[artist.username] || 0,
        reasons,
      });
      return shaped;
    });
}

/* ═══════════════════════════════════════════════════════════════════════
 * USER-FACING TASTE PROFILE — Phase 3.1
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Get a user-facing taste profile summary.
 */
export async function getUserTasteProfile(username) {
  const taste = await buildTasteProfile(username);
  const level = personalizationLevel(taste);

  // Get full artist profiles for top artists
  const topArtistNames = taste.topArtists.filter(a => a.score > 0).slice(0, WEIGHTS.TOP_ARTISTS_COUNT).map(a => a.name);
  let topArtistProfiles = [];
  if (topArtistNames.length > 0) {
    const { data: rows } = await supabaseAdmin
      .from("artist_profiles").select("*").in("username", topArtistNames);
    const followCounts = {};
    for (const a of topArtistNames) {
      const { count } = await supabaseAdmin
        .from("artist_follows").select("*", { count: "exact", head: true }).eq("artist_username", a);
      followCounts[a] = count || 0;
    }
    topArtistProfiles = (rows || [])
      .sort((a, b) => {
        const aIdx = topArtistNames.indexOf(a.username);
        const bIdx = topArtistNames.indexOf(b.username);
        return aIdx - bIdx;
      })
      .map(a => shapeArtistProfile(a, { followers: followCounts[a.username] || 0 }));
  }

  // Top genres
  const topGenres = taste.topGenres.filter(g => g.score > 0).slice(0, WEIGHTS.TOP_GENRES_COUNT);

  // Recently liked tracks
  const { data: recentLikes } = await supabaseAdmin
    .from("track_likes").select("track_id").eq("username", username)
    .order("created_at", { ascending: false }).limit(5);
  const recentLikeIds = (recentLikes || []).map(r => r.track_id);
  let recentLikedTracks = [];
  if (recentLikeIds.length > 0) {
    const { data: rows } = await supabaseAdmin.from("tracks").select("*").in("id", recentLikeIds);
    recentLikedTracks = (await Promise.all((rows || []).map(t => shapeTrack(t)))).filter(Boolean);
  }

  // Listening stats
  const { count: totalPlays } = await supabaseAdmin
    .from("play_events").select("*", { count: "exact", head: true }).eq("username", username);
  const { count: totalLikes } = await supabaseAdmin
    .from("track_likes").select("*", { count: "exact", head: true }).eq("username", username);
  const { count: totalFollows } = await supabaseAdmin
    .from("artist_follows").select("*", { count: "exact", head: true }).eq("follower_username", username);

  return {
    level,
    topArtists: topArtistProfiles,
    topGenres,
    recentLikedTracks,
    stats: {
      totalPlays: totalPlays || 0,
      totalLikes: totalLikes || 0,
      followedArtists: totalFollows || 0,
    },
    signalCount: taste.likedIds.length + taste.playedIds.length + taste.followedArtists.size,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 * NOT INTERESTED — Phase 3.1
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Handle "Not Interested" feedback.
 * Records negative signal and optionally blocks artist.
 */
export async function handleNotInterested(username, trackId, { blockArtist = false } = {}) {
  // Record the not-interested event
  await recordRecommendationFeedback(username, trackId, "not_interested");

  // Optionally block the artist from future recommendations
  if (blockArtist) {
    const { data: track } = await supabaseAdmin
      .from("tracks").select("uploader_username").eq("id", trackId).single();
    if (track?.uploader_username) {
      // Record artist block as a not-interested event with metadata
      await supabaseAdmin.from("activity_events").insert({
        username,
        event_type: "REC_NOT_INTERESTED",
        target_type: "artist",
        target_id: track.uploader_username,
        metadata: { blockArtist: true },
      });
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * FEEDBACK TRACKING
 * ═══════════════════════════════════════════════════════════════════════ */

export async function recordRecommendationFeedback(username, trackId, action) {
  try {
    const eventTypes = {
      play: "REC_PLAY",
      like: "REC_LIKE",
      save: "REC_SAVE",
      skip: "REC_SKIP",
      not_interested: "REC_NOT_INTERESTED",
    };
    const eventType = eventTypes[action];
    if (!eventType) return;

    await supabaseAdmin.from("activity_events").insert({
      username,
      event_type: eventType,
      target_type: "track",
      target_id: String(trackId),
      metadata: { source: "recommendation" },
    });
  } catch (e) {
    console.error("[recommendation] feedback error:", e.message);
  }
}
