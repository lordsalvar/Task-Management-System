-- Migration: Fix Duplicate dim_user Records
-- Removes duplicate records and adds unique constraint on auth_user_id
-- This fixes the 406 error that occurs when .single() finds multiple rows

-- Step 1: Find and keep the oldest record for each auth_user_id, delete duplicates
WITH duplicates AS (
  SELECT 
    user_id,
    auth_user_id,
    ROW_NUMBER() OVER (PARTITION BY auth_user_id ORDER BY created_at ASC) as rn
  FROM dim_user
  WHERE auth_user_id IS NOT NULL
)
DELETE FROM dim_user
WHERE user_id IN (
  SELECT user_id 
  FROM duplicates 
  WHERE rn > 1
);

-- Step 2: Add unique constraint on auth_user_id to prevent future duplicates
-- First, check if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dim_user_auth_user_id_unique'
  ) THEN
    ALTER TABLE dim_user
    ADD CONSTRAINT dim_user_auth_user_id_unique 
    UNIQUE (auth_user_id);
  END IF;
END $$;

-- Step 3: Add unique index if it doesn't exist (for performance)
-- This also enforces uniqueness at the index level
CREATE UNIQUE INDEX IF NOT EXISTS idx_dim_user_auth_user_id_unique 
ON dim_user(auth_user_id) 
WHERE auth_user_id IS NOT NULL;

-- Comments
COMMENT ON CONSTRAINT dim_user_auth_user_id_unique ON dim_user IS 
  'Ensures each auth_user_id appears only once in dim_user, preventing duplicate records';

