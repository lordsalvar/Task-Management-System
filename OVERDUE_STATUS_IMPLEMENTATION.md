# Overdue Status Implementation

## Overview

The Task Management System now supports automatic overdue detection. Tasks with a `due_date` that has passed will be automatically marked as "Overdue" if they are not completed.

## What Was Added

### 1. Database Changes

#### `fact_tasks` Table
- ✅ Added `due_date` column (TIMESTAMPTZ, nullable)
- ✅ Added index `idx_fact_tasks_due_date` for efficient due date queries
- ✅ Added index `idx_fact_tasks_overdue` for overdue task queries

#### `dim_status` Table
- ✅ Added "Overdue" status (status_id: 4, status_order: 4)
- Description: "Task is past its due date and not yet completed"

### 2. Automatic Overdue Detection

#### Database Trigger
- ✅ **Automatic on Insert/Update**: When a task is created or updated with a `due_date` in the past, it's automatically marked as "Overdue"
- ✅ **Only for Incomplete Tasks**: Completed tasks are never marked as overdue
- ✅ **Trigger Function**: `auto_mark_overdue()` runs before INSERT or UPDATE

#### Batch Update Function
- ✅ **Function**: `check_and_update_overdue_tasks()`
- ✅ **Purpose**: Updates all existing tasks that should be marked as overdue
- ✅ **Usage**: Can be called periodically to catch any tasks that may have become overdue

### 3. Code Updates

#### Task Service (`src/services/task-service.ts`)
- ✅ Updated `Task` interface to include `due_date: string | null`
- ✅ Updated `createTask()` to handle `due_date` from request
- ✅ Updated `updateTask()` to handle `due_date` updates
- ✅ Added `checkAndUpdateOverdueTasks()` method to manually trigger overdue checks

#### Notification Service (`src/services/notification-service.ts`)
- ✅ Updated to use actual `due_date` field from database
- ✅ Removed calculation based on `estimated_hours`
- ✅ Now only checks tasks with a `due_date` set

## How It Works

### Automatic Marking

1. **On Task Creation**:
   ```typescript
   // If you create a task with a due_date in the past
   await taskService.createTask({
     task_title: "Past Due Task",
     due_date: "2024-01-01T00:00:00Z" // Past date
   })
   // Task will automatically be marked as "Overdue" (status_id: 4)
   ```

2. **On Task Update**:
   ```typescript
   // If you update a task's due_date to a past date
   await taskService.updateTask(taskId, {
     due_date: "2024-01-01T00:00:00Z" // Past date
   })
   // Task will automatically be marked as "Overdue"
   ```

3. **On Due Date Passing**:
   - Tasks are automatically checked when updated
   - For batch updates, call `checkAndUpdateOverdueTasks()`

### Manual Overdue Check

You can manually trigger an overdue check for all tasks:

```typescript
import { taskService } from './services/task-service'

// Check and update all overdue tasks
const result = await taskService.checkAndUpdateOverdueTasks()
if (result.success) {
  console.log(`Updated ${result.data.updated_count} tasks to overdue`)
}
```

### Scheduled Checks (Recommended)

For production, you should periodically check for overdue tasks. Options:

1. **Using pg_cron** (if available in Supabase):
   ```sql
   SELECT cron.schedule(
     'check-overdue-tasks',
     '*/15 * * * *', -- Every 15 minutes
     $$SELECT check_and_update_overdue_tasks()$$
   );
   ```

2. **Using Application Scheduler**:
   ```typescript
   // In your app initialization or background service
   setInterval(async () => {
     await taskService.checkAndUpdateOverdueTasks()
   }, 15 * 60 * 1000) // Every 15 minutes
   ```

3. **Using Supabase Edge Functions** (if available):
   - Create a scheduled edge function that calls the database function

## Status Flow

```
Pending (1) → In Progress (2) → Completed (3)
     ↓
Overdue (4) ← (if due_date passed and not completed)
```

**Important Notes**:
- Once a task is completed, it cannot be marked as overdue
- If a task is marked as overdue, it can still be moved to other statuses
- Updating a task's `due_date` to a future date will NOT automatically change it from "Overdue" to another status (you may want to handle this in your UI)

## Filtering Overdue Tasks

### In Code
```typescript
// Get overdue status ID
const overdueStatusId = await getStatusIdByName('Overdue')

// Filter tasks by overdue status
const result = await taskService.getTasks({
  status_id: overdueStatusId
})
```

### In Database
```sql
-- Get all overdue tasks for current user
SELECT ft.*
FROM fact_tasks ft
JOIN dim_user du ON ft.user_id = du.user_id
JOIN dim_status ds ON ft.status_id = ds.status_id
WHERE du.auth_user_id = auth.uid()
  AND ds.status_name = 'Overdue'
  AND ft.is_completed = false;
```

## UI Considerations

### Displaying Overdue Tasks
- Show overdue tasks with a distinct visual indicator (red color, warning icon)
- Display how many days overdue: `Math.ceil((now - due_date) / (1000 * 60 * 60 * 24))`
- Consider showing overdue tasks at the top of task lists

### Status Selection
- When creating/editing tasks, show "Overdue" status option
- However, note that the system will automatically set this if `due_date` is in the past
- You may want to disable manual selection of "Overdue" status in the UI

### Due Date Input
- When a user sets a due date in the past, show a warning
- Automatically mark as overdue when due date is set

## Migration Applied

✅ **Migration**: `add_overdue_status_and_due_date`
- Applied successfully
- All database changes are in place
- Triggers are active

## Testing

To test the overdue functionality:

1. **Create a task with past due date**:
   ```typescript
   const pastDate = new Date()
   pastDate.setDate(pastDate.getDate() - 1) // Yesterday
   
   const task = await taskService.createTask({
     task_title: "Test Overdue Task",
     due_date: pastDate.toISOString()
   })
   // Should automatically have status_id = 4 (Overdue)
   ```

2. **Update task to past due date**:
   ```typescript
   const pastDate = new Date()
   pastDate.setDate(pastDate.getDate() - 1)
   
   await taskService.updateTask(taskId, {
     due_date: pastDate.toISOString()
   })
   // Should automatically be marked as overdue
   ```

3. **Check overdue tasks**:
   ```typescript
   const overdueStatusId = await getStatusIdByName('Overdue')
   const result = await taskService.getTasks({
     status_id: overdueStatusId
   })
   ```

## Next Steps

1. ✅ **Database**: Complete
2. ✅ **Backend Services**: Complete
3. ⚠️ **UI Updates**: Update your frontend to:
   - Display overdue status
   - Show overdue indicator
   - Handle due date input
   - Filter by overdue status
4. ⚠️ **Scheduled Checks**: Set up periodic overdue checks (recommended every 15 minutes)

## Summary

The overdue status system is now fully functional:
- ✅ Database schema updated
- ✅ Automatic overdue detection via triggers
- ✅ Manual overdue check function available
- ✅ Task service updated to handle due dates
- ✅ Notification service updated to use actual due dates

Tasks will automatically be marked as overdue when their `due_date` passes, as long as they are not completed.

