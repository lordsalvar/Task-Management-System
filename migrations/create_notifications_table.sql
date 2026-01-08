-- Migration: Create notifications table for task reminders and notifications
-- This table stores notifications for users about upcoming, overdue, and completed tasks

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dim_user(user_id) ON DELETE CASCADE,
  task_id UUID REFERENCES fact_tasks(task_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('reminder', 'overdue', 'upcoming', 'completed')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM dim_user WHERE auth_user_id = auth.uid()
    )
  );

-- Users can insert their own notifications (via application logic)
CREATE POLICY "Users can insert their own notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT user_id FROM dim_user WHERE auth_user_id = auth.uid()
    )
  );

-- Users can update their own notifications (e.g., mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (
    user_id IN (
      SELECT user_id FROM dim_user WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT user_id FROM dim_user WHERE auth_user_id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE notifications IS 'Stores notifications for users about tasks (reminders, overdue, upcoming, completed)';
COMMENT ON COLUMN notifications.type IS 'Type of notification: reminder, overdue, upcoming, or completed';
COMMENT ON COLUMN notifications.is_read IS 'Whether the notification has been read by the user';
