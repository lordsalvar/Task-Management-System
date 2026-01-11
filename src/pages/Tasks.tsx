import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, CheckCircle2, Clock, AlertCircle, X, Loader2, Sparkles, Target, PlayCircle, Edit, MoreHorizontal } from "lucide-react"
import { taskService } from "@/services"
import { syncUserToDimUser } from "@/lib/db-helpers"
import { supabase } from "@/lib/supabase"
import type { TaskWithRelations } from "@/services"
import { AppLayout } from "@/components/AppLayout"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { pageCache, CACHE_KEYS } from "@/services/page-cache"

export function Tasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskDescription, setNewTaskDescription] = useState("")
  const [newTaskPriority, setNewTaskPriority] = useState<number | undefined>(undefined)
  const [newTaskCategory, setNewTaskCategory] = useState<number | null>(null)
  const [newTaskStatus, setNewTaskStatus] = useState<number | undefined>(undefined)
  const [dueDateType, setDueDateType] = useState<'datetime' | 'hours' | 'minutes'>('datetime')
  const [newTaskDueDateTime, setNewTaskDueDateTime] = useState<string>("")
  const [newTaskDueHours, setNewTaskDueHours] = useState<string>("")
  const [newTaskDueMinutes, setNewTaskDueMinutes] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [categories, setCategories] = useState<Array<{ category_id: number; category_name: string; color: string | null }>>([])
  const [statuses, setStatuses] = useState<Array<{ status_id: number; status_name: string; status_order: number }>>([])
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6")
  const [addingCategory, setAddingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [editingPriorityTask, setEditingPriorityTask] = useState<TaskWithRelations | null>(null)
  const [newPriority, setNewPriority] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (user) {
      // Run all initial loads in parallel for better performance
      Promise.all([
        syncUserOnMount(),
        loadTasks(),
        loadCategories(),
        loadStatuses(),
      ]).catch(error => {
        console.error("Failed to load initial data:", error)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Periodic check for overdue tasks and refresh (every 30 seconds)
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      // Check overdue tasks and refresh the list
      taskService.checkAndUpdateOverdueTasks()
        .then(() => {
          // Refresh tasks after checking overdue (but use cache if available for performance)
          loadTasks(false)
        })
        .catch(error => {
          console.error("Failed to check overdue tasks:", error)
        })
    }, 30 * 1000) // Every 30 seconds

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Refresh tasks when window regains focus
  useEffect(() => {
    if (!user) return

    const handleFocus = () => {
      // Check overdue tasks and force refresh when user returns to the page
      taskService.checkAndUpdateOverdueTasks()
        .then(() => {
          loadTasks(true) // Force refresh on focus
        })
        .catch(error => {
          console.error("Failed to check overdue tasks on focus:", error)
        })
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const syncUserOnMount = async () => {
    if (!user) return
    try {
      await syncUserToDimUser(user.id, user.email || '', user.user_metadata?.name)
    } catch (error) {
      console.error("Failed to sync user:", error)
    }
  }

  const loadTasks = async (forceRefresh = false) => {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = pageCache.get<TaskWithRelations[]>(CACHE_KEYS.TASKS_LIST)
      if (cached) {
        setTasks(cached)
        setLoading(false)
        return
      }
    }

    try {
      setLoading(true)
      
      // First, check and update overdue tasks using the database function
      // This ensures status is up-to-date before loading
      await taskService.checkAndUpdateOverdueTasks().catch(error => {
        console.error("Failed to check overdue tasks:", error)
        // Don't block if this fails
      })
      
      const response = await taskService.getTasks({}, { page: 1, limit: 50 })
      if (response.success && response.data) {
        const loadedTasks = response.data.items
        setTasks(loadedTasks)
        // Cache for 1 minute (tasks can change frequently)
        pageCache.set(CACHE_KEYS.TASKS_LIST, loadedTasks, 60 * 1000)
      }
    } catch (error) {
      console.error("Failed to load tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    // Check cache first
    const cached = pageCache.get<typeof categories>(CACHE_KEYS.TASKS_CATEGORIES)
    if (cached) {
      setCategories(cached)
      return
    }

    try {
      const { data, error } = await supabase
        .from('dim_category')
        .select('category_id, category_name, color')
        .order('category_name')

      if (error) throw error
      const categoriesData = data || []
      setCategories(categoriesData)
      // Cache for 5 minutes (categories don't change often)
      pageCache.set(CACHE_KEYS.TASKS_CATEGORIES, categoriesData, 5 * 60 * 1000)
    } catch (error) {
      console.error("Failed to load categories:", error)
    }
  }

  const loadStatuses = async () => {
    // Check cache first
    const cached = pageCache.get<typeof statuses>(CACHE_KEYS.TASKS_STATUSES)
    if (cached) {
      setStatuses(cached)
      return
    }

    try {
      const { data, error } = await supabase
        .from('dim_status')
        .select('status_id, status_name, status_order')
        .order('status_order')

      if (error) throw error
      const statusesData = data || []
      setStatuses(statusesData)
      // Cache for 10 minutes (statuses rarely change)
      pageCache.set(CACHE_KEYS.TASKS_STATUSES, statusesData, 10 * 60 * 1000)
    } catch (error) {
      console.error("Failed to load statuses:", error)
    }
  }

  // Validation function
  const validateTaskForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Task title is required (no default value)
    if (!newTaskTitle.trim()) {
      errors.taskTitle = "Task title is required"
    }

    // Validate due date if a type is selected
    if (dueDateType === 'datetime' && !newTaskDueDateTime) {
      errors.dueDate = "Please select a date and time"
    } else if (dueDateType === 'hours') {
      if (!newTaskDueHours) {
        errors.dueDate = "Please enter hours"
      } else {
        const hours = parseFloat(newTaskDueHours)
        if (isNaN(hours) || hours <= 0) {
          errors.dueDate = "Hours must be a positive number"
        }
      }
    } else if (dueDateType === 'minutes') {
      if (!newTaskDueMinutes) {
        errors.dueDate = "Please enter minutes"
      } else {
        const minutes = parseFloat(newTaskDueMinutes)
        if (isNaN(minutes) || minutes <= 0) {
          errors.dueDate = "Minutes must be a positive number"
        }
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateTask = async () => {
    // Validate all required fields
    if (!validateTaskForm()) {
      setError("Please fill in all required fields")
      return
    }

    setError(null)
    setFieldErrors({})
    setCreating(true)

    try {
      if (user) {
        await syncUserToDimUser(user.id, user.email || '', user.user_metadata?.name)
      }

      // Calculate due_date based on input type
      let dueDate: string | undefined = undefined
      if (dueDateType === 'datetime' && newTaskDueDateTime) {
        // Use the datetime directly
        dueDate = new Date(newTaskDueDateTime).toISOString()
      } else if (dueDateType === 'hours' && newTaskDueHours) {
        // Calculate due date from now + hours
        const hours = parseFloat(newTaskDueHours)
        if (!isNaN(hours) && hours > 0) {
          dueDate = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
        }
      } else if (dueDateType === 'minutes' && newTaskDueMinutes) {
        // Calculate due date from now + minutes
        const minutes = parseFloat(newTaskDueMinutes)
        if (!isNaN(minutes) && minutes > 0) {
          dueDate = new Date(Date.now() + minutes * 60 * 1000).toISOString()
        }
      }

      const response = await taskService.createTask({
        task_title: newTaskTitle,
        task_description: newTaskDescription || undefined,
        category_id: newTaskCategory || undefined,
        status_id: newTaskStatus,
        task_priority: newTaskPriority,
        due_date: dueDate,
      })

      if (response.success) {
        // Invalidate caches since we created a new task
        pageCache.clear(CACHE_KEYS.TASKS_LIST)
        pageCache.clear(CACHE_KEYS.DASHBOARD_STATS)
        // Analytics also need to be refreshed
        pageCache.clear(CACHE_KEYS.ANALYTICS_DAY_OF_WEEK)
        pageCache.clear(CACHE_KEYS.ANALYTICS_ON_TIME)
        pageCache.clear(CACHE_KEYS.ANALYTICS_CATEGORY_TIME)
        
        setNewTaskTitle("")
        setNewTaskDescription("")
        setNewTaskPriority(undefined)
        setNewTaskCategory(null)
        setNewTaskStatus(undefined)
        setDueDateType('datetime')
        setNewTaskDueDateTime("")
        setNewTaskDueHours("")
        setNewTaskDueMinutes("")
        setShowTaskForm(false)
        setError(null)
        toast.success("Task created successfully!", {
          description: "Your new task has been added to the list.",
        })
        // Force refresh to get updated status (in case task is marked as overdue)
        await loadTasks(true)
      } else {
        setError(response.error?.message || "Failed to create task")
        toast.error("Failed to create task", {
          description: response.error?.message || "Please try again.",
        })
      }
    } catch (error) {
      console.error("Failed to create task:", error)
      setError(error instanceof Error ? error.message : "Failed to create task")
    } finally {
      setCreating(false)
    }
  }

  const handleResetForm = () => {
    setNewTaskTitle("")
    setNewTaskDescription("")
    setNewTaskPriority(undefined)
    setNewTaskCategory(null)
    setNewTaskStatus(undefined)
    setDueDateType('datetime')
    setNewTaskDueDateTime("")
    setNewTaskDueHours("")
    setNewTaskDueMinutes("")
    setError(null)
    setFieldErrors({})
    setShowTaskForm(false)
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setCategoryError("Category name is required")
      return
    }

    setCategoryError(null)
    setAddingCategory(true)

    try {
      const categoryNameUpper = newCategoryName.trim().toUpperCase()

      const existingCategory = categories.find(
        cat => cat.category_name.toUpperCase() === categoryNameUpper
      )

      if (existingCategory) {
        setCategoryError("Category already exists")
        setAddingCategory(false)
        return
      }

      const { data, error } = await supabase
        .from('dim_category')
        .insert({
          category_name: categoryNameUpper,
          category_description: newCategoryDescription || null,
          color: newCategoryColor || null,
        })
        .select('category_id, category_name, color')
        .single()

      if (error) throw error

      // Clear caches since we added a new category
      taskService.clearCaches()
      pageCache.clear(CACHE_KEYS.TASKS_CATEGORIES)
      await loadCategories()
      setNewTaskCategory(data.category_id)
      
      setNewCategoryName("")
      setNewCategoryDescription("")
      setNewCategoryColor("#3b82f6")
      setShowAddCategoryDialog(false)
      setCategoryError(null)
    } catch (error) {
      console.error("Failed to create category:", error)
      setCategoryError(error instanceof Error ? error.message : "Failed to create category")
    } finally {
      setAddingCategory(false)
    }
  }

  const handleCategorySelectChange = (value: string) => {
    if (value === "add-new") {
      setShowAddCategoryDialog(true)
    } else {
      setNewTaskCategory(value ? parseInt(value) : null)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId)
      // Invalidate caches since task was deleted
      pageCache.clear(CACHE_KEYS.TASKS_LIST)
      pageCache.clear(CACHE_KEYS.DASHBOARD_STATS)
      
      toast.success("Task deleted", {
        description: "The task has been removed.",
      })
      // Force refresh to get updated list immediately
      await loadTasks(true)
    } catch (error) {
      console.error("Failed to delete task:", error)
      toast.error("Failed to delete task", {
        description: "Please try again.",
      })
    }
  }

  const handleSetInProgress = async (task: TaskWithRelations) => {
    try {
      const inProgressStatus = statuses.find(s => s.status_name.toLowerCase() === "in progress")
      if (!inProgressStatus) {
        toast.error("Status not found", {
          description: "In Progress status not found.",
        })
        return
      }

      await taskService.updateTask(task.task_id, {
        status_id: inProgressStatus.status_id,
      })
      
      // Invalidate caches
      pageCache.clear(CACHE_KEYS.TASKS_LIST)
      pageCache.clear(CACHE_KEYS.DASHBOARD_STATS)
      
      toast.success("Task set to In Progress", {
        description: "The task status has been updated.",
      })
      // Force refresh to get updated status immediately
      await loadTasks(true)
    } catch (error) {
      console.error("Failed to update task:", error)
      toast.error("Failed to update task", {
        description: "Please try again.",
      })
    }
  }

  const handleComplete = async (task: TaskWithRelations) => {
    try {
      // Find the "Completed" status
      const completedStatus = statuses.find(s => s.status_name.toLowerCase() === "completed")
      if (!completedStatus) {
        toast.error("Failed to complete task", {
          description: "Completed status not found.",
        })
        return
      }

      await taskService.updateTask(task.task_id, {
        is_completed: true,
        status_id: completedStatus.status_id,
      })
      
      // Invalidate caches
      pageCache.clear(CACHE_KEYS.TASKS_LIST)
      pageCache.clear(CACHE_KEYS.DASHBOARD_STATS)
      pageCache.clear(CACHE_KEYS.ANALYTICS_DAY_OF_WEEK)
      pageCache.clear(CACHE_KEYS.ANALYTICS_ON_TIME)
      pageCache.clear(CACHE_KEYS.ANALYTICS_CATEGORY_TIME)
      
      toast.success("Task completed!", {
        description: "Great job! Keep up the momentum.",
      })
      // Force refresh to get updated status immediately
      await loadTasks(true)
    } catch (error) {
      console.error("Failed to complete task:", error)
      toast.error("Failed to complete task", {
        description: "Please try again.",
      })
    }
  }

  const handleEditPriority = (task: TaskWithRelations) => {
    setEditingPriorityTask(task)
    setNewPriority(task.task_priority || undefined)
  }

  const handleSavePriority = async () => {
    if (!editingPriorityTask) return

    try {
      await taskService.updateTask(editingPriorityTask.task_id, {
        task_priority: newPriority,
      })
      
      // Invalidate caches
      pageCache.clear(CACHE_KEYS.TASKS_LIST)
      pageCache.clear(CACHE_KEYS.DASHBOARD_STATS)
      
      toast.success("Priority updated", {
        description: "The task priority has been updated.",
      })
      
      setEditingPriorityTask(null)
      setNewPriority(undefined)
      // Force refresh to get updated status immediately
      await loadTasks(true)
    } catch (error) {
      console.error("Failed to update priority:", error)
      toast.error("Failed to update priority", {
        description: "Please try again.",
      })
    }
  }

  const getStatusBadge = (statusName: string) => {
    switch (statusName.toLowerCase()) {
      case "pending":
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case "in progress":
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />In Progress</Badge>
      case "completed":
        return <Badge variant="default"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>
      default:
        return <Badge variant="outline">{statusName}</Badge>
    }
  }

  return (
    <AppLayout pageTitle="Tasks">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Tasks
              </h1>
              <p className="text-muted-foreground mt-2">
                Create, manage, and track all your tasks in one place.
              </p>
            </div>
          </div>

          {/* Create Task */}
          <Card className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:100ms]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Create New Task
                  </CardTitle>
                  <CardDescription>Add a new task with all details</CardDescription>
                </div>
                {!showTaskForm && (
                  <Button 
                    onClick={() => setShowTaskForm(true)} 
                    variant="outline"
                    className="transition-all duration-300 hover:scale-105 hover:shadow-md"
                  >
                    <Plus className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-90" />
                    New Task
                  </Button>
                )}
              </div>
            </CardHeader>
            {showTaskForm && (
              <CardContent className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-4">
                  {/* Task Title */}
                  <div className="space-y-2">
                    <Label htmlFor="task-title">Task Title *</Label>
                    <Input
                      id="task-title"
                      placeholder="Enter task title..."
                      value={newTaskTitle}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setNewTaskTitle(e.target.value)
                        // Clear error when user starts typing
                        if (fieldErrors.taskTitle) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors.taskTitle
                            return newErrors
                          })
                        }
                      }}
                      disabled={creating}
                      className={fieldErrors.taskTitle ? "border-destructive" : ""}
                      aria-invalid={!!fieldErrors.taskTitle}
                      aria-describedby={fieldErrors.taskTitle ? "task-title-error" : undefined}
                    />
                    {fieldErrors.taskTitle && (
                      <p id="task-title-error" className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {fieldErrors.taskTitle}
                      </p>
                    )}
                  </div>

                  {/* Task Description */}
                  <div className="space-y-2">
                    <Label htmlFor="task-description">Description</Label>
                    <Textarea
                      id="task-description"
                      placeholder="Enter task description..."
                      value={newTaskDescription}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewTaskDescription(e.target.value)}
                      disabled={creating}
                      rows={3}
                    />
                  </div>

                  {/* Priority and Status Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Priority */}
                    <div className="space-y-2">
                      <Label htmlFor="task-priority">Priority</Label>
                      <Select
                        value={newTaskPriority?.toString()}
                        onValueChange={(value) => 
                          setNewTaskPriority(value ? parseInt(value) : undefined)
                        }
                        disabled={creating}
                      >
                        <SelectTrigger id="task-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Lowest</SelectItem>
                          <SelectItem value="2">2 - Low</SelectItem>
                          <SelectItem value="3">3 - Medium</SelectItem>
                          <SelectItem value="4">4 - High</SelectItem>
                          <SelectItem value="5">5 - Highest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <Label htmlFor="task-status">Status</Label>
                      <Select
                        value={newTaskStatus?.toString()}
                        onValueChange={(value) => 
                          setNewTaskStatus(value ? parseInt(value) : undefined)
                        }
                        disabled={creating}
                      >
                        <SelectTrigger id="task-status">
                          <SelectValue placeholder="Select status (defaults to Pending)" />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status.status_id} value={status.status_id.toString()}>
                              {status.status_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Category and Due Date Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Category */}
                    <div className="space-y-2">
                      <Label htmlFor="task-category">Category</Label>
                      <Select
                        value={newTaskCategory?.toString()}
                        onValueChange={handleCategorySelectChange}
                        disabled={creating}
                      >
                        <SelectTrigger id="task-category" className="uppercase">
                          <SelectValue placeholder="No category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.category_id} value={category.category_id.toString()} className="uppercase">
                              {category.category_name.toUpperCase()}
                            </SelectItem>
                          ))}
                          <SelectItem value="add-new" className="font-semibold">
                            + Add New Category
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Due Date */}
                    <div className="space-y-2">
                      <Label htmlFor="due-date-type">Due Date</Label>
                      <Select
                        value={dueDateType}
                        onValueChange={(value: 'datetime' | 'hours' | 'minutes') => {
                          setDueDateType(value)
                          // Clear errors when switching types
                          if (fieldErrors.dueDate) {
                            setFieldErrors(prev => {
                              const newErrors = { ...prev }
                              delete newErrors.dueDate
                              return newErrors
                            })
                          }
                          // Clear other inputs when switching types
                          if (value === 'datetime') {
                            setNewTaskDueHours("")
                            setNewTaskDueMinutes("")
                          } else if (value === 'hours') {
                            setNewTaskDueDateTime("")
                            setNewTaskDueMinutes("")
                          } else {
                            setNewTaskDueDateTime("")
                            setNewTaskDueHours("")
                          }
                        }}
                        disabled={creating}
                      >
                        <SelectTrigger id="due-date-type" className={fieldErrors.dueDate ? "border-destructive" : ""}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="datetime">Date & Time</SelectItem>
                          <SelectItem value="hours">Hours from now</SelectItem>
                          <SelectItem value="minutes">Minutes from now</SelectItem>
                        </SelectContent>
                      </Select>
                      {dueDateType === 'datetime' && (
                        <>
                          <Input
                            id="task-due-datetime"
                            type="datetime-local"
                            value={newTaskDueDateTime}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              setNewTaskDueDateTime(e.target.value)
                              // Clear error when user starts typing
                              if (fieldErrors.dueDate) {
                                setFieldErrors(prev => {
                                  const newErrors = { ...prev }
                                  delete newErrors.dueDate
                                  return newErrors
                                })
                              }
                            }}
                            disabled={creating}
                            min={new Date().toISOString().slice(0, 16)}
                            className={fieldErrors.dueDate ? "border-destructive" : ""}
                            aria-invalid={!!fieldErrors.dueDate}
                            aria-describedby={fieldErrors.dueDate ? "due-date-error" : undefined}
                          />
                          {fieldErrors.dueDate && (
                            <p id="due-date-error" className="text-sm text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {fieldErrors.dueDate}
                            </p>
                          )}
                        </>
                      )}
                      {dueDateType === 'hours' && (
                        <>
                          <Input
                            id="task-due-hours"
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder="e.g., 2.5"
                            value={newTaskDueHours}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              setNewTaskDueHours(e.target.value)
                              // Clear error when user starts typing
                              if (fieldErrors.dueDate) {
                                setFieldErrors(prev => {
                                  const newErrors = { ...prev }
                                  delete newErrors.dueDate
                                  return newErrors
                                })
                              }
                            }}
                            disabled={creating}
                            className={fieldErrors.dueDate ? "border-destructive" : ""}
                            aria-invalid={!!fieldErrors.dueDate}
                            aria-describedby={fieldErrors.dueDate ? "due-date-error" : undefined}
                          />
                          {fieldErrors.dueDate && (
                            <p id="due-date-error" className="text-sm text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {fieldErrors.dueDate}
                            </p>
                          )}
                        </>
                      )}
                      {dueDateType === 'minutes' && (
                        <>
                          <Input
                            id="task-due-minutes"
                            type="number"
                            step="1"
                            min="0"
                            placeholder="e.g., 30"
                            value={newTaskDueMinutes}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              setNewTaskDueMinutes(e.target.value)
                              // Clear error when user starts typing
                              if (fieldErrors.dueDate) {
                                setFieldErrors(prev => {
                                  const newErrors = { ...prev }
                                  delete newErrors.dueDate
                                  return newErrors
                                })
                              }
                            }}
                            disabled={creating}
                            className={fieldErrors.dueDate ? "border-destructive" : ""}
                            aria-invalid={!!fieldErrors.dueDate}
                            aria-describedby={fieldErrors.dueDate ? "due-date-error" : undefined}
                          />
                          {fieldErrors.dueDate && (
                            <p id="due-date-error" className="text-sm text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {fieldErrors.dueDate}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Error Messages */}
                  {error && (
                    <div className="text-sm text-destructive flex items-center gap-2 p-3 bg-destructive/10 rounded-md">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}
                  {Object.keys(fieldErrors).length > 0 && !error && (
                    <div className="text-sm text-destructive flex items-center gap-2 p-3 bg-destructive/10 rounded-md">
                      <AlertCircle className="w-4 h-4" />
                      Please fix the errors above before submitting
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={handleResetForm}
                      disabled={creating}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateTask}
                      disabled={creating}
                      className="transition-all duration-300 hover:scale-105 disabled:opacity-50"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Task
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Tasks List */}
          <Card className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:200ms]">
            <CardHeader>
              <CardTitle>Your Tasks</CardTitle>
              <CardDescription>
                Manage and track all your tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3 py-8">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 animate-pulse">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-12 animate-in fade-in zoom-in-95 duration-500">
                  <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <Target className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Get started by creating your first task above!
                  </p>
                  <Button 
                    onClick={() => setShowTaskForm(true)} 
                    variant="outline"
                    className="transition-all duration-300 hover:scale-105"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Task
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task, index) => (
                      <TableRow 
                        key={task.task_id}
                        className="group transition-all duration-200 hover:bg-muted/50 cursor-pointer"
                        style={{ 
                          animation: `fadeIn 0.3s ease-out ${index * 50}ms both`
                        }}
                      >
                        <TableCell>
                          {task.status ? getStatusBadge(task.status.status_name) : null}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span
                              className={`transition-all duration-200 ${
                                task.is_completed 
                                  ? "line-through text-muted-foreground" 
                                  : "group-hover:text-foreground"
                              }`}
                            >
                              {task.task_title}
                            </span>
                          </div>
                          {task.task_description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {task.task_description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.category ? (
                            <Badge 
                              variant="outline" 
                              style={task.category.color ? { borderColor: task.category.color, color: task.category.color } : undefined}
                              className="uppercase"
                            >
                              {task.category.category_name.toUpperCase()}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.task_priority ? (
                            <Badge variant="outline">Priority {task.task_priority}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const taskAny = task as any
                            if (taskAny.due_date) {
                              const dueDate = new Date(taskAny.due_date)
                              const now = new Date()
                              const isOverdue = dueDate < now && !task.is_completed
                              return (
                                <div className="flex flex-col">
                                  <span className={`text-sm ${isOverdue ? 'text-destructive font-semibold' : ''}`}>
                                    {dueDate.toLocaleDateString()} {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {isOverdue && (
                                    <span className="text-xs text-destructive">Overdue</span>
                                  )}
                                </div>
                              )
                            }
                            return <span className="text-muted-foreground">-</span>
                          })()}
                        </TableCell>
                        <TableCell>
                          {task.created_date ? (
                            <span className="text-sm text-muted-foreground">
                              {new Date(task.created_date.date).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 data-[state=open]:bg-muted"
                              >
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {!task.is_completed && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleSetInProgress(task)}
                                    className="cursor-pointer"
                                  >
                                    <PlayCircle className="mr-2 h-4 w-4 text-blue-600" />
                                    <span>Set to In Progress</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleComplete(task)}
                                    className="cursor-pointer"
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                                    <span>Mark as Complete</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleEditPriority(task)}
                                    className="cursor-pointer"
                                  >
                                    <Edit className="mr-2 h-4 w-4 text-purple-600" />
                                    <span>Edit Priority</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this task?")) {
                                    handleDeleteTask(task.task_id)
                                  }
                                }}
                                className="cursor-pointer text-destructive focus:text-destructive"
                              >
                                <X className="mr-2 h-4 w-4" />
                                <span>Delete Task</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new category. Category names will be stored in uppercase.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name *</Label>
              <Input
                id="category-name"
                placeholder="e.g., Work, Personal, Shopping"
                value={newCategoryName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCategoryName(e.target.value.toUpperCase())}
                disabled={addingCategory}
                className="uppercase"
                style={{ textTransform: 'uppercase' }}
              />
              <p className="text-xs text-muted-foreground">
                Will be stored as: {newCategoryName.trim().toUpperCase() || 'CATEGORY NAME'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-description">Description (Optional)</Label>
              <Textarea
                id="category-description"
                placeholder="Describe this category..."
                value={newCategoryDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewCategoryDescription(e.target.value)}
                disabled={addingCategory}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-color">Color (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="category-color"
                  type="color"
                  value={newCategoryColor}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCategoryColor(e.target.value)}
                  disabled={addingCategory}
                  className="h-10 w-20"
                />
                <Input
                  type="text"
                  value={newCategoryColor}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCategoryColor(e.target.value)}
                  disabled={addingCategory}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>

            {categoryError && (
              <div className="text-sm text-destructive flex items-center gap-2 p-3 bg-destructive/10 rounded-md">
                <AlertCircle className="w-4 h-4" />
                {categoryError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddCategoryDialog(false)
                setNewCategoryName("")
                setNewCategoryDescription("")
                setNewCategoryColor("#3b82f6")
                setCategoryError(null)
              }}
              disabled={addingCategory}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCategory}
              disabled={addingCategory || !newCategoryName.trim()}
            >
              {addingCategory ? "Adding..." : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Priority Dialog */}
      <Dialog open={!!editingPriorityTask} onOpenChange={(open) => {
        if (!open) {
          setEditingPriorityTask(null)
          setNewPriority(undefined)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Priority</DialogTitle>
            <DialogDescription>
              Set the priority level for "{editingPriorityTask?.task_title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="priority-select">Priority Level</Label>
              <Select
                value={newPriority?.toString()}
                onValueChange={(value) => setNewPriority(value ? parseInt(value) : undefined)}
              >
                <SelectTrigger id="priority-select">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Lowest</SelectItem>
                  <SelectItem value="2">2 - Low</SelectItem>
                  <SelectItem value="3">3 - Medium</SelectItem>
                  <SelectItem value="4">4 - High</SelectItem>
                  <SelectItem value="5">5 - Highest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingPriorityTask(null)
                setNewPriority(undefined)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePriority}>
              Save Priority
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
