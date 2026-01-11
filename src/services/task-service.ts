/**
 * Task Service
 * 
 * Responsibility: Handles CRUD operations for tasks
 */

import { supabase } from '../lib/supabase'
import { apiGateway } from './api-gateway'
import type { ApiResponse, PaginatedResponse, PaginationParams } from './types'
import { getOrCreateDateId, getDefaultStatusId, getCurrentUserDimUser, logTaskChange } from '../lib/db-helpers'
import type { FactTask, FactTaskInsert } from '../lib/db-helpers'
import { notificationService } from './notification-service'

export interface Task {
  task_id: string
  user_id: string
  category_id: number | null
  status_id: number
  created_date_id: number
  completed_date_id: number | null
  task_title: string
  task_description: string | null
  task_priority: number | null
  estimated_hours: number | null
  actual_hours: number | null
  is_completed: boolean
  completed_at: string | null
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface TaskWithRelations extends Task {
  category?: {
    category_id: number
    category_name: string
    color: string | null
  }
  status: {
    status_id: number
    status_name: string
    status_order: number
  }
  created_date?: {
    date: string
    year: number
    month: number
    month_name: string
  }
  completed_date?: {
    date: string
    year: number
    month: number
    month_name: string
  }
}

export interface CreateTaskRequest {
  task_title: string
  task_description?: string
  category_id?: number | null
  status_id?: number
  task_priority?: number
  estimated_hours?: number
  due_date?: string // ISO date string
}

export interface UpdateTaskRequest {
  task_title?: string
  task_description?: string
  category_id?: number | null
  status_id?: number
  task_priority?: number
  estimated_hours?: number
  actual_hours?: number
  is_completed?: boolean
  due_date?: string
}

export interface TaskFilter {
  status_id?: number
  category_id?: number
  is_completed?: boolean
  priority?: number
  date_from?: string
  date_to?: string
}

class TaskService {
  // Cache for frequently accessed data
  private statusCache: Map<number, { status_id: number; status_name: string; status_order: number }> = new Map()
  private categoryCache: Map<number, { category_id: number; category_name: string; color: string | null }> = new Map()
  private dateCache: Map<number, { date: string; year: number; month: number; month_name: string }> = new Map()
  private cacheInitialized = false

  /**
   * Clear caches (useful when categories/statuses are updated)
   */
  clearCaches(): void {
    this.statusCache.clear()
    this.categoryCache.clear()
    this.dateCache.clear()
    this.cacheInitialized = false
  }

  /**
   * Initialize caches for statuses, categories, and dates
   */
  private async initializeCaches(): Promise<void> {
    if (this.cacheInitialized) return

    try {
      // Fetch all statuses
      const { data: statuses } = await supabase
        .from('dim_status')
        .select('status_id, status_name, status_order')

      if (statuses) {
        statuses.forEach(status => {
          this.statusCache.set(status.status_id, status)
        })
      }

      // Fetch all categories
      const { data: categories } = await supabase
        .from('dim_category')
        .select('category_id, category_name, color')

      if (categories) {
        categories.forEach(category => {
          this.categoryCache.set(category.category_id, category)
        })
      }

      this.cacheInitialized = true
    } catch (error) {
      console.error('Failed to initialize caches:', error)
    }
  }

  /**
   * Batch enrich multiple tasks efficiently
   */
  private async enrichTasksBatch(tasks: FactTask[]): Promise<TaskWithRelations[]> {
    await this.initializeCaches()

    // Collect all unique IDs we need to fetch
    const statusIds = new Set<number>()
    const categoryIds = new Set<number>()
    const dateIds = new Set<number>()

    tasks.forEach(task => {
      statusIds.add(task.status_id)
      if (task.category_id) categoryIds.add(task.category_id)
      dateIds.add(task.created_date_id)
      if (task.completed_date_id) dateIds.add(task.completed_date_id)
    })

    // Batch fetch missing data
    const fetchPromises: Promise<void>[] = []

    // Fetch missing statuses
    const missingStatusIds = Array.from(statusIds).filter(id => !this.statusCache.has(id))
    if (missingStatusIds.length > 0) {
      fetchPromises.push(
        (async () => {
          const { data } = await supabase
            .from('dim_status')
            .select('status_id, status_name, status_order')
            .in('status_id', missingStatusIds)
          if (data) {
            data.forEach(status => {
              this.statusCache.set(status.status_id, status)
            })
          }
        })()
      )
    }

    // Fetch missing categories
    const missingCategoryIds = Array.from(categoryIds).filter(id => !this.categoryCache.has(id))
    if (missingCategoryIds.length > 0) {
      fetchPromises.push(
        (async () => {
          const { data } = await supabase
            .from('dim_category')
            .select('category_id, category_name, color')
            .in('category_id', missingCategoryIds)
          if (data) {
            data.forEach(category => {
              this.categoryCache.set(category.category_id, category)
            })
          }
        })()
      )
    }

    // Fetch missing dates
    const missingDateIds = Array.from(dateIds).filter(id => !this.dateCache.has(id))
    if (missingDateIds.length > 0) {
      fetchPromises.push(
        (async () => {
          const { data } = await supabase
            .from('dim_date')
            .select('date_id, date, year, month, month_name')
            .in('date_id', missingDateIds)
          if (data) {
            data.forEach(date => {
              this.dateCache.set(date.date_id, {
                date: date.date,
                year: date.year,
                month: date.month,
                month_name: date.month_name,
              })
            })
          }
        })()
      )
    }

    // Wait for all batch fetches to complete
    await Promise.all(fetchPromises)

    // Now enrich all tasks using cached data
    return tasks.map(task => {
      const enriched: TaskWithRelations = {
        ...task,
        status: this.statusCache.get(task.status_id) || {
          status_id: task.status_id,
          status_name: '',
          status_order: 0,
        },
      }

      if (task.category_id) {
        const category = this.categoryCache.get(task.category_id)
        if (category) {
          enriched.category = category
        }
      }

      const createdDate = this.dateCache.get(task.created_date_id)
      if (createdDate) {
        enriched.created_date = createdDate
      }

      if (task.completed_date_id) {
        const completedDate = this.dateCache.get(task.completed_date_id)
        if (completedDate) {
          enriched.completed_date = completedDate
        }
      }

      return enriched
    })
  }

  /**
   * Create a new task
   */
  async createTask(request: CreateTaskRequest): Promise<ApiResponse<TaskWithRelations>> {
    const response = await apiGateway.route<TaskWithRelations>('TASK', '/tasks', {
      method: 'POST',
      body: request,
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<TaskWithRelations>
    }

    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      const createdDateId = await getOrCreateDateId(new Date())
      const statusId = request.status_id || await getDefaultStatusId()

      const taskData: FactTaskInsert & { due_date?: string } = {
        user_id: dimUser.user_id,
        category_id: request.category_id || null,
        status_id: statusId,
        created_date_id: createdDateId,
        task_title: request.task_title,
        task_description: request.task_description || null,
        task_priority: request.task_priority || null,
        estimated_hours: request.estimated_hours || null,
        is_completed: false,
      }

      // Add due_date if provided
      if (request.due_date) {
        taskData.due_date = request.due_date
      }

      const { data, error } = await supabase
        .from('fact_tasks')
        .insert(taskData)
        .select()
        .single()

      if (error) throw error

      const enrichedTask = await this.enrichTask(data)

      // Create notification for task creation
      let creationMessage = `Task "${request.task_title}" has been created`
      if (request.due_date) {
        const dueDate = new Date(request.due_date)
        const formattedDate = dueDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        creationMessage += `. Due date: ${formattedDate}`
      }
      creationMessage += '.'
      
      await notificationService.createNotification(
        data.task_id,
        'reminder',
        'New Task Created',
        creationMessage
      ).catch(error => {
        // Don't fail task creation if notification fails
        console.error('Failed to create notification for task creation:', error)
      })

      return {
        success: true,
        data: enrichedTask,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CREATE_TASK_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create task',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<ApiResponse<TaskWithRelations>> {
    const response = await apiGateway.route<TaskWithRelations>('TASK', `/tasks/${taskId}`, {
      method: 'GET',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<TaskWithRelations>
    }

    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      const { data, error } = await supabase
        .from('fact_tasks')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', dimUser.user_id)
        .single()

      if (error) throw error

      return {
        success: true,
        data: await this.enrichTask(data),
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_TASK_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get task',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get all tasks with filters and pagination
   */
  async getTasks(
    filters?: TaskFilter,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<TaskWithRelations>>> {
    const response = await apiGateway.route<PaginatedResponse<TaskWithRelations>>('TASK', '/tasks', {
      method: 'GET',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<PaginatedResponse<TaskWithRelations>>
    }

    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      let query = supabase
        .from('fact_tasks')
        .select('*', { count: 'exact' })
        .eq('user_id', dimUser.user_id)

      // Apply filters
      if (filters?.status_id) {
        query = query.eq('status_id', filters.status_id)
      }
      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id)
      }
      if (filters?.is_completed !== undefined) {
        query = query.eq('is_completed', filters.is_completed)
      }
      if (filters?.priority) {
        query = query.eq('task_priority', filters.priority)
      }
      if (filters?.date_from) {
        // This would need a join with dim_date, simplified for now
        query = query.gte('created_at', filters.date_from)
      }
      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to)
      }

      // Apply pagination
      const page = pagination?.page || 1
      const limit = pagination?.limit || 20
      const offset = pagination?.offset || (page - 1) * limit

      query = query.order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error

      // Use batch enrichment instead of individual enrichment
      const enrichedTasks = await this.enrichTasksBatch(data || [])

      return {
        success: true,
        data: {
          items: enrichedTasks,
          total: count || 0,
          page,
          limit,
          hasMore: (count || 0) > offset + limit,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_TASKS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get tasks',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, request: UpdateTaskRequest): Promise<ApiResponse<TaskWithRelations>> {
    const response = await apiGateway.route<TaskWithRelations>('TASK', `/tasks/${taskId}`, {
      method: 'PUT',
      body: request,
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<TaskWithRelations>
    }

    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      // Get current task state to track changes
      const { data: currentTask } = await supabase
        .from('fact_tasks')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', dimUser.user_id)
        .single()

      if (!currentTask) {
        throw new Error('Task not found')
      }

      const updateData: Partial<FactTaskInsert & { due_date?: string }> = {}
      
      if (request.task_title !== undefined) updateData.task_title = request.task_title
      if (request.task_description !== undefined) updateData.task_description = request.task_description
      if (request.category_id !== undefined) updateData.category_id = request.category_id
      if (request.status_id !== undefined) updateData.status_id = request.status_id
      if (request.task_priority !== undefined) updateData.task_priority = request.task_priority
      if (request.estimated_hours !== undefined) updateData.estimated_hours = request.estimated_hours
      if (request.actual_hours !== undefined) updateData.actual_hours = request.actual_hours
      if (request.due_date !== undefined) {
        updateData.due_date = request.due_date || undefined
      }

      // Handle completion - log date changes
      if (request.is_completed !== undefined) {
        const wasCompleted = currentTask.is_completed
        const oldCompletedAt = currentTask.completed_at

        updateData.is_completed = request.is_completed
        if (request.is_completed) {
          const newCompletedAt = new Date().toISOString()
          const newCompletedDateId = await getOrCreateDateId(new Date())
          updateData.completed_at = newCompletedAt
          updateData.completed_date_id = newCompletedDateId

          // Log completion with date
          await logTaskChange(
            taskId,
            dimUser.user_id,
            wasCompleted ? 'date_changed' : 'completed',
            'completed_at',
            oldCompletedAt,
            newCompletedAt,
            newCompletedAt,
            newCompletedDateId
          )

          // Create notification for task completion (only if it wasn't already completed)
          if (!wasCompleted) {
            let completionMessage = `Task "${currentTask.task_title}" has been completed.`
            const taskAny = currentTask as any
            if (taskAny.due_date) {
              const dueDate = new Date(taskAny.due_date)
              const formattedDate = dueDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
              completionMessage += ` Due date was: ${formattedDate}.`
            }
            completionMessage += ' Great job!'
            
            await notificationService.createNotification(
              taskId,
              'completed',
              'Task Completed',
              completionMessage
            ).catch(error => {
              // Don't fail task update if notification fails
              console.error('Failed to create notification for task completion:', error)
            })
          }
        } else {
          // Log uncompletion
          await logTaskChange(
            taskId,
            dimUser.user_id,
            'uncompleted',
            'completed_at',
            oldCompletedAt,
            null,
            null,
            null
          )
          updateData.completed_at = null
          updateData.completed_date_id = null
        }
      } else if (request.is_completed === undefined && currentTask.completed_at) {
        // Check if completed_at date changed (e.g., manual date update)
        // This would be handled if there's a direct date update in the future
      }

      // Log status changes
      if (request.status_id !== undefined && request.status_id !== currentTask.status_id) {
        await logTaskChange(
          taskId,
          dimUser.user_id,
          'status_changed',
          'status_id',
          currentTask.status_id.toString(),
          request.status_id.toString()
        )
      }

      const { data, error } = await supabase
        .from('fact_tasks')
        .update(updateData)
        .eq('task_id', taskId)
        .eq('user_id', dimUser.user_id)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data: await this.enrichTask(data),
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UPDATE_TASK_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update task',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<ApiResponse<void>> {
    const response = await apiGateway.route<void>('TASK', `/tasks/${taskId}`, {
      method: 'DELETE',
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
        .from('fact_tasks')
        .delete()
        .eq('task_id', taskId)
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
          code: 'DELETE_TASK_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete task',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Enrich task with related dimension data
   */
  /**
   * Enrich a single task with related data (status, category, dates)
   * Uses cache when available, falls back to individual queries if needed
   */
  private async enrichTask(task: FactTask): Promise<TaskWithRelations> {
    await this.initializeCaches()

    const enriched: TaskWithRelations = {
      ...task,
      status: this.statusCache.get(task.status_id) || {
        status_id: task.status_id,
        status_name: '',
        status_order: 0,
      },
    }

    // Fetch status from cache or database
    if (!this.statusCache.has(task.status_id)) {
      const { data: status } = await supabase
        .from('dim_status')
        .select('status_id, status_name, status_order')
        .eq('status_id', task.status_id)
        .single()

      if (status) {
        this.statusCache.set(status.status_id, status)
        enriched.status = status
      }
    } else {
      enriched.status = this.statusCache.get(task.status_id)!
    }

    // Fetch category if exists
    if (task.category_id) {
      if (this.categoryCache.has(task.category_id)) {
        enriched.category = this.categoryCache.get(task.category_id)!
      } else {
        const { data: category } = await supabase
          .from('dim_category')
          .select('category_id, category_name, color')
          .eq('category_id', task.category_id)
          .single()

        if (category) {
          this.categoryCache.set(category.category_id, category)
          enriched.category = category
        }
      }
    }

    // Fetch created date
    if (this.dateCache.has(task.created_date_id)) {
      enriched.created_date = this.dateCache.get(task.created_date_id)!
    } else {
      const { data: createdDate } = await supabase
        .from('dim_date')
        .select('date_id, date, year, month, month_name')
        .eq('date_id', task.created_date_id)
        .single()

      if (createdDate) {
        const dateData = {
          date: createdDate.date,
          year: createdDate.year,
          month: createdDate.month,
          month_name: createdDate.month_name,
        }
        this.dateCache.set(createdDate.date_id, dateData)
        enriched.created_date = dateData
      }
    }

    // Fetch completed date if exists
    if (task.completed_date_id) {
      if (this.dateCache.has(task.completed_date_id)) {
        enriched.completed_date = this.dateCache.get(task.completed_date_id)!
      } else {
        const { data: completedDate } = await supabase
          .from('dim_date')
          .select('date_id, date, year, month, month_name')
          .eq('date_id', task.completed_date_id)
          .single()

        if (completedDate) {
          const dateData = {
            date: completedDate.date,
            year: completedDate.year,
            month: completedDate.month,
            month_name: completedDate.month_name,
          }
          this.dateCache.set(completedDate.date_id, dateData)
          enriched.completed_date = dateData
        }
      }
    }

    return enriched
  }

  /**
   * Check and update overdue tasks
   * This calls the database function to mark tasks as overdue if their due_date has passed
   * Also creates notifications for newly overdue tasks
   */
  async checkAndUpdateOverdueTasks(): Promise<ApiResponse<{ updated_count: number }>> {
    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      // Get the Overdue status ID
      const { data: overdueStatus } = await supabase
        .from('dim_status')
        .select('status_id')
        .eq('status_name', 'Overdue')
        .single()

      if (!overdueStatus) {
        // Overdue status doesn't exist, just run the check without notifications
        const { data: functionResult, error: functionError } = await supabase.rpc(
          'check_and_update_overdue_tasks' as any,
          {}
        )
        if (functionError) throw functionError
        const updatedCount = functionResult && Array.isArray(functionResult) && functionResult.length > 0
          ? (functionResult[0] as { updated_count: number }).updated_count
          : 0
        return {
          success: true,
          data: { updated_count: updatedCount },
          timestamp: new Date().toISOString(),
        }
      }

      const overdueStatusId = overdueStatus.status_id

      // Get list of tasks that are already overdue before the update
      const { data: previouslyOverdue } = await supabase
        .from('fact_tasks')
        .select('task_id')
        .eq('user_id', dimUser.user_id)
        .eq('is_completed', false)
        .not('due_date', 'is', null)
        .lt('due_date', new Date().toISOString())
        .eq('status_id', overdueStatusId)

      const previouslyOverdueIds = new Set((previouslyOverdue || []).map(t => t.task_id))

      // Call the database function via RPC
      const { data: functionResult, error: functionError } = await supabase.rpc(
        'check_and_update_overdue_tasks' as any,
        {}
      )

      if (functionError) throw functionError

      const updatedCount = functionResult && Array.isArray(functionResult) && functionResult.length > 0
        ? (functionResult[0] as { updated_count: number }).updated_count
        : 0

      // Get tasks that are now overdue (after the update)
      const { data: nowOverdue } = await supabase
        .from('fact_tasks')
        .select('task_id, task_title, due_date')
        .eq('user_id', dimUser.user_id)
        .eq('is_completed', false)
        .eq('status_id', overdueStatusId)
        .not('due_date', 'is', null)

      // Find newly overdue tasks (tasks that are now overdue but weren't before)
      const newlyOverdue = (nowOverdue || []).filter(task => !previouslyOverdueIds.has(task.task_id))

      // Create notifications for newly overdue tasks
      for (const task of newlyOverdue) {
        let overdueMessage = `Task "${task.task_title}" is now overdue.`
        if (task.due_date) {
          const dueDate = new Date(task.due_date)
          const formattedDate = dueDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
          overdueMessage += ` Due date was: ${formattedDate}.`
        }
        overdueMessage += ' Please complete it soon.'
        
        await notificationService.createNotification(
          task.task_id,
          'overdue',
          'Task Overdue',
          overdueMessage
        ).catch(error => {
          // Don't fail if notification creation fails
          console.error(`Failed to create notification for overdue task ${task.task_id}:`, error)
        })
      }

      return {
        success: true,
        data: {
          updated_count: updatedCount,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'OVERDUE_CHECK_ERROR',
          message: error instanceof Error ? error.message : 'Failed to check overdue tasks',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }
}

// Singleton instance
export const taskService = new TaskService()

