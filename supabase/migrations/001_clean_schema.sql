-- ============================================================
-- 4ANG CLEAN SCHEMA — Supabase Migration v2
-- Run in Supabase SQL Editor. Replaces all previous migrations.
-- Fixes: correct naming, UUID PKs, TIMESTAMPTZ, all tables.
-- ============================================================

-- ─── 1. PROFILES ───────────────────────────────────────────
-- Linked 1:1 with auth.users. Source of truth for user data.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'artist', 'admin')),
  is_restricted BOOLEAN NOT NULL DEFAULT false,
  restricted_at TIMESTAMPTZ,
  restricted_reason TEXT,
  restricted_by UUID,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ─── 2. USER PREFERENCES ───────────────────────────────────
-- Onboarding + recommendation signals.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  favorite_genres JSONB NOT NULL DEFAULT '[]',
  favorite_moods JSONB NOT NULL DEFAULT '[]',
  favorite_artists JSONB NOT NULL DEFAULT '[]',
  onboarding_step INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. ARTIST PROFILES ────────────────────────────────────
-- Artist identity. One per user.
CREATE TABLE IF NOT EXISTS artist_profiles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  artist_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  cover_url TEXT,
  genres JSONB NOT NULL DEFAULT '[]',
  links JSONB NOT NULL DEFAULT '[]',
  monthly_listeners INTEGER NOT NULL DEFAULT 0,
  total_plays BIGINT NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'independent'
    CHECK (verification_status IN ('independent', 'pending', 'verified', 'rejected')),
  verification_note TEXT,
  verification_requested_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_artist_verification ON artist_profiles(verification_status);

-- ─── 4. ARTIST FOLLOWS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS artist_follows (
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artist_profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, artist_id)
);

-- ─── 5. TRACKS ─────────────────────────────────────────────
-- Core music entity. All metadata lives here.
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  composer TEXT,
  lyrics TEXT NOT NULL DEFAULT '',
  timed_lyrics JSONB,

  audio_path TEXT NOT NULL,
  audio_original_name TEXT,
  audio_mime_type TEXT,
  audio_size BIGINT,
  audio_duration INTEGER, -- seconds

  cover_path TEXT,
  video_path TEXT,

  genres JSONB NOT NULL DEFAULT '[]',
  language TEXT,
  is_explicit BOOLEAN NOT NULL DEFAULT false,

  uploader_id UUID NOT NULL REFERENCES profiles(id),

  release_date DATE,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),

  play_count INTEGER NOT NULL DEFAULT 0,
  share_count INTEGER NOT NULL DEFAULT 0,

  submission_id UUID,

  isrc TEXT,
  rights_holder TEXT,
  rights_year INTEGER,
  rights_label TEXT,
  rights_record_id TEXT,
  rights_declared_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);
CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_uploader ON tracks(uploader_id);
CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks(play_count DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_genres ON tracks USING GIN (genres);

-- ─── 6. TRACK CREDITS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS track_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  external_name TEXT,
  role TEXT NOT NULL CHECK (role IN (
    'main_artist', 'featured', 'producer', 'songwriter',
    'lyricist', 'composer', 'arranger'
  )),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_track_credits_track ON track_credits(track_id);

-- ─── 7. TRACK LIKES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS track_likes (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

-- ─── 8. TRACK SAVES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS track_saves (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

-- ─── 9. TRACK COMMENTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS track_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_track ON track_comments(track_id, created_at);

-- ─── 10. PLAY EVENTS ───────────────────────────────────────
-- Core analytics. Feeds trending, recommendations, stats.
CREATE TABLE IF NOT EXISTS play_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  progress_seconds INTEGER,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_play_events_track ON play_events(track_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_play_events_user ON play_events(user_id, created_at DESC);

-- ─── 11. LISTENING PROGRESS ────────────────────────────────
-- Continue Listening feature.
CREATE TABLE IF NOT EXISTS listening_progress (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  progress_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  source_type TEXT, -- 'playlist', 'album', 'discover', etc.
  source_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

-- ─── 12. ACTIVITY EVENTS ───────────────────────────────────
-- Feeds recommendation + analytics.
CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_target ON activity_events(target_type, target_id);

-- ─── 13. PLAYLISTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_path TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  track_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES profiles(id),
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);

-- ─── 14. RELEASES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  type TEXT NOT NULL DEFAULT 'single' CHECK (type IN ('single', 'ep', 'album')),
  cover_path TEXT,
  description TEXT NOT NULL DEFAULT '',
  artist_message TEXT NOT NULL DEFAULT '',
  release_date DATE,
  label TEXT,
  copyright_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'rejected')),
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_releases_type ON releases(type, status);
CREATE INDEX IF NOT EXISTS idx_releases_creator ON releases(created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS release_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  track_number INTEGER NOT NULL DEFAULT 1,
  disc_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (release_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_release_tracks_release ON release_tracks(release_id, track_number);

-- ─── 15. SUBMISSIONS ───────────────────────────────────────
-- Artist music submission pipeline.
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artist_profiles(user_id),

  title TEXT NOT NULL,
  release_type TEXT NOT NULL DEFAULT 'single',

  audio_path TEXT,
  audio_original_name TEXT,
  audio_checksum TEXT,
  audio_mime_type TEXT,
  audio_size BIGINT,
  audio_duration INTEGER,

  cover_path TEXT,
  video_path TEXT,

  lyrics TEXT NOT NULL DEFAULT '',
  genres JSONB NOT NULL DEFAULT '[]',
  language TEXT,
  is_explicit BOOLEAN NOT NULL DEFAULT false,

  release_date DATE,

  rights_confirmed BOOLEAN NOT NULL DEFAULT false,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  terms_version TEXT,
  terms_accepted_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'submitted', 'under_review',
      'changes_requested', 'approved', 'rejected', 'published'
    )),

  admin_note TEXT,
  published_track_id UUID,

  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  submitted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submissions_artist ON submissions(artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS submission_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  external_name TEXT,
  role TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sub_credits_submission ON submission_credits(submission_id);

CREATE TABLE IF NOT EXISTS submission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sub_events_submission ON submission_events(submission_id, created_at DESC);

-- ─── 16. ARTIST APPLICATIONS ───────────────────────────────
CREATE TABLE IF NOT EXISTS artist_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  artist_name TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  bio TEXT,
  main_genre TEXT,
  country TEXT,
  social_links JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 17. VERIFIED ARTIST APPLICATIONS ──────────────────────
CREATE TABLE IF NOT EXISTS verified_artist_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  artist_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  bio TEXT,
  main_genre TEXT,
  social_links JSONB NOT NULL DEFAULT '{}',
  official_links JSONB NOT NULL DEFAULT '{}',
  additional_info TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 18. NOTIFICATIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  target_type TEXT,
  target_id UUID,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ─── 19. SEARCH HISTORY ────────────────────────────────────
CREATE TABLE IF NOT EXISTS search_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, created_at DESC);

-- ─── 20. REPORTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);

-- ─── 21. ADMIN AUDIT LOG ───────────────────────────────────
-- Append-only. Never update or delete rows.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);

-- ─── 22. PLATFORM SETTINGS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ,
  updated_by UUID
);

-- ─── 23. SUPPORT TICKETS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL DEFAULT 'general',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'open', 'resolved', 'closed')),
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status, created_at DESC);

-- ─── 24. EMAIL NOTIFICATIONS LOG ───────────────────────────
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  recipient TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── DONE ──────────────────────────────────────────────────
-- 24 tables created. RLS policies in separate migration.
