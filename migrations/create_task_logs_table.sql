-- Migration: Create task_logs table for tracking task changes
-- This table is essential for accurate analytics, especially for tracking completion dates

-- Create task_logs table
CREATE TABLE IF NOT EXISTS task_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES fact_tasks(task_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dim_user(user_id) ON DELETE CASCADE,
  change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('completed', 'uncompleted', 'date_changed', 'status_changed', 'other')),
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  completed_at TIMESTAMPTZ,
  completed_date_id INTEGER REFERENCES dim_date(date_id),
  log_date_id INTEGER NOT NULL REFERENCES dim_date(date_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_user_id ON task_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_change_type ON task_logs(change_type);
CREATE INDEX IF NOT EXISTS idx_task_logs_completed_date_id ON task_logs(completed_date_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_log_date_id ON task_logs(log_date_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_created_at ON task_logs(created_at);

-- Enable Row Level Security
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_logs
-- Users can only view their own task logs
CREATE POLICY "Users can view their own task logs"
  ON task_logs
  FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM dim_user WHERE auth_user_id = auth.uid()
    )
  );

-- System can insert logs (this will be done via application logic)
-- Note: In production, you might want to use a service role or function
CREATE POLICY "Users can insert their own task logs"
  ON task_logs
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT user_id FROM dim_user WHERE auth_user_id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE task_logs IS 'Stores task change events for analytics and auditing. Tracks when task properties change, especially completion dates.';
COMMENT ON COLUMN task_logs.change_type IS 'Type of change: completed, uncompleted, date_changed, status_changed, or other';
COMMENT ON COLUMN task_logs.completed_at IS 'Timestamp when task was completed (for completion logs)';
COMMENT ON COLUMN task_logs.completed_date_id IS 'Reference to date dimension for completion date (for completion logs)';
COMMENT ON COLUMN task_logs.log_date_id IS 'Reference to date dimension for when the log was created';


