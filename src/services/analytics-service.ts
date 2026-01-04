/**
 * Analytics Service
 * 
 * Responsibility: Analyzes historical task data
 */

import { supabase } from '../lib/supabase'
import { apiGateway } from './api-gateway'
import type { ApiResponse } from './types'
import { getCurrentUserDimUser } from '../lib/db-helpers'

export interface TaskCompletionStats {
  total_tasks: number
  completed_tasks: number
  pending_tasks: number
  in_progress_tasks: number
  completion_rate: number
}

export interface TimeSeriesData {
  date: string
  created: number
  completed: number
  in_progress: number
}

export interface CategoryStats {
  category_id: number
  category_name: string
  total_tasks: number
  completed_tasks: number
  completion_rate: number
  avg_hours: number | null
}

export interface PriorityStats {
  priority: number
  total_tasks: number
  completed_tasks: number
  completion_rate: number
}

export interface ProductivityMetrics {
  tasks_per_day: number
  avg_completion_time_hours: number | null
  most_productive_day: string
  most_productive_month: string
  peak_hours: number[]
}

export interface AnalyticsReport {
  period: {
    start: string
    end: string
  }
  completion_stats: TaskCompletionStats
  time_series: TimeSeriesData[]
  category_stats: CategoryStats[]
  priority_stats: PriorityStats[]
  productivity_metrics: ProductivityMetrics
}

class AnalyticsService {
  /**
   * Get task completion statistics
   */
  async getCompletionStats(
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<TaskCompletionStats>> {
    const response = await apiGateway.route<TaskCompletionStats>('ANALYTICS', '/stats/completion', {
      method: 'GET',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<TaskCompletionStats>
    }

    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      let query = supabase
        .from('fact_tasks')
        .select('status_id, is_completed', { count: 'exact' })
        .eq('user_id', dimUser.user_id)

      if (startDate) {
        query = query.gte('created_at', startDate)
      }
      if (endDate) {
        query = query.lte('created_at', endDate)
      }

      const { data, error, count } = await query

      if (error) throw error

      const totalTasks = count || 0
      const completedTasks = data?.filter(t => t.is_completed).length || 0
      const pendingTasks = data?.filter(t => t.status_id === 1).length || 0
      const inProgressTasks = data?.filter(t => t.status_id === 2).length || 0

      return {
        success: true,
        data: {
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          pending_tasks: pendingTasks,
          in_progress_tasks: inProgressTasks,
          completion_rate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get completion stats',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get time series data for task creation and completion
   */
  async getTimeSeriesData(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<ApiResponse<TimeSeriesData[]>> {
    const response = await apiGateway.route<TimeSeriesData[]>('ANALYTICS', '/stats/timeseries', {
      method: 'GET',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<TimeSeriesData[]>
    }

    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      // Get tasks with date information
      const { data: tasks, error } = await supabase
        .from('fact_tasks')
        .select(`
          created_date_id,
          completed_date_id,
          status_id,
          is_completed,
          dim_date!fact_tasks_created_date_id_fkey(date, year, month, week),
          dim_date!fact_tasks_completed_date_id_fkey(date)
        `)
        .eq('user_id', dimUser.user_id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      if (error) throw error

      // Group by date based on granularity
      const grouped = new Map<string, { created: number; completed: number; in_progress: number }>()

      tasks?.forEach(task => {
        const createdDate = (task.dim_date as any)?.date || ''
        let key = createdDate

        if (granularity === 'week') {
          // Extract week from date
          const date = new Date(createdDate)
          const week = this.getWeekNumber(date)
          key = `${date.getFullYear()}-W${week.toString().padStart(2, '0')}`
        } else if (granularity === 'month') {
          const date = new Date(createdDate)
          key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
        }

        if (!grouped.has(key)) {
          grouped.set(key, { created: 0, completed: 0, in_progress: 0 })
        }

        const stats = grouped.get(key)!
        stats.created++

        if (task.is_completed) {
          stats.completed++
        } else if (task.status_id === 2) {
          stats.in_progress++
        }
      })

      const timeSeries: TimeSeriesData[] = Array.from(grouped.entries())
        .map(([date, stats]) => ({
          date,
          ...stats,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return {
        success: true,
        data: timeSeries,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get time series data',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<CategoryStats[]>> {
    const response = await apiGateway.route<CategoryStats[]>('ANALYTICS', '/stats/categories', {
      method: 'GET',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<CategoryStats[]>
    }

    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      let query = supabase
        .from('fact_tasks')
        .select('category_id, is_completed, actual_hours')
        .eq('user_id', dimUser.user_id)
        .not('category_id', 'is', null)

      if (startDate) {
        query = query.gte('created_at', startDate)
      }
      if (endDate) {
        query = query.lte('created_at', endDate)
      }

      const { data: tasks, error } = await query

      if (error) throw error

      // Group by category
      const categoryMap = new Map<number, {
        total: number
        completed: number
        hours: number[]
      }>()

      tasks?.forEach(task => {
        if (!task.category_id) return

        if (!categoryMap.has(task.category_id)) {
          categoryMap.set(task.category_id, { total: 0, completed: 0, hours: [] })
        }

        const stats = categoryMap.get(task.category_id)!
        stats.total++
        if (task.is_completed) {
          stats.completed++
        }
        if (task.actual_hours) {
          stats.hours.push(task.actual_hours)
        }
      })

      // Fetch category names
      const categoryIds = Array.from(categoryMap.keys())
      const { data: categories } = await supabase
        .from('dim_category')
        .select('category_id, category_name')
        .in('category_id', categoryIds)

      const categoryStats: CategoryStats[] = Array.from(categoryMap.entries())
        .map(([categoryId, stats]) => {
          const category = categories?.find(c => c.category_id === categoryId)
          const avgHours = stats.hours.length > 0
            ? stats.hours.reduce((a, b) => a + b, 0) / stats.hours.length
            : null

          return {
            category_id: categoryId,
            category_name: category?.category_name || 'Unknown',
            total_tasks: stats.total,
            completed_tasks: stats.completed,
            completion_rate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
            avg_hours: avgHours,
          }
        })

      return {
        success: true,
        data: categoryStats,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get category stats',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get priority statistics
   */
  async getPriorityStats(
    _startDate?: string,
    _endDate?: string
  ): Promise<ApiResponse<PriorityStats[]>> {
    // TODO: Implement priority stats
    return {
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Get comprehensive analytics report
   */
  async getAnalyticsReport(
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<AnalyticsReport>> {
    const response = await apiGateway.route<AnalyticsReport>('ANALYTICS', '/report', {
      method: 'GET',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<AnalyticsReport>
    }

    try {
      const [completionStats, timeSeries, categoryStats, priorityStats] = await Promise.all([
        this.getCompletionStats(startDate, endDate),
        this.getTimeSeriesData(startDate, endDate, 'day'),
        this.getCategoryStats(startDate, endDate),
        this.getPriorityStats(startDate, endDate),
      ])

      if (!completionStats.success || !timeSeries.success || !categoryStats.success || !priorityStats.success) {
        throw new Error('Failed to fetch analytics data')
      }

      return {
        success: true,
        data: {
          period: {
            start: startDate,
            end: endDate,
          },
          completion_stats: completionStats.data!,
          time_series: timeSeries.data!,
          category_stats: categoryStats.data!,
          priority_stats: priorityStats.data!,
          productivity_metrics: {
            tasks_per_day: 0,
            avg_completion_time_hours: null,
            most_productive_day: '',
            most_productive_month: '',
            peak_hours: [],
          }, // TODO: Implement productivity metrics
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate analytics report',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Helper: Get week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  }
}

// Singleton instance
export const analyticsService = new AnalyticsService()

