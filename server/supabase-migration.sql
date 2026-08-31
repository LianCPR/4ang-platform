-- ============================================================
-- 4ANG Supabase Migration — Private Beta
-- Run this in Supabase SQL Editor to set up your database.
-- ============================================================

-- ─── PROFILES ──────────────────────────────────────────────
-- Linked 1:1 with auth.users. Never store passwords here.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user', -- user | artist | admin
  is_restricted BOOLEAN NOT NULL DEFAULT false,
  restricted_at BIGINT,
  restricted_reason TEXT,
  restricted_by TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ─── OTP TOKENS ────────────────────────────────────────────
-- OTP verification — used by Supabase path instead of SQLite
CREATE TABLE IF NOT EXISTS otp_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target TEXT NOT NULL,
  target_type TEXT NOT NULL, -- email | phone
  code TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS idx_otp_target ON otp_tokens(target, target_type, used);

-- ─── ARTIST PROFILES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS artist_profiles (
  username TEXT PRIMARY KEY REFERENCES profiles(username),
  artist_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_filename TEXT,
  cover_filename TEXT,
  genres TEXT NOT NULL DEFAULT '[]',
  links TEXT NOT NULL DEFAULT '[]',
  verification_status TEXT NOT NULL DEFAULT 'independent',
  verification_note TEXT,
  verification_requested_at BIGINT,
  verified_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE TABLE IF NOT EXISTS artist_follows (
  follower_username TEXT NOT NULL,
  artist_username TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  PRIMARY KEY (follower_username, artist_username)
);

-- ─── TRACKS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  composer TEXT,
  description TEXT,
  release_date TEXT,
  lyrics TEXT,
  timed_lyrics TEXT,
  audio_filename TEXT NOT NULL,
  cover_filename TEXT,
  video_filename TEXT,
  genres TEXT NOT NULL DEFAULT '[]',
  uploader_username TEXT NOT NULL,
  uploader_display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  share_count INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  duration INTEGER,
  submission_id TEXT,
  isrc TEXT,
  rights_holder TEXT,
  rights_year INTEGER,
  rights_label TEXT,
  rights_record_id TEXT,
  rights_declared_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  reviewed_at BIGINT,
  reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_tracks_uploader ON tracks(uploader_username);
CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks(play_count DESC);

-- ─── TRACK CREDITS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS track_credits (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  artist_username TEXT,
  external_name TEXT,
  role TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_track_credits_track ON track_credits(track_id);

-- ─── LIKES / SAVES / COMMENTS ─────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  track_id TEXT NOT NULL,
  username TEXT NOT NULL,
  PRIMARY KEY (track_id, username)
);
CREATE TABLE IF NOT EXISTS saves (
  track_id TEXT NOT NULL,
  username TEXT NOT NULL,
  PRIMARY KEY (track_id, username)
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- ─── PLAY EVENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS play_events (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  username TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS idx_play_events_track ON play_events(track_id, created_at);
CREATE INDEX IF NOT EXISTS idx_play_events_user ON play_events(username, created_at);

-- ─── SUBMISSIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  artist_username TEXT NOT NULL,
  title TEXT NOT NULL,
  release_type TEXT NOT NULL DEFAULT 'single',
  audio_filename TEXT,
  audio_original_name TEXT,
  audio_checksum TEXT,
  cover_filename TEXT,
  video_filename TEXT,
  lyrics TEXT NOT NULL DEFAULT '',
  genres TEXT NOT NULL DEFAULT '[]',
  language TEXT,
  is_explicit BOOLEAN NOT NULL DEFAULT false,
  release_date TEXT,
  rights_confirmed BOOLEAN NOT NULL DEFAULT false,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  terms_version TEXT,
  terms_accepted_at BIGINT,
  status TEXT NOT NULL DEFAULT 'draft',
  admin_note TEXT,
  reviewed_at BIGINT,
  reviewed_by TEXT,
  published_track_id TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  submitted_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_submissions_artist ON submissions(artist_username, created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, submitted_at);

CREATE TABLE IF NOT EXISTS submission_credits (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  artist_username TEXT,
  external_name TEXT,
  role TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_submission_credits_submission ON submission_credits(submission_id);

CREATE TABLE IF NOT EXISTS submission_events (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS idx_submission_events_submission ON submission_events(submission_id, created_at);

-- ─── ADMIN ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_username TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  resolved_at BIGINT,
  resolved_by TEXT,
  resolution_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at BIGINT,
  updated_by TEXT
);

-- ─── PLAYLISTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  owner_username TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_filename TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  track_count INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists(owner_username, created_at);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  added_by TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  added_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);

-- ─── NOTIFICATIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  type TEXT NOT NULL,
  actor_username TEXT,
  target_type TEXT,
  target_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(username, read, created_at);

-- ─── ACTIVITY EVENTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  username TEXT,
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_events(username, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_target ON activity_events(target_type, target_id);

-- ─── SEARCH HISTORY ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS search_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL,
  query TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(username, created_at);

-- ─── RELEASES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS releases (
  id TEXT PRIMARY KEY,
  artist_username TEXT NOT NULL,
  title TEXT NOT NULL,
  release_type TEXT NOT NULL DEFAULT 'single',
  description TEXT NOT NULL DEFAULT '',
  cover_filename TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  release_date TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS idx_releases_artist ON releases(artist_username, created_at);

CREATE TABLE IF NOT EXISTS release_tracks (
  id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_release_tracks_release ON release_tracks(release_id, position);

-- ─── ARTIST APPLICATIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS artist_applications (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at BIGINT,
  reviewed_by TEXT,
  rejection_reason TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE TABLE IF NOT EXISTS verified_artist_applications (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  verification_doc TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at BIGINT,
  reviewed_by TEXT,
  rejection_reason TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- ─── EMAIL NOTIFICATIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS email_notifications (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  sent BOOLEAN NOT NULL DEFAULT false,
  sent_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS idx_email_notifications_user ON email_notifications(username, sent);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────
-- Enable RLS on all tables with user data
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_artist_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- ─── RLS POLICIES ─────────────────────────────────────────

-- PROFILES: public read, owner write
CREATE POLICY "Profiles are publicly readable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- TRACKS: public read for approved, owner/admin write
CREATE POLICY "Approved tracks are public" ON tracks FOR SELECT USING (status = 'approved');
CREATE POLICY "Artists can view own tracks" ON tracks FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = uploader_username)
);
CREATE POLICY "Admins can view all tracks" ON tracks FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- LIKES: owner CRUD
CREATE POLICY "Users can manage own likes" ON likes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = likes.username)
);

-- SAVES: owner CRUD
CREATE POLICY "Users can manage own saves" ON saves FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = saves.username)
);

-- COMMENTS: public read, authenticated write
CREATE POLICY "Comments are publicly readable" ON comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON comments FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = comments.username)
);

-- PLAY EVENTS: authenticated write
CREATE POLICY "Authenticated users can log plays" ON play_events FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Users can view own plays" ON play_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = play_events.username)
);

-- NOTIFICATIONS: owner read/write
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = notifications.username)
);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = notifications.username)
);

-- SEARCH HISTORY: owner CRUD
CREATE POLICY "Users can manage own search history" ON search_history FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = search_history.username)
);

-- ACTIVITY EVENTS: authenticated write
CREATE POLICY "Authenticated users can log activities" ON activity_events FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- PLAYLISTS: public read for public, owner CRUD
CREATE POLICY "Public playlists are readable" ON playlists FOR SELECT USING (is_public = true);
CREATE POLICY "Users can view own playlists" ON playlists FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = playlists.owner_username)
);
CREATE POLICY "Authenticated users can create playlists" ON playlists FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Users can update own playlists" ON playlists FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = playlists.owner_username)
);
CREATE POLICY "Users can delete own playlists" ON playlists FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = playlists.owner_username)
);

-- PLAYLIST TRACKS: follow playlist ownership
CREATE POLICY "Playlist tracks follow playlist visibility" ON playlist_tracks FOR SELECT USING (
  EXISTS (SELECT 1 FROM playlists p WHERE p.id = playlist_tracks.playlist_id AND (p.is_public = true OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = p.owner_username)))
);
CREATE POLICY "Playlist owners can manage tracks" ON playlist_tracks FOR ALL USING (
  EXISTS (SELECT 1 FROM playlists p WHERE p.id = playlist_tracks.playlist_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = p.owner_username))
);

-- SUBMISSIONS: artist view own, admin view all
CREATE POLICY "Artists can view own submissions" ON submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = submissions.artist_username)
);
CREATE POLICY "Admins can view all submissions" ON submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Artists can create submissions" ON submissions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = submissions.artist_username)
);
CREATE POLICY "Artists can update own submissions" ON submissions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = submissions.artist_username)
);

-- OTP TOKENS: service-role only (backend manages)
CREATE POLICY "Service role manages OTP tokens" ON otp_tokens FOR ALL USING (true) WITH CHECK (true);

-- REPORTS: authenticated create, owner view
CREATE POLICY "Authenticated users can create reports" ON reports FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Users can view own reports" ON reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = reports.reporter_username)
);
CREATE POLICY "Admins can view all reports" ON reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ADMIN AUDIT LOG: admin only
CREATE POLICY "Admins can view audit log" ON admin_audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- RELEASES: owner CRUD, public read for published
CREATE POLICY "Published releases are public" ON releases FOR SELECT USING (status = 'published');
CREATE POLICY "Artists can view own releases" ON releases FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = releases.artist_username)
);

-- PLATFORM SETTINGS: public read
CREATE POLICY "Settings are publicly readable" ON platform_settings FOR SELECT USING (true);
