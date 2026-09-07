-- ============================================================
-- 020: Phase 2.4 — Artist Social 2.0
--
-- Adds an official artist_posts store: plain-text posts and music
-- posts (track / release / playlist), including auto-generated
-- release announcements. Adds an artist-curated pinned release on
-- artist_profiles. Comments and reactions REUSE the Phase 2.1
-- unified system via target_type = 'artist_post'. Feed visibility
-- (ARTIST_POSTED activity events), release-announcement automation
-- and follower notifications are handled by the Node backend.
--
-- Everything is additive / idempotent.
-- ============================================================

-- ============================================================
-- 1. ARTIST POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.artist_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owning artist account. artist_id follows the artist_follows
    -- convention (references profiles), artist_username is the
    -- artist_profiles.username (unique).
    artist_id UUID
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,
    artist_username TEXT NOT NULL,

    post_type TEXT NOT NULL DEFAULT 'post'
        CHECK (post_type IN ('post', 'release_announcement')),

    -- At most ONE music attachment.
    music_type TEXT
        CHECK (music_type IN ('track', 'release', 'playlist')),
    track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
    release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL,
    playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL,

    body TEXT,
    status TEXT NOT NULL DEFAULT 'published'
        CHECK (status IN ('draft', 'published', 'hidden', 'deleted')),
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    edited_at TIMESTAMPTZ,
    view_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Max body length (spec 2.4, 500 chars).
    CHECK (char_length(body) <= 500),
    -- A plain text post must have a non-empty body.
    CHECK (
        post_type <> 'post'
        OR music_type IS NOT NULL
        OR (body IS NOT NULL AND char_length(body) > 0)
    ),
    -- Exactly zero or one valid music attachment.
    CHECK (
        (music_type IS NULL AND track_id IS NULL AND release_id IS NULL AND playlist_id IS NULL)
        OR (music_type = 'track' AND track_id IS NOT NULL AND release_id IS NULL AND playlist_id IS NULL)
        OR (music_type = 'release' AND release_id IS NOT NULL AND track_id IS NULL AND playlist_id IS NULL)
        OR (music_type = 'playlist' AND playlist_id IS NOT NULL AND track_id IS NULL AND release_id IS NULL)
    ),
    -- Release announcements always reference a release.
    CHECK (post_type <> 'release_announcement' OR release_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_artist_posts_artist
    ON public.artist_posts(artist_username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artist_posts_feed
    ON public.artist_posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artist_posts_release
    ON public.artist_posts(release_id);

-- ============================================================
-- 2. PINNED RELEASE (artist-curated showcase)
-- ============================================================
ALTER TABLE public.artist_profiles
    ADD COLUMN IF NOT EXISTS pinned_release_id UUID
    REFERENCES public.releases(id)
    ON DELETE SET NULL;

-- ============================================================
-- 3. RLS — public reads; artist-only writes (identity enforced)
-- ============================================================
ALTER TABLE public.artist_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist_posts_select" ON public.artist_posts;
CREATE POLICY "artist_posts_select" ON public.artist_posts
  FOR SELECT USING (true);

-- The authenticated user must be the post's artist identity.
DROP POLICY IF EXISTS "artist_posts_insert_own" ON public.artist_posts;
CREATE POLICY "artist_posts_insert_own" ON public.artist_posts
  FOR INSERT WITH CHECK (
    artist_username =
      (SELECT COALESCE(username, '') FROM public.profiles WHERE auth.uid() = id)
    AND EXISTS (
      SELECT 1 FROM public.artist_profiles ap
      WHERE ap.username = artist_username
    )
  );

DROP POLICY IF EXISTS "artist_posts_update_own" ON public.artist_posts;
CREATE POLICY "artist_posts_update_own" ON public.artist_posts
  FOR UPDATE USING (
    (SELECT COALESCE(username, '') FROM public.profiles WHERE auth.uid() = id) = artist_username
  );

DROP POLICY IF EXISTS "artist_posts_delete_own" ON public.artist_posts;
CREATE POLICY "artist_posts_delete_own" ON public.artist_posts
  FOR DELETE USING (
    (SELECT COALESCE(username, '') FROM public.profiles WHERE auth.uid() = id) = artist_username
  );

-- ============================================================
-- 4. COUNTER SYNC TRIGGERS
-- Reactions/comments on an artist post update its counters.
-- ============================================================

-- like_count from social_reactions (target_type = 'artist_post').
CREATE OR REPLACE FUNCTION public.sync_artist_post_like_count()
RETURNS TRIGGER AS $$
DECLARE v_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND COALESCE(NEW.target_type, '') = 'artist_post' THEN
    SELECT COUNT(*) INTO v_count FROM public.social_reactions
      WHERE target_type = 'artist_post' AND target_id = NEW.target_id;
    UPDATE public.artist_posts SET like_count = v_count WHERE id = NEW.target_id::uuid;
  ELSIF TG_OP = 'DELETE' AND COALESCE(OLD.target_type, '') = 'artist_post' THEN
    SELECT COUNT(*) INTO v_count FROM public.social_reactions
      WHERE target_type = 'artist_post' AND target_id = OLD.target_id;
    UPDATE public.artist_posts SET like_count = v_count WHERE id = OLD.target_id::uuid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artist_posts_like_count ON public.social_reactions;
CREATE TRIGGER trg_artist_posts_like_count
  AFTER INSERT OR DELETE ON public.social_reactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_artist_post_like_count();

-- comment_count from social_comments (top-level, not deleted).
CREATE OR REPLACE FUNCTION public.sync_artist_post_comment_count()
RETURNS TRIGGER AS $$
DECLARE v_count INTEGER;
DECLARE v_target_type TEXT;
DECLARE v_target_id TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_target_type := COALESCE(NEW.target_type, '');
    v_target_id := NEW.target_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_target_type := COALESCE(OLD.target_type, '');
    v_target_id := OLD.target_id;
  END IF;
  IF v_target_type = 'artist_post' THEN
    SELECT COUNT(*) INTO v_count FROM public.social_comments
      WHERE target_type = 'artist_post' AND target_id = v_target_id
        AND parent_id IS NULL AND NOT is_deleted;
    UPDATE public.artist_posts SET comment_count = v_count WHERE id = v_target_id::uuid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artist_posts_comment_count ON public.social_comments;
CREATE TRIGGER trg_artist_posts_comment_count
  AFTER INSERT OR DELETE ON public.social_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_artist_post_comment_count();