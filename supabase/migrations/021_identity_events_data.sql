-- ═══════════════════════════════════════════════════════════════
-- 4ANG PHASE 4.4 — IDENTITY + EVENTS + DATA PLATFORM
-- ═══════════════════════════════════════════════════════════════

-- ============================================================
-- 1. USER EVENTS (Application Event System)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    session_id TEXT,
    metadata JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events (event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_entity ON user_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_events_occurred ON user_events (occurred_at DESC);

-- RLS
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own events"
    ON user_events FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users insert own events"
    ON user_events FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role manages events"
    ON user_events FOR ALL
    USING (true);

-- ============================================================
-- 2. AUDIO ANALYSIS (C++ Engine Results)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audio_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    duration_seconds DOUBLE PRECISION,
    sample_rate DOUBLE PRECISION,
    channels INTEGER,
    loudness_lufs DOUBLE PRECISION,
    true_peak_dbtp DOUBLE PRECISION,
    dynamic_range_db DOUBLE PRECISION,
    rms DOUBLE PRECISION,
    peak DOUBLE PRECISION,
    bpm DOUBLE PRECISION,
    bpm_confidence DOUBLE PRECISION,
    spectral_centroid DOUBLE PRECISION,
    spectral_bandwidth DOUBLE PRECISION,
    spectral_rolloff DOUBLE PRECISION,
    spectral_flatness DOUBLE PRECISION,
    brightness DOUBLE PRECISION,
    energy DOUBLE PRECISION,
    silence_ratio DOUBLE PRECISION,
    waveform_points INTEGER,
    analysis_version TEXT DEFAULT '1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(track_id)
);

CREATE INDEX IF NOT EXISTS idx_audio_analysis_track ON audio_analysis (track_id);

-- RLS
ALTER TABLE audio_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read audio analysis"
    ON audio_analysis FOR SELECT
    USING (true);

CREATE POLICY "Service role manages audio analysis"
    ON audio_analysis FOR ALL
    USING (true);

-- ============================================================
-- 3. AI JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_target ON ai_jobs (target_type, target_id);

-- RLS
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages AI jobs"
    ON ai_jobs FOR ALL
    USING (true);

-- ============================================================
-- 4. RECOMMENDATION HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recommendation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    context TEXT NOT NULL DEFAULT 'home',
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    score DOUBLE PRECISION,
    reason TEXT,
    source TEXT,
    position INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    impression_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    played_at TIMESTAMPTZ,
    skipped_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rec_history_user ON recommendation_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_history_track ON recommendation_history (track_id);

-- RLS
ALTER TABLE recommendation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own recommendation history"
    ON recommendation_history FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role manages recommendation history"
    ON recommendation_history FOR ALL
    USING (true);
