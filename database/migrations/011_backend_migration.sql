-- ============================================================
-- 011: Backend SQLite → Supabase PostgreSQL Migration
-- Adds missing tables/columns needed by the Express backend.
-- ============================================================

-- ─── 1. OTP TOKENS ──────────────────────────────────────
-- Server-side OTP storage for legacy auth path.
CREATE TABLE IF NOT EXISTS public.otp_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target TEXT NOT NULL,
  target_type TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_target ON public.otp_tokens(target, target_type, used);

-- ─── 2. ARTIST APPLICATIONS — add username column ───────
-- Backend stores username for display; Supabase schema only had user_id.
DO $$ BEGIN
  ALTER TABLE public.artist_applications ADD COLUMN IF NOT EXISTS username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 3. VERIFIED ARTIST APPLICATIONS — add username ─────
DO $$ BEGIN
  ALTER TABLE public.verified_artist_applications ADD COLUMN IF NOT EXISTS username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 4. PROFILES — add email column for legacy compat ───
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 5. TRACKS — add missing columns ────────────────────
DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS timed_lyrics JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS audio_duration REAL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS isrc TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS rights_holder TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS rights_year INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS rights_label TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS rights_record_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS rights_declared_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 6. SUBMISSIONS — add missing columns ───────────────
DO $$ BEGIN
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS audio_original_name TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS audio_checksum TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS video_path TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 7. ADMIN AUDIT LOG — allow null actor_id for system actions ──
-- Backend inserts actor_username (text) not actor_id.
DO $$ BEGIN
  ALTER TABLE public.admin_audit_log ALTER COLUMN actor_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS actor_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 8. NOTIFICATIONS — add username column ─────────────
-- Backend uses username for lookups.
DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_type TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 9. ARTIST FOLLOWS — add username columns ──────────
DO $$ BEGIN
  ALTER TABLE public.artist_follows ADD COLUMN IF NOT EXISTS follower_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.artist_follows ADD COLUMN IF NOT EXISTS artist_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 10. TRACK LIKES — add username column ──────────────
DO $$ BEGIN
  ALTER TABLE public.track_likes ADD COLUMN IF NOT EXISTS username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 11. TRACK SAVES — add username column ──────────────
DO $$ BEGIN
  ALTER TABLE public.track_saves ADD COLUMN IF NOT EXISTS username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 12. TRACK COMMENTS — add username columns ──────────
DO $$ BEGIN
  ALTER TABLE public.track_comments ADD COLUMN IF NOT EXISTS username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.track_comments ADD COLUMN IF NOT EXISTS display_name TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 13. PLAY EVENTS — add username column ──────────────
DO $$ BEGIN
  ALTER TABLE public.play_events ADD COLUMN IF NOT EXISTS username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 14. PLAYLISTS — add owner_username column ──────────
DO $$ BEGIN
  ALTER TABLE public.playlists ADD COLUMN IF NOT EXISTS owner_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 15. PLAYLIST TRACKS — add added_by_username column ─
DO $$ BEGIN
  ALTER TABLE public.playlist_tracks ADD COLUMN IF NOT EXISTS added_by_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 16. SUBMISSION EVENTS — add actor_username column ──
DO $$ BEGIN
  ALTER TABLE public.submission_events ADD COLUMN IF NOT EXISTS actor_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 17. SUBMISSION CREDITS — add artist_username column ─
DO $$ BEGIN
  ALTER TABLE public.submission_credits ADD COLUMN IF NOT EXISTS artist_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 18. TRACK CREDITS — add artist_username column ─────
DO $$ BEGIN
  ALTER TABLE public.track_credits ADD COLUMN IF NOT EXISTS artist_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 19. RELEASES — add created_by_username column ──────
DO $$ BEGIN
  ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS created_by_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS reviewed_by_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 20. RELEASES — add slug column ─────────────────────
DO $$ BEGIN
  ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS slug TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 21. REPORTS — add reporter_username column ─────────
DO $$ BEGIN
  ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reporter_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved_by_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 22. LISTENING PROGRESS — add username column ───────
DO $$ BEGIN
  ALTER TABLE public.listening_progress ADD COLUMN IF NOT EXISTS username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 23. ACTIVITY EVENTS — add username column ──────────
DO $$ BEGIN
  ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 24. SEARCH HISTORY — add username column ───────────
DO $$ BEGIN
  ALTER TABLE public.search_history ADD COLUMN IF NOT EXISTS username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 25. PLATFORM SETTINGS — add updated_by_username ────
DO $$ BEGIN
  ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS updated_by_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 26. TRACKS — add uploader_username column ──────────
DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS uploader_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS uploader_display_name TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 27. TRACKS — add submission_id column if missing ───
DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS submission_id UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 28. SUBMISSIONS — add artist_username column ───────
DO $$ BEGIN
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS artist_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 29. SUBMISSIONS — add published_track_id ──────────
DO $$ BEGIN
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS published_track_id UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 30. INDEXES for username-based lookups ─────────────
CREATE INDEX IF NOT EXISTS idx_artist_apps_username ON public.artist_applications(username);
CREATE INDEX IF NOT EXISTS idx_verified_apps_username ON public.verified_artist_applications(username);
CREATE INDEX IF NOT EXISTS idx_follows_follower_uname ON public.artist_follows(follower_username);
CREATE INDEX IF NOT EXISTS idx_follows_artist_uname ON public.artist_follows(artist_username);
CREATE INDEX IF NOT EXISTS idx_track_likes_username ON public.track_likes(username);
CREATE INDEX IF NOT EXISTS idx_track_saves_username ON public.track_saves(username);
CREATE INDEX IF NOT EXISTS idx_track_comments_username ON public.track_comments(username);
CREATE INDEX IF NOT EXISTS idx_play_events_username ON public.play_events(username);
CREATE INDEX IF NOT EXISTS idx_playlists_owner_uname ON public.playlists(owner_username);
CREATE INDEX IF NOT EXISTS idx_notifications_username ON public.notifications(username);
CREATE INDEX IF NOT EXISTS idx_tracks_uploader_uname ON public.tracks(uploader_username);
CREATE INDEX IF NOT EXISTS idx_submissions_artist_uname ON public.submissions(artist_username);
CREATE INDEX IF NOT EXISTS idx_activity_username ON public.activity_events(username);
CREATE INDEX IF NOT EXISTS idx_listening_progress_username ON public.listening_progress(username);
CREATE INDEX IF NOT EXISTS idx_search_history_username ON public.search_history(username);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_uname ON public.reports(reporter_username);
