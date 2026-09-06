-- ═══════════════════════════════════════════════════════════════════════
-- 019 — SOCIAL DISCOVERY 2.0 (Phase 2.3)
-- No new source-of-truth tables: every signal reuses existing data
-- (activity_events, user_follows, artist_follows, track_likes,
-- play_events, playlists, rooms). This migration only adds targeted
-- indexes for the batched network queries performed by the discovery
-- endpoints. Everything is additive and idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- Network activity timeline: "friends are listening", circle trending,
-- shared-with-me lookups.
CREATE INDEX IF NOT EXISTS idx_activity_events_user_time
  ON public.activity_events (username, created_at DESC);

-- By event type + time: circle-wide trending aggregations.
CREATE INDEX IF NOT EXISTS idx_activity_events_type_time
  ON public.activity_events (event_type, created_at DESC);

-- Follow lookups used to build the "network" each request:
--   feed of followed users, mutual-follow detection.
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id_time
  ON public.user_follows (following_id, created_at DESC);

-- Public playlist discovery from the network.
CREATE INDEX IF NOT EXISTS idx_playlists_public_owner
  ON public.playlists (is_public, owner_username, created_at DESC);

-- Artist follows by follower (network → artists they follow).
CREATE INDEX IF NOT EXISTS idx_artist_follows_follower_time
  ON public.artist_follows (follower_username, created_at DESC);

-- Track likes by user (taste signals for people/taste discovery).
CREATE INDEX IF NOT EXISTS idx_track_likes_username_time
  ON public.track_likes (username, created_at DESC);