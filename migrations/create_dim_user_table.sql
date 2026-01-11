-- Migration: Create dim_user table
-- This table stores user information linked to Supabase auth users
-- Part of the star schema dimension tables

-- Create dim_user table
CREATE TABLE IF NOT EXISTS dim_user (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID, -- Reference to auth.users.id from Supabase Auth
  name TEXT NOT NULL,
  email TEXT,
  password TEXT, -- Legacy password field (not used with Supabase Auth)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Create index for fast lookups by auth user ID
CREATE INDEX IF NOT EXISTS idx_dim_user_auth_user_id ON dim_user(auth_user_id);

-- Enable Row Level Security
ALTER TABLE dim_user ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dim_user
-- Users can view their own user record
CREATE POLICY "Users can view their own user record"
  ON dim_user
  FOR SELECT
  USING (auth_user_id = auth.uid());

-- Users can update their own user record
CREATE POLICY "Users can update their own user record"
  ON dim_user
  FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Allow authenticated users to insert their own records (for sync functionality)
CREATE POLICY "Users can insert their own user record"
  ON dim_user
  FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_dim_user_updated_at ON dim_user;
CREATE TRIGGER update_dim_user_updated_at
  BEFORE UPDATE ON dim_user
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE dim_user IS 'Dimension table storing user information linked to Supabase auth users';
COMMENT ON COLUMN dim_user.auth_user_id IS 'Reference to auth.users.id from Supabase Auth';
COMMENT ON COLUMN dim_user.password IS 'Legacy password field (not used with Supabase Auth)';

