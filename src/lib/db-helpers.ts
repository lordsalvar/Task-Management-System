import { supabase } from './supabase'
import type { Tables, TablesInsert } from './database.types'

// Type aliases for easier use
export type DimUser = Tables<'dim_user'>
export type DimDate = Tables<'dim_date'>
export type DimCategory = Tables<'dim_category'>
export type DimStatus = Tables<'dim_status'>
export type FactTask = Tables<'fact_tasks'>

export type DimUserInsert = TablesInsert<'dim_user'>
export type DimDateInsert = TablesInsert<'dim_date'>
export type DimCategoryInsert = TablesInsert<'dim_category'>
export type DimStatusInsert = TablesInsert<'dim_status'>
export type FactTaskInsert = TablesInsert<'fact_tasks'>
export type TaskLog = Tables<'task_logs'>
export type TaskLogInsert = TablesInsert<'task_logs'>

/**
 * Syncs a user from auth.users to dim_user table
 * This should be called after user signup or when user data needs to be synced
 */
export async function syncUserToDimUser(authUserId: string, email: string, name?: string) {
  // Check if user already exists in dim_user
  const { data: existingUsers, error: selectError } = await supabase
    .from('dim_user')
    .select('user_id')
    .eq('auth_user_id', authUserId)

  // Handle select errors (but allow PGRST116 - no rows found)
  if (selectError && selectError.code !== 'PGRST116') {
    throw selectError
  }

  const existingUser = existingUsers && existingUsers.length > 0 ? existingUsers[0] : null

  if (existingUser) {
    // Update existing user
    const { error } = await supabase
      .from('dim_user')
      .update({
        email,
        name: name || email.split('@')[0], // Use email prefix as default name
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', authUserId)

    if (error) throw error
    return existingUser.user_id
  } else {
    // Create new user
    const { data, error } = await supabase
      .from('dim_user')
      .insert({
        auth_user_id: authUserId,
        email,
        name: name || email.split('@')[0], // Use email prefix as default name
      })
      .select('user_id')
      .single()

    if (error) throw error
    if (!data) throw new Error('Failed to create user record')
    return data.user_id
  }
}

/**
 * Gets or creates a date record in dim_date
 * Returns the date_id for the given date
 */
export async function getOrCreateDateId(date: Date): Promise<number> {
  const dateString = date.toISOString().split('T')[0] // YYYY-MM-DD format

  // Check if date exists
  const { data: existingDate } = await supabase
    .from('dim_date')
    .select('date_id')
    .eq('date', dateString)
    .single()

  if (existingDate) {
    return existingDate.date_id
  }

  // If date doesn't exist, we need to populate it
  // This should ideally be done via the populate_dim_date function
  // For now, we'll insert it manually
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const quarter = Math.ceil(month / 3)
  const week = getWeekNumber(date)
  const dayOfMonth = date.getDate()
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay() // Convert Sunday (0) to 7
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
  const monthName = date.toLocaleDateString('en-US', { month: 'long' })
  const isWeekend = dayOfWeek === 6 || dayOfWeek === 7

  const { data, error } = await supabase
    .from('dim_date')
    .insert({
      date: dateString,
      year,
      quarter,
      month,
      month_name: monthName,
      week,
      day_of_month: dayOfMonth,
      day_of_week: dayOfWeek,
      day_name: dayName,
      is_weekend: isWeekend,
      is_holiday: false, // Can be updated later if needed
    })
    .select('date_id')
    .single()

  if (error) throw error
  return data.date_id
}

/**
 * Helper function to calculate week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * Gets the default status ID (Pending)
 */
export async function getDefaultStatusId(): Promise<number> {
  const { data, error } = await supabase
    .from('dim_status')
    .select('status_id')
    .eq('status_name', 'Pending')
    .single()

  if (error) throw error
  return data.status_id
}

/**
 * Gets status ID by status name
 */
export async function getStatusIdByName(statusName: string): Promise<number> {
  const { data, error } = await supabase
    .from('dim_status')
    .select('status_id')
    .eq('status_name', statusName)
    .single()

  if (error) throw error
  return data.status_id
}

/**
 * Gets the current user's dim_user record
 * Automatically syncs the user if they don't exist in dim_user
 */
export async function getCurrentUserDimUser(): Promise<DimUser | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('dim_user')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // User doesn't exist in dim_user, sync them
      try {
        const userId = await syncUserToDimUser(
          user.id,
          user.email || '',
          user.user_metadata?.name
        )
        
        // Fetch the newly created user
        const { data: newUser, error: fetchError } = await supabase
          .from('dim_user')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        if (fetchError) throw fetchError
        return newUser
      } catch (syncError) {
        console.error('Failed to sync user to dim_user:', syncError)
        return null
      }
    }
    throw error
  }

  return data
}

/**
 * Logs a task change event
 * This is useful for tracking when dates change, especially completion dates
 */
export async function logTaskChange(
  taskId: string,
  userId: string,
  changeType: 'completed' | 'uncompleted' | 'date_changed' | 'status_changed' | 'other',
  fieldName?: string,
  oldValue?: string | null,
  newValue?: string | null,
  completedAt?: string | null,
  completedDateId?: number | null
): Promise<void> {
  const logDateId = await getOrCreateDateId(new Date())
  
  const logData: TaskLogInsert = {
    task_id: taskId,
    user_id: userId,
    change_type: changeType,
    field_name: fieldName || null,
    old_value: oldValue || null,
    new_value: newValue || null,
    completed_at: completedAt || null,
    completed_date_id: completedDateId || null,
    log_date_id: logDateId,
  }

  const { error } = await supabase
    .from('task_logs')
    .insert(logData)

  if (error) {
    // Log error but don't throw - logging should not break the main operation
    console.error('Failed to log task change:', error)
  }
}

