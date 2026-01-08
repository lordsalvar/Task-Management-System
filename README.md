# Task Management System

A modern, full-featured task management application built with React, TypeScript, and Supabase. Features a star schema data warehouse design, microservices architecture, comprehensive analytics, and real-time notifications.

## 🚀 Features

### Core Functionality

- **Task Management**

  - Create, read, update, and delete tasks
  - Task categorization with custom categories
  - Priority levels (1-5)
  - Estimated and actual hours tracking
  - Task status management (Pending, In Progress, Completed)
  - Rich task descriptions

- **User Authentication**

  - Secure sign up and sign in via Supabase Auth
  - Protected routes
  - Session management
  - User profile management

- **Dashboard**

  - Real-time task statistics
  - Completion rate tracking
  - Task status overview
  - Quick insights into productivity

- **Analytics Dashboard**

  - **Task Completion Volume by Day of Week**: Visualize which days you're most productive
  - **On-Time Task Completion Rate**: Track percentage of tasks completed on or before their due dates
  - **Average Task Completion Time by Category**: Identify which categories take the longest to complete
  - Interactive charts and visualizations using Recharts

- **Notifications System**

  - Real-time notification bell in header
  - Automatic notifications for:
    - Overdue tasks
    - Upcoming tasks (due within 24 hours)
  - Mark notifications as read
  - Unread count badge
  - Auto-refresh every 5 minutes

- **Category Management**
  - Create custom task categories
  - Color-coded categories
  - Category-based filtering

## 🏗️ Architecture

### Microservices Architecture

The application follows a microservices pattern with the following services:

1. **API Gateway** (`src/services/api-gateway.ts`)

   - Central entry point for all requests
   - Authentication and authorization
   - Rate limiting
   - Request routing

2. **User Service** (`src/services/user-service.ts`)

   - User account management
   - Authentication (sign up, sign in, sign out)
   - Profile management

3. **Task Service** (`src/services/task-service.ts`)

   - CRUD operations for tasks
   - Task filtering and pagination
   - Task enrichment with related data

4. **Analytics Service** (`src/services/analytics-service.ts`)

   - Historical task data analysis
   - Completion statistics
   - Time series data
   - Category and productivity metrics

5. **Notification Service** (`src/services/notification-service.ts`)
   - Task reminders
   - Overdue task detection
   - Notification preferences
   - Notification delivery

### Database Architecture (Star Schema)

The database uses a **star schema** data warehouse design:

- **Fact Table**: `fact_tasks` - stores task events and metrics
- **Log Table**: `task_logs` - stores task change events for analytics
- **Notification Table**: `notifications` - stores user notifications
- **Dimension Tables**:
  - `dim_user` - user information
  - `dim_date` - date dimension for time-based queries
  - `dim_category` - task categories
  - `dim_status` - task statuses (Pending, In Progress, Completed)

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for detailed schema documentation.

## 🛠️ Tech Stack

### Frontend

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **Recharts** - Data visualization
- **Sonner** - Toast notifications
- **Lucide React** - Icons

### Backend & Database

- **Supabase** - Backend as a Service
  - PostgreSQL database
  - Authentication
  - Row Level Security (RLS)
  - Real-time capabilities

### State Management

- React Context API (AuthContext)
- React Hooks

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Task-Management-System
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure Supabase**

   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - Get your project URL and anon key from Settings > API
   - Create a `.env` file in the root directory:
     ```env
     VITE_SUPABASE_URL=your_supabase_project_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

4. **Run database migrations**

   - Execute the SQL files in the `migrations/` directory in your Supabase SQL Editor:
     - Base schema (if not already created)
     - `migrations/create_task_logs_table.sql`
     - `migrations/create_notifications_table.sql`

5. **Start the development server**

   ```bash
   npm run dev
   ```

6. **Open your browser**
   - Navigate to `http://localhost:5173`

## 🗄️ Database Setup

### Running Migrations

1. **Task Logs Table**

   ```sql
   -- Run migrations/create_task_logs_table.sql
   ```

   This creates the `task_logs` table for tracking task changes and analytics.

2. **Notifications Table**
   ```sql
   -- Run migrations/create_notifications_table.sql
   ```
   This creates the `notifications` table for the notification system.

### Database Schema

The database uses a star schema with:

- **Fact tables**: Store measurable events (tasks)
- **Dimension tables**: Store descriptive attributes (users, dates, categories, statuses)
- **Log tables**: Track changes for analytics

All tables have Row Level Security (RLS) enabled for data protection.

## 📁 Project Structure

```
Task-Management-System/
├── migrations/              # Database migration files
│   ├── create_task_logs_table.sql
│   └── create_notifications_table.sql
├── public/                  # Static assets
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── app-sidebar.tsx
│   │   ├── AppLayout.tsx
│   │   ├── notification-bell.tsx
│   │   └── ...
│   ├── contexts/           # React contexts
│   │   └── AuthContext.tsx
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility libraries
│   │   ├── database.types.ts
│   │   ├── db-helpers.ts
│   │   ├── supabase.ts
│   │   └── utils.ts
│   ├── pages/              # Page components
│   │   ├── Analytics.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   └── Tasks.tsx
│   ├── services/           # Microservices
│   │   ├── analytics-service.ts
│   │   ├── api-gateway.ts
│   │   ├── notification-service.ts
│   │   ├── task-service.ts
│   │   └── user-service.ts
│   ├── App.tsx
│   └── main.tsx
├── DATABASE_SCHEMA.md      # Database documentation
├── MICROSERVICES_ARCHITECTURE.md  # Architecture docs
└── README.md               # This file
```

## 🎯 Key Features in Detail

### Analytics Dashboard

The Analytics page provides three key business insights:

1. **Task Completion Volume by Day of Week**

   - Bar chart showing completed tasks by day
   - Helps identify most productive days
   - Uses task logs for accurate completion tracking

2. **On-Time Task Completion Rate**

   - Pie chart showing on-time vs late completions
   - Summary statistics
   - Calculates based on estimated hours or default 7-day window

3. **Average Task Completion Time by Category**
   - Horizontal bar chart
   - Shows average completion time in days per category
   - Sorted by longest completion time first

### Notification System

- **Automatic Detection**: Checks for upcoming/overdue tasks every 5 minutes
- **Smart Notifications**:
  - Overdue tasks (past due date)
  - Upcoming tasks (due within 24 hours)
- **Due Date Calculation**: Uses `estimated_hours` or defaults to 7 days from creation
- **UI Features**:
  - Notification bell with unread count badge
  - Dropdown menu with all notifications
  - Mark individual or all as read
  - Click to navigate to tasks

### Task Management

- **Full CRUD Operations**: Create, read, update, delete tasks
- **Rich Metadata**:
  - Title and description
  - Priority (1-5)
  - Category assignment
  - Status tracking
  - Time estimation and tracking
- **Filtering & Search**: Filter by status, category, priority, date range
- **Category Management**: Create and manage custom categories with colors

## 🔒 Security

- **Row Level Security (RLS)**: All database tables have RLS enabled
- **Authentication**: Supabase Auth handles user authentication
- **Protected Routes**: React Router guards protect authenticated routes
- **API Gateway**: Centralized authentication and rate limiting

## 📊 Analytics & Reporting

The system tracks:

- Task completion patterns
- Productivity metrics
- Category performance
- Time tracking (estimated vs actual)
- Completion rates

All analytics use the `task_logs` table for accurate historical tracking.

## 🚦 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🎨 UI Components

Built with [shadcn/ui](https://ui.shadcn.com/) components:

- Cards, Buttons, Dialogs
- Tables, Forms, Dropdowns
- Charts, Badges, Tooltips
- And more...

## 🔄 Real-time Features

- Notification updates every 5 minutes
- Real-time task status updates
- Live dashboard statistics

## 📱 Responsive Design

The application is fully responsive and works on:

- Desktop
- Tablet
- Mobile devices
