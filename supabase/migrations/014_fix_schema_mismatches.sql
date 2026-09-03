-- ============================================================
-- 014: Fix schema mismatches for backend compatibility
-- All targeted tables are EMPTY (0 rows) — safe to DROP + recreate
-- Tables with data (profiles, artist_profiles, artist_applications,
-- user_preferences) are NOT touched.
-- ============================================================

-- Helper: avoid "already exists" errors
-- Uses a DO block to conditionally drop

-- ═══════════════════════════════════════════════════════════════
-- 1. SUBMISSIONS — drop & recreate with correct columns + constraints
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.submission_credits CASCADE;
DROP TABLE IF EXISTS public.submission_events CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;

CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL,
  artist_username TEXT NOT NULL,
  title TEXT NOT NULL,
  release_type TEXT NOT NULL DEFAULT 'single',
  audio_path TEXT,
  audio_original_name TEXT,
  audio_checksum TEXT,
  cover_path TEXT,
  video_path TEXT,
  lyrics TEXT NOT NULL DEFAULT '',
  genres JSONB NOT NULL DEFAULT '[]'::jsonb,
  language TEXT,
  is_explicit BOOLEAN NOT NULL DEFAULT FALSE,
  release_date DATE,
  rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  terms_version TEXT,
  terms_accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_review','under_review','changes_requested','rejected','approved','published')),
  admin_note TEXT,
  published_track_id UUID,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

CREATE INDEX idx_submissions_artist ON public.submissions(artist_username, created_at DESC);
CREATE INDEX idx_submissions_status ON public.submissions(status, submitted_at);
CREATE INDEX idx_submissions_checksum ON public.submissions(audio_checksum);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 2. SUBMISSION_CREDITS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE public.submission_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  artist_username TEXT,
  external_name TEXT,
  role TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_submission_credits_sub ON public.submission_credits(submission_id);

ALTER TABLE public.submission_credits ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 3. SUBMISSION_EVENTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE public.submission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_submission_events_sub ON public.submission_events(submission_id, created_at);

ALTER TABLE public.submission_events ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 4. TRACKS — drop & recreate
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.track_credits CASCADE;
DROP TABLE IF EXISTS public.tracks CASCADE;

CREATE TABLE public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  composer TEXT,
  description TEXT,
  release_date DATE,
  lyrics TEXT,
  audio_path TEXT,
  audio_original_name TEXT,
  cover_path TEXT,
  video_path TEXT,
  genres JSONB NOT NULL DEFAULT '[]'::jsonb,
  language TEXT,
  is_explicit BOOLEAN NOT NULL DEFAULT FALSE,
  uploader_id UUID,
  uploader_username TEXT,
  uploader_display_name TEXT,
  status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending','approved','rejected','removed')),
  share_count INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  submission_id UUID,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  audio_duration REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracks_uploader ON public.tracks(uploader_username);
CREATE INDEX idx_tracks_status ON public.tracks(status, created_at DESC);
CREATE INDEX idx_tracks_genres ON public.tracks USING GIN(genres);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 5. TRACK_CREDITS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE public.track_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  artist_username TEXT,
  user_id UUID,
  external_name TEXT,
  role TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_track_credits_track ON public.track_credits(track_id);

ALTER TABLE public.track_credits ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 6. TRACK_LIKES — composite PK, no single id column
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.track_likes CASCADE;

CREATE TABLE public.track_likes (
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, username)
);

CREATE INDEX idx_track_likes_username ON public.track_likes(username);

ALTER TABLE public.track_likes ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 7. TRACK_SAVES — composite PK, no single id column
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.track_saves CASCADE;

CREATE TABLE public.track_saves (
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, username)
);

CREATE INDEX idx_track_saves_username ON public.track_saves(username);

ALTER TABLE public.track_saves ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 8. TRACK_COMMENTS — has username + display_name
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.track_comments CASCADE;

CREATE TABLE public.track_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_track_comments_track ON public.track_comments(track_id, created_at);

ALTER TABLE public.track_comments ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 9. PLAYLISTS — drop & recreate
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.playlist_tracks CASCADE;
DROP TABLE IF EXISTS public.playlists CASCADE;

CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_username TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_path TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  track_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_playlists_owner ON public.playlists(owner_username);

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 10. PLAYLIST_TRACKS — has added_by
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE public.playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL,
  added_by TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_playlist_tracks_playlist ON public.playlist_tracks(playlist_id);

ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 11. NOTIFICATIONS — has is_read (not "read")
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  type TEXT NOT NULL,
  actor_username TEXT,
  target_type TEXT,
  target_id TEXT,
  title TEXT,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_username ON public.notifications(username, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(username, is_read) WHERE NOT is_read;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 12. ADMIN_AUDIT_LOG — has actor_username
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.admin_audit_log CASCADE;

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_created ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 13. ACTIVITY_EVENTS — has event_type (not "type") + metadata
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.activity_events CASCADE;

CREATE TABLE public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT,
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_username ON public.activity_events(username, created_at DESC);
CREATE INDEX idx_activity_created ON public.activity_events(created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 14. ARTIST_FOLLOWS — has composite-style IDs
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.artist_follows CASCADE;

CREATE TABLE public.artist_follows (
  follower_id UUID,
  artist_id UUID,
  follower_username TEXT NOT NULL,
  artist_username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_username, artist_username)
);

CREATE INDEX idx_artist_follows_artist ON public.artist_follows(artist_username);

ALTER TABLE public.artist_follows ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 15. REPORTS — has reporter_id, note (not "detail")
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.reports CASCADE;

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID,
  reporter_username TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_status ON public.reports(status, created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 16. SUPPORT_TICKETS — if needed by backend
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.support_tickets CASCADE;

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','replied','closed')),
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_username ON public.support_tickets(username, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 17. LISTENING_PROGRESS
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.listening_progress CASCADE;

CREATE TABLE public.listening_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  track_id UUID NOT NULL,
  progress_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listening_username ON public.listening_progress(username, track_id);

ALTER TABLE public.listening_progress ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- Done. All empty tables recreated with correct schemas.
-- ═══════════════════════════════════════════════════════════════
