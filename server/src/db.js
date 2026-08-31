import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "app.sqlite");

export const db = new DatabaseSync(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  composer TEXT,
  description TEXT,
  release_date TEXT,
  lyrics TEXT,
  audio_filename TEXT NOT NULL,
  uploader_username TEXT NOT NULL,
  uploader_display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  share_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT
);

CREATE TABLE IF NOT EXISTS likes (
  track_id TEXT NOT NULL,
  username TEXT NOT NULL,
  PRIMARY KEY (track_id, username)
);

CREATE TABLE IF NOT EXISTS saves (
  track_id TEXT NOT NULL,
  username TEXT NOT NULL,
  PRIMARY KEY (track_id, username)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

// Migration: add play_count to installs created before this column existed.
// SQLite has no "ADD COLUMN IF NOT EXISTS" — the try/catch is the idiom.
try { db.exec("ALTER TABLE tracks ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already present */ }

// Migration: OAuth-linked identity columns. Nullable — most accounts are
// still plain username/password. Partial unique indexes (rather than a
// UNIQUE column constraint) so many NULLs are allowed but no two accounts
// can ever share the same real provider id.
try { db.exec("ALTER TABLE users ADD COLUMN email TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE users ADD COLUMN google_id TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE users ADD COLUMN facebook_id TEXT"); } catch (e) { /* already present */ }
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_facebook_id ON users(facebook_id) WHERE facebook_id IS NOT NULL");

// --- Artist system (Phase 5) ---
// A separate table, not more columns bolted onto `users` — an artist
// profile is a distinct entity with its own lifecycle (bio, images,
// verification review), and keying it by username avoids inventing a
// second identity/slug system on top of the one that already exists.
db.exec(`
  CREATE TABLE IF NOT EXISTS artist_profiles (
    username TEXT PRIMARY KEY,
    artist_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar_filename TEXT,
    cover_filename TEXT,
    genres TEXT NOT NULL DEFAULT '[]',
    links TEXT NOT NULL DEFAULT '[]',
    verification_status TEXT NOT NULL DEFAULT 'independent',
    verification_note TEXT,
    verification_requested_at INTEGER,
    verified_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (username) REFERENCES users(username)
  );
  CREATE TABLE IF NOT EXISTS artist_follows (
    follower_username TEXT NOT NULL,
    artist_username TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (follower_username, artist_username)
  );
  CREATE TABLE IF NOT EXISTS play_events (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    username TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_play_events_track ON play_events(track_id, created_at);
`);

// --- Submissions (Phase 6) ---
// A submission is a separate staging entity from `tracks` on purpose: an
// artist's request must be editable, re-reviewable, and fully withdrawable
// without ever touching (or half-creating) a real published track. Only
// `POST /:id/publish` (admin-only) ever inserts into `tracks`.
db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    artist_username TEXT NOT NULL,
    title TEXT NOT NULL,
    release_type TEXT NOT NULL DEFAULT 'single',
    audio_filename TEXT,
    audio_original_name TEXT,
    audio_checksum TEXT,
    cover_filename TEXT,
    video_filename TEXT,
    lyrics TEXT NOT NULL DEFAULT '',
    genres TEXT NOT NULL DEFAULT '[]',
    language TEXT,
    is_explicit INTEGER NOT NULL DEFAULT 0,
    release_date TEXT,
    rights_confirmed INTEGER NOT NULL DEFAULT 0,
    terms_accepted INTEGER NOT NULL DEFAULT 0,
    terms_version TEXT,
    terms_accepted_at INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    admin_note TEXT,
    reviewed_at INTEGER,
    reviewed_by TEXT,
    published_track_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    submitted_at INTEGER,
    FOREIGN KEY (artist_username) REFERENCES artist_profiles(username)
  );
  CREATE INDEX IF NOT EXISTS idx_submissions_artist ON submissions(artist_username, created_at);
  CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, submitted_at);

  CREATE TABLE IF NOT EXISTS submission_credits (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    artist_username TEXT,
    external_name TEXT,
    role TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_submission_credits_submission ON submission_credits(submission_id);

  CREATE TABLE IF NOT EXISTS submission_events (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    actor_username TEXT NOT NULL,
    action TEXT NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_submission_events_submission ON submission_events(submission_id, created_at);

  CREATE TABLE IF NOT EXISTS track_credits (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    artist_username TEXT,
    external_name TEXT,
    role TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_track_credits_track ON track_credits(track_id);
`);

// Migration: a track's cover/video/genre data, and the submission it was
// published from. All nullable/defaulted so pre-Phase-6 tracks (none of
// which have any of this data) keep working exactly as before.
try { db.exec("ALTER TABLE tracks ADD COLUMN cover_filename TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE tracks ADD COLUMN video_filename TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE tracks ADD COLUMN genres TEXT NOT NULL DEFAULT '[]'"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE tracks ADD COLUMN submission_id TEXT"); } catch (e) { /* already present */ }

// --- Admin platform (Phase 7) ---
// Real account-restriction state, checked by requireAuth on every
// request -- never a client-side flag. Never applied to admins (the
// restrict endpoint refuses that target).
try { db.exec("ALTER TABLE users ADD COLUMN is_restricted INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE users ADD COLUMN restricted_at INTEGER"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE users ADD COLUMN restricted_reason TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE users ADD COLUMN restricted_by TEXT"); } catch (e) { /* already present */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id TEXT PRIMARY KEY,
    actor_username TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at);

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_username TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL,
    resolved_at INTEGER,
    resolved_by TEXT,
    resolution_note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);

  CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER,
    updated_by TEXT
  );
`);

// --- Phase 8: Social, Discovery & Personalized Music Experience ---

// Playlists — owned by a user, real tracks only.
db.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    owner_username TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cover_filename TEXT,
    is_public INTEGER NOT NULL DEFAULT 1,
    track_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (owner_username) REFERENCES users(username)
  );
  CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists(owner_username, created_at);

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    added_by TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    added_at INTEGER NOT NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);
  CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);
`);

// Notifications — real events, opt-in only where appropriate.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      type TEXT NOT NULL,
      actor_username TEXT,
      target_type TEXT,
      target_id TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(username, read, created_at);
  `);
} catch (e) { /* already present */ }

// Activity events — lightweight, purposeful events for analytics, discovery, personalization.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      username TEXT,
      event_type TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_events(event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_events(username, created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_target ON activity_events(target_type, target_id);
  `);
} catch (e) { /* already present */ }

// Search history for authenticated users.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      query TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(username, created_at);
  `);
} catch (e) { /* already present */ }

try { db.exec("ALTER TABLE users ADD COLUMN is_artist INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already present */ }

// --- Auth upgrade: Passwordless OTP, Email verification, Phone, Apple ---
try { db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE users ADD COLUMN apple_id TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'email'"); } catch (e) { /* already present */ }
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id) WHERE apple_id IS NOT NULL");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL");

// OTP tokens — email and phone, one-time use with expiry.
db.exec(`
  CREATE TABLE IF NOT EXISTS otp_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target TEXT NOT NULL,
    target_type TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_otp_target ON otp_tokens(target, target_type, used);
`);

function randomId() {
  return (globalThis.crypto && globalThis.crypto.randomUUID) ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Every privileged Admin action funnels through here -- a single,
// append-only, actor+action+target trail (Part 53). Nothing here is ever
// exposed to non-admins, and rows are never updated or deleted, only
// inserted, so the log can't quietly be edited after the fact from
// within the app itself.
export function recordAdminAudit(actorUsername, action, targetType, targetId, metadata) {
  db.prepare(`INSERT INTO admin_audit_log (id, actor_username, action, target_type, target_id, metadata, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(randomId(), actorUsername, action, targetType, targetId || null, metadata ? JSON.stringify(metadata) : null, Date.now());
}

export function shapeAuditEntry(row) {
  return {
    id: row.id,
    actorUsername: row.actor_username,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
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
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || null,
    resolvedBy: row.resolved_by || null,
    resolutionNote: row.resolution_note || null,
  };
}

export function getSetting(key, fallback = null) {
  const row = db.prepare("SELECT value FROM platform_settings WHERE key = ?").get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch (e) { return fallback; }
}

export function setSetting(key, value, actorUsername) {
  const now = Date.now();
  db.prepare(`INSERT INTO platform_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .run(key, JSON.stringify(value), now, actorUsername || null);
}

export function isAccountRestricted(username) {
  const row = db.prepare("SELECT is_restricted FROM users WHERE username = ?").get(username);
  return !!(row && row.is_restricted);
}

export function shapePublicUserSummary(row) {
  const artist = db.prepare("SELECT verification_status FROM artist_profiles WHERE username = ?").get(row.username);
  return {
    username: row.username,
    displayName: row.display_name,
    email: row.email || null,
    isAdmin: !!row.is_admin,
    isArtist: !!artist,
    artistBadge: artist ? badgeStatusFor(artist.verification_status) : null,
    isRestricted: !!row.is_restricted,
    restrictedReason: row.restricted_reason || null,
    restrictedAt: row.restricted_at || null,
    createdAt: row.created_at,
  };
}

// A track's real "who uploaded this, and are they a real artist" — a
// guaranteed-correct join (uploader_username is a real FK), never a
// text-matched guess against the free-text composer field.
export function badgeStatusFor(verificationStatus) {
  if (!verificationStatus) return null;
  return verificationStatus === "verified" ? "verified" : "independent";
}

export function shapeArtistProfile(row, extra = {}) {
  if (!row) return null;
  return {
    username: row.username,
    artistName: row.artist_name,
    bio: row.bio || "",
    avatarUrl: row.avatar_filename ? "/api/artist-images/" + row.avatar_filename : null,
    coverUrl: row.cover_filename ? "/api/artist-images/" + row.cover_filename : null,
    genres: JSON.parse(row.genres || "[]"),
    links: JSON.parse(row.links || "[]"),
    verificationStatus: row.verification_status,
    verificationNote: row.verification_note || null,
    badge: badgeStatusFor(row.verification_status),
    createdAt: row.created_at,
    ...extra,
  };
}

// Structured credits for a published track — a real join against
// artist_profiles for every registered credit (never a name string typed
// in at review time), so avatars/badges/links on a "Producer" credit are
// exactly as reliable as the uploader badge already is.
export function shapeTrackCredits(trackId) {
  const rows = db.prepare("SELECT * FROM track_credits WHERE track_id = ? ORDER BY is_primary DESC, position ASC").all(trackId);
  return rows.map((c) => {
    const artist = c.artist_username ? db.prepare("SELECT artist_name, avatar_filename, verification_status FROM artist_profiles WHERE username = ?").get(c.artist_username) : null;
    return {
      artistUsername: c.artist_username || null,
      artistName: artist ? artist.artist_name : (c.external_name || ""),
      avatarUrl: artist && artist.avatar_filename ? "/api/artist-images/" + artist.avatar_filename : null,
      badge: artist ? badgeStatusFor(artist.verification_status) : null,
      isExternal: !c.artist_username,
      role: c.role,
      isPrimary: !!c.is_primary,
    };
  });
}

export function shapeTrack(row) {
  if (!row) return null;
  const likedBy = db.prepare("SELECT username FROM likes WHERE track_id = ?").all(row.id).map((r) => r.username);
  const savedBy = db.prepare("SELECT username FROM saves WHERE track_id = ?").all(row.id).map((r) => r.username);
  const comments = db.prepare("SELECT * FROM comments WHERE track_id = ? ORDER BY created_at ASC").all(row.id).map((c) => ({
    id: c.id, username: c.username, displayName: c.display_name, text: c.text, createdAt: c.created_at
  }));
  const uploaderArtist = db.prepare("SELECT verification_status FROM artist_profiles WHERE username = ?").get(row.uploader_username);
  const credits = shapeTrackCredits(row.id);
  const primary = credits.find((c) => c.isPrimary);
  const featured = credits.filter((c) => c.role === "featured");
  return {
    id: row.id,
    title: row.title,
    composer: row.composer || "",
    description: row.description || "",
    releaseDate: row.release_date || "",
    lyrics: row.lyrics || "",
    timedLyrics: row.timed_lyrics ? (() => { try { return JSON.parse(row.timed_lyrics); } catch (e) { return null; } })() : null,
    duration: row.duration || null,
    genres: JSON.parse(row.genres || "[]"),
    uploaderUsername: row.uploader_username,
    uploaderDisplayName: row.uploader_display_name,
    uploaderBadge: badgeStatusFor(uploaderArtist && uploaderArtist.verification_status),
    status: row.status,
    shareCount: row.share_count,
    playCount: row.play_count || 0,
    createdAt: row.created_at,
    likedBy,
    savedBy,
    comments,
    audioUrl: "/api/tracks/" + row.id + "/audio",
    coverUrl: row.cover_filename ? "/api/track-covers/" + row.cover_filename : null,
    videoUrl: row.video_filename ? "/api/tracks/" + row.id + "/video" : null,
    credits,
    // Real-signal display helpers, always derived from the structured
    // credits above — never a second, independently-typed name field.
    primaryArtistName: primary ? primary.artistName : "",
    primaryArtistUsername: primary ? primary.artistUsername : null,
    featuredArtistNames: featured.map((f) => f.artistName),
    isrc: row.isrc || null,
    rightsHolder: row.rights_holder || null,
    rightsYear: row.rights_year || null,
    rightsLabel: row.rights_label || null,
    rightsRecordId: row.rights_record_id || null,
    rightsDeclaredAt: row.rights_declared_at || null,
  };
}

// --- Submissions (Phase 6) ---

export function shapeSubmissionCredits(submissionId) {
  const rows = db.prepare("SELECT * FROM submission_credits WHERE submission_id = ? ORDER BY is_primary DESC, position ASC").all(submissionId);
  return rows.map((c) => {
    const artist = c.artist_username ? db.prepare("SELECT artist_name, avatar_filename, verification_status FROM artist_profiles WHERE username = ?").get(c.artist_username) : null;
    return {
      id: c.id,
      artistUsername: c.artist_username || null,
      artistName: artist ? artist.artist_name : (c.external_name || ""),
      avatarUrl: artist && artist.avatar_filename ? "/api/artist-images/" + artist.avatar_filename : null,
      badge: artist ? badgeStatusFor(artist.verification_status) : null,
      isExternal: !c.artist_username,
      role: c.role,
      isPrimary: !!c.is_primary,
    };
  });
}

export function shapeSubmissionEvents(submissionId) {
  const rows = db.prepare("SELECT * FROM submission_events WHERE submission_id = ? ORDER BY created_at ASC").all(submissionId);
  return rows.map((e) => ({
    id: e.id,
    actorUsername: e.actor_username,
    action: e.action,
    note: e.note || null,
    createdAt: e.created_at,
  }));
}

export function shapeSubmission(row, { includeEvents = false } = {}) {
  if (!row) return null;
  const submitterArtist = db.prepare("SELECT artist_name, avatar_filename, verification_status FROM artist_profiles WHERE username = ?").get(row.artist_username);
  const out = {
    id: row.id,
    artistUsername: row.artist_username,
    artistName: submitterArtist ? submitterArtist.artist_name : row.artist_username,
    artistBadge: submitterArtist ? badgeStatusFor(submitterArtist.verification_status) : null,
    title: row.title,
    releaseType: row.release_type,
    audioOriginalName: row.audio_original_name || null,
    hasAudio: !!row.audio_filename,
    coverUrl: row.cover_filename ? "/api/submissions/" + row.id + "/cover" : null,
    hasVideo: !!row.video_filename,
    lyrics: row.lyrics || "",
    genres: JSON.parse(row.genres || "[]"),
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at || null,
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
    credits: shapeSubmissionCredits(row.id),
  };
  if (includeEvents) out.events = shapeSubmissionEvents(row.id);
  return out;
}

// --- Phase 8 helpers ---

export function shapePlaylist(row) {
  if (!row) return null;
  const owner = db.prepare("SELECT display_name FROM users WHERE username = ?").get(row.owner_username);
  return {
    id: row.id,
    ownerUsername: row.owner_username,
    ownerDisplayName: owner ? owner.display_name : row.owner_username,
    title: row.title,
    description: row.description || "",
    coverUrl: row.cover_filename ? "/api/playlist-covers/" + row.cover_filename : null,
    isPublic: !!row.is_public,
    trackCount: row.track_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function shapePlaylistDetail(row, { includeTracks = false, viewerUsername = null } = {}) {
  if (!row) return null;
  const base = shapePlaylist(row);
  if (!includeTracks) return base;
  const trackRows = db.prepare(
    "SELECT t.*, pt.position, pt.added_at FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = ? ORDER BY pt.position ASC"
  ).all(row.id);
  return {
    ...base,
    tracks: trackRows.filter((t) => t.status === "approved").map((t) => ({ ...shapeTrack(t), addedAt: t.added_at })),
  };
}

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
    read: !!row.read,
    createdAt: row.created_at,
  };
}

// Real notification creation — only called from server-side code.
export function createNotification(username, type, title, body, { actorUsername = null, targetType = null, targetId = null } = {}) {
  db.prepare(
    "INSERT INTO notifications (id, username, type, actor_username, target_type, target_id, title, body, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)"
  ).run(randomId(), username, type, actorUsername, targetType, targetId, title, body || "", Date.now());
}

// Record an activity event — lightweight, purposeful.
export function recordActivity(username, eventType, targetType, targetId, metadata) {
  db.prepare(
    "INSERT INTO activity_events (id, username, event_type, target_type, target_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(randomId(), username || null, eventType, targetType || null, targetId || null, metadata ? JSON.stringify(metadata) : null, Date.now());
}

// ═══════════════════════════════════════════════════════════════
// PHASE 9 — Releases, Timed Lyrics, Rights, Artist Applications
// ═══════════════════════════════════════════════════════════════

// --- Timed Lyrics & Rights columns on tracks ---
try { db.exec("ALTER TABLE tracks ADD COLUMN timed_lyrics TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE tracks ADD COLUMN duration INTEGER"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE tracks ADD COLUMN isrc TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE tracks ADD COLUMN rights_holder TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE tracks ADD COLUMN rights_year TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE tracks ADD COLUMN rights_label TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE tracks ADD COLUMN rights_record_id TEXT"); } catch (e) { /* already present */ }
try { db.exec("ALTER TABLE tracks ADD COLUMN rights_declared_at INTEGER"); } catch (e) { /* already present */ }

// --- Releases: Single, EP, Album, Postcard ---
db.exec(`
  CREATE TABLE IF NOT EXISTS releases (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT,
    type TEXT NOT NULL DEFAULT 'single',
    cover_filename TEXT,
    description TEXT NOT NULL DEFAULT '',
    artist_message TEXT NOT NULL DEFAULT '',
    release_date TEXT,
    label TEXT,
    copyright_text TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    rejection_reason TEXT,
    reviewed_at INTEGER,
    reviewed_by TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_releases_type ON releases(type, status);
  CREATE INDEX IF NOT EXISTS idx_releases_creator ON releases(created_by, created_at);
  CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status, updated_at);

  CREATE TABLE IF NOT EXISTS release_tracks (
    id TEXT PRIMARY KEY,
    release_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    track_number INTEGER NOT NULL DEFAULT 1,
    disc_number INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_release_tracks_release ON release_tracks(release_id, track_number);
  CREATE INDEX IF NOT EXISTS idx_release_tracks_track ON release_tracks(track_id);
`);

// --- Artist Applications (become a 4ANG artist) ---
db.exec(`
  CREATE TABLE IF NOT EXISTS artist_applications (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    main_genre TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    social_links TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    review_note TEXT,
    submitted_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    reviewed_by TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_artist_apps_user ON artist_applications(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_artist_apps_status ON artist_applications(status, submitted_at);

  CREATE TABLE IF NOT EXISTS verified_artist_applications (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    main_genre TEXT NOT NULL DEFAULT '',
    social_links TEXT NOT NULL DEFAULT '[]',
    official_links TEXT NOT NULL DEFAULT '[]',
    additional_info TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    review_note TEXT,
    submitted_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    reviewed_by TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_verified_apps_user ON verified_artist_applications(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_verified_apps_status ON verified_artist_applications(status, submitted_at);
`);

// --- Email Notifications log ---
db.exec(`
  CREATE TABLE IF NOT EXISTS email_notifications (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    recipient TEXT NOT NULL,
    type TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    sent_at INTEGER,
    error TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_email_notif_status ON email_notifications(status, created_at);
`);

// --- Listening Progress (Continue Listening) ---
db.exec(`
  CREATE TABLE IF NOT EXISTS listening_progress (
    username TEXT NOT NULL,
    track_id TEXT NOT NULL,
    progress_seconds REAL DEFAULT 0,
    duration_seconds REAL DEFAULT 0,
    source_type TEXT DEFAULT 'track',
    source_id TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (username, track_id)
  );
  CREATE INDEX IF NOT EXISTS idx_lp_user ON listening_progress(username, updated_at DESC);
`);

// ═══════════════════════════════════════════════════════════════
// PHASE 9 — Shape helpers
// ═══════════════════════════════════════════════════════════════

export function shapeRelease(row, { includeTracks = false } = {}) {
  if (!row) return null;
  const out = {
    id: row.id,
    title: row.title,
    slug: row.slug || null,
    type: row.type,
    coverUrl: row.cover_filename ? "/api/releases/" + row.id + "/cover" : null,
    description: row.description || "",
    artistMessage: row.artist_message || "",
    releaseDate: row.release_date || null,
    label: row.label || null,
    copyrightText: row.copyright_text || null,
    status: row.status,
    rejectionReason: row.rejection_reason || null,
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeTracks) {
    const trackRows = db.prepare(
      "SELECT t.*, rt.track_number, rt.disc_number FROM release_tracks rt JOIN tracks t ON t.id = rt.track_id WHERE rt.release_id = ? ORDER BY rt.disc_number ASC, rt.track_number ASC"
    ).all(row.id);
    out.tracks = trackRows.filter((t) => t.status === "approved").map((t) => ({ ...shapeTrack(t), trackNumber: t.track_number, discNumber: t.disc_number }));
    out.trackCount = out.tracks.length;
    out.totalDuration = out.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  }
  return out;
}

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
    socialLinks: JSON.parse(row.social_links || "[]"),
    status: row.status,
    reviewNote: row.review_note || null,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
    createdAt: row.created_at,
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
    socialLinks: JSON.parse(row.social_links || "[]"),
    officialLinks: JSON.parse(row.official_links || "[]"),
    additionalInfo: row.additional_info || "",
    status: row.status,
    reviewNote: row.review_note || null,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
    createdAt: row.created_at,
  };
}

// Generate unique 4ANG Rights Record ID: 4ANG-RGT-YYYY-XXXXXXXX
export function generateRightsRecordId() {
  const year = new Date().getFullYear();
  const rand = randomId().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `4ANG-RGT-${year}-${rand}`;
}
