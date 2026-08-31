-- ============================================================
-- 005: Music Submissions
-- Workflow: draft → submitted → under_review → approved/rejected → published
-- ============================================================

CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artist_profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  release_type TEXT NOT NULL DEFAULT 'single',  -- single | ep | album
  audio_url TEXT,
  audio_filename TEXT,
  audio_original_name TEXT,
  audio_checksum TEXT,
  audio_mime_type TEXT,
  audio_size BIGINT,
  audio_duration REAL,
  cover_url TEXT,
  cover_filename TEXT,
  video_url TEXT,
  video_filename TEXT,
  lyrics TEXT NOT NULL DEFAULT '',
  genres JSONB NOT NULL DEFAULT '[]'::JSONB,
  language TEXT,
  is_explicit BOOLEAN NOT NULL DEFAULT FALSE,
  release_date DATE,
  rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  terms_version TEXT,
  terms_accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | submitted | under_review | changes_requested | rejected | approved | published
  admin_note TEXT,
  published_track_id UUID REFERENCES public.tracks(id),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ
);

CREATE INDEX idx_submissions_artist ON public.submissions(artist_id, created_at DESC);
CREATE INDEX idx_submissions_status ON public.submissions(status, submitted_at);

CREATE TABLE public.submission_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),  -- NULL for external artists
  external_name TEXT,
  role TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_submission_credits_submission ON public.submission_credits(submission_id);

CREATE TABLE public.submission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,  -- created | submitted | reviewed | changes_requested | rejected | approved | published
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submission_events_submission ON public.submission_events(submission_id, created_at);

CREATE TRIGGER submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
