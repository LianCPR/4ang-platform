-- ============================================================
-- 012: Catch-up Migration
-- Creates missing tables and adds missing columns that were
-- defined in earlier migrations (001-011) but never applied.
-- All statements use IF NOT EXISTS for safe re-runnability.
-- ============================================================

-- ─── 1. CREATE MISSING TABLES ─────────────────────────────

-- track_likes (from 003_music.sql)
CREATE TABLE IF NOT EXISTS public.track_likes (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  username TEXT,
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_track_likes_track ON public.track_likes(track_id);
CREATE INDEX IF NOT EXISTS idx_track_likes_username ON public.track_likes(username);

-- track_saves (from 003_music.sql)
CREATE TABLE IF NOT EXISTS public.track_saves (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  username TEXT,
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_track_saves_track ON public.track_saves(track_id);
CREATE INDEX IF NOT EXISTS idx_track_saves_username ON public.track_saves(username);

-- track_comments (from 003_music.sql)
CREATE TABLE IF NOT EXISTS public.track_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  username TEXT,
  display_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_track_comments_track ON public.track_comments(track_id, created_at);
CREATE INDEX IF NOT EXISTS idx_track_comments_username ON public.track_comments(username);

-- ─── 2. ENABLE RLS ON NEW TABLES ──────────────────────────

ALTER TABLE public.track_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for track_likes
DO $$ BEGIN
  CREATE POLICY "track_likes_select_public" ON public.track_likes
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "track_likes_insert_own" ON public.track_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "track_likes_delete_own" ON public.track_likes
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS policies for track_saves
DO $$ BEGIN
  CREATE POLICY "track_saves_select_own" ON public.track_saves
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "track_saves_insert_own" ON public.track_saves
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "track_saves_delete_own" ON public.track_saves
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS policies for track_comments
DO $$ BEGIN
  CREATE POLICY "comments_select_public" ON public.track_comments
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "comments_insert_own" ON public.track_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "comments_delete_own" ON public.track_comments
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. ADD MISSING COLUMNS ───────────────────────────────

-- profiles.auth_provider
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- tracks.audio_duration
DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS audio_duration REAL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- tracks.updated_at
DO $$ BEGIN
  ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- releases.created_by_username
DO $$ BEGIN
  ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS created_by_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS reviewed_by_username TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS slug TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
