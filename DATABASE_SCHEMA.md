# Database Schema Documentation

This document describes the star schema data warehouse structure for the Task Management System.

## Schema Overview

The database uses a **star schema** design pattern, which consists of:
- **1 Fact Table**: `fact_tasks` - stores task events and metrics
- **1 Log Table**: `task_logs` - stores task change events for analytics and auditing
- **4 Dimension Tables**: `dim_user`, `dim_date`, `dim_category`, `dim_status` - store descriptive attributes

## Fact Table

### `fact_tasks`
Stores task events such as completion status and completion time.

**Primary Key**: `task_id` (UUID)

**Foreign Keys**:
- `user_id` → `dim_user.user_id`
- `category_id` → `dim_category.category_id` (nullable)
- `status_id` → `dim_status.status_id`
- `created_date_id` → `dim_date.date_id`
- `completed_date_id` → `dim_date.date_id` (nullable)

**Columns**:
- `task_id` (UUID, Primary Key) - Unique identifier for the task
- `user_id` (UUID, NOT NULL) - Reference to the user who owns the task
- `category_id` (INTEGER, nullable) - Reference to task category
- `status_id` (INTEGER, NOT NULL) - Reference to task status
- `created_date_id` (INTEGER, NOT NULL) - Reference to date dimension for creation date
- `completed_date_id` (INTEGER, nullable) - Reference to date dimension for completion date
- `task_title` (VARCHAR(255), NOT NULL) - Title of the task
- `task_description` (TEXT, nullable) - Detailed description of the task
- `task_priority` (INTEGER, nullable) - Priority level (1-5, where 1=Lowest, 5=Highest)
- `estimated_hours` (DECIMAL(10,2), nullable) - Estimated time to complete
- `actual_hours` (DECIMAL(10,2), nullable) - Actual time taken to complete
- `is_completed` (BOOLEAN, NOT NULL, default: false) - Completion flag
- `completed_at` (TIMESTAMPTZ, nullable) - Timestamp when task was completed
- `created_at` (TIMESTAMPTZ, NOT NULL, default: now()) - Record creation timestamp
- `updated_at` (TIMESTAMPTZ, NOT NULL, default: now()) - Record update timestamp

## Log Table

### `task_logs`
Stores task change events for analytics and auditing. This table tracks when task properties change, especially completion dates, which is crucial for accurate analytics.

**Primary Key**: `log_id` (UUID)

**Foreign Keys**:
- `task_id` → `fact_tasks.task_id`
- `user_id` → `dim_user.user_id`
- `log_date_id` → `dim_date.date_id`
- `completed_date_id` → `dim_date.date_id` (nullable)

**Columns**:
- `log_id` (UUID, Primary Key) - Unique identifier for the log entry
- `task_id` (UUID, NOT NULL) - Reference to the task that changed
- `user_id` (UUID, NOT NULL) - Reference to the user who owns the task
- `change_type` (VARCHAR(50), NOT NULL) - Type of change: 'completed', 'uncompleted', 'date_changed', 'status_changed', 'other'
- `field_name` (VARCHAR(100), nullable) - Name of the field that changed
- `old_value` (TEXT, nullable) - Previous value of the field
- `new_value` (TEXT, nullable) - New value of the field
- `completed_at` (TIMESTAMPTZ, nullable) - Timestamp when task was completed (for completion logs)
- `completed_date_id` (INTEGER, nullable) - Reference to date dimension for completion date (for completion logs)
- `log_date_id` (INTEGER, NOT NULL) - Reference to date dimension for when the log was created
- `created_at` (TIMESTAMPTZ, NOT NULL, default: now()) - Record creation timestamp

**Indexes**:
- `idx_task_logs_task_id` - For filtering logs by task
- `idx_task_logs_user_id` - For filtering logs by user
- `idx_task_logs_change_type` - For filtering by change type
- `idx_task_logs_completed_date_id` - For filtering completion logs by date
- `idx_task_logs_log_date_id` - For filtering logs by log date

**Use Cases**:
- Track when tasks are completed for accurate analytics
- Audit trail of task changes
- Calculate productivity metrics based on actual completion dates
- Analyze completion patterns over time

## Dimension Tables

### `dim_user`
Contains user information linked to Supabase auth users.

**Primary Key**: `user_id` (UUID)

**Columns**:
- `user_id` (UUID, Primary Key) - Unique identifier for the user
- `auth_user_id` (UUID, nullable) - Reference to `auth.users.id` from Supabase Auth
- `name` (TEXT, NOT NULL) - User's display name
- `email` (TEXT, nullable) - User's email address
- `password` (TEXT, nullable) - Legacy password field (not used with Supabase Auth)
- `created_at` (TIMESTAMPTZ, NOT NULL, default: now()) - Record creation timestamp
- `updated_at` (TIMESTAMPTZ, nullable) - Record update timestamp

**Indexes**:
- `idx_dim_user_auth_user_id` - For fast lookups by auth user ID

### `dim_date`
Stores date details for task creation and completion. This is a time dimension table that enables efficient date-based queries and aggregations.

**Primary Key**: `date_id` (SERIAL)

**Columns**:
- `date_id` (SERIAL, Primary Key) - Unique identifier for the date
- `date` (DATE, NOT NULL, UNIQUE) - The actual date (YYYY-MM-DD)
- `year` (INTEGER, NOT NULL) - Year (e.g., 2024)
- `quarter` (INTEGER, NOT NULL) - Quarter (1-4)
- `month` (INTEGER, NOT NULL) - Month (1-12)
- `month_name` (VARCHAR(20), NOT NULL) - Month name (e.g., "January")
- `week` (INTEGER, NOT NULL) - Week number (1-53)
- `day_of_month` (INTEGER, NOT NULL) - Day of month (1-31)
- `day_of_week` (INTEGER, NOT NULL) - Day of week (1-7, where 1=Monday, 7=Sunday)
- `day_name` (VARCHAR(20), NOT NULL) - Day name (e.g., "Monday")
- `is_weekend` (BOOLEAN, NOT NULL, default: false) - Whether the date is a weekend
- `is_holiday` (BOOLEAN, NOT NULL, default: false) - Whether the date is a holiday
- `created_at` (TIMESTAMPTZ, NOT NULL, default: now()) - Record creation timestamp

**Indexes**:
- `idx_dim_date_date` - For fast lookups by date
- `idx_dim_date_year_month` - For fast lookups by year and month

**Note**: The table is pre-populated with dates from 2020-01-01 to 2030-12-31 using the `populate_dim_date()` function.

### `dim_category`
Stores task category information.

**Primary Key**: `category_id` (SERIAL)

**Columns**:
- `category_id` (SERIAL, Primary Key) - Unique identifier for the category
- `category_name` (VARCHAR(100), NOT NULL, UNIQUE) - Name of the category
- `category_description` (TEXT, nullable) - Description of the category
- `color` (VARCHAR(7), nullable) - Hex color code for UI display (e.g., "#FF5733")
- `icon` (VARCHAR(50), nullable) - Icon identifier for UI display
- `created_at` (TIMESTAMPTZ, NOT NULL, default: now()) - Record creation timestamp
- `updated_at` (TIMESTAMPTZ, NOT NULL, default: now()) - Record update timestamp

### `dim_status`
Stores task status information (Pending, In Progress, Completed).

**Primary Key**: `status_id` (SERIAL)

**Columns**:
- `status_id` (SERIAL, Primary Key) - Unique identifier for the status
- `status_name` (VARCHAR(50), NOT NULL, UNIQUE) - Name of the status
- `status_description` (TEXT, nullable) - Description of the status
- `status_order` (INTEGER, NOT NULL) - Order for sorting statuses (1=Pending, 2=In Progress, 3=Completed)
- `created_at` (TIMESTAMPTZ, NOT NULL, default: now()) - Record creation timestamp

**Default Values**:
The table is pre-populated with three default statuses:
1. **Pending** (status_order: 1) - Task is pending and not yet started
2. **In Progress** (status_order: 2) - Task is currently being worked on
3. **Completed** (status_order: 3) - Task has been completed

## Database Functions

### `populate_dim_date(start_date DATE, end_date DATE)`
Populates the `dim_date` table with date records for a given date range. This function is automatically called during migration to populate dates from 2020-01-01 to 2030-12-31.

**Usage**:
```sql
SELECT populate_dim_date('2024-01-01'::DATE, '2024-12-31'::DATE);
```

### `update_updated_at_column()`
Trigger function that automatically updates the `updated_at` timestamp when a record is updated. This function is used by triggers on:
- `dim_user`
- `dim_category`
- `fact_tasks`

## Row Level Security (RLS)

All tables have Row Level Security enabled with the following policies:

### `dim_user`
- **SELECT**: Users can view their own user record
- **UPDATE**: Users can update their own user record

### `dim_date`
- **SELECT**: Anyone can read dates (reference data)

### `dim_category`
- **SELECT**: Anyone can read categories
- **INSERT**: Authenticated users can create categories
- **UPDATE**: Authenticated users can update categories

### `dim_status`
- **SELECT**: Anyone can read statuses (reference data)

### `fact_tasks`
- **SELECT**: Users can view their own tasks
- **INSERT**: Users can insert their own tasks
- **UPDATE**: Users can update their own tasks
- **DELETE**: Users can delete their own tasks

### `task_logs`
- **SELECT**: Users can view their own task logs
- **INSERT**: System automatically inserts logs (via application logic)

## Indexes

The following indexes are created for optimal query performance:

### `fact_tasks` indexes:
- `idx_fact_tasks_user_id` - For filtering tasks by user
- `idx_fact_tasks_category_id` - For filtering tasks by category
- `idx_fact_tasks_status_id` - For filtering tasks by status
- `idx_fact_tasks_created_date_id` - For filtering tasks by creation date
- `idx_fact_tasks_completed_date_id` - For filtering tasks by completion date
- `idx_fact_tasks_is_completed` - For filtering completed/incomplete tasks
- `idx_fact_tasks_created_at` - For sorting by creation timestamp

### `task_logs` indexes:
- `idx_task_logs_task_id` - For filtering logs by task
- `idx_task_logs_user_id` - For filtering logs by user
- `idx_task_logs_change_type` - For filtering by change type
- `idx_task_logs_completed_date_id` - For filtering completion logs by date
- `idx_task_logs_log_date_id` - For filtering logs by log date

## TypeScript Types

TypeScript types are automatically generated and available in `src/lib/database.types.ts`. These types provide full type safety when working with the database through the Supabase client.

**Usage**:
```typescript
import { supabase } from './lib/supabase'
import type { Tables } from './lib/database.types'

type FactTask = Tables<'fact_tasks'>
type DimUser = Tables<'dim_user'>
```

## Helper Functions

Utility functions are available in `src/lib/db-helpers.ts`:

- `syncUserToDimUser()` - Syncs auth user to dim_user table
- `getOrCreateDateId()` - Gets or creates a date record in dim_date
- `getDefaultStatusId()` - Gets the default status ID (Pending)
- `getStatusIdByName()` - Gets status ID by status name
- `getCurrentUserDimUser()` - Gets the current user's dim_user record
- `logTaskChange()` - Logs a task change event (especially for date changes)

## Example Queries

### Get all tasks for a user with related dimension data:
```sql
SELECT 
  ft.task_id,
  ft.task_title,
  ft.task_description,
  ft.is_completed,
  ft.completed_at,
  du.name as user_name,
  dc.category_name,
  ds.status_name,
  dd_created.date as created_date,
  dd_completed.date as completed_date
FROM fact_tasks ft
JOIN dim_user du ON ft.user_id = du.user_id
LEFT JOIN dim_category dc ON ft.category_id = dc.category_id
JOIN dim_status ds ON ft.status_id = ds.status_id
JOIN dim_date dd_created ON ft.created_date_id = dd_created.date_id
LEFT JOIN dim_date dd_completed ON ft.completed_date_id = dd_completed.date_id
WHERE du.auth_user_id = auth.uid()
ORDER BY ft.created_at DESC;
```

### Get task completion statistics by month:
```sql
SELECT 
  dd.year,
  dd.month,
  dd.month_name,
  COUNT(*) as total_tasks,
  SUM(CASE WHEN ft.is_completed THEN 1 ELSE 0 END) as completed_tasks,
  AVG(ft.actual_hours) as avg_hours
FROM fact_tasks ft
JOIN dim_date dd ON ft.created_date_id = dd.date_id
JOIN dim_user du ON ft.user_id = du.user_id
WHERE du.auth_user_id = auth.uid()
GROUP BY dd.year, dd.month, dd.month_name
ORDER BY dd.year DESC, dd.month DESC;
```

### Get task completion logs for analytics:
```sql
SELECT 
  tl.task_id,
  tl.completed_at,
  tl.change_type,
  dd.date as completed_date,
  ft.task_title
FROM task_logs tl
JOIN fact_tasks ft ON tl.task_id = ft.task_id
JOIN dim_date dd ON tl.completed_date_id = dd.date_id
JOIN dim_user du ON tl.user_id = du.user_id
WHERE du.auth_user_id = auth.uid()
  AND tl.change_type IN ('completed', 'date_changed')
  AND tl.completed_at IS NOT NULL
ORDER BY tl.completed_at DESC;
```

### Get completion statistics using logs (more accurate):
```sql
SELECT 
  dd.year,
  dd.month,
  dd.month_name,
  COUNT(DISTINCT tl.task_id) as completed_tasks,
  COUNT(*) as completion_events
FROM task_logs tl
JOIN dim_date dd ON tl.completed_date_id = dd.date_id
JOIN dim_user du ON tl.user_id = du.user_id
WHERE du.auth_user_id = auth.uid()
  AND tl.change_type IN ('completed', 'date_changed')
  AND tl.completed_at IS NOT NULL
GROUP BY dd.year, dd.month, dd.month_name
ORDER BY dd.year DESC, dd.month DESC;
```

