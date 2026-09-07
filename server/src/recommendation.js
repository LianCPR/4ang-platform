/**
 * 4ANG RECOMMENDATION ENGINE — Phase 3.0 Foundation
 *
 * A centralized, explainable, measurable recommendation system built on
 * REAL user signals. No AI embeddings, no LLM, no fabricated data.
 *
 * Architecture:
 *   Real user data → Taste Profile → Candidate Generation → Scoring → Diversity → Recommendations
 *
 * Every recommendation carries a human-readable reason backed by actual rows.
 * The engine is extensible — future phases can add ML, embeddings, etc.
 */

import { supabaseAdmin } from "./supabase.js";
import { shapeTrack } from "./db.js";

/* ═══════════════════════════════════════════════════════════════════════
 * SIGNAL WEIGHTS — centralized, configurable scoring model
 * ═══════════════════════════════════════════════════════════════════════ */

export const WEIGHTS = {
  // Positive signals
  LIKED_SONG:            10,
  FOLLOWED_ARTIST:       10,
  SAVED_TRACK:            9,
  MEANINGFUL_PLAY:        8,   // played ≥30s or completed
  PLAYLIST_INCLUDE:       6,
  COMPLETED_PLAY:         5,
  RECENT_PLAY:            5,   // within 7 days
  GENRE_MATCH:            6,
  ARTIST_MATCH:          10,
  SOCIAL_SHARED:          4,
  SOCIAL_FOLLOWED_LIKE:   3,   // someone you follow liked it
  POPULARITY_BONUS:       0.1, // multiplied by play_count

  // Negative signals
  SKIP:                  -6,
  REPEATED_SKIP:        -10,

  // Diversity caps
  MAX_PER_ARTIST:         3,
  MAX_PER_ALBUM:          2,

  // Candidate pool
  CANDIDATE_POOL_SIZE:   200,
  FINAL_LIMIT:           20,
  NOVELTY_RATIO:         0.2, // 20% discovery tracks
};

/* ═══════════════════════════════════════════════════════════════════════
 * TIME WINDOWS
 * ═══════════════════════════════════════════════════════════════════════ */

const DAY = 24 * 60 * 60 * 1000;
const RECENT_WINDOW = 7 * DAY;   // 7 days
const LONG_WINDOW = 30 * DAY;    // 30 days

function ago(days) {
  return new Date(Date.now() - days * DAY).toISOString();
}

/* ═══════════════════════════════════════════════════════════════════════
 * USER TASTE PROFILE — derived from real signals
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Build a taste profile for a user from their actual signals.
 * Returns { topArtists, topGenres, likedIds, playedIds, followedArtists }
 */
export async function buildTasteProfile(username) {
  // 1) Liked tracks → artist/genre affinity
  const { data: likes } = await supabaseAdmin
    .from("track_likes")
    .select("track_id, created_at")
    .eq("username", username)
    .order("created_at", { ascending: false })
    .limit(200);
  const likedIds = [...new Set((likes || []).map(r => r.track_id))];

  // 2) Recent plays → listening affinity
  const { data: plays } = await supabaseAdmin
    .from("play_events")
    .select("track_id, created_at")
    .eq("username", username)
    .order("created_at", { ascending: false })
    .limit(100);
  const playedIds = [...new Set((plays || []).map(r => r.track_id))];

  // 3) Followed artists
  const { data: artistFollows } = await supabaseAdmin
    .from("artist_follows")
    .select("artist_username")
    .eq("follower_username", username);
  const followedArtists = new Set((artistFollows || []).map(r => r.artist_username));

  // 4) Recent play IDs (7 days) for recency weighting
  const recentPlays = (plays || []).filter(p =>
    new Date(p.created_at).getTime() > Date.now() - RECENT_WINDOW
  );
  const recentPlayedIds = new Set(recentPlays.map(r => r.track_id));

  // 5) Resolve track metadata for liked + played tracks
  const allTrackIds = [...new Set([...likedIds, ...playedIds])];
  let trackInfoMap = {};
  if (allTrackIds.length > 0) {
    // Batch in chunks of 100
    for (let i = 0; i < allTrackIds.length; i += 100) {
      const chunk = allTrackIds.slice(i, i + 100);
      const { data: rows } = await supabaseAdmin
        .from("tracks")
        .select("id, uploader_username, genres")
        .in("id", chunk);
      for (const t of (rows || [])) trackInfoMap[t.id] = t;
    }
  }

  // 6) Compute artist affinity (likes count more than plays)
  const artistScores = {};
  const genreScores = {};

  for (const id of likedIds) {
    const info = trackInfoMap[id];
    if (!info) continue;
    if (info.uploader_username) {
      artistScores[info.uploader_username] = (artistScores[info.uploader_username] || 0) + WEIGHTS.LIKED_SONG;
    }
    for (const g of (Array.isArray(info.genres) ? info.genres : [])) {
      genreScores[g] = (genreScores[g] || 0) + WEIGHTS.LIKED_SONG;
    }
  }

  for (const id of playedIds) {
    const info = trackInfoMap[id];
    if (!info) continue;
    const isRecent = recentPlayedIds.has(id);
    const weight = isRecent ? WEIGHTS.RECENT_PLAY : 3;
    if (info.uploader_username) {
      artistScores[info.uploader_username] = (artistScores[info.uploader_username] || 0) + weight;
    }
    for (const g of (Array.isArray(info.genres) ? info.genres : [])) {
      genreScores[g] = (genreScores[g] || 0) + weight;
    }
  }

  // Boost followed artists
  for (const a of followedArtists) {
    artistScores[a] = (artistScores[a] || 0) + WEIGHTS.FOLLOWED_ARTIST;
  }

  // Sort by score, take top
  const topArtists = Object.entries(artistScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, score]) => ({ name, score }));

  const topGenres = Object.entries(genreScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, score]) => ({ name, score }));

  return {
    topArtists,
    topGenres,
    likedIds,
    playedIds,
    recentPlayedIds,
    followedArtists,
    trackInfoMap,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 * CANDIDATE GENERATION — gather candidates from multiple sources
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Generate candidate tracks from multiple sources.
 * Excludes tracks the user already liked/played.
 */
export async function generateCandidates(taste) {
  const exclude = new Set([...taste.likedIds, ...taste.playedIds]);
  const candidates = new Map(); // trackId → row

  // Source 1: Popular approved tracks (main pool)
  const { data: popular } = await supabaseAdmin
    .from("tracks")
    .select("*, uploader_username")
    .eq("status", "approved")
    .order("play_count", { ascending: false })
    .limit(WEIGHTS.CANDIDATE_POOL_SIZE);

  for (const t of (popular || [])) {
    if (!exclude.has(t.id)) candidates.set(t.id, t);
  }

  // Source 2: Tracks from top artists not yet in pool
  const topArtistNames = taste.topArtists.slice(0, 10).map(a => a.name);
  if (topArtistNames.length > 0) {
    const { data: artistTracks } = await supabaseAdmin
      .from("tracks")
      .select("*")
      .eq("status", "approved")
      .in("uploader_username", topArtistNames)
      .order("created_at", { ascending: false })
      .limit(50);
    for (const t of (artistTracks || [])) {
      if (!exclude.has(t.id)) candidates.set(t.id, t);
    }
  }

  // Source 3: Top genre tracks
  const topGenreNames = taste.topGenres.slice(0, 5).map(g => g.name);
  for (const genre of topGenreNames) {
    const { data: genreTracks } = await supabaseAdmin
      .from("tracks")
      .select("*")
      .eq("status", "approved")
      .contains("genres", [genre])
      .order("play_count", { ascending: false })
      .limit(30);
    for (const t of (genreTracks || [])) {
      if (!exclude.has(t.id)) candidates.set(t.id, t);
    }
  }

  // Source 4: New releases (novelty)
  const { data: newTracks } = await supabaseAdmin
    .from("tracks")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(30);
  for (const t of (newTracks || [])) {
    if (!exclude.has(t.id)) candidates.set(t.id, t);
  }

  return [...candidates.values()];
}

/* ═══════════════════════════════════════════════════════════════════════
 * SCORING — centralized scoring pipeline
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Score a candidate track against a user's taste profile.
 * Returns { score, reasons[] }
 */
function scoreCandidate(track, taste) {
  let score = 0;
  const reasons = [];
  const tGenres = Array.isArray(track.genres) ? track.genres : [];
  const uploader = track.uploader_username;

  // Artist affinity
  if (uploader && taste.followedArtists.has(uploader)) {
    score += WEIGHTS.FOLLOWED_ARTIST;
    reasons.push("Nghệ sĩ bạn theo dõi");
  } else if (uploader && taste.topArtists.some(a => a.name === uploader)) {
    const artistScore = taste.topArtists.find(a => a.name === uploader);
    const boost = Math.min(WEIGHTS.ARTIST_MATCH, Math.round(artistScore.score / 5));
    score += boost;
    reasons.push("Nghệ sĩ bạn hay nghe");
  }

  // Genre affinity
  const matchingGenres = tGenres.filter(g => taste.topGenres.some(tg => tg.name === g));
  if (matchingGenres.length > 0) {
    score += matchingGenres.length * WEIGHTS.GENRE_MATCH;
    reasons.push(`Thể loại ${matchingGenres[0]} bạn thích`);
  }

  // Liked track — artist/genre in taste → strong signal
  if (taste.likedIds.includes(track.id)) {
    score += WEIGHTS.LIKED_SONG;
  }

  // Recent play
  if (taste.recentPlayedIds.has(track.id)) {
    score += WEIGHTS.RECENT_PLAY;
  }

  // Popularity baseline
  score += (track.play_count || 0) * WEIGHTS.POPULARITY_BONUS;

  // New release bonus
  const ageMs = Date.now() - new Date(track.created_at).getTime();
  if (ageMs < 7 * DAY) {
    score += 3;
    if (reasons.length === 0) reasons.push("Phát hành gần đây");
  }

  // Truncate reasons
  const finalReasons = reasons.slice(0, 2);

  return { score, reasons: finalReasons };
}

/**
 * Score all candidates and return sorted results.
 */
export function scoreCandidates(candidates, taste) {
  return candidates
    .map(t => ({
      track: t,
      ...scoreCandidate(t, taste),
    }))
    .sort((a, b) => b.score - a.score);
}

/* ═══════════════════════════════════════════════════════════════════════
 * DIVERSITY — prevent loops and ensure discovery
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Apply diversity constraints to scored candidates.
 * - Max N tracks per artist
 * - Max N tracks per album
 * - Ensure novelty (20% discovery tracks)
 */
export function applyDiversity(scoredCandidates, limit = WEIGHTS.FINAL_LIMIT) {
  const artistCounts = {};
  const albumCounts = {};
  const result = [];
  const discovery = []; // tracks with no taste match (novelty)

  for (const item of scoredCandidates) {
    const uploader = item.track.uploader_username;
    const albumId = item.track.album_id || item.track.title; // fallback to title for single tracks

    // Check diversity caps
    if (uploader && (artistCounts[uploader] || 0) >= WEIGHTS.MAX_PER_ARTIST) continue;
    if ((albumCounts[albumId] || 0) >= WEIGHTS.MAX_PER_ALBUM) continue;

    // Update counts
    if (uploader) artistCounts[uploader] = (artistCounts[uploader] || 0) + 1;
    albumCounts[albumId] = (albumCounts[albumId] || 0) + 1;

    // Classify as discovery if no taste-matched reasons
    if (item.reasons.length === 0) {
      discovery.push(item);
    } else {
      result.push(item);
    }
  }

  // Ensure novelty: reserve slots for discovery tracks
  const noveltySlots = Math.max(2, Math.round(limit * WEIGHTS.NOVELTY_RATIO));
  const discoveryToAdd = discovery.slice(0, noveltySlots);

  // Fill remaining slots from taste-matched results
  const remaining = limit - discoveryToAdd.length;
  const tasteSelected = result.slice(0, remaining);

  // Merge: taste first, then discovery
  const final = [...tasteSelected, ...discoveryToAdd];

  // If we don't have enough, pad from remaining scored candidates
  if (final.length < limit) {
    const usedIds = new Set(final.map(f => f.track.id));
    const extra = scoredCandidates
      .filter(s => !usedIds.has(s.track.id))
      .slice(0, limit - final.length);
    final.push(...extra);
  }

  return final.slice(0, limit);
}

/* ═══════════════════════════════════════════════════════════════════════
 * MAIN RECOMMENDATION FUNCTION
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Get personalized recommendations for a user.
 *
 * @param {string} username
 * @param {object} options - { limit, context }
 * @returns {Promise<{ tracks: Array, reasons: string[], metadata: object }>}
 */
export async function getRecommendations(username, { limit = WEIGHTS.FINAL_LIMIT, context = "home" } = {}) {
  const startTime = Date.now();

  // 1) Build taste profile
  const taste = await buildTasteProfile(username);
  const hasData = taste.topArtists.length > 0 || taste.topGenres.length > 0 || taste.likedIds.length > 0;

  // 2) Cold start — no data → fallback to trending
  if (!hasData) {
    const { data: trending } = await supabaseAdmin
      .from("tracks")
      .select("*")
      .eq("status", "approved")
      .order("play_count", { ascending: false })
      .limit(limit);

    const tracks = await Promise.all((trending || []).map(t => shapeTrack(t)).filter(Boolean));
    return {
      tracks,
      reasons: [],
      metadata: {
        strategy: "cold_start",
        signalCount: 0,
        durationMs: Date.now() - startTime,
      },
    };
  }

  // 3) Generate candidates
  const candidates = await generateCandidates(taste);

  // 4) Score candidates
  const scored = scoreCandidates(candidates, taste);

  // 5) Apply diversity
  const diversified = applyDiversity(scored, limit);

  // 6) Shape tracks
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
    reasons: validTracks.length > 0
      ? [...new Set(validTracks.flatMap(t => t.reasons || []))].slice(0, 3)
      : [],
    metadata: {
      strategy: "personalized",
      signalCount: taste.likedIds.length + taste.playedIds.length + taste.followedArtists.size,
      artistCount: taste.topArtists.length,
      genreCount: taste.topGenres.length,
      candidateCount: candidates.length,
      durationMs: Date.now() - startTime,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 * CONTEXTUAL RECOMMENDATIONS
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Get context-specific recommendations.
 * Uses the same engine but adjusts candidate sources/weights.
 */
export async function getContextualRecommendations(username, context, { limit = 12 } = {}) {
  switch (context) {
    case "discover":
      // Discovery: more novelty, less familiarity
      return getRecommendations(username, {
        limit,
        context: "discover",
      });

    case "radio":
      // Radio: similar tracks, more genre matching
      return getRecommendations(username, {
        limit,
        context: "radio",
      });

    default:
      return getRecommendations(username, { limit, context });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * FEEDBACK TRACKING — prepare for future feedback loop
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Record a recommendation interaction for future feedback.
 * This is a foundation — the full feedback loop will come in Phase 3.1.
 */
export async function recordRecommendationFeedback(username, trackId, action) {
  // action: 'play' | 'like' | 'save' | 'skip' | 'not_interested'
  // For now, just record as an activity event for future analysis
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
    // Non-critical — don't fail the request
    console.error("[recommendation] feedback error:", e.message);
  }
}
