-- saved_filters table
CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  filter_key TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  sort_by TEXT DEFAULT 'created_at',
  page_name TEXT DEFAULT 'investors',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_filters_unique ON saved_filters(user_id, filter_key, page_name);
CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_page ON saved_filters(user_id, page_name);

ALTER TABLE saved_filters DISABLE ROW LEVEL SECURITY;

SELECT 'saved_filters table created' as result;
