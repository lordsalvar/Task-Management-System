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

      const taskData: FactTaskInsert = {
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

      const { data, error } = await supabase
        .from('fact_tasks')
        .insert(taskData)
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

      const enrichedTasks = await Promise.all(
        (data || []).map(task => this.enrichTask(task))
      )

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

      const updateData: Partial<FactTaskInsert> = {}
      
      if (request.task_title !== undefined) updateData.task_title = request.task_title
      if (request.task_description !== undefined) updateData.task_description = request.task_description
      if (request.category_id !== undefined) updateData.category_id = request.category_id
      if (request.status_id !== undefined) updateData.status_id = request.status_id
      if (request.task_priority !== undefined) updateData.task_priority = request.task_priority
      if (request.estimated_hours !== undefined) updateData.estimated_hours = request.estimated_hours
      if (request.actual_hours !== undefined) updateData.actual_hours = request.actual_hours

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
  private async enrichTask(task: FactTask): Promise<TaskWithRelations> {
    const enriched: TaskWithRelations = {
      ...task,
      status: { status_id: 0, status_name: '', status_order: 0 },
    }

    // Fetch status
    const { data: status } = await supabase
      .from('dim_status')
      .select('*')
      .eq('status_id', task.status_id)
      .single()

    if (status) {
      enriched.status = {
        status_id: status.status_id,
        status_name: status.status_name,
        status_order: status.status_order,
      }
    }

    // Fetch category if exists
    if (task.category_id) {
      const { data: category } = await supabase
        .from('dim_category')
        .select('*')
        .eq('category_id', task.category_id)
        .single()

      if (category) {
        enriched.category = {
          category_id: category.category_id,
          category_name: category.category_name,
          color: category.color,
        }
      }
    }

    // Fetch created date
    const { data: createdDate } = await supabase
      .from('dim_date')
      .select('date, year, month, month_name')
      .eq('date_id', task.created_date_id)
      .single()

    if (createdDate) {
      enriched.created_date = createdDate
    }

    // Fetch completed date if exists
    if (task.completed_date_id) {
      const { data: completedDate } = await supabase
        .from('dim_date')
        .select('date, year, month, month_name')
        .eq('date_id', task.completed_date_id)
        .single()

      if (completedDate) {
        enriched.completed_date = completedDate
      }
    }

    return enriched
  }
}

// Singleton instance
export const taskService = new TaskService()

