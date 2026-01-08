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
import { Plus, CheckCircle2, Clock, AlertCircle, X, Loader2, Sparkles, Target } from "lucide-react"
import { taskService } from "@/services"
import { syncUserToDimUser } from "@/lib/db-helpers"
import { supabase } from "@/lib/supabase"
import type { TaskWithRelations } from "@/services"
import { AppLayout } from "@/components/AppLayout"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export function Tasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)
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

  const syncUserOnMount = async () => {
    if (!user) return
    try {
      await syncUserToDimUser(user.id, user.email || '', user.user_metadata?.name)
    } catch (error) {
      console.error("Failed to sync user:", error)
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
        setNewTaskTitle("")
        setNewTaskDescription("")
        setNewTaskPriority(undefined)
        setNewTaskCategory(null)
        setNewTaskStatus(undefined)
        setNewTaskEstimatedHours("")
        setShowTaskForm(false)
        setError(null)
        toast.success("Task created successfully!", {
          description: "Your new task has been added to the list.",
        })
        await loadTasks()
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

      // Clear task service cache since we added a new category
      taskService.clearCaches()
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

  const handleToggleComplete = async (task: TaskWithRelations) => {
    try {
      await taskService.updateTask(task.task_id, {
        is_completed: !task.is_completed,
      })
      toast.success(
        task.is_completed ? "Task marked as incomplete" : "Task completed!",
        {
          description: task.is_completed 
            ? "The task has been marked as incomplete." 
            : "Great job! Keep up the momentum.",
        }
      )
      await loadTasks()
    } catch (error) {
      console.error("Failed to update task:", error)
      toast.error("Failed to update task", {
        description: "Please try again.",
      })
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId)
      toast.success("Task deleted", {
        description: "The task has been removed.",
      })
      await loadTasks()
    } catch (error) {
      console.error("Failed to delete task:", error)
      toast.error("Failed to delete task", {
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

                  {/* Category and Estimated Hours Row */}
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
                      <TableHead>Estimated</TableHead>
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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleComplete(task)}
                              className="flex items-center transition-all duration-200 hover:scale-110 active:scale-95"
                              aria-label={task.is_completed ? "Mark as incomplete" : "Mark as complete"}
                            >
                              {task.is_completed ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500 transition-all duration-200" />
                              ) : (
                                <div className="w-5 h-5 border-2 border-muted-foreground rounded-full transition-all duration-200 group-hover:border-primary" />
                              )}
                            </button>
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
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this task?")) {
                                handleDeleteTask(task.task_id)
                              }
                            }}
                            className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive hover:scale-105"
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
    </AppLayout>
  )
}
