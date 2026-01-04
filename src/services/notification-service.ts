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
      // In a real implementation, this would:
      // 1. Create a notification record
      // 2. Send email/push notification based on user preferences
      // 3. Log the notification

      // For now, we'll just log it
      console.log(`Sending ${reminderType} reminder for task ${taskId}`)

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
    _unreadOnly: boolean = false
  ): Promise<ApiResponse<Notification[]>> {
    const response = await apiGateway.route<Notification[]>('NOTIFICATION', '/notifications', {
      method: 'GET',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<Notification[]>
    }

    try {
      // In a real implementation, this would fetch from a notifications table
      // For now, return empty array
      return {
        success: true,
        data: [],
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
      // In a real implementation, this would update the notification record
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
}

// Singleton instance
export const notificationService = new NotificationService()

