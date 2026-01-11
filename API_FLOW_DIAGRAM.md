# API Request Flow Architecture

## Implementation Flow

```
┌─────────────┐
│   UI/Client │
│  Component  │
└──────┬──────┘
       │ 1. Calls service method
       │    userService.signUp()
       │    taskService.createTask()
       ▼
┌─────────────────────┐
│   Service Layer     │
│  (user-service.ts)  │
│  (task-service.ts)   │
│  (analytics-...)     │
│  (notification-...)   │
└──────┬──────────────┘
       │ 2. Calls API Gateway for validation
       │    apiGateway.route('USER', '/signup', {...})
       ▼
┌─────────────────────┐
│   API Gateway       │
│  (api-gateway.ts)   │
│                     │
│  • Authentication   │
│  • Rate Limiting    │
│  • Request Validation│
│  • Authorization    │
└──────┬──────────────┘
       │ 3. Returns success if validated
       │    { success: true, ... }
       ▼
┌─────────────────────┐
│   Service Layer     │
│  (continues)        │
│                     │
│  • Business Logic   │
│  • Data Processing  │
│  • Database Calls   │
└──────┬──────────────┘
       │ 4. Makes database operations
       │    supabase.from('fact_tasks').insert(...)
       │    supabase.auth.signUp(...)
       ▼
┌─────────────────────┐
│  Supabase Database  │
│  (PostgreSQL)       │
└─────────────────────┘
```

## Detailed Flow Example: Creating a Task

### Step-by-Step Execution

1. **UI Component** (`src/pages/Tasks.tsx` or similar)
   ```typescript
   const result = await taskService.createTask({
     task_title: "New Task",
     task_description: "Description"
   })
   ```

2. **Service Layer** (`src/services/task-service.ts`)
   ```typescript
   async createTask(request: CreateTaskRequest) {
     // Step 2a: Call API Gateway for validation
     const response = await apiGateway.route('TASK', '/tasks', {
       method: 'POST',
       body: request,
       requireAuth: true,
     })
     
     // Step 2b: Check if gateway validation passed
     if (!response.success) {
       return response // Return error (unauthorized, rate limited, etc.)
     }
     
     // Step 2c: Gateway validated, proceed with business logic
     // ... business logic ...
     
     // Step 2d: Make database call
     const { data, error } = await supabase
       .from('fact_tasks')
       .insert(taskData)
   }
   ```

3. **API Gateway** (`src/services/api-gateway.ts`)
   ```typescript
   async route(service, path, options) {
     // Step 3a: Authenticate user
     const auth = await this.authenticate()
     if (!auth) return { success: false, error: 'UNAUTHORIZED' }
     
     // Step 3b: Check rate limiting
     const rateLimit = this.checkRateLimit(service, auth.userId)
     if (!rateLimit.allowed) {
       return { success: false, error: 'RATE_LIMIT_EXCEEDED' }
     }
     
     // Step 3c: Validation passed
     return { success: true, ... }
   }
   ```

4. **Service Layer** (continues after gateway validation)
   - Performs business logic
   - Transforms data
   - Makes database operations

5. **Database** (Supabase)
   - Executes SQL operations
   - Returns data

## Conceptual vs Actual Flow

### Conceptual Architecture (What We Want)
```
Client Request → API Gateway → Service Layer → Database
```

### Actual Implementation (What We Have)
```
Client Request → Service Layer → API Gateway → Service Layer → Database
                      ↑                              ↓
                      └─────────── Gateway validates and returns ───┘
```

## Why This Pattern?

This is a **client-side gateway pattern** where:

1. **Services are the entry point** - UI components call service methods directly
2. **Gateway validates** - Services call gateway to validate requests
3. **Services execute** - After validation, services perform business logic and database operations

### Benefits:
- ✅ All requests go through gateway validation
- ✅ Services maintain business logic separation
- ✅ Gateway provides centralized authentication and rate limiting
- ✅ Works well for client-side applications

### Alternative Pattern (True Microservices):
If this were a true microservices architecture with separate services, the flow would be:
```
Client → API Gateway → HTTP Request → Microservice → Database
```

But since this is a **client-side application**, the current pattern is correct:
```
Client → Service (TypeScript) → Gateway (validation) → Service (logic) → Database
```

## Summary

**Your flow is:**
```
Client Request → Service Layer → API Gateway (validation) → Service Layer (business logic) → Supabase Database
```

**All requests go through the gateway** - it's just that the gateway is called BY the services, not directly by the client. This is the correct pattern for a client-side gateway architecture.

