import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppLayout } from "@/components/AppLayout"
import { MessageCircle, Send, Bot, User, Loader2 } from "lucide-react"
import { taskService, analyticsService } from "@/services"
import { syncUserToDimUser } from "@/lib/db-helpers"
import type { TaskWithRelations } from "@/services"
import { toast } from "sonner"

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTED_QUESTIONS = [
  "What are my tasks today?",
  "How many tasks did I complete?",
  "What tasks are overdue?",
  "What's my completion rate?",
]

export function ChatAssistant() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your task management assistant. I can help you with information about your tasks. Try asking me one of the questions below, or ask your own!",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      syncUserToDimUser(user.id, user.email || '', user.user_metadata?.name).catch(error => {
        console.error("Failed to sync user:", error)
      })
    }
  }, [user])

  const handleQuestionClick = (question: string) => {
    setInput(question)
    handleSend(question)
  }

  const handleSend = async (questionText?: string) => {
    const question = questionText || input.trim()
    if (!question) return

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: question,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      // Process the question and get response
      const response = await processQuestion(question)
      
      // Add assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error("Failed to process question:", error)
      const errorMessage: Message = {
        role: 'assistant',
        content: "I'm sorry, I encountered an error while processing your question. Please try again.",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
      toast.error("Failed to get response", {
        description: "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  const processQuestion = async (question: string): Promise<string> => {
    const lowerQuestion = question.toLowerCase()

    // Get tasks today
    if (lowerQuestion.includes('today') || lowerQuestion.includes('task today')) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const response = await taskService.getTasks({}, { page: 1, limit: 100 })
      if (response.success && response.data) {
        const tasks = response.data.items
        const todayTasks = tasks.filter(task => {
          const taskAny = task as any
          if (taskAny.due_date) {
            const dueDate = new Date(taskAny.due_date)
            return dueDate >= today && dueDate < tomorrow && !task.is_completed
          }
          return false
        })

        if (todayTasks.length === 0) {
          return "You don't have any tasks due today. Great job staying on top of things! 🎉"
        }

        const taskList = todayTasks.map((task, index) => {
          const taskAny = task as any
          const dueDate = taskAny.due_date ? new Date(taskAny.due_date).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : ''
          return `${index + 1}. ${task.task_title}${dueDate ? ` (due at ${dueDate})` : ''}`
        }).join('\n')

        return `You have ${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''} due today:\n\n${taskList}`
      }
      return "I couldn't retrieve your tasks. Please try again."
    }

    // Get completed tasks count
    if (lowerQuestion.includes('complete') || lowerQuestion.includes('completed') || lowerQuestion.includes('how many')) {
      const statsResponse = await analyticsService.getCompletionStats()
      if (statsResponse.success && statsResponse.data) {
        const { completed_tasks, total_tasks, completion_rate } = statsResponse.data
        return `You have completed ${completed_tasks} out of ${total_tasks} total tasks, which is a ${completion_rate.toFixed(1)}% completion rate. ${completed_tasks > 0 ? 'Keep up the great work! 🎉' : 'Start completing tasks to see your progress!'}`
      }
      return "I couldn't retrieve your completion statistics. Please try again."
    }

    // Get overdue tasks
    if (lowerQuestion.includes('overdue')) {
      const response = await taskService.getTasks({}, { page: 1, limit: 100 })
      if (response.success && response.data) {
        const tasks = response.data.items
        const overdueTasks = tasks.filter(task => {
          if (task.is_completed) return false
          const taskAny = task as any
          if (taskAny.due_date) {
            return new Date(taskAny.due_date) < new Date()
          }
          return false
        })

        if (overdueTasks.length === 0) {
          return "Great news! You don't have any overdue tasks. You're staying on top of everything! ✅"
        }

        const taskList = overdueTasks.map((task, index) => {
          const taskAny = task as any
          const dueDate = taskAny.due_date ? new Date(taskAny.due_date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          }) : ''
          return `${index + 1}. ${task.task_title}${dueDate ? ` (was due on ${dueDate})` : ''}`
        }).join('\n')

        return `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}:\n\n${taskList}\n\nConsider prioritizing these tasks to get back on track!`
      }
      return "I couldn't retrieve your tasks. Please try again."
    }

    // Get completion rate
    if (lowerQuestion.includes('completion rate') || lowerQuestion.includes('rate')) {
      const statsResponse = await analyticsService.getCompletionStats()
      if (statsResponse.success && statsResponse.data) {
        const { completion_rate, completed_tasks, total_tasks } = statsResponse.data
        return `Your completion rate is ${completion_rate.toFixed(1)}%. You've completed ${completed_tasks} out of ${total_tasks} tasks. ${completion_rate >= 80 ? 'Excellent work! 🌟' : completion_rate >= 50 ? 'Good progress! Keep it up! 💪' : 'You can do it! Try to complete more tasks to improve your rate.'}`
      }
      return "I couldn't retrieve your completion rate. Please try again."
    }

    // Get all tasks
    if (lowerQuestion.includes('all task') || lowerQuestion.includes('my task') || lowerQuestion.includes('list task')) {
      const response = await taskService.getTasks({}, { page: 1, limit: 50 })
      if (response.success && response.data) {
        const tasks = response.data.items
        const pendingTasks = tasks.filter(t => !t.is_completed)
        const completedTasks = tasks.filter(t => t.is_completed)

        if (tasks.length === 0) {
          return "You don't have any tasks yet. Create your first task to get started! 🚀"
        }

        return `You have ${tasks.length} total tasks:\n\n• ${pendingTasks.length} pending/in progress\n• ${completedTasks.length} completed\n\n${pendingTasks.length > 0 ? `You have ${pendingTasks.length} task${pendingTasks.length > 1 ? 's' : ''} to work on. Keep going! 💪` : 'All your tasks are completed! Amazing work! 🎉'}`
      }
      return "I couldn't retrieve your tasks. Please try again."
    }

    // Default response
    return "I can help you with information about your tasks! Try asking:\n• What are my tasks today?\n• How many tasks did I complete?\n• What tasks are overdue?\n• What's my completion rate?\n\nOr ask about your tasks in your own words!"
  }

  return (
    <AppLayout pageTitle="Chat Assistant">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-2">
                <MessageCircle className="h-8 w-8 text-primary" />
                Chat Assistant
              </h1>
              <p className="text-muted-foreground mt-2">
                Ask me anything about your tasks and I'll help you with real-time information.
              </p>
            </div>
          </div>

          {/* Chat Card */}
          <Card className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:100ms]">
            <CardHeader>
              <CardTitle>Task Assistant</CardTitle>
              <CardDescription>
                Get instant answers about your tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Suggested Questions */}
              <div className="mb-6 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Suggested questions:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuestionClick(question)}
                      className="text-xs"
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-4 mb-6 max-h-[500px] overflow-y-auto pr-2">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {message.role === 'user' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Ask me about your tasks..."
                  disabled={loading}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </AppLayout>
  )
}

