-- ============================================================
-- 004: Playlists
-- ============================================================

CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  cover_filename TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  track_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_playlists_owner ON public.playlists(owner_id, created_at DESC);

CREATE TABLE public.playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES public.profiles(id),
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(playlist_id, track_id)
);

CREATE INDEX idx_playlist_tracks_playlist ON public.playlist_tracks(playlist_id, position);
CREATE INDEX idx_playlist_tracks_track ON public.playlist_tracks(track_id);

CREATE TRIGGER playlists_updated_at
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-update track_count
CREATE OR REPLACE FUNCTION public.update_playlist_track_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.playlists SET track_count = track_count + 1 WHERE id = NEW.playlist_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.playlists SET track_count = track_count - 1 WHERE id = OLD.playlist_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER playlist_track_count_trigger
  AFTER INSERT OR DELETE ON public.playlist_tracks
  FOR EACH ROW EXECUTE FUNCTION public.update_playlist_track_count();
