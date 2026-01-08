/**
 * Microservices Architecture - Service Exports
 * 
 * This module exports all microservices for easy access throughout the application.
 */

// API Gateway
export { apiGateway, SERVICE_ENDPOINTS } from './api-gateway'

// Services
export { userService } from './user-service'
export { taskService } from './task-service'
export { analyticsService } from './analytics-service'
export { notificationService } from './notification-service'

// Page Cache
export { pageCache, CACHE_KEYS } from './page-cache'

// Types
export type * from './types'
export type * from './user-service'
export type * from './task-service'
export type * from './analytics-service'
export type * from './notification-service'

