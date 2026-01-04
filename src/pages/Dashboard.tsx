import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Target, LogOut, Plus, CheckCircle2, Clock, AlertCircle, BarChart3, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { taskService, analyticsService } from "@/services"
import { syncUserToDimUser } from "@/lib/db-helpers"
import { supabase } from "@/lib/supabase"
import type { TaskWithRelations } from "@/services"

export function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    inProgress: 0,
    completionRate: 0,
  })
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskDescription, setNewTaskDescription] = useState("")
  const [newTaskPriority, setNewTaskPriority] = useState<number | undefined>(undefined)
  const [newTaskCategory, setNewTaskCategory] = useState<number | null>(null)
  const [newTaskStatus, setNewTaskStatus] = useState<number | undefined>(undefined)
  const [newTaskEstimatedHours, setNewTaskEstimatedHours] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
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

  useEffect(() => {
    // Ensure user is synced to dim_user
    if (user) {
      syncUserOnMount()
      loadTasks()
      loadStats()
      loadCategories()
      loadStatuses()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const syncUserOnMount = async () => {
    if (!user) return
    try {
      await syncUserToDimUser(user.id, user.email || '', user.user_metadata?.name)
    } catch (error) {
      console.error("Failed to sync user:", error)
      // Don't show error to user - this is a background sync
      // The error will be shown when they try to create a task
    }
  }

  const loadTasks = async () => {
    try {
      setLoading(true)
      const response = await taskService.getTasks({}, { page: 1, limit: 50 })
      if (response.success && response.data) {
        setTasks(response.data.items)
      }
    } catch (error) {
      console.error("Failed to load tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await analyticsService.getCompletionStats()
      if (response.success && response.data) {
        setStats({
          total: response.data.total_tasks,
          completed: response.data.completed_tasks,
          pending: response.data.pending_tasks,
          inProgress: response.data.in_progress_tasks,
          completionRate: response.data.completion_rate,
        })
      }
    } catch (error) {
      console.error("Failed to load stats:", error)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('dim_category')
        .select('category_id, category_name, color')
        .order('category_name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error("Failed to load categories:", error)
    }
  }

  const loadStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('dim_status')
        .select('status_id, status_name, status_order')
        .order('status_order')

      if (error) throw error
      setStatuses(data || [])
    } catch (error) {
      console.error("Failed to load statuses:", error)
    }
  }

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      setError("Task title is required")
      return
    }

    setError(null)
    setCreating(true)

    try {
      // Ensure user is synced first
      if (user) {
        await syncUserToDimUser(user.id, user.email || '', user.user_metadata?.name)
      }

      const estimatedHours = newTaskEstimatedHours ? parseFloat(newTaskEstimatedHours) : undefined

      const response = await taskService.createTask({
        task_title: newTaskTitle,
        task_description: newTaskDescription || undefined,
        category_id: newTaskCategory || undefined,
        status_id: newTaskStatus,
        task_priority: newTaskPriority,
        estimated_hours: estimatedHours,
      })

      if (response.success) {
        // Reset form
        setNewTaskTitle("")
        setNewTaskDescription("")
        setNewTaskPriority(undefined)
        setNewTaskCategory(null)
        setNewTaskStatus(undefined)
        setNewTaskEstimatedHours("")
        setShowTaskForm(false)
        setError(null)
        await loadTasks()
        await loadStats()
      } else {
        setError(response.error?.message || "Failed to create task")
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
    setNewTaskEstimatedHours("")
    setError(null)
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
      // Convert to uppercase
      const categoryNameUpper = newCategoryName.trim().toUpperCase()

      // Check if category already exists
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

      // Reload categories and select the new one
      await loadCategories()
      setNewTaskCategory(data.category_id)
      
      // Reset form
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

  const handleToggleComplete = async (task: TaskWithRelations) => {
    try {
      await taskService.updateTask(task.task_id, {
        is_completed: !task.is_completed,
      })
      await loadTasks()
      await loadStats()
    } catch (error) {
      console.error("Failed to update task:", error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId)
      await loadTasks()
      await loadStats()
    } catch (error) {
      console.error("Failed to delete task:", error)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate("/")
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
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Task Management System</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Welcome back! Manage your tasks and track your productivity.
              </p>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  All tasks created
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.completed}</div>
                <p className="text-xs text-muted-foreground">
                  Tasks finished
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.inProgress}</div>
                <p className="text-xs text-muted-foreground">
                  Currently working
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.completionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  Success rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Create Task */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Create New Task</CardTitle>
                  <CardDescription>Add a new task with all details</CardDescription>
                </div>
                {!showTaskForm && (
                  <Button onClick={() => setShowTaskForm(true)} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    New Task
                  </Button>
                )}
              </div>
            </CardHeader>
            {showTaskForm && (
              <CardContent>
                <div className="space-y-4">
                  {/* Task Title */}
                  <div className="space-y-2">
                    <Label htmlFor="task-title">Task Title *</Label>
                    <Input
                      id="task-title"
                      placeholder="Enter task title..."
                      value={newTaskTitle}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskTitle(e.target.value)}
                      disabled={creating}
                    />
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
                        id="task-priority"
                        value={newTaskPriority || ""}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                          setNewTaskPriority(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                        disabled={creating}
                      >
                        <option value="">Select priority</option>
                        <option value="1">1 - Lowest</option>
                        <option value="2">2 - Low</option>
                        <option value="3">3 - Medium</option>
                        <option value="4">4 - High</option>
                        <option value="5">5 - Highest</option>
                      </Select>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <Label htmlFor="task-status">Status</Label>
                      <Select
                        id="task-status"
                        value={newTaskStatus || ""}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                          setNewTaskStatus(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                        disabled={creating}
                      >
                        <option value="">Select status (defaults to Pending)</option>
                        {statuses.map((status) => (
                          <option key={status.status_id} value={status.status_id}>
                            {status.status_name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  {/* Category and Estimated Hours Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Category */}
                    <div className="space-y-2">
                      <Label htmlFor="task-category">Category</Label>
                      <Select
                        id="task-category"
                        value={newTaskCategory || ""}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                          handleCategorySelectChange(e.target.value)
                        }
                        disabled={creating}
                        className="uppercase"
                      >
                        <option value="">No category</option>
                        {categories.map((category) => (
                          <option key={category.category_id} value={category.category_id}>
                            {category.category_name.toUpperCase()}
                          </option>
                        ))}
                        <option value="add-new" className="font-semibold">
                          + Add New Category
                        </option>
                      </Select>
                    </div>

                    {/* Estimated Hours */}
                    <div className="space-y-2">
                      <Label htmlFor="task-estimated-hours">Estimated Hours</Label>
                      <Input
                        id="task-estimated-hours"
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="e.g., 2.5"
                        value={newTaskEstimatedHours}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskEstimatedHours(e.target.value)}
                        disabled={creating}
                      />
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="text-sm text-destructive flex items-center gap-2 p-3 bg-destructive/10 rounded-md">
                      <AlertCircle className="w-4 h-4" />
                      {error}
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
                      disabled={creating || !newTaskTitle.trim()}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {creating ? "Creating..." : "Create Task"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Tasks List */}
          <Card>
            <CardHeader>
              <CardTitle>Your Tasks</CardTitle>
              <CardDescription>
                Manage and track all your tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading tasks...
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks yet. Create your first task above!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Estimated</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.task_id}>
                        <TableCell>
                          {task.status ? getStatusBadge(task.status.status_name) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleComplete(task)}
                              className="flex items-center"
                            >
                              {task.is_completed ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <div className="w-5 h-5 border-2 border-muted-foreground rounded-full" />
                              )}
                            </button>
                            <span
                              className={task.is_completed ? "line-through text-muted-foreground" : ""}
                            >
                              {task.task_title}
                            </span>
                          </div>
                          {task.task_description && (
                            <p className="text-sm text-muted-foreground mt-1">
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
                          {task.estimated_hours ? (
                            <span className="text-sm">{task.estimated_hours}h</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTask(task.task_id)}
                          >
                            Delete
                          </Button>
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
    </div>
  )
}
