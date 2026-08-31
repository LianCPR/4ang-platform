-- ============================================================
-- 4ANG RLS POLICIES
-- Run AFTER 001_clean_schema.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_artist_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user is artist
CREATE OR REPLACE FUNCTION is_artist()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'artist')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── PROFILES ──────────────────────────────────────────────
-- Public: anyone can read profiles
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT USING (true);

-- User: can update own profile (limited columns)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- User: can insert own profile (signup trigger)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ─── USER PREFERENCES ──────────────────────────────────────
CREATE POLICY "Users can read own preferences"
  ON user_preferences FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── ARTIST PROFILES ───────────────────────────────────────
-- Public: anyone can read artist profiles
CREATE POLICY "Artist profiles are publicly readable"
  ON artist_profiles FOR SELECT USING (true);

-- Artist: can update own artist profile
CREATE POLICY "Artists can update own profile"
  ON artist_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Artists can insert own profile"
  ON artist_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── ARTIST FOLLOWS ────────────────────────────────────────
-- Public: anyone can see who follows whom
CREATE POLICY "Follows are publicly readable"
  ON artist_follows FOR SELECT USING (true);

-- User: can follow/unfollow
CREATE POLICY "Users can follow artists"
  ON artist_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow artists"
  ON artist_follows FOR DELETE USING (auth.uid() = follower_id);

-- ─── TRACKS ────────────────────────────────────────────────
-- Public: approved tracks are readable by anyone
CREATE POLICY "Approved tracks are publicly readable"
  ON tracks FOR SELECT USING (status = 'approved');

-- Artist: can read own tracks (any status)
CREATE POLICY "Artists can read own tracks"
  ON tracks FOR SELECT USING (auth.uid() = uploader_id);

-- Artist: can insert own tracks
CREATE POLICY "Artists can insert own tracks"
  ON tracks FOR INSERT WITH CHECK (auth.uid() = uploader_id);

-- Artist: can update own tracks
CREATE POLICY "Artists can update own tracks"
  ON tracks FOR UPDATE USING (auth.uid() = uploader_id);

-- Admin: full access
CREATE POLICY "Admins have full access to tracks"
  ON tracks FOR ALL USING (is_admin());

-- ─── TRACK CREDITS ─────────────────────────────────────────
-- Public: readable with tracks
CREATE POLICY "Track credits are publicly readable"
  ON track_credits FOR SELECT USING (true);

CREATE POLICY "Track owners can manage credits"
  ON track_credits FOR ALL USING (
    EXISTS (SELECT 1 FROM tracks WHERE id = track_id AND uploader_id = auth.uid())
  );

-- ─── TRACK LIKES ───────────────────────────────────────────
-- User: can read own likes
CREATE POLICY "Users can read own likes"
  ON track_likes FOR SELECT USING (auth.uid() = user_id);

-- User: can like/unlike
CREATE POLICY "Users can like tracks"
  ON track_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike tracks"
  ON track_likes FOR DELETE USING (auth.uid() = user_id);

-- Public: count likes per track (for display)
-- NOTE: This requires a helper view or function since RLS doesn't
-- easily expose "count of other users' likes".
-- We'll handle like counts in the API layer instead.

-- ─── TRACK SAVES ───────────────────────────────────────────
CREATE POLICY "Users can read own saves"
  ON track_saves FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save tracks"
  ON track_saves FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave tracks"
  ON track_saves FOR DELETE USING (auth.uid() = user_id);

-- ─── TRACK COMMENTS ────────────────────────────────────────
-- Public: anyone can read comments
CREATE POLICY "Comments are publicly readable"
  ON track_comments FOR SELECT USING (true);

-- User: can insert comments
CREATE POLICY "Users can post comments"
  ON track_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User: can delete own comments
CREATE POLICY "Users can delete own comments"
  ON track_comments FOR DELETE USING (auth.uid() = user_id);

-- Admin: can delete any comment
CREATE POLICY "Admins can delete any comment"
  ON track_comments FOR DELETE USING (is_admin());

-- ─── PLAY EVENTS ───────────────────────────────────────────
-- User: can insert own play events
CREATE POLICY "Users can log own plays"
  ON play_events FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- User: can read own play events
CREATE POLICY "Users can read own play events"
  ON play_events FOR SELECT USING (auth.uid() = user_id);

-- Admin: can read all play events
CREATE POLICY "Admins can read all play events"
  ON play_events FOR SELECT USING (is_admin());

-- ─── LISTENING PROGRESS ────────────────────────────────────
CREATE POLICY "Users can manage own listening progress"
  ON listening_progress FOR ALL USING (auth.uid() = user_id);

-- ─── ACTIVITY EVENTS ───────────────────────────────────────
CREATE POLICY "Users can insert own activity"
  ON activity_events FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can read own activity"
  ON activity_events FOR SELECT USING (auth.uid() = user_id);

-- Admin: can read all activity
CREATE POLICY "Admins can read all activity"
  ON activity_events FOR SELECT USING (is_admin());

-- ─── PLAYLISTS ─────────────────────────────────────────────
-- Public playlists: readable by anyone
CREATE POLICY "Public playlists are readable"
  ON playlists FOR SELECT USING (is_public = true);

-- Owner: can read own playlists (including private)
CREATE POLICY "Owners can read own playlists"
  ON playlists FOR SELECT USING (auth.uid() = owner_id);

-- Owner: can manage own playlists
CREATE POLICY "Owners can insert playlists"
  ON playlists FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own playlists"
  ON playlists FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete own playlists"
  ON playlists FOR DELETE USING (auth.uid() = owner_id);

-- ─── PLAYLIST TRACKS ───────────────────────────────────────
-- Read: if parent playlist is accessible
CREATE POLICY "Playlist tracks readable if playlist is accessible"
  ON playlist_tracks FOR SELECT USING (
    EXISTS (SELECT 1 FROM playlists WHERE id = playlist_id AND (is_public = true OR owner_id = auth.uid()))
  );

CREATE POLICY "Playlist owners can manage tracks"
  ON playlist_tracks FOR ALL USING (
    EXISTS (SELECT 1 FROM playlists WHERE id = playlist_id AND owner_id = auth.uid())
  );

-- ─── RELEASES ──────────────────────────────────────────────
-- Public: published releases
CREATE POLICY "Published releases are publicly readable"
  ON releases FOR SELECT USING (status = 'published');

-- Creator: can read own releases
CREATE POLICY "Creators can read own releases"
  ON releases FOR SELECT USING (auth.uid() = created_by);

-- Creator: can insert/update own drafts
CREATE POLICY "Creators can manage own releases"
  ON releases FOR ALL USING (auth.uid() = created_by);

-- Admin: full access
CREATE POLICY "Admins have full access to releases"
  ON releases FOR ALL USING (is_admin());

-- ─── RELEASE TRACKS ────────────────────────────────────────
CREATE POLICY "Release tracks are publicly readable"
  ON release_tracks FOR SELECT USING (true);

CREATE POLICY "Release owners can manage tracks"
  ON release_tracks FOR ALL USING (
    EXISTS (SELECT 1 FROM releases WHERE id = release_id AND created_by = auth.uid())
  );

-- ─── SUBMISSIONS ───────────────────────────────────────────
-- Artist: can read own submissions
CREATE POLICY "Artists can read own submissions"
  ON submissions FOR SELECT USING (auth.uid() = artist_id);

-- Artist: can insert/update own drafts
CREATE POLICY "Artists can manage own submissions"
  ON submissions FOR ALL USING (auth.uid() = artist_id);

-- Admin: full access
CREATE POLICY "Admins have full access to submissions"
  ON submissions FOR ALL USING (is_admin());

-- ─── SUBMISSION CREDITS ────────────────────────────────────
CREATE POLICY "Submission credits readable if submission is accessible"
  ON submission_credits FOR SELECT USING (
    EXISTS (SELECT 1 FROM submissions WHERE id = submission_id AND (artist_id = auth.uid() OR is_admin()))
  );

CREATE POLICY "Submission owners can manage credits"
  ON submission_credits FOR ALL USING (
    EXISTS (SELECT 1 FROM submissions WHERE id = submission_id AND artist_id = auth.uid())
  );

-- ─── SUBMISSION EVENTS ─────────────────────────────────────
CREATE POLICY "Submission events readable if submission is accessible"
  ON submission_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM submissions WHERE id = submission_id AND (artist_id = auth.uid() OR is_admin()))
  );

-- ─── ARTIST APPLICATIONS ───────────────────────────────────
CREATE POLICY "Users can read own applications"
  ON artist_applications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications"
  ON artist_applications FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins have full access to applications"
  ON artist_applications FOR ALL USING (is_admin());

-- ─── VERIFIED ARTIST APPLICATIONS ──────────────────────────
CREATE POLICY "Users can read own verified applications"
  ON verified_artist_applications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verified applications"
  ON verified_artist_applications FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins have full access to verified applications"
  ON verified_artist_applications FOR ALL USING (is_admin());

-- ─── NOTIFICATIONS ─────────────────────────────────────────
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications (mark read)"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ─── SEARCH HISTORY ────────────────────────────────────────
CREATE POLICY "Users can read own search history"
  ON search_history FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own search history"
  ON search_history FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own search history"
  ON search_history FOR DELETE USING (auth.uid() = user_id);

-- ─── REPORTS ───────────────────────────────────────────────
CREATE POLICY "Users can insert reports"
  ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can read own reports"
  ON reports FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Admins have full access to reports"
  ON reports FOR ALL USING (is_admin());

-- ─── ADMIN AUDIT LOG ───────────────────────────────────────
-- Append-only, admin-readable
CREATE POLICY "Admins can read audit log"
  ON admin_audit_log FOR SELECT USING (is_admin());

CREATE POLICY "System can insert audit entries"
  ON admin_audit_log FOR INSERT WITH CHECK (true);

-- ─── PLATFORM SETTINGS ─────────────────────────────────────
-- Public: anyone can read settings
CREATE POLICY "Settings are publicly readable"
  ON platform_settings FOR SELECT USING (true);

-- Admin: can update settings
CREATE POLICY "Admins can update settings"
  ON platform_settings FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can insert settings"
  ON platform_settings FOR INSERT WITH CHECK (is_admin());

-- ─── SUPPORT TICKETS ───────────────────────────────────────
CREATE POLICY "Users can read own tickets"
  ON support_tickets FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tickets"
  ON support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins have full access to tickets"
  ON support_tickets FOR ALL USING (is_admin());

-- ─── EMAIL NOTIFICATIONS ───────────────────────────────────
-- Admin-only
CREATE POLICY "Admins can read email notifications"
  ON email_notifications FOR SELECT USING (is_admin());

CREATE POLICY "System can insert email notifications"
  ON email_notifications FOR INSERT WITH CHECK (true);

-- ─── DONE ──────────────────────────────────────────────────
-- 28 tables have RLS enabled with policies.
