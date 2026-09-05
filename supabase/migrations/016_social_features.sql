-- Migration 016: Social Music 1.0
-- user_follows table + activity_events public read

-- User-to-user follows
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_username TEXT NOT NULL,
  following_username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_username ON user_follows(follower_username);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_username ON user_follows(following_username);

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- Users can read follows involving themselves
CREATE POLICY "Users can read own follows"
  ON user_follows FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- Users can follow others
CREATE POLICY "Users can follow"
  ON user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow"
  ON user_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Make activity_events readable by all authenticated users (for feed)
DROP POLICY IF EXISTS "Users can read own follows" ON activity_events;
DROP POLICY IF EXISTS "Users can read own activity" ON activity_events;
DROP POLICY IF EXISTS "Admins can read all activity" ON activity_events;

CREATE POLICY "Authenticated users can read activity"
  ON activity_events FOR SELECT
  USING (true);

-- Keep insert restricted
DROP POLICY IF EXISTS "Authenticated users can insert activity" ON activity_events;
CREATE POLICY "Authenticated users can insert activity"
  ON activity_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
