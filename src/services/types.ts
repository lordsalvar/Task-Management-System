/**
 * Common types and interfaces for microservices
 */

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  timestamp: string
}

// Pagination
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Request metadata
export interface RequestMetadata {
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
}

// Rate limiting
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

// Service health check
export interface ServiceHealth {
  service: string
  status: 'healthy' | 'degraded' | 'down'
  uptime: number
  version: string
  timestamp: string
}

