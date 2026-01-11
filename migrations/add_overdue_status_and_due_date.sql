-- Migration: Add Overdue Status and Due Date Support
-- Adds due_date column to fact_tasks and Overdue status to dim_status
-- Creates automatic overdue detection function

-- Step 1: Add due_date column to fact_tasks
ALTER TABLE fact_tasks 
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- Add index for due_date queries
CREATE INDEX IF NOT EXISTS idx_fact_tasks_due_date ON fact_tasks(due_date) WHERE due_date IS NOT NULL;

-- Add index for overdue queries (tasks with due_date in the past that are not completed)
CREATE INDEX IF NOT EXISTS idx_fact_tasks_overdue ON fact_tasks(due_date, is_completed) 
WHERE due_date IS NOT NULL AND is_completed = false;

-- Step 2: Add Overdue status to dim_status
INSERT INTO dim_status (status_name, status_description, status_order)
VALUES ('Overdue', 'Task is past its due date and not yet completed', 4)
ON CONFLICT (status_name) DO NOTHING;

-- Step 3: Create function to check and update overdue tasks
CREATE OR REPLACE FUNCTION check_and_update_overdue_tasks()
RETURNS TABLE(updated_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  overdue_status_id INTEGER;
  updated_count INTEGER;
BEGIN
  -- Get the Overdue status ID
  SELECT status_id INTO overdue_status_id
  FROM dim_status
  WHERE status_name = 'Overdue';
  
  -- If Overdue status doesn't exist, return
  IF overdue_status_id IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;
  
  -- Update tasks that are overdue (due_date < now() and not completed)
  -- Only update if they're not already marked as Overdue
  WITH updated AS (
    UPDATE fact_tasks
    SET status_id = overdue_status_id,
        updated_at = now()
    WHERE due_date IS NOT NULL
      AND due_date < now()
      AND is_completed = false
      AND status_id != overdue_status_id
    RETURNING task_id
  )
  SELECT COUNT(*)::INTEGER INTO updated_count FROM updated;
  
  RETURN QUERY SELECT updated_count;
END;
$$;

-- Step 4: Create function to automatically mark tasks as overdue on insert/update
-- This function will be called by triggers
CREATE OR REPLACE FUNCTION auto_mark_overdue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  overdue_status_id INTEGER;
BEGIN
  -- Only process if task is not completed
  IF NEW.is_completed = true THEN
    RETURN NEW;
  END IF;
  
  -- Get the Overdue status ID
  SELECT status_id INTO overdue_status_id
  FROM dim_status
  WHERE status_name = 'Overdue';
  
  -- If Overdue status doesn't exist, return
  IF overdue_status_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- If due_date is set and is in the past, mark as overdue
  IF NEW.due_date IS NOT NULL AND NEW.due_date < now() THEN
    NEW.status_id := overdue_status_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 5: Create trigger to automatically mark tasks as overdue
DROP TRIGGER IF EXISTS trigger_auto_mark_overdue ON fact_tasks;
CREATE TRIGGER trigger_auto_mark_overdue
  BEFORE INSERT OR UPDATE ON fact_tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_overdue();

-- Step 6: Create a scheduled function comment (for pg_cron if available)
-- Note: This requires pg_cron extension. If not available, you can call check_and_update_overdue_tasks()
-- periodically from your application
COMMENT ON FUNCTION check_and_update_overdue_tasks() IS 
  'Checks all tasks and marks them as overdue if due_date has passed. 
   Can be called periodically (e.g., via pg_cron or application scheduler)';

COMMENT ON FUNCTION auto_mark_overdue() IS 
  'Automatically marks tasks as overdue when due_date is set and is in the past';

COMMENT ON COLUMN fact_tasks.due_date IS 
  'Due date and time for the task. Tasks past this date will be automatically marked as Overdue if not completed';

-- Comments
COMMENT ON TABLE dim_status IS 
  'Task statuses: Pending (1), In Progress (2), Completed (3), Overdue (4)';

