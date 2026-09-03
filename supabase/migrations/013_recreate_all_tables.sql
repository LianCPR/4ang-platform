-- ============================================================
-- 013: RECREATE ALL 4ANG TABLES WITH CORRECT POSTGRES TYPES
-- Safe to re-run after a partially failed execution.
--
-- IMPORTANT:
--   - public.profiles DATA IS PRESERVED.
--   - All non-profile tables below are DROP + RECREATED.
--   - Only run this while those tables contain no important data.
-- ============================================================

BEGIN;

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 1. REMOVE OLD POLICIES FIRST
--
-- This prevents:
--   ERROR 42710: policy already exists
--
-- We dynamically remove every policy from the tables that
-- migration 013 manages.
-- ============================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            schemaname,
            tablename,
            policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
            'profiles',
            'user_preferences',
            'artist_profiles',
            'artist_applications',
            'verified_artist_applications',
            'tracks',
            'track_credits',
            'track_likes',
            'track_saves',
            'track_comments',
            'play_events',
            'submissions',
            'submission_events',
            'submission_credits',
            'releases',
            'release_tracks',
            'playlists',
            'playlist_tracks',
            'artist_follows',
            'notifications',
            'admin_audit_log',
            'activity_events',
            'reports',
            'support_tickets',
            'search_history',
            'listening_progress',
            'platform_settings'
          )
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            r.policyname,
            r.schemaname,
            r.tablename
        );
    END LOOP;
END $$;


-- ============================================================
-- 2. PROFILES
--
-- NEVER DROP PROFILES.
--
-- Existing profiles data must survive.
--
-- Handles both:
--   BIGINT epoch milliseconds
--   TIMESTAMPTZ
-- ============================================================

-- Ensure columns exist.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;


-- ------------------------------------------------------------
-- Convert created_at if it is still BIGINT.
-- ------------------------------------------------------------

DO $$
DECLARE
    column_type TEXT;
BEGIN
    SELECT data_type
    INTO column_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'created_at';

    IF column_type = 'bigint' THEN

        ALTER TABLE public.profiles
            ADD COLUMN IF NOT EXISTS created_at_new TIMESTAMPTZ;

        UPDATE public.profiles
        SET created_at_new =
            CASE
                WHEN created_at IS NULL THEN now()
                ELSE to_timestamp(created_at / 1000.0)
            END
        WHERE created_at_new IS NULL;

        ALTER TABLE public.profiles
            DROP COLUMN created_at;

        ALTER TABLE public.profiles
            RENAME COLUMN created_at_new TO created_at;

    ELSIF column_type IS NULL THEN

        ALTER TABLE public.profiles
            ADD COLUMN created_at TIMESTAMPTZ;

    ELSIF column_type <> 'timestamp with time zone' THEN

        RAISE EXCEPTION
            'Unexpected profiles.created_at type: %',
            column_type;

    END IF;
END $$;


-- ------------------------------------------------------------
-- Convert updated_at if it is still BIGINT.
-- ------------------------------------------------------------

DO $$
DECLARE
    column_type TEXT;
BEGIN
    SELECT data_type
    INTO column_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'updated_at';

    IF column_type = 'bigint' THEN

        ALTER TABLE public.profiles
            ADD COLUMN IF NOT EXISTS updated_at_new TIMESTAMPTZ;

        UPDATE public.profiles
        SET updated_at_new =
            CASE
                WHEN updated_at IS NULL THEN now()
                ELSE to_timestamp(updated_at / 1000.0)
            END
        WHERE updated_at_new IS NULL;

        ALTER TABLE public.profiles
            DROP COLUMN updated_at;

        ALTER TABLE public.profiles
            RENAME COLUMN updated_at_new TO updated_at;

    ELSIF column_type IS NULL THEN

        ALTER TABLE public.profiles
            ADD COLUMN updated_at TIMESTAMPTZ;

    ELSIF column_type <> 'timestamp with time zone' THEN

        RAISE EXCEPTION
            'Unexpected profiles.updated_at type: %',
            column_type;

    END IF;
END $$;


-- ------------------------------------------------------------
-- Fix NULL timestamps and defaults.
-- ------------------------------------------------------------

UPDATE public.profiles
SET created_at = now()
WHERE created_at IS NULL;

UPDATE public.profiles
SET updated_at = now()
WHERE updated_at IS NULL;

ALTER TABLE public.profiles
    ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.profiles
    ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.profiles
    ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.profiles
    ALTER COLUMN updated_at SET NOT NULL;


-- ------------------------------------------------------------
-- auth_provider
-- ------------------------------------------------------------

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';

UPDATE public.profiles
SET auth_provider = 'email'
WHERE auth_provider IS NULL;


-- ============================================================
-- 3. DROP NON-PROFILE TABLES
--
-- These tables are intentionally recreated.
-- ============================================================

DROP TABLE IF EXISTS public.artist_applications CASCADE;
DROP TABLE IF EXISTS public.verified_artist_applications CASCADE;
DROP TABLE IF EXISTS public.artist_profiles CASCADE;

DROP TABLE IF EXISTS public.tracks CASCADE;
DROP TABLE IF EXISTS public.track_credits CASCADE;
DROP TABLE IF EXISTS public.track_likes CASCADE;
DROP TABLE IF EXISTS public.track_saves CASCADE;
DROP TABLE IF EXISTS public.track_comments CASCADE;
DROP TABLE IF EXISTS public.play_events CASCADE;

DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.submission_events CASCADE;
DROP TABLE IF EXISTS public.submission_credits CASCADE;

DROP TABLE IF EXISTS public.releases CASCADE;
DROP TABLE IF EXISTS public.release_tracks CASCADE;

DROP TABLE IF EXISTS public.playlists CASCADE;
DROP TABLE IF EXISTS public.playlist_tracks CASCADE;

DROP TABLE IF EXISTS public.artist_follows CASCADE;

DROP TABLE IF EXISTS public.notifications CASCADE;

DROP TABLE IF EXISTS public.admin_audit_log CASCADE;
DROP TABLE IF EXISTS public.activity_events CASCADE;

DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;

DROP TABLE IF EXISTS public.search_history CASCADE;
DROP TABLE IF EXISTS public.listening_progress CASCADE;

DROP TABLE IF EXISTS public.platform_settings CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;


-- ============================================================
-- 4. USER PREFERENCES
-- ============================================================

CREATE TABLE public.user_preferences (
    user_id UUID PRIMARY KEY
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    favorite_genres JSONB NOT NULL DEFAULT '[]'::jsonb,
    favorite_moods JSONB NOT NULL DEFAULT '[]'::jsonb,
    favorite_artists JSONB NOT NULL DEFAULT '[]'::jsonb,

    onboarding_step INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 5. ARTIST PROFILES
-- ============================================================

CREATE TABLE public.artist_profiles (
    user_id UUID PRIMARY KEY
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    username TEXT UNIQUE NOT NULL,
    artist_name TEXT NOT NULL,

    bio TEXT NOT NULL DEFAULT '',

    avatar_url TEXT,
    cover_url TEXT,

    genres JSONB NOT NULL DEFAULT '[]'::jsonb,
    links JSONB NOT NULL DEFAULT '[]'::jsonb,

    monthly_listeners INTEGER NOT NULL DEFAULT 0,
    total_plays BIGINT NOT NULL DEFAULT 0,

    verification_status TEXT NOT NULL DEFAULT 'independent'
        CHECK (
            verification_status IN (
                'independent',
                'pending',
                'verified',
                'rejected'
            )
        ),

    verification_note TEXT,
    verification_requested_at TIMESTAMPTZ,

    badge_type TEXT,

    social_links JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_artist_profiles_username
    ON public.artist_profiles(username);

CREATE INDEX idx_artist_profiles_verification
    ON public.artist_profiles(verification_status);


-- ============================================================
-- 6. ARTIST APPLICATIONS
-- ============================================================

CREATE TABLE public.artist_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    username TEXT,
    artist_name TEXT NOT NULL,

    full_name TEXT,
    email TEXT,
    phone TEXT,

    bio TEXT,
    main_genre TEXT,
    country TEXT,

    social_links JSONB NOT NULL DEFAULT '[]'::jsonb,

    artist_type TEXT NOT NULL DEFAULT 'independent',

    genres JSONB NOT NULL DEFAULT '[]'::jsonb,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'reviewing',
                'approved',
                'rejected'
            )
        ),

    review_note TEXT,

    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,

    reviewed_by UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_artist_apps_user
    ON public.artist_applications(user_id);

CREATE INDEX idx_artist_apps_username
    ON public.artist_applications(username);

CREATE INDEX idx_artist_apps_status
    ON public.artist_applications(status);


-- ============================================================
-- 7. VERIFIED ARTIST APPLICATIONS
-- ============================================================

CREATE TABLE public.verified_artist_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    username TEXT,
    artist_name TEXT NOT NULL,

    email TEXT,
    phone TEXT,

    bio TEXT,
    main_genre TEXT,

    social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
    official_links JSONB NOT NULL DEFAULT '[]'::jsonb,

    additional_info TEXT,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'approved',
                'rejected'
            )
        ),

    review_note TEXT,

    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,

    reviewed_by UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verified_apps_user
    ON public.verified_artist_applications(user_id);

CREATE INDEX idx_verified_apps_username
    ON public.verified_artist_applications(username);


-- ============================================================
-- 8. TRACKS
-- ============================================================

CREATE TABLE public.tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title TEXT NOT NULL,
    composer TEXT,
    description TEXT,

    release_date DATE,

    lyrics TEXT,
    timed_lyrics JSONB,

    audio_url TEXT NOT NULL,
    audio_path TEXT,
    audio_filename TEXT,
    audio_mime_type TEXT,
    audio_size BIGINT,
    audio_duration REAL,

    cover_url TEXT,
    cover_path TEXT,
    cover_filename TEXT,

    video_url TEXT,
    video_path TEXT,
    video_filename TEXT,

    genres JSONB NOT NULL DEFAULT '[]'::jsonb,

    uploader_id UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    uploader_username TEXT,
    uploader_display_name TEXT,

    status TEXT NOT NULL DEFAULT 'approved'
        CHECK (
            status IN (
                'pending',
                'approved',
                'rejected',
                'removed'
            )
        ),

    share_count INTEGER NOT NULL DEFAULT 0,
    play_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    save_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,

    submission_id UUID,

    isrc TEXT,

    rights_holder TEXT,
    rights_year INTEGER,
    rights_label TEXT,
    rights_record_id TEXT,
    rights_declared_at TIMESTAMPTZ,

    reviewed_at TIMESTAMPTZ,

    reviewed_by UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracks_uploader
    ON public.tracks(uploader_id);

CREATE INDEX idx_tracks_uploader_uname
    ON public.tracks(uploader_username);

CREATE INDEX idx_tracks_status
    ON public.tracks(status, created_at DESC);

CREATE INDEX idx_tracks_genres
    ON public.tracks USING GIN(genres);

CREATE INDEX idx_tracks_submission
    ON public.tracks(submission_id);


-- ============================================================
-- 9. TRACK CREDITS
-- ============================================================

CREATE TABLE public.track_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    track_id UUID NOT NULL
        REFERENCES public.tracks(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    artist_username TEXT,
    external_name TEXT,

    role TEXT NOT NULL,

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_track_credits_track
    ON public.track_credits(track_id);


-- ============================================================
-- 10. TRACK LIKES
-- ============================================================

CREATE TABLE public.track_likes (
    user_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    track_id UUID NOT NULL
        REFERENCES public.tracks(id)
        ON DELETE CASCADE,

    username TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, track_id)
);

CREATE INDEX idx_track_likes_track
    ON public.track_likes(track_id);

CREATE INDEX idx_track_likes_username
    ON public.track_likes(username);


-- ============================================================
-- 11. TRACK SAVES
-- ============================================================

CREATE TABLE public.track_saves (
    user_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    track_id UUID NOT NULL
        REFERENCES public.tracks(id)
        ON DELETE CASCADE,

    username TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, track_id)
);

CREATE INDEX idx_track_saves_track
    ON public.track_saves(track_id);

CREATE INDEX idx_track_saves_username
    ON public.track_saves(username);


-- ============================================================
-- 12. TRACK COMMENTS
-- ============================================================

CREATE TABLE public.track_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    track_id UUID NOT NULL
        REFERENCES public.tracks(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    text TEXT NOT NULL,

    username TEXT,
    display_name TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_track_comments_track
    ON public.track_comments(track_id, created_at);

CREATE INDEX idx_track_comments_username
    ON public.track_comments(username);


-- ============================================================
-- 13. PLAY EVENTS
-- ============================================================

CREATE TABLE public.play_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    track_id UUID NOT NULL
        REFERENCES public.tracks(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    username TEXT,
    session_id TEXT,

    progress_seconds REAL NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_play_events_track
    ON public.play_events(track_id, created_at DESC);

CREATE INDEX idx_play_events_user
    ON public.play_events(user_id, created_at DESC);

CREATE INDEX idx_play_events_username
    ON public.play_events(username);


-- ============================================================
-- 14. SUBMISSIONS
-- ============================================================

CREATE TABLE public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    artist_username TEXT,

    artist_id UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    title TEXT NOT NULL,

    release_type TEXT NOT NULL DEFAULT 'single',

    lyrics TEXT,
    language TEXT,
    release_date TEXT,

    is_explicit BOOLEAN NOT NULL DEFAULT FALSE,

    rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,

    terms_version TEXT,

    genres JSONB NOT NULL DEFAULT '[]'::jsonb,

    audio_path TEXT,
    audio_url TEXT,
    audio_original_name TEXT,
    audio_checksum TEXT,
    audio_mime_type TEXT,
    audio_size BIGINT,

    cover_path TEXT,
    cover_url TEXT,

    video_path TEXT,

    status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (
            status IN (
                'pending_review',
                'under_review',
                'changes_requested',
                'approved',
                'published',
                'rejected'
            )
        ),

    review_note TEXT,
    reviewed_at TIMESTAMPTZ,

    reviewed_by UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    published_track_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_submissions_artist
    ON public.submissions(artist_username);

CREATE INDEX idx_submissions_status
    ON public.submissions(status);


-- ============================================================
-- 15. SUBMISSION EVENTS
-- ============================================================

CREATE TABLE public.submission_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id UUID NOT NULL
        REFERENCES public.submissions(id)
        ON DELETE CASCADE,

    actor_username TEXT,

    action TEXT NOT NULL,
    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_events_submission
    ON public.submission_events(submission_id);


-- ============================================================
-- 16. SUBMISSION CREDITS
-- ============================================================

CREATE TABLE public.submission_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id UUID NOT NULL
        REFERENCES public.submissions(id)
        ON DELETE CASCADE,

    artist_username TEXT,
    external_name TEXT,

    role TEXT NOT NULL,

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sub_credits_submission
    ON public.submission_credits(submission_id);


-- ============================================================
-- 17. RELEASES
-- ============================================================

CREATE TABLE public.releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title TEXT NOT NULL,
    slug TEXT,

    type TEXT NOT NULL DEFAULT 'single'
        CHECK (
            type IN (
                'single',
                'ep',
                'album'
            )
        ),

    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (
            status IN (
                'draft',
                'submitted',
                'published',
                'rejected'
            )
        ),

    cover_url TEXT,
    cover_path TEXT,

    description TEXT,
    release_date DATE,

    created_by UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    created_by_username TEXT,

    reviewed_at TIMESTAMPTZ,

    reviewed_by UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    reviewed_by_username TEXT,

    rejection_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_releases_status
    ON public.releases(status);

CREATE INDEX idx_releases_created_by
    ON public.releases(created_by);


-- ============================================================
-- 18. RELEASE TRACKS
-- ============================================================

CREATE TABLE public.release_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    release_id UUID NOT NULL
        REFERENCES public.releases(id)
        ON DELETE CASCADE,

    track_id UUID NOT NULL
        REFERENCES public.tracks(id)
        ON DELETE CASCADE,

    position INTEGER NOT NULL DEFAULT 0,

    UNIQUE (release_id, track_id)
);

CREATE INDEX idx_release_tracks_release
    ON public.release_tracks(release_id);


-- ============================================================
-- 19. PLAYLISTS
-- ============================================================

CREATE TABLE public.playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title TEXT NOT NULL,
    description TEXT,

    owner_id UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    owner_username TEXT,

    cover_url TEXT,
    cover_path TEXT,

    is_public BOOLEAN NOT NULL DEFAULT TRUE,

    track_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_playlists_owner
    ON public.playlists(owner_id);

CREATE INDEX idx_playlists_owner_uname
    ON public.playlists(owner_username);


-- ============================================================
-- 20. PLAYLIST TRACKS
-- ============================================================

CREATE TABLE public.playlist_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    playlist_id UUID NOT NULL
        REFERENCES public.playlists(id)
        ON DELETE CASCADE,

    track_id UUID NOT NULL
        REFERENCES public.tracks(id)
        ON DELETE CASCADE,

    added_by_username TEXT,

    position INTEGER NOT NULL DEFAULT 0,

    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (playlist_id, track_id)
);

CREATE INDEX idx_playlist_tracks_playlist
    ON public.playlist_tracks(playlist_id);


-- ============================================================
-- 21. ARTIST FOLLOWS
-- ============================================================

CREATE TABLE public.artist_follows (
    follower_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    artist_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    follower_username TEXT,
    artist_username TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (follower_id, artist_id)
);

CREATE INDEX idx_follows_artist
    ON public.artist_follows(artist_id);

CREATE INDEX idx_follows_follower_uname
    ON public.artist_follows(follower_username);

CREATE INDEX idx_follows_artist_uname
    ON public.artist_follows(artist_username);


-- ============================================================
-- 22. NOTIFICATIONS
-- ============================================================

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username TEXT,

    user_id UUID
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    type TEXT NOT NULL,

    title TEXT,
    message TEXT,

    target_type TEXT,
    target_id TEXT,

    actor_username TEXT,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user
    ON public.notifications(user_id);

CREATE INDEX idx_notifications_username
    ON public.notifications(username);


-- ============================================================
-- 23. ADMIN AUDIT LOG
-- ============================================================

CREATE TABLE public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    actor_id UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    actor_username TEXT,

    action TEXT NOT NULL,

    target_type TEXT,
    target_id TEXT,

    details JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_action
    ON public.admin_audit_log(action);

CREATE INDEX idx_audit_created
    ON public.admin_audit_log(created_at DESC);


-- ============================================================
-- 24. ACTIVITY EVENTS
-- ============================================================

CREATE TABLE public.activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username TEXT,

    user_id UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    action TEXT NOT NULL,

    target_type TEXT,
    target_id TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_user
    ON public.activity_events(user_id);

CREATE INDEX idx_activity_username
    ON public.activity_events(username);

CREATE INDEX idx_activity_created
    ON public.activity_events(created_at DESC);


-- ============================================================
-- 25. REPORTS
-- ============================================================

CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reporter_id UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    reporter_username TEXT,

    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,

    reason TEXT NOT NULL,
    details TEXT,

    status TEXT NOT NULL DEFAULT 'open'
        CHECK (
            status IN (
                'open',
                'resolved',
                'dismissed'
            )
        ),

    resolved_by UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    resolved_by_username TEXT,

    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_status
    ON public.reports(status);

CREATE INDEX idx_reports_reporter_uname
    ON public.reports(reporter_username);


-- ============================================================
-- 26. SUPPORT TICKETS
-- ============================================================

CREATE TABLE public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    username TEXT,

    subject TEXT NOT NULL,
    message TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'open'
        CHECK (
            status IN (
                'open',
                'replied',
                'closed'
            )
        ),

    admin_reply TEXT,
    replied_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_user
    ON public.support_tickets(user_id);


-- ============================================================
-- 27. SEARCH HISTORY
-- ============================================================

CREATE TABLE public.search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username TEXT,

    user_id UUID
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    query TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_username
    ON public.search_history(username);

CREATE INDEX idx_search_user
    ON public.search_history(user_id);


-- ============================================================
-- 28. LISTENING PROGRESS
-- ============================================================

CREATE TABLE public.listening_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username TEXT,

    user_id UUID
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    track_id UUID NOT NULL
        REFERENCES public.tracks(id)
        ON DELETE CASCADE,

    progress_seconds REAL NOT NULL DEFAULT 0,

    completed BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listening_user
    ON public.listening_progress(user_id);

CREATE INDEX idx_listening_username
    ON public.listening_progress(username);

CREATE INDEX idx_listening_track
    ON public.listening_progress(track_id);


-- ============================================================
-- 29. PLATFORM SETTINGS
-- ============================================================

CREATE TABLE public.platform_settings (
    key TEXT PRIMARY KEY,

    value JSONB NOT NULL DEFAULT '{}'::jsonb,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_by_username TEXT
);


-- ============================================================
-- 30. RLS
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_artist_applications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_credits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_tracks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.artist_follows ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_progress ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 31. PROFILES POLICIES
-- ============================================================

CREATE POLICY "profiles_select_public"
ON public.profiles
FOR SELECT
USING (true);

CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);


-- ============================================================
-- 32. USER PREFERENCES
-- ============================================================

CREATE POLICY "prefs_select_own"
ON public.user_preferences
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "prefs_insert_own"
ON public.user_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prefs_update_own"
ON public.user_preferences
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "prefs_delete_own"
ON public.user_preferences
FOR DELETE
USING (auth.uid() = user_id);


-- ============================================================
-- 33. ARTIST PROFILES
-- ============================================================

CREATE POLICY "artist_profiles_select_public"
ON public.artist_profiles
FOR SELECT
USING (true);

CREATE POLICY "artist_profiles_insert_own"
ON public.artist_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "artist_profiles_update_own"
ON public.artist_profiles
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "artist_profiles_delete_own"
ON public.artist_profiles
FOR DELETE
USING (auth.uid() = user_id);


-- ============================================================
-- 34. ARTIST APPLICATIONS
-- ============================================================

CREATE POLICY "artist_apps_select_own"
ON public.artist_applications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "artist_apps_insert_own"
ON public.artist_applications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "artist_apps_update_own"
ON public.artist_applications
FOR UPDATE
USING (auth.uid() = user_id);


-- ============================================================
-- 35. VERIFIED ARTIST APPLICATIONS
-- ============================================================

CREATE POLICY "verified_apps_select_own"
ON public.verified_artist_applications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "verified_apps_insert_own"
ON public.verified_artist_applications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "verified_apps_update_own"
ON public.verified_artist_applications
FOR UPDATE
USING (auth.uid() = user_id);


-- ============================================================
-- 36. TRACKS
-- ============================================================

CREATE POLICY "tracks_select_public"
ON public.tracks
FOR SELECT
USING (
    status = 'approved'
    OR auth.uid() = uploader_id
);

CREATE POLICY "tracks_insert_own"
ON public.tracks
FOR INSERT
WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "tracks_update_own"
ON public.tracks
FOR UPDATE
USING (auth.uid() = uploader_id);

CREATE POLICY "tracks_delete_own"
ON public.tracks
FOR DELETE
USING (auth.uid() = uploader_id);


-- ============================================================
-- 37. TRACK LIKES
-- ============================================================

CREATE POLICY "track_likes_select_public"
ON public.track_likes
FOR SELECT
USING (true);

CREATE POLICY "track_likes_insert_own"
ON public.track_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "track_likes_delete_own"
ON public.track_likes
FOR DELETE
USING (auth.uid() = user_id);


-- ============================================================
-- 38. TRACK SAVES
-- ============================================================

CREATE POLICY "track_saves_select_own"
ON public.track_saves
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "track_saves_insert_own"
ON public.track_saves
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "track_saves_delete_own"
ON public.track_saves
FOR DELETE
USING (auth.uid() = user_id);


-- ============================================================
-- 39. COMMENTS
-- ============================================================

CREATE POLICY "comments_select_public"
ON public.track_comments
FOR SELECT
USING (true);

CREATE POLICY "comments_insert_own"
ON public.track_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_delete_own"
ON public.track_comments
FOR DELETE
USING (auth.uid() = user_id);


-- ============================================================
-- 40. PLAY EVENTS
-- ============================================================

CREATE POLICY "play_events_select_public"
ON public.play_events
FOR SELECT
USING (true);

CREATE POLICY "play_events_insert"
ON public.play_events
FOR INSERT
WITH CHECK (
    user_id IS NULL
    OR auth.uid() = user_id
);


-- ============================================================
-- 41. SUBMISSIONS
-- ============================================================

CREATE POLICY "submissions_select_own"
ON public.submissions
FOR SELECT
USING (
    auth.uid() = artist_id
);

CREATE POLICY "submissions_insert_own"
ON public.submissions
FOR INSERT
WITH CHECK (
    auth.uid() = artist_id
);

CREATE POLICY "submissions_update_own"
ON public.submissions
FOR UPDATE
USING (
    auth.uid() = artist_id
);


-- ============================================================
-- 42. SUBMISSION EVENTS
-- ============================================================

CREATE POLICY "submission_events_select"
ON public.submission_events
FOR SELECT
USING (true);

CREATE POLICY "submission_events_insert"
ON public.submission_events
FOR INSERT
WITH CHECK (true);


-- ============================================================
-- 43. SUBMISSION CREDITS
-- ============================================================

CREATE POLICY "submission_credits_select"
ON public.submission_credits
FOR SELECT
USING (true);

CREATE POLICY "submission_credits_insert"
ON public.submission_credits
FOR INSERT
WITH CHECK (true);


-- ============================================================
-- 44. RELEASES
-- ============================================================

CREATE POLICY "releases_select_public"
ON public.releases
FOR SELECT
USING (
    status = 'published'
    OR auth.uid() = created_by
);

CREATE POLICY "releases_insert_own"
ON public.releases
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "releases_update_own"
ON public.releases
FOR UPDATE
USING (auth.uid() = created_by);


-- ============================================================
-- 45. RELEASE TRACKS
-- ============================================================

CREATE POLICY "release_tracks_select_public"
ON public.release_tracks
FOR SELECT
USING (true);

CREATE POLICY "release_tracks_insert"
ON public.release_tracks
FOR INSERT
WITH CHECK (true);

CREATE POLICY "release_tracks_delete"
ON public.release_tracks
FOR DELETE
USING (true);


-- ============================================================
-- 46. PLAYLISTS
-- ============================================================

CREATE POLICY "playlists_select_public"
ON public.playlists
FOR SELECT
USING (
    is_public
    OR auth.uid() = owner_id
);

CREATE POLICY "playlists_insert_own"
ON public.playlists
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "playlists_update_own"
ON public.playlists
FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "playlists_delete_own"
ON public.playlists
FOR DELETE
USING (auth.uid() = owner_id);


-- ============================================================
-- 47. PLAYLIST TRACKS
-- ============================================================

CREATE POLICY "playlist_tracks_select"
ON public.playlist_tracks
FOR SELECT
USING (true);

CREATE POLICY "playlist_tracks_insert"
ON public.playlist_tracks
FOR INSERT
WITH CHECK (true);

CREATE POLICY "playlist_tracks_delete"
ON public.playlist_tracks
FOR DELETE
USING (true);


-- ============================================================
-- 48. ARTIST FOLLOWS
-- ============================================================

CREATE POLICY "artist_follows_select_public"
ON public.artist_follows
FOR SELECT
USING (true);

CREATE POLICY "artist_follows_insert_own"
ON public.artist_follows
FOR INSERT
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "artist_follows_delete_own"
ON public.artist_follows
FOR DELETE
USING (auth.uid() = follower_id);


-- ============================================================
-- 49. NOTIFICATIONS
-- ============================================================

CREATE POLICY "notifications_select_own"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_service"
ON public.notifications
FOR INSERT
WITH CHECK (true);


-- ============================================================
-- 50. ADMIN AUDIT LOG
-- ============================================================

CREATE POLICY "audit_select"
ON public.admin_audit_log
FOR SELECT
USING (true);

CREATE POLICY "audit_insert_service"
ON public.admin_audit_log
FOR INSERT
WITH CHECK (true);


-- ============================================================
-- 51. ACTIVITY EVENTS
-- ============================================================

CREATE POLICY "activity_select_public"
ON public.activity_events
FOR SELECT
USING (true);

CREATE POLICY "activity_insert_service"
ON public.activity_events
FOR INSERT
WITH CHECK (true);


-- ============================================================
-- 52. REPORTS
-- ============================================================

CREATE POLICY "reports_select_own"
ON public.reports
FOR SELECT
USING (auth.uid() = reporter_id);

CREATE POLICY "reports_insert_own"
ON public.reports
FOR INSERT
WITH CHECK (auth.uid() = reporter_id);


-- ============================================================
-- 53. SUPPORT TICKETS
-- ============================================================

CREATE POLICY "support_select_own"
ON public.support_tickets
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "support_insert_own"
ON public.support_tickets
FOR INSERT
WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 54. SEARCH HISTORY
-- ============================================================

CREATE POLICY "search_select_own"
ON public.search_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "search_insert_own"
ON public.search_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "search_delete_own"
ON public.search_history
FOR DELETE
USING (auth.uid() = user_id);


-- ============================================================
-- 55. LISTENING PROGRESS
-- ============================================================

CREATE POLICY "listening_select_own"
ON public.listening_progress
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "listening_insert_own"
ON public.listening_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "listening_update_own"
ON public.listening_progress
FOR UPDATE
USING (auth.uid() = user_id);


-- ============================================================
-- 56. PLATFORM SETTINGS
-- ============================================================

CREATE POLICY "platform_settings_select"
ON public.platform_settings
FOR SELECT
USING (true);

CREATE POLICY "platform_settings_insert"
ON public.platform_settings
FOR INSERT
WITH CHECK (true);

CREATE POLICY "platform_settings_update"
ON public.platform_settings
FOR UPDATE
USING (true);


-- ============================================================
-- 57. FINAL ANALYZE
-- ============================================================

ANALYZE public.profiles;

ANALYZE public.user_preferences;
ANALYZE public.artist_profiles;
ANALYZE public.artist_applications;
ANALYZE public.verified_artist_applications;

ANALYZE public.tracks;
ANALYZE public.track_credits;
ANALYZE public.track_likes;
ANALYZE public.track_saves;
ANALYZE public.track_comments;
ANALYZE public.play_events;

ANALYZE public.submissions;
ANALYZE public.submission_events;
ANALYZE public.submission_credits;

ANALYZE public.releases;
ANALYZE public.release_tracks;

ANALYZE public.playlists;
ANALYZE public.playlist_tracks;

ANALYZE public.artist_follows;
ANALYZE public.notifications;

ANALYZE public.admin_audit_log;
ANALYZE public.activity_events;

ANALYZE public.reports;
ANALYZE public.support_tickets;

ANALYZE public.search_history;
ANALYZE public.listening_progress;

ANALYZE public.platform_settings;


-- ============================================================
-- 58. COMMIT
-- ============================================================

COMMIT;