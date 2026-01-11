-- Migration: Fix Security Issues and Remove Duplicate Indexes
-- Addresses security vulnerabilities and cleans up duplicate indexes

-- Fix function security: Set search_path for update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix function security: Set search_path for populate_dim_date (if it exists)
-- Note: This function may not exist if dim_date was populated differently
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'populate_dim_date'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION populate_dim_date(start_date DATE, end_date DATE)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $func$
      DECLARE
        current_date DATE := start_date;
        year_val INTEGER;
        quarter_val INTEGER;
        month_val INTEGER;
        week_val INTEGER;
        day_of_month_val INTEGER;
        day_of_week_val INTEGER;
        day_name_val VARCHAR(20);
        month_name_val VARCHAR(20);
        is_weekend_val BOOLEAN;
      BEGIN
        WHILE current_date <= end_date LOOP
          year_val := EXTRACT(YEAR FROM current_date);
          month_val := EXTRACT(MONTH FROM current_date);
          quarter_val := CEIL(month_val::numeric / 3);
          
          -- Calculate week number (ISO week)
          week_val := EXTRACT(WEEK FROM current_date);
          
          day_of_month_val := EXTRACT(DAY FROM current_date);
          day_of_week_val := EXTRACT(DOW FROM current_date);
          -- Convert Sunday (0) to 7, Monday (1) to 1, etc.
          IF day_of_week_val = 0 THEN
            day_of_week_val := 7;
          END IF;
          
          day_name_val := TO_CHAR(current_date, ''Day'');
          month_name_val := TO_CHAR(current_date, ''Month'');
          is_weekend_val := day_of_week_val IN (6, 7);
          
          INSERT INTO dim_date (
            date, year, quarter, month, month_name, week,
            day_of_month, day_of_week, day_name, is_weekend, is_holiday
          ) VALUES (
            current_date, year_val, quarter_val, month_val, month_name_val, week_val,
            day_of_month_val, day_of_week_val, day_name_val, is_weekend_val, false
          )
          ON CONFLICT (date) DO NOTHING;
          
          current_date := current_date + INTERVAL ''1 day'';
        END LOOP;
      END;
      $func$;
    ';
  END IF;
END $$;

-- Remove duplicate index on dim_user
-- dim_user_user_id_key is identical to dim_user_pkey (primary key)
DROP INDEX IF EXISTS dim_user_user_id_key;

-- Comments
COMMENT ON FUNCTION update_updated_at_column() IS 'Trigger function with secure search_path to prevent SQL injection';
COMMENT ON FUNCTION populate_dim_date(DATE, DATE) IS 'Date population function with secure search_path to prevent SQL injection';

