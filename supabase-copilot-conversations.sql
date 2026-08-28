-- Copilot conversations table
-- Stores AI copilot chat history per user

CREATE TABLE IF NOT EXISTS copilot_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_user_id ON copilot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_updated ON copilot_conversations(user_id, updated_at DESC);

-- RLS policies
ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own conversations
CREATE POLICY "Users can view own copilot conversations"
  ON copilot_conversations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "Users can insert own copilot conversations"
  ON copilot_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update own copilot conversations"
  ON copilot_conversations FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "Users can delete own copilot conversations"
  ON copilot_conversations FOR DELETE
  USING (auth.uid() = user_id);
