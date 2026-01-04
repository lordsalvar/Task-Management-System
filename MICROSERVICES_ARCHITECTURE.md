# Microservices Architecture Documentation

This document describes the microservices architecture implementation for the Task Management System.

## Architecture Overview

The system is built using a **microservices architecture** pattern with the following components:

1. **API Gateway** - Central entry point for all requests
2. **User Service** - Manages user accounts and authentication
3. **Task Service** - Handles CRUD operations for tasks
4. **Analytics Service** - Analyzes historical task data
5. **Notification Service** - Sends reminders for upcoming or overdue tasks

## Service Responsibilities

### 1. API Gateway (`src/services/api-gateway.ts`)

**Responsibilities:**
- Request routing to appropriate microservices
- Authentication and authorization
- API security (rate limiting, validation)
- Request/response transformation
- Error handling and logging

**Key Features:**
- **Authentication**: Validates Supabase session tokens
- **Rate Limiting**: Prevents abuse with configurable limits per endpoint
- **Request Routing**: Routes requests to appropriate services based on path
- **Security**: Validates requests and handles errors gracefully

**Rate Limits:**
- Default: 100 requests per minute
- Task Service: 200 requests per minute
- Analytics Service: 50 requests per minute

**Usage:**
```typescript
import { apiGateway } from '@/services'

const response = await apiGateway.route('TASK', '/tasks', {
  method: 'GET',
  requireAuth: true,
})
```

### 2. User Service (`src/services/user-service.ts`)

**Responsibilities:**
- User account management
- Authentication (sign up, sign in, sign out)
- User profile management
- Session management

**Endpoints:**
- `POST /api/user/signup` - Create new user account
- `POST /api/user/signin` - Sign in user
- `POST /api/user/signout` - Sign out user
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/session` - Get current session

**Usage:**
```typescript
import { userService } from '@/services'

// Sign up
const signUpResponse = await userService.signUp({
  email: 'user@example.com',
  password: 'password123',
  name: 'John Doe'
})

// Sign in
const signInResponse = await userService.signIn('user@example.com', 'password123')

// Get profile
const profileResponse = await userService.getProfile()

// Update profile
const updateResponse = await userService.updateProfile({
  name: 'Jane Doe'
})
```

### 3. Task Service (`src/services/task-service.ts`)

**Responsibilities:**
- Create, read, update, delete tasks
- Task filtering and pagination
- Task enrichment with related data (categories, statuses, dates)

**Endpoints:**
- `POST /api/task/tasks` - Create new task
- `GET /api/task/tasks` - Get all tasks (with filters and pagination)
- `GET /api/task/tasks/:id` - Get task by ID
- `PUT /api/task/tasks/:id` - Update task
- `DELETE /api/task/tasks/:id` - Delete task

**Task Filter Options:**
- `status_id` - Filter by status
- `category_id` - Filter by category
- `is_completed` - Filter by completion status
- `priority` - Filter by priority level
- `date_from` - Filter by start date
- `date_to` - Filter by end date

**Usage:**
```typescript
import { taskService } from '@/services'

// Create task
const createResponse = await taskService.createTask({
  task_title: 'Complete project',
  task_description: 'Finish the project documentation',
  category_id: 1,
  task_priority: 5,
  estimated_hours: 8
})

// Get tasks with filters
const tasksResponse = await taskService.getTasks(
  {
    is_completed: false,
    priority: 5
  },
  { page: 1, limit: 20 }
)

// Update task
const updateResponse = await taskService.updateTask(taskId, {
  is_completed: true,
  actual_hours: 7.5
})

// Delete task
const deleteResponse = await taskService.deleteTask(taskId)
```

### 4. Analytics Service (`src/services/analytics-service.ts`)

**Responsibilities:**
- Analyze historical task data
- Generate completion statistics
- Provide time series data
- Category and priority analytics
- Productivity metrics

**Endpoints:**
- `GET /api/analytics/stats/completion` - Get completion statistics
- `GET /api/analytics/stats/timeseries` - Get time series data
- `GET /api/analytics/stats/categories` - Get category statistics
- `GET /api/analytics/report` - Get comprehensive analytics report

**Usage:**
```typescript
import { analyticsService } from '@/services'

// Get completion stats
const statsResponse = await analyticsService.getCompletionStats(
  '2024-01-01',
  '2024-12-31'
)

// Get time series data
const timeSeriesResponse = await analyticsService.getTimeSeriesData(
  '2024-01-01',
  '2024-12-31',
  'month' // or 'day', 'week'
)

// Get category stats
const categoryStatsResponse = await analyticsService.getCategoryStats(
  '2024-01-01',
  '2024-12-31'
)

// Get comprehensive report
const reportResponse = await analyticsService.getAnalyticsReport(
  '2024-01-01',
  '2024-12-31'
)
```

### 5. Notification Service (`src/services/notification-service.ts`)

**Responsibilities:**
- Send reminders for upcoming tasks
- Identify overdue tasks
- Manage notification preferences
- Handle notification delivery

**Endpoints:**
- `GET /api/notification/reminders/upcoming` - Get upcoming task reminders
- `GET /api/notification/reminders/overdue` - Get overdue tasks
- `POST /api/notification/reminders/send` - Send reminder notification
- `GET /api/notification/preferences` - Get notification preferences
- `PUT /api/notification/preferences` - Update notification preferences
- `GET /api/notification/notifications` - Get all notifications
- `PUT /api/notification/notifications/:id/read` - Mark notification as read

**Usage:**
```typescript
import { notificationService } from '@/services'

// Get upcoming reminders
const upcomingResponse = await notificationService.getUpcomingReminders(7) // 7 days ahead

// Get overdue tasks
const overdueResponse = await notificationService.getOverdueTasks()

// Send reminder
const sendResponse = await notificationService.sendReminder(taskId, 'upcoming')

// Get preferences
const preferencesResponse = await notificationService.getNotificationPreferences()

// Update preferences
const updatePrefsResponse = await notificationService.updateNotificationPreferences({
  email_enabled: true,
  reminder_before_days: 2
})
```

## Service Communication

All services communicate through the **API Gateway**, which provides:

1. **Unified Interface**: Single entry point for all client requests
2. **Authentication**: Centralized authentication and authorization
3. **Rate Limiting**: Prevents service abuse
4. **Error Handling**: Consistent error responses
5. **Logging**: Centralized request logging

## Request Flow

```
Client Request
    ↓
API Gateway (Authentication, Rate Limiting, Validation)
    ↓
Service Layer (Business Logic)
    ↓
Database (Supabase)
    ↓
Response (via API Gateway)
    ↓
Client
```

## Error Handling

All services return a standardized `ApiResponse<T>` format:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  timestamp: string
}
```

**Error Codes:**
- `UNAUTHORIZED` - Authentication required
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `GATEWAY_ERROR` - API Gateway error
- `SIGNUP_ERROR` - User signup failed
- `SIGNIN_ERROR` - User signin failed
- `CREATE_TASK_ERROR` - Task creation failed
- `ANALYTICS_ERROR` - Analytics operation failed
- `NOTIFICATION_ERROR` - Notification operation failed

## Security Features

1. **Authentication**: All protected endpoints require valid Supabase session
2. **Rate Limiting**: Prevents abuse with configurable limits
3. **Row Level Security**: Database-level security via Supabase RLS
4. **Input Validation**: Request validation before processing
5. **Error Sanitization**: Errors don't expose sensitive information

## Type Safety

All services are fully typed with TypeScript:

```typescript
import type {
  UserProfile,
  CreateTaskRequest,
  TaskWithRelations,
  AnalyticsReport,
  NotificationPreferences
} from '@/services'
```

## Service Health

Each service can be monitored through the API Gateway. Health checks can be implemented to monitor service availability and performance.

## Future Enhancements

1. **Service Discovery**: Dynamic service registration and discovery
2. **Load Balancing**: Distribute requests across multiple service instances
3. **Caching**: Implement caching layer for frequently accessed data
4. **Message Queue**: Asynchronous processing for notifications
5. **Distributed Tracing**: Track requests across services
6. **Service Mesh**: Advanced networking and security features

## Migration from Monolithic to Microservices

The current implementation uses a **modular monolith** approach where:
- Services are separated by domain logic
- All services share the same database (Supabase)
- Services communicate through the API Gateway pattern

For a full microservices deployment, you would:
1. Deploy each service as a separate application
2. Use message queues for async communication
3. Implement service discovery
4. Add API Gateway as a separate service (e.g., using Kong, AWS API Gateway)
5. Use separate databases per service (if needed)

## Best Practices

1. **Single Responsibility**: Each service has a clear, single responsibility
2. **Loose Coupling**: Services communicate through well-defined interfaces
3. **Error Handling**: Consistent error handling across all services
4. **Type Safety**: Full TypeScript support for type safety
5. **Documentation**: Comprehensive documentation for each service
6. **Testing**: Each service should have unit and integration tests

