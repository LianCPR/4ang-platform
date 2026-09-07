-- ============================================================
-- 002: Artist System
-- Artist profiles, follows, verification.
-- ============================================================

-- Artist profiles (separate from users — distinct entity)
CREATE TABLE public.artist_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  artist_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  cover_url TEXT,
  genres JSONB NOT NULL DEFAULT '[]'::JSONB,
  links JSONB NOT NULL DEFAULT '[]'::JSONB,
  monthly_listeners INTEGER NOT NULL DEFAULT 0,
  total_plays INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'independent',  -- independent | pending | verified | rejected
  verification_note TEXT,
  verification_requested_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for username lookup
CREATE INDEX idx_artist_profiles_user ON public.artist_profiles(user_id);

-- Artist follows
CREATE TABLE public.artist_follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.artist_profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, artist_id)
);

CREATE INDEX idx_artist_follows_artist ON public.artist_follows(artist_id);

-- Update profile role when artist profile is created
CREATE OR REPLACE FUNCTION public.on_artist_profile_created()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET role = 'artist' WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_artist_created
  AFTER INSERT ON public.artist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.on_artist_profile_created();

CREATE TRIGGER artist_profiles_updated_at
  BEFORE UPDATE ON public.artist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
