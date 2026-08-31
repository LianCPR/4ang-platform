/**
 * 4ANG Supabase Service Layer
 * Replaces SQLite queries with Supabase client calls.
 * Maintains the same API contract as the old db.js shape functions.
 */
import { supabase, supabaseAdmin } from "./supabase.js";

// Use admin client for server-side operations that need to bypass RLS
const db = supabaseAdmin;

// ============================================================
// HELPERS
// ============================================================

function now() {
  return Date.now();
}

async function runQuery(queryFn) {
  const { data, error } = await queryFn();
  if (error) throw error;
  return data;
}

// ============================================================
// PROFILES
// ============================================================

export async function getProfile(userId) {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

export async function getProfileByUsername(username) {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();
  if (error) return null;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await db
    .from("profiles")
    .update({ ...updates, updated_at: now() })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function shapeProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio || "",
    role: row.role,
    isRestricted: row.is_restricted,
    restrictedReason: row.restricted_reason,
    restrictedAt: row.restricted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// ARTISTS
// ============================================================

export async function getArtistProfile(userId) {
  const { data, error } = await db
    .from("artists")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data;
}

export async function getArtistByUsername(username) {
  const { data, error } = await db
    .from("artists")
    .select("*")
    .eq("username", username)
    .single();
  if (error) return null;
  return data;
}

export async function shapeArtistProfile(row, extra = {}) {
  if (!row) return null;
  // Get follower count
  const { count: followerCount } = await db
    .from("artist_follows")
    .select("*", { count: "exact", head: true })
    .eq("artist_id", row.id);

  // Get monthly listeners (distinct users who played tracks in last 30 days)
  const thirtyDaysAgo = now() - 30 * 24 * 60 * 60 * 1000;
  const { count: monthlyListeners } = await db
    .from("play_events")
    .select("user_id", { count: "exact", head: true, distinct: true })
    .gte("created_at", thirtyDaysAgo)
    .not("user_id", "is", null)
    .in("track_id",
      (await db.from("tracks").select("id").eq("uploader_id", row.user_id).eq("status", "approved")).data?.map(t => t.id) || []
    );

  // Get total plays
  const tracks = (await db.from("tracks").select("id, play_count").eq("uploader_id", row.user_id).eq("status", "approved")).data || [];
  const totalPlays = tracks.reduce((sum, t) => sum + (t.play_count || 0), 0);

  // Get top tracks
  const topTracks = (await db.from("tracks").select("*").eq("uploader_id", row.user_id).eq("status", "approved").order("play_count", { ascending: false }).limit(10)).data || [];

  // Get recent plays
  const trackIds = tracks.map(t => t.id);
  let recentPlays = [];
  if (trackIds.length > 0) {
    const { data: plays } = await db
      .from("play_events")
      .select("track_id, user_id, created_at")
      .in("track_id", trackIds)
      .order("created_at", { ascending: false })
      .limit(15);
    recentPlays = plays || [];
  }

  return {
    username: row.username,
    artistName: row.artist_name,
    bio: row.bio || "",
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    genres: row.genres || [],
    links: row.links || [],
    verificationStatus: row.verification_status,
    verificationNote: row.verification_note || null,
    badge: row.verification_status === "verified" ? "verified" : "independent",
    createdAt: row.created_at,
    followers: followerCount || 0,
    monthlyListeners: monthlyListeners || 0,
    totalPlays,
    topTracks: topTracks.map(t => shapeTrackSync(t)),
    recentPlays: recentPlays.map(p => ({
      trackTitle: tracks.find(t => t.id === p.track_id)?.title || "",
      username: p.user_id,
      createdAt: p.created_at,
    })),
    ...extra,
  };
}

export async function computeArtistStats(username) {
  const artist = await getArtistByUsername(username);
  if (!artist) return null;
  return shapeArtistProfile(artist);
}

// ============================================================
// TRACKS
// ============================================================

export async function getTrack(trackId) {
  const { data, error } = await db
    .from("tracks")
    .select("*")
    .eq("id", trackId)
    .single();
  if (error) return null;
  return data;
}

export async function shapeTrack(row) {
  if (!row) return null;

  // Get likes
  const { data: likes } = await db
    .from("likes")
    .select("user_id")
    .eq("track_id", row.id);
  const likedBy = likes?.map(l => l.user_id) || [];

  // Get saves
  const { data: saves } = await db
    .from("saves")
    .select("user_id")
    .eq("track_id", row.id);
  const savedBy = saves?.map(s => s.user_id) || [];

  // Get comments
  const { data: comments } = await db
    .from("comments")
    .select("id, user_id, text, created_at")
    .eq("track_id", row.id)
    .order("created_at", { ascending: true });

  // Get uploader profile
  const uploader = await getProfile(row.uploader_id);

  // Get uploader artist status
  const uploaderArtist = await db
    .from("artists")
    .select("verification_status")
    .eq("user_id", row.uploader_id)
    .single();

  // Get credits
  const credits = await shapeTrackCredits(row.id);
  const primary = credits.find(c => c.isPrimary);
  const featured = credits.filter(c => c.role === "featured");

  return {
    id: row.id,
    title: row.title,
    composer: "",
    description: row.description || "",
    releaseDate: row.release_date || "",
    lyrics: row.lyrics || "",
    timedLyrics: row.timed_lyrics || null,
    duration: row.duration || null,
    genres: row.genres || [],
    uploaderUsername: uploader?.username || "",
    uploaderDisplayName: uploader?.display_name || "",
    uploaderBadge: uploaderArtist?.data?.verification_status === "verified" ? "verified" : "independent",
    status: row.status,
    shareCount: row.share_count,
    playCount: row.play_count || 0,
    createdAt: row.created_at,
    likedBy: likedBy.map(id => id),
    savedBy: savedBy.map(id => id),
    comments: (comments || []).map(c => ({
      id: c.id,
      username: "", // Will be resolved if needed
      displayName: "",
      text: c.text,
      createdAt: c.created_at,
    })),
    audioUrl: row.audio_url || "",
    coverUrl: row.cover_url || "",
    videoUrl: row.video_url || "",
    credits,
    primaryArtistName: primary ? primary.artistName : (uploader?.display_name || ""),
    primaryArtistUsername: primary ? primary.artistUsername : (uploader?.username || null),
    featuredArtistNames: featured.map(f => f.artistName),
    isrc: row.isrc || null,
    rightsHolder: row.rights_holder || null,
    rightsYear: row.rights_year || null,
    rightsLabel: row.rights_label || null,
    rightsRecordId: row.rights_record_id || null,
    rightsDeclaredAt: row.rights_declared_at || null,
  };
}

// Synchronous version for batch operations
function shapeTrackSync(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    composer: "",
    description: row.description || "",
    releaseDate: row.release_date || "",
    lyrics: row.lyrics || "",
    timedLyrics: row.timed_lyrics || null,
    duration: row.duration || null,
    genres: row.genres || [],
    status: row.status,
    shareCount: row.share_count,
    playCount: row.play_count || 0,
    createdAt: row.created_at,
    audioUrl: row.audio_url || "",
    coverUrl: row.cover_url || "",
    videoUrl: row.video_url || "",
    credits: [],
    primaryArtistName: "",
    primaryArtistUsername: null,
    featuredArtistNames: [],
  };
}

export async function shapeTrackCredits(trackId) {
  const { data: rows } = await db
    .from("track_credits")
    .select("*")
    .eq("track_id", trackId)
    .order("is_primary", { ascending: false })
    .order("position", { ascending: true });

  if (!rows) return [];

  const results = [];
  for (const c of rows) {
    let artist = null;
    if (c.artist_id) {
      const { data } = await db
        .from("artists")
        .select("artist_name, avatar_url, verification_status")
        .eq("id", c.artist_id)
        .single();
      artist = data;
    }
    results.push({
      artistUsername: c.artist_id ? (await db.from("artists").select("username").eq("id", c.artist_id).single()).data?.username : null,
      artistName: artist ? artist.artist_name : (c.external_name || ""),
      avatarUrl: artist?.avatar_url || null,
      badge: artist?.verification_status === "verified" ? "verified" : null,
      isExternal: !c.artist_id,
      role: c.role,
      isPrimary: c.is_primary,
    });
  }
  return results;
}

// ============================================================
// LIKES
// ============================================================

export async function toggleLike(userId, trackId) {
  const { data: existing } = await db
    .from("likes")
    .select("user_id")
    .eq("user_id", userId)
    .eq("track_id", trackId)
    .single();

  if (existing) {
    await db.from("likes").delete().eq("user_id", userId).eq("track_id", trackId);
    return false;
  } else {
    await db.from("likes").insert({ user_id: userId, track_id: trackId, created_at: now() });
    return true;
  }
}

export async function isLiked(userId, trackId) {
  const { data } = await db
    .from("likes")
    .select("user_id")
    .eq("user_id", userId)
    .eq("track_id", trackId)
    .single();
  return !!data;
}

// ============================================================
// SAVES
// ============================================================

export async function toggleSave(userId, trackId) {
  const { data: existing } = await db
    .from("saves")
    .select("user_id")
    .eq("user_id", userId)
    .eq("track_id", trackId)
    .single();

  if (existing) {
    await db.from("saves").delete().eq("user_id", userId).eq("track_id", trackId);
    return false;
  } else {
    await db.from("saves").insert({ user_id: userId, track_id: trackId, created_at: now() });
    return true;
  }
}

// ============================================================
// PLAY EVENTS
// ============================================================

export async function recordPlay(userId, trackId) {
  // Check if user already played this track recently (within 5 minutes)
  const fiveMinAgo = now() - 5 * 60 * 1000;
  const { data: recent } = await db
    .from("play_events")
    .select("id")
    .eq("user_id", userId)
    .eq("track_id", trackId)
    .gte("created_at", fiveMinAgo)
    .limit(1)
    .single();

  if (!recent) {
    await db.from("play_events").insert({
      track_id: trackId,
      user_id: userId,
      created_at: now(),
    });
    // Increment play count
    await db.rpc("increment_play_count", { track_id_input: trackId });
  }
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export async function createNotification(userId, type, title, body, { actorId = null, targetType = null, targetId = null } = {}) {
  await db.from("notifications").insert({
    user_id: userId,
    type,
    actor_id: actorId,
    target_type: targetType,
    target_id: targetId,
    title,
    body: body || "",
    read: false,
    created_at: now(),
  });
}

// ============================================================
// ACTIVITY
// ============================================================

export async function recordActivity(userId, eventType, targetType, targetId, metadata) {
  await db.from("activity_events").insert({
    user_id: userId,
    event_type: eventType,
    target_type: targetType || null,
    target_id: targetId || null,
    metadata: metadata || null,
    created_at: now(),
  });
}

// ============================================================
// ADMIN AUDIT
// ============================================================

export async function recordAdminAudit(userId, action, targetType, targetId, metadata) {
  await db.from("admin_audit_log").insert({
    actor_id: userId,
    action,
    target_type: targetType,
    target_id: targetId || null,
    metadata: metadata || null,
    created_at: now(),
  });
}

// ============================================================
// PLAYLISTS
// ============================================================

export async function shapePlaylist(row) {
  if (!row) return null;
  const { data: owner } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", row.owner_id)
    .single();

  return {
    id: row.id,
    ownerUsername: (await db.from("profiles").select("username").eq("id", row.owner_id).single()).data?.username || "",
    ownerDisplayName: owner?.display_name || "",
    title: row.title,
    description: row.description || "",
    coverUrl: row.cover_url || null,
    isPublic: row.is_public,
    trackCount: row.track_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// SEARCH
// ============================================================

export async function searchTracks(query, limit = 20) {
  const { data, error } = await db
    .from("tracks")
    .select("*")
    .eq("status", "approved")
    .ilike("title", `%${query}%`)
    .order("play_count", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

export async function searchArtists(query, limit = 20) {
  const { data, error } = await db
    .from("artists")
    .select("*")
    .ilike("artist_name", `%${query}%`)
    .limit(limit);
  if (error) return [];
  return data || [];
}
