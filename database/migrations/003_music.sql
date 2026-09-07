-- ============================================================
-- 003: Music — Tracks, Credits, Likes, Saves, Comments, Plays
-- ============================================================

-- Published tracks
CREATE TABLE public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  composer TEXT,
  description TEXT,
  release_date DATE,
  lyrics TEXT,
  audio_url TEXT NOT NULL,
  audio_filename TEXT,
  audio_mime_type TEXT,
  audio_size BIGINT,
  audio_duration REAL,
  cover_url TEXT,
  cover_filename TEXT,
  video_url TEXT,
  video_filename TEXT,
  genres JSONB NOT NULL DEFAULT '[]'::JSONB,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'approved',  -- pending | approved | rejected | removed
  share_count INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  submission_id UUID,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracks_uploader ON public.tracks(uploader_id);
CREATE INDEX idx_tracks_status ON public.tracks(status, created_at DESC);
CREATE INDEX idx_tracks_genres ON public.tracks USING GIN(genres);

-- Track credits
CREATE TABLE public.track_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),  -- NULL for external artists
  external_name TEXT,  -- Used when user_id is NULL
  role TEXT NOT NULL,  -- main_artist | featured | producer | songwriter | lyricist | composer | arranger
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_track_credits_track ON public.track_credits(track_id);

-- Track likes (favorites)
CREATE TABLE public.track_likes (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, track_id)
);

CREATE INDEX idx_track_likes_track ON public.track_likes(track_id);

-- Track saves (bookmarks)
CREATE TABLE public.track_saves (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, track_id)
);

CREATE INDEX idx_track_saves_track ON public.track_saves(track_id);

-- Track comments
CREATE TABLE public.track_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_track_comments_track ON public.track_comments(track_id, created_at);

-- Play events (listening history)
CREATE TABLE public.play_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.tracks(id),
  user_id UUID REFERENCES public.profiles(id),  -- NULL for anonymous
  session_id TEXT,  -- For anonymous tracking
  progress_seconds REAL NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_play_events_track ON public.play_events(track_id, created_at DESC);
CREATE INDEX idx_play_events_user ON public.play_events(user_id, created_at DESC);
