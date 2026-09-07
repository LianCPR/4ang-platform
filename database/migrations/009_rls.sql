-- ============================================================
-- 009: Row Level Security (RLS)
-- Every table gets RLS enabled with clear policies.
-- ============================================================

-- ============================================================
-- PROFILES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read public profiles
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (TRUE);

-- Users can update own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert own profile (handled by trigger, but safe to allow)
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- USER PREFERENCES
-- ============================================================
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "preferences_select_own" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "preferences_insert_own" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "preferences_update_own" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- ARTIST PROFILES
-- ============================================================
ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read artist profiles
CREATE POLICY "artist_profiles_select_public" ON public.artist_profiles
  FOR SELECT USING (TRUE);

-- Artists can update own profile
CREATE POLICY "artist_profiles_update_own" ON public.artist_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Artists can insert own profile
CREATE POLICY "artist_profiles_insert_own" ON public.artist_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ARTIST FOLLOWS
-- ============================================================
ALTER TABLE public.artist_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artist_follows_select_public" ON public.artist_follows
  FOR SELECT USING (TRUE);

CREATE POLICY "artist_follows_insert_own" ON public.artist_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "artist_follows_delete_own" ON public.artist_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ============================================================
-- TRACKS (public reads, owner/admin writes)
-- ============================================================
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved tracks
CREATE POLICY "tracks_select_public" ON public.tracks
  FOR SELECT USING (status = 'approved');

-- Track owners can read their own tracks (any status)
CREATE POLICY "tracks_select_own" ON public.tracks
  FOR SELECT USING (auth.uid() = uploader_id);

-- ============================================================
-- TRACK CREDITS
-- ============================================================
ALTER TABLE public.track_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "track_credits_select_public" ON public.track_credits
  FOR SELECT USING (TRUE);

-- ============================================================
-- TRACK LIKES
-- ============================================================
ALTER TABLE public.track_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "track_likes_select_public" ON public.track_likes
  FOR SELECT USING (TRUE);

CREATE POLICY "track_likes_insert_own" ON public.track_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "track_likes_delete_own" ON public.track_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TRACK SAVES
-- ============================================================
ALTER TABLE public.track_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "track_saves_select_own" ON public.track_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "track_saves_insert_own" ON public.track_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "track_saves_delete_own" ON public.track_saves
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TRACK COMMENTS
-- ============================================================
ALTER TABLE public.track_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_public" ON public.track_comments
  FOR SELECT USING (TRUE);

CREATE POLICY "comments_insert_own" ON public.track_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_delete_own" ON public.track_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- PLAY EVENTS
-- ============================================================
ALTER TABLE public.play_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "play_events_select_own" ON public.play_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "play_events_insert_own" ON public.play_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- PLAYLISTS
-- ============================================================
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- Public playlists readable by anyone
CREATE POLICY "playlists_select_public" ON public.playlists
  FOR SELECT USING (is_public = TRUE OR auth.uid() = owner_id);

CREATE POLICY "playlists_insert_own" ON public.playlists
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "playlists_update_own" ON public.playlists
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "playlists_delete_own" ON public.playlists
  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================
-- PLAYLIST TRACKS
-- ============================================================
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playlist_tracks_select_public" ON public.playlist_tracks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND (playlists.is_public = TRUE OR playlists.owner_id = auth.uid())
    )
  );

CREATE POLICY "playlist_tracks_insert_own" ON public.playlist_tracks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.owner_id = auth.uid()
    )
  );

CREATE POLICY "playlist_tracks_delete_own" ON public.playlist_tracks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.owner_id = auth.uid()
    )
  );

CREATE POLICY "playlist_tracks_update_own" ON public.playlist_tracks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.owner_id = auth.uid()
    )
  );

-- ============================================================
-- SUBMISSIONS (owner + admin only)
-- ============================================================
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Artists can read own submissions
CREATE POLICY "submissions_select_own" ON public.submissions
  FOR SELECT USING (auth.uid() = artist_id);

-- Artists can create submissions
CREATE POLICY "submissions_insert_own" ON public.submissions
  FOR INSERT WITH CHECK (auth.uid() = artist_id);

-- Artists can update own draft submissions
CREATE POLICY "submissions_update_own" ON public.submissions
  FOR UPDATE USING (auth.uid() = artist_id AND status IN ('draft', 'changes_requested'));

-- Artists can delete own draft submissions
CREATE POLICY "submissions_delete_own" ON public.submissions
  FOR DELETE USING (auth.uid() = artist_id AND status = 'draft');

-- ============================================================
-- SUBMISSION CREDITS
-- ============================================================
ALTER TABLE public.submission_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submission_credits_select_own" ON public.submission_credits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions
      WHERE submissions.id = submission_credits.submission_id
      AND submissions.artist_id = auth.uid()
    )
  );

CREATE POLICY "submission_credits_insert_own" ON public.submission_credits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions
      WHERE submissions.id = submission_credits.submission_id
      AND submissions.artist_id = auth.uid()
    )
  );

CREATE POLICY "submission_credits_delete_own" ON public.submission_credits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.submissions
      WHERE submissions.id = submission_credits.submission_id
      AND submissions.artist_id = auth.uid()
    )
  );

-- ============================================================
-- SUBMISSION EVENTS (read-only for artist)
-- ============================================================
ALTER TABLE public.submission_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submission_events_select_own" ON public.submission_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions
      WHERE submissions.id = submission_events.submission_id
      AND submissions.artist_id = auth.uid()
    )
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- SEARCH HISTORY
-- ============================================================
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "search_history_select_own" ON public.search_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "search_history_insert_own" ON public.search_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "search_history_delete_own" ON public.search_history
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- ACTIVITY EVENTS (own only)
-- ============================================================
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_select_own" ON public.activity_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "activity_insert_own" ON public.activity_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- PLATFORM SETTINGS (admin only via Edge Function)
-- ============================================================
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Public read for some settings (service-level)
CREATE POLICY "settings_select_public" ON public.platform_settings
  FOR SELECT USING (TRUE);

-- ============================================================
-- ADMIN AUDIT LOG (admin only via Edge Function)
-- ============================================================
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- No direct client access — admin operations go through Edge Functions
-- with service role key

-- ============================================================
-- REPORTS
-- ============================================================
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Users can read own reports
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);
