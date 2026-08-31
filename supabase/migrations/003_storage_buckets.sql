-- ============================================================
-- 4ANG STORAGE BUCKETS & POLICIES
-- Run AFTER 002_rls_policies.sql
-- ============================================================

-- Create buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('artist-images', 'artist-images', true),
  ('artwork', 'artwork', true),
  ('playlist-covers', 'playlist-covers', true),
  ('music', 'music', false),
  ('videos', 'videos', false),
  ('submission-covers', 'submission-covers', false);

-- ─── AVATARS (public) ──────────────────────────────────────
-- Path: avatars/{user_id}/avatar.webp
CREATE POLICY "Avatar publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- ─── ARTIST IMAGES (public) ────────────────────────────────
-- Path: artist-images/{user_id}/avatar.webp, cover.webp
CREATE POLICY "Artist images publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'artist-images');

CREATE POLICY "Artists can upload own images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'artist-images'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Artists can update own images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'artist-images'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Artists can delete own images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'artist-images'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- ─── ARTWORK (public) ──────────────────────────────────────
-- Path: artwork/{track_id}/cover.webp
CREATE POLICY "Artwork publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'artwork');

CREATE POLICY "Track owners can upload artwork"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'artwork');

CREATE POLICY "Track owners can update artwork"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'artwork');

-- ─── PLAYLIST COVERS (public) ──────────────────────────────
-- Path: playlist-covers/{user_id}/{playlist_id}.webp
CREATE POLICY "Playlist covers publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'playlist-covers');

CREATE POLICY "Playlist owners can upload covers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'playlist-covers'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Playlist owners can update covers"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'playlist-covers'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Playlist owners can delete covers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'playlist-covers'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- ─── MUSIC (private) ───────────────────────────────────────
-- Path: music/{track_id}/audio.mp3
-- Only track owner and admin can upload. Access via signed URLs.
CREATE POLICY "Music uploaders can manage audio"
  ON storage.objects FOR ALL
  USING (bucket_id = 'music');

-- ─── VIDEOS (private) ──────────────────────────────────────
-- Path: videos/{track_id}/video.mp4
CREATE POLICY "Video uploaders can manage videos"
  ON storage.objects FOR ALL
  USING (bucket_id = 'videos');

-- ─── SUBMISSION COVERS (private) ───────────────────────────
-- Path: submission-covers/{user_id}/{submission_id}.webp
-- Only visible to submission owner and admin.
CREATE POLICY "Submission owners can manage covers"
  ON storage.objects FOR ALL
  USING (bucket_id = 'submission-covers');

-- ─── DONE ──────────────────────────────────────────────────
-- 7 storage buckets created with policies.
