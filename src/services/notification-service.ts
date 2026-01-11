/**
 * Notification Service
 * 
 * Responsibility: Sends reminders for upcoming or overdue tasks
 */

import { supabase } from '../lib/supabase'
import { apiGateway } from './api-gateway'
import type { ApiResponse } from './types'
import { getCurrentUserDimUser } from '../lib/db-helpers'

export interface Notification {
  notification_id: string
  user_id: string
  task_id: string | null
  type: 'reminder' | 'overdue' | 'upcoming' | 'completed'
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface NotificationPreferences {
  email_enabled: boolean
  push_enabled: boolean
  reminder_before_days: number
  reminder_before_hours: number
  daily_digest: boolean
  weekly_digest: boolean
}

export interface TaskReminder {
  task_id: string
  task_title: string
  due_date: string | null
  is_overdue: boolean
  days_until_due: number | null
}

class NotificationService {
  private checkingNotifications = false

  /**
   * Get upcoming task reminders
   */
  async getUpcomingReminders(
    daysAhead: number = 7
  ): Promise<ApiResponse<TaskReminder[]>> {
    const response = await apiGateway.route<TaskReminder[]>('NOTIFICATION', '/reminders/upcoming', {
      method: 'GET',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<TaskReminder[]>
    }

    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() + daysAhead)

      // Get tasks that are not completed and have a due date
      // Note: We're using created_at as a proxy for due_date since we don't have a due_date field yet
      // In a real implementation, you'd add a due_date field to fact_tasks
      const { data: tasks, error } = await supabase
        .from('fact_tasks')
        .select('task_id, task_title, created_at, is_completed')
        .eq('user_id', dimUser.user_id)
        .eq('is_completed', false)
        .lte('created_at', cutoffDate.toISOString())
        .gte('created_at', new Date().toISOString())

      if (error) throw error

      const reminders: TaskReminder[] = (tasks || []).map(task => {
        const dueDate = new Date(task.created_at)
        const now = new Date()
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        return {
          task_id: task.task_id,
          task_title: task.task_title,
          due_date: task.created_at,
          is_overdue: daysUntilDue < 0,
          days_until_due: daysUntilDue,
        }
      })

      return {
        success: true,
        data: reminders,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NOTIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get upcoming reminders',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(): Promise<ApiResponse<TaskReminder[]>> {
    const response = await apiGateway.route<TaskReminder[]>('NOTIFICATION', '/reminders/overdue', {
      method: 'GET',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<TaskReminder[]>
    }

    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      const now = new Date()

      // Get tasks that are not completed and are past their due date
      const { data: tasks, error } = await supabase
        .from('fact_tasks')
        .select('task_id, task_title, created_at, is_completed')
        .eq('user_id', dimUser.user_id)
        .eq('is_completed', false)
        .lt('created_at', now.toISOString())

      if (error) throw error

      const overdue: TaskReminder[] = (tasks || []).map(task => {
        const dueDate = new Date(task.created_at)
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        return {
          task_id: task.task_id,
          task_title: task.task_title,
          due_date: task.created_at,
          is_overdue: true,
          days_until_due: daysUntilDue,
        }
      })

      return {
        success: true,
        data: overdue,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NOTIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get overdue tasks',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Send reminder notification
   */
  async sendReminder(taskId: string, reminderType: 'upcoming' | 'overdue'): Promise<ApiResponse<void>> {
    const response = await apiGateway.route('NOTIFICATION', '/reminders/send', {
      method: 'POST',
      body: { task_id: taskId, type: reminderType },
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<void>
    }

    try {
      // Get task details
      const { data: task, error: taskError } = await supabase
        .from('fact_tasks')
        .select('task_title')
        .eq('task_id', taskId)
        .single()

      if (taskError) throw taskError

      const title = reminderType === 'overdue' ? 'Task Overdue' : 'Task Due Soon'
      const message = reminderType === 'overdue'
        ? `"${task.task_title}" is overdue`
        : `"${task.task_title}" is due soon`

      // Create notification
      await this.createNotification(taskId, reminderType, title, message)

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NOTIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to send reminder',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get user notification preferences
   */
  async getNotificationPreferences(): Promise<ApiResponse<NotificationPreferences>> {
    const response = await apiGateway.route<NotificationPreferences>('NOTIFICATION', '/preferences', {
      method: 'GET',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<NotificationPreferences>
    }

    try {
      // In a real implementation, this would fetch from a user_preferences table
      // For now, return defaults
      return {
        success: true,
        data: {
          email_enabled: true,
          push_enabled: false,
          reminder_before_days: 1,
          reminder_before_hours: 24,
          daily_digest: true,
          weekly_digest: true,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NOTIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get preferences',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<ApiResponse<NotificationPreferences>> {
    const response = await apiGateway.route<NotificationPreferences>('NOTIFICATION', '/preferences', {
      method: 'PUT',
      body: preferences,
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<NotificationPreferences>
    }

    try {
      // In a real implementation, this would update a user_preferences table
      const current = await this.getNotificationPreferences()
      const updated = {
        ...current.data!,
        ...preferences,
      }

      return {
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NOTIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update preferences',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get all notifications for the user
   */
  async getNotifications(
    unreadOnly: boolean = false
  ): Promise<ApiResponse<Notification[]>> {
    const response = await apiGateway.route<Notification[]>('NOTIFICATION', '/notifications', {
      method: 'GET',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<Notification[]>
    }

    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', dimUser.user_id)
        .order('created_at', { ascending: false })

      if (unreadOnly) {
        query = query.eq('is_read', false)
      }

      const { data, error } = await query

      if (error) throw error

      // Map database rows to Notification interface
      const notifications: Notification[] = (data || []).map(row => ({
        notification_id: row.notification_id,
        user_id: row.user_id,
        task_id: row.task_id,
        type: row.type as 'reminder' | 'overdue' | 'upcoming' | 'completed',
        title: row.title,
        message: row.message,
        is_read: row.is_read,
        created_at: row.created_at,
      }))

      // Filter out duplicates: keep only the most recent notification for each task_id + type combination
      const seen = new Map<string, Notification>()
      const deduplicated: Notification[] = []

      for (const notification of notifications) {
        if (notification.task_id) {
          const key = `${notification.task_id}-${notification.type}`
          const existing = seen.get(key)
          
          if (!existing || new Date(notification.created_at) > new Date(existing.created_at)) {
            // Remove old duplicate if exists
            if (existing) {
              const oldIndex = deduplicated.findIndex(n => n.notification_id === existing.notification_id)
              if (oldIndex !== -1) {
                deduplicated.splice(oldIndex, 1)
              }
            }
            seen.set(key, notification)
            deduplicated.push(notification)
          }
        } else {
          // Notifications without task_id are kept (they're unique)
          deduplicated.push(notification)
        }
      }

      // Sort by created_at descending
      deduplicated.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      return {
        success: true,
        data: deduplicated,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NOTIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get notifications',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<ApiResponse<void>> {
    const response = await apiGateway.route<void>('NOTIFICATION', `/notifications/${notificationId}/read`, {
      method: 'PUT',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<void>
    }

    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('notification_id', notificationId)
        .eq('user_id', dimUser.user_id)

      if (error) throw error

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NOTIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to mark as read',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Create a notification
   * Checks for existing notifications to prevent duplicates
   */
  async createNotification(
    taskId: string | null,
    type: 'reminder' | 'overdue' | 'upcoming' | 'completed',
    title: string,
    message: string
  ): Promise<ApiResponse<Notification>> {
    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      // Check if a notification already exists for this task and type in the last 24 hours
      if (taskId) {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const { data: existing } = await supabase
          .from('notifications')
          .select('notification_id')
          .eq('user_id', dimUser.user_id)
          .eq('task_id', taskId)
          .eq('type', type)
          .gte('created_at', yesterday.toISOString())
          .limit(1)

        if (existing && existing.length > 0) {
          // Notification already exists, return the existing one
          const { data: existingNotification } = await supabase
            .from('notifications')
            .select('*')
            .eq('notification_id', existing[0].notification_id)
            .single()

          if (existingNotification) {
            const notification: Notification = {
              notification_id: existingNotification.notification_id,
              user_id: existingNotification.user_id,
              task_id: existingNotification.task_id,
              type: existingNotification.type as 'reminder' | 'overdue' | 'upcoming' | 'completed',
              title: existingNotification.title,
              message: existingNotification.message,
              is_read: existingNotification.is_read,
              created_at: existingNotification.created_at,
            }

            return {
              success: true,
              data: notification,
              timestamp: new Date().toISOString(),
            }
          }
        }
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: dimUser.user_id,
          task_id: taskId,
          type,
          title,
          message,
          is_read: false,
        })
        .select()
        .single()

      if (error) throw error

      if (!data) {
        throw new Error('Failed to create notification')
      }

      // Map database row to Notification interface
      const notification: Notification = {
        notification_id: data.notification_id,
        user_id: data.user_id,
        task_id: data.task_id,
        type: data.type as 'reminder' | 'overdue' | 'upcoming' | 'completed',
        title: data.title,
        message: data.message,
        is_read: data.is_read,
        created_at: data.created_at,
      }

      return {
        success: true,
        data: notification,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NOTIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create notification',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Check for upcoming and overdue tasks and create notifications
   * This should be called periodically or on app load
   * Prevents concurrent calls to avoid duplicate notifications
   */
  async checkAndCreateNotifications(): Promise<ApiResponse<{ created: number }>> {
    // Prevent concurrent calls
    if (this.checkingNotifications) {
      return {
        success: true,
        data: { created: 0 },
        timestamp: new Date().toISOString(),
      }
    }

    this.checkingNotifications = true

    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      const now = new Date()

      // Get tasks that are not completed
      const { data: tasks, error: tasksError } = await supabase
        .from('fact_tasks')
        .select('task_id, task_title, created_at, is_completed, estimated_hours, due_date')
        .eq('user_id', dimUser.user_id)
        .eq('is_completed', false)

      if (tasksError) throw tasksError

      if (!tasks || tasks.length === 0) {
        return {
          success: true,
          data: { created: 0 },
          timestamp: new Date().toISOString(),
        }
      }

      // Check for existing notifications in the last 24 hours to avoid duplicates
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const { data: recentNotifications } = await supabase
        .from('notifications')
        .select('task_id, type')
        .eq('user_id', dimUser.user_id)
        .gte('created_at', yesterday.toISOString())
        .in('type', ['upcoming', 'overdue'])

      const recentNotificationKeys = new Set(
        (recentNotifications || [])
          .filter((n): n is { task_id: string; type: string } => n.task_id !== null)
          .map(n => `${n.task_id}-${n.type}`)
      )

      let createdCount = 0

      // Check each task and create notifications if needed
      for (const task of tasks) {
        // Skip if task is completed or has no due date
        if (task.is_completed || !task.due_date) {
          continue
        }

        // Use the actual due_date from the database
        const dueDate = new Date(task.due_date)
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        const isOverdue = daysUntilDue < 0
        const isUpcoming = daysUntilDue >= 0 && daysUntilDue <= 1

        // Create overdue notification
        if (isOverdue) {
          const notificationKey = `${task.task_id}-overdue`
          if (!recentNotificationKeys.has(notificationKey)) {
            const result = await this.createNotification(
              task.task_id,
              'overdue',
              'Task Overdue',
              `"${task.task_title}" is ${Math.abs(daysUntilDue)} day(s) overdue`
            )
            // Only count if notification was actually created (not a duplicate)
            if (result.success) {
              createdCount++
              recentNotificationKeys.add(notificationKey)
            }
          }
        }
        // Create upcoming notification (due within 24 hours)
        else if (isUpcoming) {
          const notificationKey = `${task.task_id}-upcoming`
          if (!recentNotificationKeys.has(notificationKey)) {
            const result = await this.createNotification(
              task.task_id,
              'upcoming',
              'Task Due Soon',
              `"${task.task_title}" is due ${daysUntilDue === 0 ? 'today' : `in ${daysUntilDue} day(s)`}`
            )
            // Only count if notification was actually created (not a duplicate)
            if (result.success) {
              createdCount++
              recentNotificationKeys.add(notificationKey)
            }
          }
        }
      }

      return {
        success: true,
        data: { created: createdCount },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NOTIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to check and create notifications',
        },
        timestamp: new Date().toISOString(),
      }
    } finally {
      this.checkingNotifications = false
    }
  }

  /**
   * Remove duplicate notifications from the database
   * Keeps only the most recent notification for each task_id + type combination
   */
  async removeDuplicateNotifications(): Promise<ApiResponse<{ removed: number }>> {
    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      // Get all notifications for the user
      const { data: allNotifications, error: fetchError } = await supabase
        .from('notifications')
        .select('notification_id, task_id, type, created_at')
        .eq('user_id', dimUser.user_id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      if (!allNotifications || allNotifications.length === 0) {
        return {
          success: true,
          data: { removed: 0 },
          timestamp: new Date().toISOString(),
        }
      }

      // Group by task_id + type, keep only the most recent one
      const seen = new Map<string, string>() // key -> notification_id to keep
      const toDelete: string[] = []

      for (const notification of allNotifications) {
        if (notification.task_id) {
          const key = `${notification.task_id}-${notification.type}`
          const existingId = seen.get(key)

          if (!existingId) {
            // First occurrence, keep it
            seen.set(key, notification.notification_id)
          } else {
            // Duplicate found, mark for deletion
            toDelete.push(notification.notification_id)
          }
        }
      }

      // Delete duplicates
      let removedCount = 0
      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('notifications')
          .delete()
          .in('notification_id', toDelete)

        if (deleteError) throw deleteError
        removedCount = toDelete.length
      }

      return {
        success: true,
        data: { removed: removedCount },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NOTIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to remove duplicates',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<ApiResponse<void>> {
    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', dimUser.user_id)
        .eq('is_read', false)

      if (error) throw error

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NOTIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to mark all as read',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }
}

// Singleton instance
export const notificationService = new NotificationService()

