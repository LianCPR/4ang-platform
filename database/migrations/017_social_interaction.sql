-- ============================================================
-- 017: Phase 2.1 — Social Interaction 2.0
--
-- Adds a unified, generalised comment system (comment on tracks,
-- playlists, albums, activity posts and users) with one-level
-- threaded replies, plus a unified reaction table that works on
-- both comments and activity posts. Keeps the existing
-- track_comments table intact for backward compatibility.
--
-- Everything is additive / idempotent: CREATE TABLE IF NOT EXISTS,
-- ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS.
-- ============================================================

-- ============================================================
-- 1. SOCIAL COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.social_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,          -- track | playlist | album | post | user | artist
  target_id TEXT NOT NULL,            -- track/playlist UUID or activity_events id
  parent_id UUID REFERENCES public.social_comments(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_username TEXT NOT NULL,
  author_display_name TEXT,
  text TEXT NOT NULL,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  like_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_comments_target
  ON public.social_comments(target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS idx_social_comments_parent
  ON public.social_comments(parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_social_comments_author
  ON public.social_comments(author_username, created_at DESC);

-- ============================================================
-- 2. SOCIAL REACTIONS (unified: posts + comments)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.social_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,          -- post | comment
  target_id TEXT NOT NULL,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, username)
);

CREATE INDEX IF NOT EXISTS idx_social_reactions_target
  ON public.social_reactions(target_type, target_id);

-- ============================================================
-- 3. ACTIVITY EVENTS — add interaction counters
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_reactions ENABLE ROW LEVEL SECURITY;

-- Social comments: readable publicly (access enforcement happens in-app
-- via the backend which checks target visibility); users manage their own.
DROP POLICY IF EXISTS "social_comments_select" ON public.social_comments;
CREATE POLICY "social_comments_select" ON public.social_comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "social_comments_insert_own" ON public.social_comments;
CREATE POLICY "social_comments_insert_own" ON public.social_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "social_comments_update_own" ON public.social_comments;
CREATE POLICY "social_comments_update_own" ON public.social_comments
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "social_comments_delete_own" ON public.social_comments;
CREATE POLICY "social_comments_delete_own" ON public.social_comments
  FOR DELETE USING (auth.uid() = author_id);

-- Reactions: public reads; users manage their own reactions only.
DROP POLICY IF EXISTS "social_reactions_select" ON public.social_reactions;
CREATE POLICY "social_reactions_select" ON public.social_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "social_reactions_insert_own" ON public.social_reactions;
CREATE POLICY "social_reactions_insert_own" ON public.social_reactions
  FOR INSERT WITH CHECK (REPLACE(username, ' ', '') = (SELECT COALESCE(username, '') FROM public.profiles WHERE auth.uid() = id));

DROP POLICY IF EXISTS "social_reactions_delete_own" ON public.social_reactions;
CREATE POLICY "social_reactions_delete_own" ON public.social_reactions
  FOR DELETE USING (REPLACE(username, ' ', '') = (SELECT COALESCE(username, '') FROM public.profiles WHERE auth.uid() = id));

-- Add metadata to notifications (for deep-link context like commentId)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Backfill: migrate existing track comments into the unified system so
-- they keep appearing (counts + list) after the switch to social_comments.
INSERT INTO public.social_comments (
  id, target_type, target_id, parent_id, author_id, author_username,
  author_display_name, text, is_deleted, like_count, reply_count, created_at
)
SELECT
  tc.id,
  'track',
  tc.track_id::text,
  NULL,
  NULL::uuid,
  tc.username,
  tc.display_name,
  tc.text,
  FALSE,
  0,
  0,
  tc.created_at
FROM public.track_comments tc
WHERE NOT EXISTS (
  SELECT 1 FROM public.social_comments sc
  WHERE sc.id = tc.id
);

-- ============================================================
-- 5. TRIGGERS — keep like/reply counters accurate
-- ============================================================

-- Increment/decrement social_comments.like_count from social_reactions.
CREATE OR REPLACE FUNCTION public.sync_comment_like_count()
RETURNS TRIGGER AS $$
DECLARE v_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.target_type = 'comment' THEN
    SELECT COUNT(*) INTO v_count FROM public.social_reactions
      WHERE target_type = 'comment' AND target_id = NEW.target_id;
    UPDATE public.social_comments SET like_count = v_count WHERE id = NEW.target_id::uuid;
  ELSIF TG_OP = 'DELETE' AND OLD.target_type = 'comment' THEN
    SELECT COUNT(*) INTO v_count FROM public.social_reactions
      WHERE target_type = 'comment' AND target_id = OLD.target_id;
    UPDATE public.social_comments SET like_count = v_count WHERE id = OLD.target_id::uuid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_social_reactions_comment_count ON public.social_reactions;
CREATE TRIGGER trg_social_reactions_comment_count
  AFTER INSERT OR DELETE ON public.social_reactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_comment_like_count();

-- Keep social_comments.reply_count accurate.
CREATE OR REPLACE FUNCTION public.sync_comment_reply_count()
RETURNS TRIGGER AS $$
DECLARE v_count INTEGER;
BEGIN
  IF TG_OP IN ('INSERT','DELETE') AND COALESCE(NEW.parent_id, OLD.parent_id) IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.social_comments
      WHERE parent_id = COALESCE(NEW.parent_id, OLD.parent_id);
    UPDATE public.social_comments SET reply_count = v_count
      WHERE id = COALESCE(NEW.parent_id, OLD.parent_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_social_comments_reply_count ON public.social_comments;
CREATE TRIGGER trg_social_comments_reply_count
  AFTER INSERT OR DELETE ON public.social_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_comment_reply_count();

-- Keep activity_events.like_count accurate for post reactions.
CREATE OR REPLACE FUNCTION public.sync_post_like_count()
RETURNS TRIGGER AS $$
DECLARE v_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.target_type = 'post' THEN
    SELECT COUNT(*) INTO v_count FROM public.social_reactions
      WHERE target_type = 'post' AND target_id = NEW.target_id;
    UPDATE public.activity_events SET like_count = v_count WHERE id = NEW.target_id::uuid;
  ELSIF TG_OP = 'DELETE' AND OLD.target_type = 'post' THEN
    SELECT COUNT(*) INTO v_count FROM public.social_reactions
      WHERE target_type = 'post' AND target_id = OLD.target_id;
    UPDATE public.activity_events SET like_count = v_count WHERE id = OLD.target_id::uuid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_social_reactions_post_count ON public.social_reactions;
CREATE TRIGGER trg_social_reactions_post_count
  AFTER INSERT OR DELETE ON public.social_reactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_like_count();

-- Keep activity_events.comment_count accurate for post comments.
CREATE OR REPLACE FUNCTION public.sync_post_comment_count()
RETURNS TRIGGER AS $$
DECLARE v_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.target_type = 'post' THEN
    SELECT COUNT(*) INTO v_count FROM public.social_comments
      WHERE target_type = 'post' AND target_id = NEW.target_id AND parent_id IS NULL AND NOT is_deleted;
    UPDATE public.activity_events SET comment_count = v_count WHERE id = NEW.target_id::uuid;
  ELSIF TG_OP = 'DELETE' AND OLD.target_type = 'post' THEN
    SELECT COUNT(*) INTO v_count FROM public.social_comments
      WHERE target_type = 'post' AND target_id = OLD.target_id AND parent_id IS NULL AND NOT is_deleted;
    UPDATE public.activity_events SET comment_count = v_count WHERE id = OLD.target_id::uuid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_social_comments_post_count ON public.social_comments;
CREATE TRIGGER trg_social_comments_post_count
  AFTER INSERT OR DELETE ON public.social_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_comment_count();
