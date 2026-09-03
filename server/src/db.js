/**
 * 4ANG Database Layer — Supabase PostgreSQL
 *
 * Replaces the legacy SQLite layer. Exports the same shape functions
 * and utilities used by route files, now backed by Supabase.
 *
 * IMPORTANT: The Supabase tables now include `username` columns alongside
 * UUID `user_id`/`id` columns (added in migration 011) so shape functions
 * can use the same field names.
 */
import { supabaseAdmin } from "./supabase.js";

function randomId() {
  return (globalThis.crypto && globalThis.crypto.randomUUID)
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ═══════════════════════════════════════════════════════════════
// URL Resolution — Supabase Storage URLs
// ═══════════════════════════════════════════════════════════════

function publicUrl(bucket, path) {
  if (!path) return null;
  if (path.startsWith("http")) return path; // already a full URL
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

async function signedUrl(bucket, path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 365 * 24 * 60 * 60);
  if (error) return null;
  return data?.signedUrl || null;
}

function resolveUrl(bucket, filePath) {
  if (!filePath) return null;
  if (filePath.startsWith("http")) return filePath;
  // Public buckets: artwork, avatars
  if (bucket === "artwork" || bucket === "avatars") {
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
    return data?.publicUrl || `/api/${bucket}/${filePath}`;
  }
  // Private buckets: audio, videos — use API proxy
  return `/api/${bucket}/${filePath}`;
}

// ═══════════════════════════════════════════════════════════════
// Settings
// ═══════════════════════════════════════════════════════════════

export async function getSetting(key, fallback = null) {
  const { data, error } = await supabaseAdmin
    .from("platform_settings").select("value").eq("key", key).single();
  if (error || !data) return fallback;
  try { return typeof data.value === "string" ? JSON.parse(data.value) : data.value; } catch { return fallback; }
}

export async function setSetting(key, value, actorUsername) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("platform_settings")
    .upsert({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
      updated_at: now,
      updated_by_username: actorUsername || null,
    }, { onConflict: "key" });
  if (error) console.error("[db] setSetting:", error.message);
}

// ═══════════════════════════════════════════════════════════════
// Account Restrictions
// ═══════════════════════════════════════════════════════════════

export async function isAccountRestricted(username) {
  const { data } = await supabaseAdmin
    .from("profiles").select("is_restricted").eq("username", username).single();
  return !!(data && data.is_restricted);
}

// ═══════════════════════════════════════════════════════════════
// Badge Status
// ═══════════════════════════════════════════════════════════════

export function badgeStatusFor(verificationStatus) {
  if (!verificationStatus) return null;
  return verificationStatus === "verified" ? "verified" : "independent";
}

// ═══════════════════════════════════════════════════════════════
// Shape Functions — format DB rows for API responses
// ═══════════════════════════════════════════════════════════════

export function shapePublicUserSummary(row) {
  return {
    username: row.username,
    displayName: row.display_name,
    email: row.email || null,
    isAdmin: row.role === "admin",
    isArtist: row.role === "artist",
    artistBadge: null, // caller should resolve separately
    isRestricted: !!row.is_restricted,
    restrictedReason: row.restricted_reason || null,
    restrictedAt: row.restricted_at || null,
    createdAt: typeof row.created_at === "number" ? row.created_at : new Date(row.created_at).getTime(),
  };
}

export function shapeAuditEntry(row) {
  return {
    id: row.id,
    actorUsername: row.actor_username || row.actor_username,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: typeof row.metadata === "string" ? (() => { try { return JSON.parse(row.metadata); } catch { return null; } })() : row.metadata,
    createdAt: typeof row.created_at === "number" ? row.created_at : new Date(row.created_at).getTime(),
  };
}

export function shapeReport(row) {
  return {
    id: row.id,
    reporterUsername: row.reporter_username,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    note: row.note || null,
    status: row.status,
    createdAt: typeof row.created_at === "number" ? row.created_at : new Date(row.created_at).getTime(),
    resolvedAt: row.resolved_at || null,
    resolvedBy: row.resolved_by_username || null,
    resolutionNote: row.resolution_note || null,
  };
}

export function shapeArtistProfile(row, extra = {}) {
  if (!row) return null;
  return {
    username: row.username,
    artistName: row.artist_name,
    bio: row.bio || "",
    avatarUrl: row.avatar_url || (row.avatar_filename ? resolveUrl("avatars", row.avatar_filename) : null),
    coverUrl: row.cover_url || (row.cover_filename ? resolveUrl("artwork", row.cover_filename) : null),
    genres: typeof row.genres === "string" ? JSON.parse(row.genres || "[]") : (row.genres || []),
    links: typeof row.links === "string" ? JSON.parse(row.links || "[]") : (row.links || []),
    verificationStatus: row.verification_status,
    verificationNote: row.verification_note || null,
    badge: badgeStatusFor(row.verification_status),
    createdAt: typeof row.created_at === "number" ? row.created_at : new Date(row.created_at).getTime(),
    ...extra,
  };
}

export function shapeTrackCredits(trackId) {
  // Must be called asynchronously; returns a promise
  return _shapeTrackCreditsAsync(trackId);
}

async function _shapeTrackCreditsAsync(trackId) {
  const { data: rows } = await supabaseAdmin
    .from("track_credits").select("*").eq("track_id", trackId).order("is_primary", { ascending: false }).order("position");
  if (!rows || rows.length === 0) return [];
  return Promise.all(rows.map(async (c) => {
    let artist = null;
    if (c.artist_username || c.user_id) {
      const filter = c.user_id ? { user_id: c.user_id } : { username: c.artist_username };
      const { data } = await supabaseAdmin.from("artist_profiles").select("artist_name, avatar_url, verification_status").eq(
        Object.keys(filter)[0], Object.values(filter)[0]
      ).maybeSingle();
      artist = data;
    }
    return {
      artistUsername: c.artist_username || null,
      artistName: artist ? artist.artist_name : (c.external_name || ""),
      avatarUrl: artist?.avatar_url || null,
      badge: artist ? badgeStatusFor(artist.verification_status) : null,
      isExternal: !c.artist_username && !c.user_id,
      role: c.role,
      isPrimary: !!c.is_primary,
    };
  }));
}

export async function shapeTrack(row) {
  if (!row) return null;
  // Get likes, savedBy, comments, uploader badge, credits in parallel
  const [likesResult, savesResult, commentsResult, uploaderArtist, credits] = await Promise.all([
    supabaseAdmin.from("track_likes").select("username").eq("track_id", row.id),
    supabaseAdmin.from("track_saves").select("username").eq("track_id", row.id),
    supabaseAdmin.from("track_comments").select("*").eq("track_id", row.id).order("created_at"),
    row.uploader_username
      ? supabaseAdmin.from("artist_profiles").select("verification_status").eq("username", row.uploader_username).maybeSingle()
      : Promise.resolve({ data: null }),
    _shapeTrackCreditsAsync(row.id),
  ]);

  const likedBy = (likesResult.data || []).map(r => r.username);
  const savedBy = (savesResult.data || []).map(r => r.username);
  const comments = (commentsResult.data || []).map(c => ({
    id: c.id, username: c.username, displayName: c.display_name || "", text: c.text, createdAt: typeof c.created_at === "string" ? new Date(c.created_at).getTime() : c.created_at,
  }));
  const primary = credits.find(c => c.isPrimary);
  const featured = credits.filter(c => c.role === "featured");

  return {
    id: row.id,
    title: row.title,
    composer: row.composer || "",
    description: row.description || "",
    releaseDate: row.release_date || "",
    lyrics: row.lyrics || "",
    timedLyrics: row.timed_lyrics || null,
    duration: row.audio_duration || row.duration || null,
    genres: typeof row.genres === "string" ? JSON.parse(row.genres || "[]") : (row.genres || []),
    uploaderUsername: row.uploader_username,
    uploaderDisplayName: row.uploader_display_name || row.uploader_username || "",
    uploaderBadge: badgeStatusFor(uploaderArtist?.data?.verification_status),
    status: row.status,
    shareCount: row.share_count || 0,
    playCount: row.play_count || 0,
    createdAt: typeof row.created_at === "number" ? row.created_at : new Date(row.created_at).getTime(),
    likedBy,
    savedBy,
    comments,
    audioUrl: `/api/tracks/${row.id}/audio`,
    coverUrl: row.cover_url || (row.cover_filename ? resolveUrl("artwork", row.cover_filename) : null),
    videoUrl: row.video_path || row.video_filename ? `/api/tracks/${row.id}/video` : null,
    credits,
    primaryArtistName: primary ? primary.artistName : "",
    primaryArtistUsername: primary ? primary.artistUsername : null,
    featuredArtistNames: featured.map(f => f.artistName),
    isrc: row.isrc || null,
    rightsHolder: row.rights_holder || null,
    rightsYear: row.rights_year || null,
    rightsLabel: row.rights_label || null,
    rightsRecordId: row.rights_record_id || null,
    rightsDeclaredAt: row.rights_declared_at || null,
  };
}

// ═══════════════════════════════════════════════════════════════
// Submissions
// ═══════════════════════════════════════════════════════════════

export async function shapeSubmissionCredits(submissionId) {
  const { data: rows } = await supabaseAdmin
    .from("submission_credits").select("*").eq("submission_id", submissionId).order("is_primary", { ascending: false }).order("position");
  if (!rows || rows.length === 0) return [];
  return Promise.all(rows.map(async (c) => {
    let artist = null;
    if (c.artist_username || c.user_id) {
      const filter = c.user_id ? { user_id: c.user_id } : { username: c.artist_username };
      const { data } = await supabaseAdmin.from("artist_profiles").select("artist_name, avatar_url, verification_status").eq(
        Object.keys(filter)[0], Object.values(filter)[0]
      ).maybeSingle();
      artist = data;
    }
    return {
      id: c.id,
      artistUsername: c.artist_username || null,
      artistName: artist ? artist.artist_name : (c.external_name || ""),
      avatarUrl: artist?.avatar_url || null,
      badge: artist ? badgeStatusFor(artist.verification_status) : null,
      isExternal: !c.artist_username && !c.user_id,
      role: c.role,
      isPrimary: !!c.is_primary,
    };
  }));
}

export async function shapeSubmissionEvents(submissionId) {
  const { data: rows } = await supabaseAdmin
    .from("submission_events").select("*").eq("submission_id", submissionId).order("created_at");
  if (!rows) return [];
  return rows.map(e => ({
    id: e.id,
    actorUsername: e.actor_username,
    action: e.action,
    note: e.note || null,
    createdAt: typeof e.created_at === "string" ? new Date(e.created_at).getTime() : e.created_at,
  }));
}

export async function shapeSubmission(row, { includeEvents = false } = {}) {
  if (!row) return null;
  let submitterArtist = null;
  if (row.artist_username) {
    const { data } = await supabaseAdmin
      .from("artist_profiles").select("artist_name, avatar_url, verification_status").eq("username", row.artist_username).maybeSingle();
    submitterArtist = data;
  }
  const out = {
    id: row.id,
    artistUsername: row.artist_username,
    artistName: submitterArtist ? submitterArtist.artist_name : row.artist_username,
    artistBadge: submitterArtist ? badgeStatusFor(submitterArtist.verification_status) : null,
    title: row.title,
    releaseType: row.release_type,
    audioOriginalName: row.audio_original_name || null,
    hasAudio: !!(row.audio_path || row.audio_filename),
    coverUrl: row.cover_url || (row.cover_filename ? resolveUrl("artwork", row.cover_filename) : null),
    hasVideo: !!(row.video_path || row.video_filename),
    lyrics: row.lyrics || "",
    genres: typeof row.genres === "string" ? JSON.parse(row.genres || "[]") : (row.genres || []),
    language: row.language || "",
    isExplicit: !!row.is_explicit,
    releaseDate: row.release_date || "",
    rightsConfirmed: !!row.rights_confirmed,
    termsAccepted: !!row.terms_accepted,
    termsVersion: row.terms_version || null,
    termsAcceptedAt: row.terms_accepted_at || null,
    status: row.status,
    adminNote: row.admin_note || null,
    publishedTrackId: row.published_track_id || null,
    createdAt: typeof row.created_at === "number" ? row.created_at : new Date(row.created_at).getTime(),
    updatedAt: typeof row.updated_at === "number" ? row.updated_at : new Date(row.updated_at).getTime(),
    submittedAt: row.submitted_at ? (typeof row.submitted_at === "number" ? row.submitted_at : new Date(row.submitted_at).getTime()) : null,
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
    credits: await shapeSubmissionCredits(row.id),
  };
  if (includeEvents) out.events = await shapeSubmissionEvents(row.id);
  return out;
}

// ═══════════════════════════════════════════════════════════════
// Playlists
// ═══════════════════════════════════════════════════════════════

export async function shapePlaylist(row) {
  if (!row) return null;
  let ownerDisplayName = row.owner_username;
  if (row.owner_username) {
    const { data } = await supabaseAdmin.from("profiles").select("display_name").eq("username", row.owner_username).maybeSingle();
    if (data) ownerDisplayName = data.display_name;
  }
  return {
    id: row.id,
    ownerUsername: row.owner_username,
    ownerDisplayName,
    title: row.title,
    description: row.description || "",
    coverUrl: row.cover_url || (row.cover_filename ? resolveUrl("artwork", row.cover_filename) : null),
    isPublic: row.is_public ?? row.is_public ?? true,
    trackCount: row.track_count || 0,
    createdAt: typeof row.created_at === "number" ? row.created_at : new Date(row.created_at).getTime(),
    updatedAt: typeof row.updated_at === "number" ? row.updated_at : new Date(row.updated_at).getTime(),
  };
}

export async function shapePlaylistDetail(row, { includeTracks = false } = {}) {
  if (!row) return null;
  const base = await shapePlaylist(row);
  if (!includeTracks) return base;

  const { data: trackRows } = await supabaseAdmin
    .from("playlist_tracks").select("*, tracks(*)").eq("playlist_id", row.id).order("position");
  if (!trackRows) return { ...base, tracks: [] };

  const tracks = [];
  for (const pt of trackRows) {
    if (pt.tracks && pt.tracks.status === "approved") {
      const shaped = await shapeTrack(pt.tracks);
      if (shaped) {
        shaped.addedAt = typeof pt.added_at === "string" ? new Date(pt.added_at).getTime() : pt.added_at;
        tracks.push(shaped);
      }
    }
  }
  return { ...base, tracks };
}

// ═══════════════════════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════════════════════

export function shapeNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    actorUsername: row.actor_username || null,
    targetType: row.target_type || null,
    targetId: row.target_id || null,
    title: row.title,
    body: row.body || "",
    read: !!row.is_read,
    createdAt: typeof row.created_at === "string" ? new Date(row.created_at).getTime() : (typeof row.created_at === "number" ? row.created_at : 0),
  };
}

export async function createNotification(username, type, title, body, { actorUsername = null, targetType = null, targetId = null } = {}) {
  const { error } = await supabaseAdmin.from("notifications").insert({
    id: randomId(),
    username,
    type,
    actor_username: actorUsername,
    target_type: targetType,
    target_id: targetId,
    title,
    body: body || "",
    is_read: false,
    created_at: new Date().toISOString(),
  });
  if (error) console.error("[db] createNotification:", error.message);
}

// ═══════════════════════════════════════════════════════════════
// Activity Events
// ═══════════════════════════════════════════════════════════════

export async function recordActivity(username, eventType, targetType, targetId, metadata) {
  const { error } = await supabaseAdmin.from("activity_events").insert({
    id: randomId(),
    username: username || null,
    event_type: eventType,
    target_type: targetType || null,
    target_id: targetId || null,
    metadata: metadata || null,
    created_at: new Date().toISOString(),
  });
  if (error) console.error("[db] recordActivity:", error.message);
}

// ═══════════════════════════════════════════════════════════════
// Admin Audit Log
// ═══════════════════════════════════════════════════════════════

export async function recordAdminAudit(actorUsername, action, targetType, targetId, metadata) {
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    id: randomId(),
    actor_username: actorUsername,
    action,
    target_type: targetType,
    target_id: targetId || null,
    metadata: metadata ? (typeof metadata === "string" ? metadata : JSON.stringify(metadata)) : null,
    created_at: new Date().toISOString(),
  });
  if (error) console.error("[db] recordAdminAudit:", error.message);
}

// ═══════════════════════════════════════════════════════════════
// Artist Applications
// ═══════════════════════════════════════════════════════════════

export function shapeArtistApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    artistName: row.artist_name,
    fullName: row.full_name || null,
    email: row.email,
    phone: row.phone || null,
    bio: row.bio || "",
    mainGenre: row.main_genre || "",
    country: row.country || "",
    socialLinks: typeof row.social_links === "string" ? JSON.parse(row.social_links || "[]") : (row.social_links || []),
    status: row.status,
    reviewNote: row.review_note || null,
    submittedAt: typeof row.submitted_at === "string" ? new Date(row.submitted_at).getTime() : (row.submitted_at || null),
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
    createdAt: typeof row.created_at === "string" ? new Date(row.created_at).getTime() : row.created_at,
  };
}

export function shapeVerifiedArtistApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    artistName: row.artist_name,
    email: row.email,
    phone: row.phone || null,
    bio: row.bio || "",
    mainGenre: row.main_genre || "",
    socialLinks: typeof row.social_links === "string" ? JSON.parse(row.social_links || "[]") : (row.social_links || []),
    officialLinks: typeof row.official_links === "string" ? JSON.parse(row.official_links || "[]") : (row.official_links || []),
    additionalInfo: row.additional_info || "",
    status: row.status,
    reviewNote: row.review_note || null,
    submittedAt: typeof row.submitted_at === "string" ? new Date(row.submitted_at).getTime() : (row.submitted_at || null),
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
    createdAt: typeof row.created_at === "string" ? new Date(row.created_at).getTime() : row.created_at,
  };
}

// ═══════════════════════════════════════════════════════════════
// Releases
// ═══════════════════════════════════════════════════════════════

export async function shapeRelease(row, { includeTracks = false } = {}) {
  if (!row) return null;
  const out = {
    id: row.id,
    title: row.title,
    slug: row.slug || null,
    type: row.type,
    coverUrl: row.cover_url || (row.cover_filename ? resolveUrl("artwork", row.cover_filename) : null),
    description: row.description || "",
    artistMessage: row.artist_message || "",
    releaseDate: row.release_date || null,
    label: row.label || null,
    copyrightText: row.copyright_text || null,
    status: row.status,
    rejectionReason: row.rejection_reason || null,
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by_username || null,
    createdBy: row.created_by_username || row.created_by,
    createdAt: typeof row.created_at === "number" ? row.created_at : new Date(row.created_at).getTime(),
    updatedAt: typeof row.updated_at === "number" ? row.updated_at : new Date(row.updated_at).getTime(),
  };
  if (includeTracks) {
    const { data: trackRows } = await supabaseAdmin
      .from("release_tracks").select("*, tracks(*)").eq("release_id", row.id).order("disc_number").order("track_number");
    if (trackRows) {
      const tracks = [];
      for (const rt of trackRows) {
        if (rt.tracks && rt.tracks.status === "approved") {
          const shaped = await shapeTrack(rt.tracks);
          if (shaped) {
            shaped.trackNumber = rt.track_number;
            shaped.discNumber = rt.disc_number;
            tracks.push(shaped);
          }
        }
      }
      out.tracks = tracks;
      out.trackCount = tracks.length;
      out.totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════

export function generateRightsRecordId() {
  const year = new Date().getFullYear();
  const rand = randomId().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `4ANG-RGT-${year}-${rand}`;
}

// ═══════════════════════════════════════════════════════════════
// Re-export Supabase helpers for route files
// ═══════════════════════════════════════════════════════════════
export { supabaseAdmin } from "./supabase.js";
export {
  pgSelect, pgSelectOne, pgInsert, pgInsertMany, pgUpdate, pgUpsert,
  pgDelete, pgCount, pgExists, pgInsertReturning, pgUpsertReturning,
} from "./pg.js";
