-- ============================================================
-- 001: Profiles & User Preferences
-- Extends Supabase auth.users with application-specific data.
-- ============================================================

-- Public profile data (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',  -- user | artist | admin
  is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  restricted_at TIMESTAMPTZ,
  restricted_reason TEXT,
  restricted_by UUID,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for username lookups
CREATE UNIQUE INDEX idx_profiles_username ON public.profiles(username);

-- User preferences (onboarding, moods, favorite genres)
CREATE TABLE public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  favorite_genres JSONB NOT NULL DEFAULT '[]'::JSONB,
  favorite_moods JSONB NOT NULL DEFAULT '[]'::JSONB,
  favorite_artists JSONB NOT NULL DEFAULT '[]'::JSONB,
  onboarding_step INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform settings (key-value config)
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.profiles(id)
);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
