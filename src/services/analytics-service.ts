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

export interface DayOfWeekCompletion {
  day_name: string
  day_of_week: number
  completed_count: number
}

export interface OnTimeCompletionStats {
  total_completed: number
  on_time_count: number
  late_count: number
  on_time_percentage: number
}

export interface CategoryCompletionTime {
  category_id: number
  category_name: string
  avg_completion_hours: number | null
  avg_completion_days: number | null
  task_count: number
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

      // Get completion logs for more accurate completion tracking
      const { data: completionLogs } = await supabase
        .from('task_logs')
        .select(`
          completed_at,
          completed_date_id,
          log_date_id,
          dim_date!task_logs_completed_date_id_fkey(date, year, month, week),
          dim_date!task_logs_log_date_id_fkey(date)
        `)
        .eq('user_id', dimUser.user_id)
        .in('change_type', ['completed', 'date_changed'])
        .not('completed_at', 'is', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      // Group by date based on granularity
      const grouped = new Map<string, { created: number; completed: number; in_progress: number }>()

      // Process task creations
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

        if (task.status_id === 2) {
          stats.in_progress++
        }
      })

      // Process completion logs - use logs for accurate completion dates
      completionLogs?.forEach(log => {
        const completedDate = (log.dim_date as any)?.date || ''
        if (!completedDate) return

        let key = completedDate

        if (granularity === 'week') {
          const date = new Date(completedDate)
          const week = this.getWeekNumber(date)
          key = `${date.getFullYear()}-W${week.toString().padStart(2, '0')}`
        } else if (granularity === 'month') {
          const date = new Date(completedDate)
          key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
        }

        if (!grouped.has(key)) {
          grouped.set(key, { created: 0, completed: 0, in_progress: 0 })
        }

        const stats = grouped.get(key)!
        stats.completed++
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
          productivity_metrics: await this.calculateProductivityMetrics(startDate, endDate),
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
   * Calculate productivity metrics using task logs
   */
  private async calculateProductivityMetrics(
    startDate: string,
    endDate: string
  ): Promise<ProductivityMetrics> {
    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        return {
          tasks_per_day: 0,
          avg_completion_time_hours: null,
          most_productive_day: '',
          most_productive_month: '',
          peak_hours: [],
        }
      }

      // Get tasks with creation and completion dates
      const { data: tasks } = await supabase
        .from('fact_tasks')
        .select('task_id, created_at, completed_at, actual_hours')
        .eq('user_id', dimUser.user_id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('completed_at', 'is', null)

      // Get completion logs for accurate completion times
      const { data: completionLogs } = await supabase
        .from('task_logs')
        .select('task_id, completed_at, log_date_id, dim_date!task_logs_completed_date_id_fkey(day_name, month_name)')
        .eq('user_id', dimUser.user_id)
        .in('change_type', ['completed', 'date_changed'])
        .not('completed_at', 'is', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      if (!tasks || !completionLogs) {
        return {
          tasks_per_day: 0,
          avg_completion_time_hours: null,
          most_productive_day: '',
          most_productive_month: '',
          peak_hours: [],
        }
      }

      // Calculate tasks per day
      const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) || 1
      const tasksPerDay = tasks.length / daysDiff

      // Calculate average completion time
      const completionTimes: number[] = []
      tasks.forEach(task => {
        if (task.completed_at && task.created_at) {
          const created = new Date(task.created_at).getTime()
          const completed = new Date(task.completed_at).getTime()
          const hours = (completed - created) / (1000 * 60 * 60)
          if (hours > 0) {
            completionTimes.push(hours)
          }
        }
      })
      const avgCompletionTime = completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : null

      // Find most productive day and month from completion logs
      const dayCounts = new Map<string, number>()
      const monthCounts = new Map<string, number>()

      completionLogs.forEach(log => {
        const dateInfo = (log.dim_date as any)
        if (dateInfo) {
          const dayName = dateInfo.day_name || ''
          const monthName = dateInfo.month_name || ''
          
          if (dayName) {
            dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1)
          }
          if (monthName) {
            monthCounts.set(monthName, (monthCounts.get(monthName) || 0) + 1)
          }
        }
      })

      const mostProductiveDay = Array.from(dayCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || ''
      const mostProductiveMonth = Array.from(monthCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || ''

      // Extract peak hours from completion times
      const hourCounts = new Map<number, number>()
      completionLogs.forEach(log => {
        if (log.completed_at) {
          const hour = new Date(log.completed_at).getHours()
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
        }
      })
      const peakHours = Array.from(hourCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => hour)

      return {
        tasks_per_day: Math.round(tasksPerDay * 100) / 100,
        avg_completion_time_hours: avgCompletionTime ? Math.round(avgCompletionTime * 100) / 100 : null,
        most_productive_day: mostProductiveDay,
        most_productive_month: mostProductiveMonth,
        peak_hours: peakHours,
      }
    } catch (error) {
      console.error('Error calculating productivity metrics:', error)
      return {
        tasks_per_day: 0,
        avg_completion_time_hours: null,
        most_productive_day: '',
        most_productive_month: '',
        peak_hours: [],
      }
    }
  }

  /**
   * Get task completion logs for analytics
   * This provides accurate completion dates from logs
   */
  async getCompletionLogs(
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<Array<{
    task_id: string
    completed_at: string
    completed_date_id: number
    log_date_id: number
  }>>> {
    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      let query = supabase
        .from('task_logs')
        .select('task_id, completed_at, completed_date_id, log_date_id')
        .eq('user_id', dimUser.user_id)
        .in('change_type', ['completed', 'date_changed'])
        .not('completed_at', 'is', null)
        .not('completed_date_id', 'is', null)

      if (startDate) {
        query = query.gte('created_at', startDate)
      }
      if (endDate) {
        query = query.lte('created_at', endDate)
      }

      const { data, error } = await query.order('completed_at', { ascending: false })

      if (error) throw error

      // Filter out any null values (shouldn't happen due to .not() filters, but TypeScript needs this)
      const filteredData = (data || []).filter(
        (log): log is { task_id: string; completed_at: string; completed_date_id: number; log_date_id: number } =>
          log.completed_at !== null && log.completed_date_id !== null
      )

      return {
        success: true,
        data: filteredData,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get completion logs',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get completion statistics by day of week
   * Business Question 1: Which days of the week have the highest number of completed tasks?
   */
  async getCompletionByDayOfWeek(
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<DayOfWeekCompletion[]>> {
    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      // Get completion logs with date information
      let query = supabase
        .from('task_logs')
        .select(`
          completed_date_id,
          dim_date!task_logs_completed_date_id_fkey(day_name, day_of_week)
        `)
        .eq('user_id', dimUser.user_id)
        .in('change_type', ['completed', 'date_changed'])
        .not('completed_at', 'is', null)
        .not('completed_date_id', 'is', null)

      if (startDate) {
        query = query.gte('created_at', startDate)
      }
      if (endDate) {
        query = query.lte('created_at', endDate)
      }

      const { data: logs, error } = await query

      if (error) throw error

      // Group by day of week
      const dayCounts = new Map<string, { day_name: string; day_of_week: number; count: number }>()

      logs?.forEach(log => {
        const dateInfo = (log.dim_date as any)
        if (dateInfo && dateInfo.day_name) {
          const dayName = dateInfo.day_name
          const dayOfWeek = dateInfo.day_of_week

          if (!dayCounts.has(dayName)) {
            dayCounts.set(dayName, {
              day_name: dayName,
              day_of_week: dayOfWeek,
              count: 0,
            })
          }

          const dayData = dayCounts.get(dayName)!
          dayData.count++
        }
      })

      // Convert to array and sort by day of week (Monday = 1, Sunday = 7)
      const result: DayOfWeekCompletion[] = Array.from(dayCounts.values())
        .map(day => ({
          day_name: day.day_name,
          day_of_week: day.day_of_week,
          completed_count: day.count,
        }))
        .sort((a, b) => a.day_of_week - b.day_of_week)

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get completion by day of week',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get on-time completion percentage
   * Business Question 2: What percentage of tasks are completed on or before their due dates?
   * 
   * Note: Since due_date is not yet in the database schema, we'll use created_at + estimated_hours
   * as a proxy for due date, or we can calculate based on average completion time.
   * For now, we'll use a simple approach: tasks completed within estimated time or within 7 days of creation.
   */
  async getOnTimeCompletionStats(
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<OnTimeCompletionStats>> {
    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      // Get completed tasks with creation and completion dates
      let query = supabase
        .from('fact_tasks')
        .select('task_id, created_at, completed_at, estimated_hours, actual_hours')
        .eq('user_id', dimUser.user_id)
        .eq('is_completed', true)
        .not('completed_at', 'is', null)

      if (startDate) {
        query = query.gte('created_at', startDate)
      }
      if (endDate) {
        query = query.lte('created_at', endDate)
      }

      const { data: tasks, error } = await query

      if (error) throw error

      if (!tasks || tasks.length === 0) {
        return {
          success: true,
          data: {
            total_completed: 0,
            on_time_count: 0,
            late_count: 0,
            on_time_percentage: 0,
          },
          timestamp: new Date().toISOString(),
        }
      }

      let onTimeCount = 0
      let lateCount = 0

      tasks.forEach(task => {
        if (!task.completed_at || !task.created_at) return

        const created = new Date(task.created_at)
        const completed = new Date(task.completed_at)
        const completionTimeHours = (completed.getTime() - created.getTime()) / (1000 * 60 * 60)

        // Determine if task was completed on time
        // If estimated_hours exists, use it; otherwise use 7 days as default
        let expectedHours = 7 * 24 // Default: 7 days
        if (task.estimated_hours) {
          expectedHours = task.estimated_hours
        }

        if (completionTimeHours <= expectedHours) {
          onTimeCount++
        } else {
          lateCount++
        }
      })

      const totalCompleted = tasks.length
      const onTimePercentage = totalCompleted > 0 ? (onTimeCount / totalCompleted) * 100 : 0

      return {
        success: true,
        data: {
          total_completed: totalCompleted,
          on_time_count: onTimeCount,
          late_count: lateCount,
          on_time_percentage: Math.round(onTimePercentage * 100) / 100,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get on-time completion stats',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get average completion time by category
   * Business Question 3: Which task categories take the longest time to complete based on historical data?
   */
  async getCategoryCompletionTime(
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<CategoryCompletionTime[]>> {
    try {
      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) {
        throw new Error('User not found')
      }

      // Get completed tasks with categories and completion times
      let query = supabase
        .from('fact_tasks')
        .select('task_id, category_id, created_at, completed_at, actual_hours')
        .eq('user_id', dimUser.user_id)
        .eq('is_completed', true)
        .not('completed_at', 'is', null)
        .not('category_id', 'is', null)

      if (startDate) {
        query = query.gte('created_at', startDate)
      }
      if (endDate) {
        query = query.lte('created_at', endDate)
      }

      const { data: tasks, error } = await query

      if (error) throw error

      if (!tasks || tasks.length === 0) {
        return {
          success: true,
          data: [],
          timestamp: new Date().toISOString(),
        }
      }

      // Group by category
      const categoryMap = new Map<number, {
        completionTimes: number[]
        taskCount: number
      }>()

      tasks.forEach(task => {
        if (!task.category_id || !task.completed_at || !task.created_at) return

        const created = new Date(task.created_at)
        const completed = new Date(task.completed_at)
        const completionTimeHours = (completed.getTime() - created.getTime()) / (1000 * 60 * 60)

        if (!categoryMap.has(task.category_id)) {
          categoryMap.set(task.category_id, {
            completionTimes: [],
            taskCount: 0,
          })
        }

        const categoryData = categoryMap.get(task.category_id)!
        categoryData.completionTimes.push(completionTimeHours)
        categoryData.taskCount++
      })

      // Fetch category names
      const categoryIds = Array.from(categoryMap.keys())
      const { data: categories } = await supabase
        .from('dim_category')
        .select('category_id, category_name')
        .in('category_id', categoryIds)

      // Calculate averages and format results
      const result: CategoryCompletionTime[] = Array.from(categoryMap.entries())
        .map(([categoryId, data]) => {
          const category = categories?.find(c => c.category_id === categoryId)
          const avgHours = data.completionTimes.length > 0
            ? data.completionTimes.reduce((a, b) => a + b, 0) / data.completionTimes.length
            : null
          const avgDays = avgHours ? avgHours / 24 : null

          return {
            category_id: categoryId,
            category_name: category?.category_name || 'Unknown',
            avg_completion_hours: avgHours ? Math.round(avgHours * 100) / 100 : null,
            avg_completion_days: avgDays ? Math.round(avgDays * 100) / 100 : null,
            task_count: data.taskCount,
          }
        })
        .sort((a, b) => {
          // Sort by average completion hours (longest first)
          const aHours = a.avg_completion_hours || 0
          const bHours = b.avg_completion_hours || 0
          return bHours - aHours
        })

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get category completion time',
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

