-- Migration: Fix RLS Performance Issues
-- Optimizes RLS policies by wrapping auth functions in SELECT to evaluate once per query
-- This prevents re-evaluation for each row, significantly improving performance at scale

-- Fix dim_user policies
DROP POLICY IF EXISTS "Users can view own user record" ON dim_user;
CREATE POLICY "Users can view own user record"
  ON dim_user
  FOR SELECT
  USING (auth_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own user record" ON dim_user;
CREATE POLICY "Users can update own user record"
  ON dim_user
  FOR UPDATE
  USING (auth_user_id = (select auth.uid()))
  WITH CHECK (auth_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own user record" ON dim_user;
CREATE POLICY "Users can insert own user record"
  ON dim_user
  FOR INSERT
  WITH CHECK (auth_user_id = (select auth.uid()));

-- Fix dim_category policies
DROP POLICY IF EXISTS "Authenticated users can create categories" ON dim_category;
CREATE POLICY "Authenticated users can create categories"
  ON dim_category
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update categories" ON dim_category;
CREATE POLICY "Authenticated users can update categories"
  ON dim_category
  FOR UPDATE
  USING ((select auth.role()) = 'authenticated');

-- Fix fact_tasks policies
DROP POLICY IF EXISTS "Users can view own tasks" ON fact_tasks;
CREATE POLICY "Users can view own tasks"
  ON fact_tasks
  FOR SELECT
  USING (user_id IN (
    SELECT dim_user.user_id
    FROM dim_user
    WHERE dim_user.auth_user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can insert own tasks" ON fact_tasks;
CREATE POLICY "Users can insert own tasks"
  ON fact_tasks
  FOR INSERT
  WITH CHECK (user_id IN (
    SELECT dim_user.user_id
    FROM dim_user
    WHERE dim_user.auth_user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update own tasks" ON fact_tasks;
CREATE POLICY "Users can update own tasks"
  ON fact_tasks
  FOR UPDATE
  USING (user_id IN (
    SELECT dim_user.user_id
    FROM dim_user
    WHERE dim_user.auth_user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can delete own tasks" ON fact_tasks;
CREATE POLICY "Users can delete own tasks"
  ON fact_tasks
  FOR DELETE
  USING (user_id IN (
    SELECT dim_user.user_id
    FROM dim_user
    WHERE dim_user.auth_user_id = (select auth.uid())
  ));

-- Fix task_logs policies
DROP POLICY IF EXISTS "Users can view their own task logs" ON task_logs;
CREATE POLICY "Users can view their own task logs"
  ON task_logs
  FOR SELECT
  USING (user_id IN (
    SELECT dim_user.user_id
    FROM dim_user
    WHERE dim_user.auth_user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can insert their own task logs" ON task_logs;
CREATE POLICY "Users can insert their own task logs"
  ON task_logs
  FOR INSERT
  WITH CHECK (user_id IN (
    SELECT dim_user.user_id
    FROM dim_user
    WHERE dim_user.auth_user_id = (select auth.uid())
  ));

-- Fix notifications policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (user_id IN (
    SELECT dim_user.user_id
    FROM dim_user
    WHERE dim_user.auth_user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
CREATE POLICY "Users can insert their own notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (user_id IN (
    SELECT dim_user.user_id
    FROM dim_user
    WHERE dim_user.auth_user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id IN (
    SELECT dim_user.user_id
    FROM dim_user
    WHERE dim_user.auth_user_id = (select auth.uid())
  ));

-- Comments
COMMENT ON POLICY "Users can view own user record" ON dim_user IS 'Optimized RLS policy using (select auth.uid()) for better performance';
COMMENT ON POLICY "Users can view own tasks" ON fact_tasks IS 'Optimized RLS policy using (select auth.uid()) for better performance';

