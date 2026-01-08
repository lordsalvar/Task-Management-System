import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Target, CheckCircle2, Clock, BarChart3 } from "lucide-react"
import { analyticsService } from "@/services"
import { syncUserToDimUser } from "@/lib/db-helpers"
import { AppLayout } from "@/components/AppLayout"
import { Skeleton } from "@/components/ui/skeleton"
import { pageCache, CACHE_KEYS } from "@/services/page-cache"

export function Dashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    inProgress: 0,
    completionRate: 0,
  })

  useEffect(() => {
    if (user) {
      // Run sync and stats load in parallel
      Promise.all([
        syncUserOnMount(),
        loadStats(),
      ]).catch(error => {
        console.error("Failed to load dashboard data:", error)
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

  const loadStats = async () => {
    // Check cache first
    const cached = pageCache.get<typeof stats>(CACHE_KEYS.DASHBOARD_STATS)
    if (cached) {
      setStats(cached)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await analyticsService.getCompletionStats()
      if (response.success && response.data) {
        const statsData = {
          total: response.data.total_tasks,
          completed: response.data.completed_tasks,
          pending: response.data.pending_tasks,
          inProgress: response.data.in_progress_tasks,
          completionRate: response.data.completion_rate,
        }
        setStats(statsData)
        // Cache for 2 minutes (stats can change frequently)
        pageCache.set(CACHE_KEYS.DASHBOARD_STATS, statsData, 2 * 60 * 1000)
      }
    } catch (error) {
      console.error("Failed to load stats:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout pageTitle="Dashboard">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                Welcome back! Track your productivity and task completion.
              </p>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:100ms]">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-2xl font-bold tabular-nums transition-all duration-300 group-hover:scale-110 inline-block">
                  {loading ? <Skeleton className="h-8 w-16" /> : stats.total}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  All tasks created
                </p>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:200ms]">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground group-hover:text-green-500 transition-colors duration-300" />
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-2xl font-bold tabular-nums transition-all duration-300 group-hover:scale-110 inline-block">
                  {loading ? <Skeleton className="h-8 w-16" /> : stats.completed}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tasks finished
                </p>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:300ms]">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors duration-300 animate-pulse" />
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-2xl font-bold tabular-nums transition-all duration-300 group-hover:scale-110 inline-block">
                  {loading ? <Skeleton className="h-8 w-16" /> : stats.inProgress}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Currently working
                </p>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:400ms]">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors duration-300" />
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-2xl font-bold tabular-nums transition-all duration-300 group-hover:scale-110 inline-block">
                  {loading ? <Skeleton className="h-8 w-16" /> : `${stats.completionRate.toFixed(1)}%`}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Success rate
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </AppLayout>
  )
}
