/**
 * API Gateway Service
 * 
 * Responsibilities:
 * - Request routing to appropriate microservices
 * - Authentication and authorization
 * - API security (rate limiting, validation)
 * - Request/response transformation
 * - Error handling and logging
 */

import { supabase } from '../lib/supabase'
import type { ApiResponse, RequestMetadata, RateLimitInfo } from './types'

// Service endpoints configuration
const SERVICE_ENDPOINTS = {
  USER: '/api/user',
  TASK: '/api/task',
  ANALYTICS: '/api/analytics',
  NOTIFICATION: '/api/notification',
} as const

// Rate limiting configuration
const RATE_LIMITS = {
  default: { limit: 100, window: 60000 }, // 100 requests per minute
  task: { limit: 200, window: 60000 },
  analytics: { limit: 50, window: 60000 },
} as const

class ApiGateway {
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map()

  /**
   * Authenticates the request using Supabase session
   */
  async authenticate(): Promise<{ userId: string; sessionId: string } | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        return null
      }

      return {
        userId: session.user.id,
        sessionId: session.access_token,
      }
    } catch (error) {
      console.error('Authentication error:', error)
      return null
    }
  }

  /**
   * Checks rate limiting for a given endpoint
   */
  checkRateLimit(endpoint: string, userId: string): { allowed: boolean; info: RateLimitInfo } {
    const key = `${userId}:${endpoint}`
    const config = RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS] || RATE_LIMITS.default
    const now = Date.now()

    const current = this.rateLimitStore.get(key)
    
    if (!current || now > current.resetTime) {
      // Reset or initialize
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.window,
      })
      
      return {
        allowed: true,
        info: {
          limit: config.limit,
          remaining: config.limit - 1,
          reset: now + config.window,
        },
      }
    }

    if (current.count >= config.limit) {
      return {
        allowed: false,
        info: {
          limit: config.limit,
          remaining: 0,
          reset: current.resetTime,
        },
      }
    }

    current.count++
    this.rateLimitStore.set(key, current)

    return {
      allowed: true,
      info: {
        limit: config.limit,
        remaining: config.limit - current.count,
        reset: current.resetTime,
      },
    }
  }

  /**
   * Routes request to appropriate service
   */
  async route<T>(
    service: keyof typeof SERVICE_ENDPOINTS,
    _path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
      body?: unknown
      requireAuth?: boolean
      metadata?: RequestMetadata
    } = {}
  ): Promise<ApiResponse<T>> {
    const { requireAuth = true, metadata } = options

    try {
      // Authentication
      if (requireAuth) {
        const auth = await this.authenticate()
        if (!auth) {
          return {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required',
            },
            timestamp: new Date().toISOString(),
          }
        }

        // Rate limiting
        const rateLimit = this.checkRateLimit(service, auth.userId)
        if (!rateLimit.allowed) {
          return {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests. Please try again later.',
              details: rateLimit.info,
            },
            timestamp: new Date().toISOString(),
          }
        }

        // Add user context to metadata
        if (metadata) {
          metadata.userId = auth.userId
          metadata.sessionId = auth.sessionId
        }
      }

      // For now, we'll use Supabase directly
      // In a full microservices architecture, this would make HTTP requests to separate services
      // This is a client-side gateway that routes to service modules
      return {
        success: true,
        data: {} as T, // Will be populated by service
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error(`API Gateway error [${service}]:`, error)
      return {
        success: false,
        error: {
          code: 'GATEWAY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Validates request payload
   */
  validateRequest<T>(data: unknown, schema?: (data: unknown) => data is T): boolean {
    if (!schema) return true
    return schema(data)
  }

  /**
   * Logs request for monitoring
   */
  logRequest(service: string, path: string, metadata?: RequestMetadata): void {
    if (import.meta.env.DEV) {
      console.log(`[API Gateway] ${service}${path}`, metadata)
    }
    // In production, this would send to a logging service
  }
}

// Singleton instance
export const apiGateway = new ApiGateway()

// Export service endpoints for direct access if needed
export { SERVICE_ENDPOINTS }

