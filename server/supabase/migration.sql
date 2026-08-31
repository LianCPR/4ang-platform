-- ============================================================
-- 4ANG Supabase Migration
-- Run this in Supabase SQL Editor to set up all tables, RLS,
-- storage buckets, and policies.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES (linked 1-1 to auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',  -- user | artist | admin | support
  is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  restricted_at BIGINT,
  restricted_reason TEXT,
  restricted_by UUID,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. ARTIST PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  artist_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  cover_url TEXT,
  genres JSONB NOT NULL DEFAULT '[]'::jsonb,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_status TEXT NOT NULL DEFAULT 'independent',
  verification_note TEXT,
  verification_requested_at BIGINT,
  verified_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_artists_user ON artists(user_id);
CREATE INDEX IF NOT EXISTS idx_artists_username ON artists(username);
CREATE INDEX IF NOT EXISTS idx_artists_verification ON artists(verification_status);

-- ============================================================
-- 3. ARTIST FOLLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS artist_follows (
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  PRIMARY KEY (follower_id, artist_id)
);

-- ============================================================
-- 4. TRACKS (songs)
-- ============================================================
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  release_date TEXT,
  lyrics TEXT,
  timed_lyrics JSONB,
  duration INTEGER,
  audio_url TEXT,
  cover_url TEXT,
  video_url TEXT,
  genres JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploader_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  share_count INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  is_explicit BOOLEAN NOT NULL DEFAULT FALSE,
  submission_id UUID,
  isrc TEXT,
  rights_holder TEXT,
  rights_year TEXT,
  rights_label TEXT,
  rights_record_id TEXT,
  rights_declared_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  reviewed_at BIGINT,
  reviewed_by UUID
);

CREATE INDEX IF NOT EXISTS idx_tracks_uploader ON tracks(uploader_id);
CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status);
CREATE INDEX IF NOT EXISTS idx_tracks_created ON tracks(created_at DESC);

-- ============================================================
-- 5. TRACK CREDITS
-- ============================================================
CREATE TABLE IF NOT EXISTS track_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES artists(id),
  external_name TEXT,
  role TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_track_credits_track ON track_credits(track_id);

-- ============================================================
-- 6. LIKES
-- ============================================================
CREATE TABLE IF NOT EXISTS likes (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  PRIMARY KEY (user_id, track_id)
);

-- ============================================================
-- 7. SAVES
-- ============================================================
CREATE TABLE IF NOT EXISTS saves (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  PRIMARY KEY (user_id, track_id)
);

-- ============================================================
-- 8. COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_comments_track ON comments(track_id, created_at);

-- ============================================================
-- 9. PLAY EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS play_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_play_events_track ON play_events(track_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_play_events_user ON play_events(user_id, created_at DESC);

-- ============================================================
-- 10. SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID NOT NULL REFERENCES artists(id),
  title TEXT NOT NULL,
  release_type TEXT NOT NULL DEFAULT 'single',
  audio_url TEXT,
  audio_original_name TEXT,
  audio_checksum TEXT,
  cover_url TEXT,
  video_url TEXT,
  lyrics TEXT NOT NULL DEFAULT '',
  genres JSONB NOT NULL DEFAULT '[]'::jsonb,
  language TEXT,
  is_explicit BOOLEAN NOT NULL DEFAULT FALSE,
  release_date TEXT,
  rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  terms_version TEXT,
  terms_accepted_at BIGINT,
  status TEXT NOT NULL DEFAULT 'draft',
  admin_note TEXT,
  reviewed_at BIGINT,
  reviewed_by UUID,
  published_track_id UUID,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  submitted_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_submissions_artist ON submissions(artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, submitted_at);

-- ============================================================
-- 11. SUBMISSION CREDITS
-- ============================================================
CREATE TABLE IF NOT EXISTS submission_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES artists(id),
  external_name TEXT,
  role TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 12. SUBMISSION EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS submission_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  note TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_submission_events ON submission_events(submission_id, created_at);

-- ============================================================
-- 13. PLAYLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  track_count INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists(owner_id, created_at DESC);

-- ============================================================
-- 14. PLAYLIST TRACKS
-- ============================================================
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES profiles(id),
  position INTEGER NOT NULL DEFAULT 0,
  added_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);

-- ============================================================
-- 15. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  actor_id UUID,
  target_type TEXT,
  target_id UUID,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- ============================================================
-- 16. ACTIVITY EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_events(user_id, created_at DESC);

-- ============================================================
-- 17. SEARCH HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS search_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, created_at DESC);

-- ============================================================
-- 18. ADMIN AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);

-- ============================================================
-- 19. REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  resolved_at BIGINT,
  resolved_by UUID,
  resolution_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);

-- ============================================================
-- 20. PLATFORM SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at BIGINT,
  updated_by UUID
);

-- ============================================================
-- 21. LISTENING PROGRESS (Continue Listening)
-- ============================================================
CREATE TABLE IF NOT EXISTS listening_progress (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  progress_seconds REAL DEFAULT 0,
  duration_seconds REAL DEFAULT 0,
  source_type TEXT DEFAULT 'track',
  source_id UUID,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  PRIMARY KEY (user_id, track_id)
);

-- ============================================================
-- 22. RELEASES
-- ============================================================
CREATE TABLE IF NOT EXISTS releases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT,
  type TEXT NOT NULL DEFAULT 'single',
  cover_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  artist_message TEXT NOT NULL DEFAULT '',
  release_date TEXT,
  label TEXT,
  copyright_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  reviewed_at BIGINT,
  reviewed_by UUID,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_releases_type ON releases(type, status);
CREATE INDEX IF NOT EXISTS idx_releases_creator ON releases(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status, updated_at DESC);

-- ============================================================
-- 23. RELEASE TRACKS
-- ============================================================
CREATE TABLE IF NOT EXISTS release_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  track_number INTEGER NOT NULL DEFAULT 1,
  disc_number INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_release_tracks ON release_tracks(release_id, track_number);

-- ============================================================
-- 24. ARTIST APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS artist_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  artist_name TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  main_genre TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT,
  submitted_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  reviewed_at BIGINT,
  reviewed_by UUID,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- ============================================================
-- 25. VERIFIED ARTIST APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS verified_artist_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  artist_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  main_genre TEXT NOT NULL DEFAULT '',
  social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  official_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  additional_info TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT,
  submitted_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  reviewed_at BIGINT,
  reviewed_by UUID,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- ============================================================
-- 26. EMAIL NOTIFICATIONS LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  recipient TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at BIGINT,
  error TEXT,
  metadata JSONB,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_artist_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES policies
-- ============================================================
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- ARTISTS policies
-- ============================================================
CREATE POLICY "Artists are viewable by everyone" ON artists
  FOR SELECT USING (TRUE);

CREATE POLICY "Artists can update own profile" ON artists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can create artist profile" ON artists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ARTIST FOLLOWS policies
-- ============================================================
CREATE POLICY "Follows viewable by everyone" ON artist_follows
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can follow artists" ON artist_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow artists" ON artist_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ============================================================
-- TRACKS policies
-- ============================================================
CREATE POLICY "Published tracks viewable by everyone" ON tracks
  FOR SELECT USING (status = 'approved' OR auth.uid() = uploader_id);

CREATE POLICY "Artists can insert own tracks" ON tracks
  FOR INSERT WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "Artists can update own tracks" ON tracks
  FOR UPDATE USING (auth.uid() = uploader_id);

-- ============================================================
-- TRACK CREDITS policies
-- ============================================================
CREATE POLICY "Track credits viewable by everyone" ON track_credits
  FOR SELECT USING (TRUE);

-- ============================================================
-- LIKES policies
-- ============================================================
CREATE POLICY "Users can view own likes" ON likes
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can like tracks" ON likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike tracks" ON likes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- SAVES policies
-- ============================================================
CREATE POLICY "Users can view own saves" ON saves
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can save tracks" ON saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave tracks" ON saves
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- COMMENTS policies
-- ============================================================
CREATE POLICY "Comments viewable by everyone" ON comments
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can insert comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- PLAY EVENTS policies
-- ============================================================
CREATE POLICY "Play events viewable by everyone" ON play_events
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can insert play events" ON play_events
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================
-- SUBMISSIONS policies
-- ============================================================
CREATE POLICY "Artists can view own submissions" ON submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM artists WHERE artists.id = submissions.artist_id AND artists.user_id = auth.uid())
  );

CREATE POLICY "Admins can view all submissions" ON submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Artists can create submissions" ON submissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM artists WHERE artists.id = submissions.artist_id AND artists.user_id = auth.uid())
  );

CREATE POLICY "Artists can update own draft submissions" ON submissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM artists WHERE artists.id = submissions.artist_id AND artists.user_id = auth.uid())
    AND status IN ('draft', 'changes_requested')
  );

-- ============================================================
-- SUBMISSION CREDITS policies
-- ============================================================
CREATE POLICY "Submission credits viewable with submission" ON submission_credits
  FOR SELECT USING (TRUE);

-- ============================================================
-- SUBMISSION EVENTS policies
-- ============================================================
CREATE POLICY "Submission events viewable with submission" ON submission_events
  FOR SELECT USING (TRUE);

-- ============================================================
-- PLAYLISTS policies
-- ============================================================
CREATE POLICY "Public playlists viewable by everyone" ON playlists
  FOR SELECT USING (is_public = TRUE OR auth.uid() = owner_id);

CREATE POLICY "Users can create playlists" ON playlists
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own playlists" ON playlists
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own playlists" ON playlists
  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================
-- PLAYLIST TRACKS policies
-- ============================================================
CREATE POLICY "Playlist tracks viewable with playlist" ON playlist_tracks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_tracks.playlist_id AND (playlists.is_public = TRUE OR playlists.owner_id = auth.uid()))
  );

CREATE POLICY "Playlist owners can manage tracks" ON playlist_tracks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_tracks.playlist_id AND playlists.owner_id = auth.uid())
  );

-- ============================================================
-- NOTIFICATIONS policies
-- ============================================================
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- ACTIVITY EVENTS policies
-- ============================================================
CREATE POLICY "Activity events viewable by everyone" ON activity_events
  FOR SELECT USING (TRUE);

CREATE POLICY "System can insert activity events" ON activity_events
  FOR INSERT WITH CHECK (TRUE);

-- ============================================================
-- SEARCH HISTORY policies
-- ============================================================
CREATE POLICY "Users can view own search history" ON search_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own search history" ON search_history
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- ADMIN AUDIT LOG policies
-- ============================================================
CREATE POLICY "Admins can view audit log" ON admin_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- REPORTS policies
-- ============================================================
CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports" ON reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ============================================================
-- PLATFORM SETTINGS policies
-- ============================================================
CREATE POLICY "Platform settings viewable by everyone" ON platform_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage platform settings" ON platform_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- LISTENING PROGRESS policies
-- ============================================================
CREATE POLICY "Users can manage own progress" ON listening_progress
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- RELEASES policies
-- ============================================================
CREATE POLICY "Published releases viewable by everyone" ON releases
  FOR SELECT USING (status = 'published' OR auth.uid() = created_by);

CREATE POLICY "Admins can view all releases" ON releases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Users can create releases" ON releases
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own releases" ON releases
  FOR UPDATE USING (auth.uid() = created_by);

-- ============================================================
-- RELEASE TRACKS policies
-- ============================================================
CREATE POLICY "Release tracks viewable by everyone" ON release_tracks
  FOR SELECT USING (TRUE);

-- ============================================================
-- ARTIST APPLICATIONS policies
-- ============================================================
CREATE POLICY "Users can view own applications" ON artist_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all applications" ON artist_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Users can create applications" ON artist_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- VERIFIED ARTIST APPLICATIONS policies
-- ============================================================
CREATE POLICY "Users can view own verified applications" ON verified_artist_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all verified applications" ON verified_artist_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Users can create verified applications" ON verified_artist_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- EMAIL NOTIFICATIONS policies
-- ============================================================
CREATE POLICY "System can manage email notifications" ON email_notifications
  FOR ALL USING (TRUE);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('artwork', 'artwork', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('music', 'music', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('artist-images', 'artist-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('playlist-covers', 'playlist-covers', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('submission-covers', 'submission-covers', false) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

-- Avatars: anyone can view, owner can upload/update
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (string_to_array(name, '/'))[1]);

CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (string_to_array(name, '/'))[1]);

-- Artwork: anyone can view, authenticated can upload
CREATE POLICY "Artwork images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'artwork');

CREATE POLICY "Authenticated users can upload artwork" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'artwork' AND auth.role() = 'authenticated');

-- Music: only authenticated users can upload, anyone can stream via signed URL
CREATE POLICY "Authenticated users can upload music" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'music' AND auth.role() = 'authenticated');

-- Videos: only authenticated users can upload
CREATE POLICY "Authenticated users can upload videos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');

-- Artist images: anyone can view, owner can upload
CREATE POLICY "Artist images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'artist-images');

CREATE POLICY "Authenticated users can upload artist images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'artist-images' AND auth.role() = 'authenticated');

-- Playlist covers: anyone can view, authenticated can upload
CREATE POLICY "Playlist covers are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'playlist-covers');

CREATE POLICY "Authenticated users can upload playlist covers" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'playlist-covers' AND auth.role() = 'authenticated');

-- Submission covers: authenticated only
CREATE POLICY "Authenticated users can upload submission covers" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'submission-covers' AND auth.role() = 'authenticated');

CREATE POLICY "Submission covers viewable by owner or admin" ON storage.objects
  FOR SELECT USING (bucket_id = 'submission-covers');
