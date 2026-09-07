-- ═══════════════════════════════════════════════════════════════
-- 4ANG PHASE 3.3 — AI MUSIC ASSISTANT TABLES
-- ═══════════════════════════════════════════════════════════════

-- Assistant conversations
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_conv_username ON assistant_conversations (username, updated_at DESC);

-- Assistant messages
CREATE TABLE IF NOT EXISTS assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_msg_conv ON assistant_messages (conversation_id, created_at);

-- RLS
ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own conversations
CREATE POLICY "Users read own conversations"
  ON assistant_conversations FOR SELECT
  USING (username = auth.uid()::text);

CREATE POLICY "Users create own conversations"
  ON assistant_conversations FOR INSERT
  WITH CHECK (username = auth.uid()::text);

CREATE POLICY "Users update own conversations"
  ON assistant_conversations FOR UPDATE
  USING (username = auth.uid()::text);

CREATE POLICY "Users delete own conversations"
  ON assistant_conversations FOR DELETE
  USING (username = auth.uid()::text);

-- Users can only see messages in their own conversations
CREATE POLICY "Users read own messages"
  ON assistant_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM assistant_conversations
      WHERE username = auth.uid()::text
    )
  );

CREATE POLICY "Users insert own messages"
  ON assistant_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM assistant_conversations
      WHERE username = auth.uid()::text
    )
  );

-- Service role can manage all (backend operations)
CREATE POLICY "Service role manages conversations"
  ON assistant_conversations FOR ALL
  USING (true);

CREATE POLICY "Service role manages messages"
  ON assistant_messages FOR ALL
  USING (true);
