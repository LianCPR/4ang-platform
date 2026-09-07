-- ═══════════════════════════════════════════════════════════════
-- 4ANG PHASE 3.2 — AI SERVICE TABLES
-- ═══════════════════════════════════════════════════════════════

-- AI request logging (observability + cost tracking)
CREATE TABLE IF NOT EXISTS ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  endpoint TEXT NOT NULL DEFAULT 'general',
  tokens_prompt INTEGER NOT NULL DEFAULT 0,
  tokens_completion INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_requests_username ON ai_requests (username);
CREATE INDEX IF NOT EXISTS idx_ai_requests_created ON ai_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_endpoint ON ai_requests (endpoint);

-- AI analysis cache (persistent cache for track analysis)
CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  analysis_type TEXT NOT NULL DEFAULT 'track_semantics',
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_analysis_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_analysis_cache (expires_at);

-- AI feedback (user feedback on AI suggestions)
CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  rating INTEGER CHECK (rating IN (-1, 0, 1)),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_username ON ai_feedback (username);

-- RLS — only own requests visible
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own AI requests"
  ON ai_requests FOR SELECT
  USING (username = auth.uid()::text);

CREATE POLICY "Service role inserts AI requests"
  ON ai_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone reads AI analysis cache"
  ON ai_analysis_cache FOR SELECT
  USING (true);

CREATE POLICY "Service role manages AI cache"
  ON ai_analysis_cache FOR ALL
  USING (true);

CREATE POLICY "Users see own AI feedback"
  ON ai_feedback FOR SELECT
  USING (username = auth.uid()::text);

CREATE POLICY "Users insert own AI feedback"
  ON ai_feedback FOR INSERT
  WITH CHECK (username = auth.uid()::text);
