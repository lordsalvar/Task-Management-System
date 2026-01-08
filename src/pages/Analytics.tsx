import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { AppLayout } from "@/components/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, TrendingUp, Loader2 } from "lucide-react"
import { analyticsService } from "@/services"
import { syncUserToDimUser } from "@/lib/db-helpers"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"

export function Analytics() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [dayOfWeekData, setDayOfWeekData] = useState<Array<{ day_name: string; completed_count: number }>>([])
  const [onTimeStats, setOnTimeStats] = useState<{
    total_completed: number
    on_time_count: number
    late_count: number
    on_time_percentage: number
  } | null>(null)
  const [categoryTimeData, setCategoryTimeData] = useState<Array<{
    category_name: string
    avg_completion_days: number | null
    task_count: number
  }>>([])

  useEffect(() => {
    if (user) {
      syncUserOnMount()
      loadAnalytics()
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

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      // Load all three analytics metrics
      const [dayOfWeekResponse, onTimeResponse, categoryTimeResponse] = await Promise.all([
        analyticsService.getCompletionByDayOfWeek(),
        analyticsService.getOnTimeCompletionStats(),
        analyticsService.getCategoryCompletionTime(),
      ])

      if (dayOfWeekResponse.success && dayOfWeekResponse.data) {
        setDayOfWeekData(dayOfWeekResponse.data)
      }

      if (onTimeResponse.success && onTimeResponse.data) {
        setOnTimeStats(onTimeResponse.data)
      }

      if (categoryTimeResponse.success && categoryTimeResponse.data) {
        setCategoryTimeData(
          categoryTimeResponse.data.map(cat => ({
            category_name: cat.category_name,
            avg_completion_days: cat.avg_completion_days,
            task_count: cat.task_count,
          }))
        )
      }
    } catch (error) {
      console.error("Failed to load analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  const dayOfWeekConfig = {
    completed_count: {
      label: "Completed Tasks",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig

  const onTimeChartData = onTimeStats
    ? [
        { name: "On Time", value: onTimeStats.on_time_count, fill: "hsl(142, 76%, 36%)" },
        { name: "Late", value: onTimeStats.late_count, fill: "hsl(0, 84%, 60%)" },
      ]
    : []

  const categoryConfig = {
    avg_days: {
      label: "Average Days",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig

  return (
    <AppLayout pageTitle="Analytics">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Analytics Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                Track your productivity and analyze task completion trends.
              </p>
            </div>
          </div>

          {/* Task Completion Volume by Day of Week */}
          <Card className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:100ms]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Task Completion Volume by Day of Week
              </CardTitle>
              <CardDescription>
                Analyze completion patterns across different days of the week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : dayOfWeekData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No completion data available yet
                </div>
              ) : (
                <ChartContainer config={dayOfWeekConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayOfWeekData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="day_name"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                      />
                      <Bar
                        dataKey="completed_count"
                        fill="var(--color-completed_count)"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* On-Time Task Completion Rate */}
          <Card className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:200ms]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                On‑Time Task Completion Rate
              </CardTitle>
              <CardDescription>
                Track your on-time completion rate to improve deadline management
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !onTimeStats ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No completion data available yet
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-3xl font-bold text-primary">
                        {onTimeStats.on_time_percentage.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">On-Time Rate</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-3xl font-bold text-green-600">
                        {onTimeStats.on_time_count}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">On-Time Tasks</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-3xl font-bold text-red-600">
                        {onTimeStats.late_count}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Late Tasks</div>
                    </div>
                  </div>

                  {/* Pie Chart */}
                  <ChartContainer config={{}} className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={onTimeChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {onTimeChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Average Task Completion Time by Category */}
          <Card className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:300ms]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Average Task Completion Time by Category
              </CardTitle>
              <CardDescription>
                Identify categories that require more time to help with planning and resource allocation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : categoryTimeData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No category completion data available yet
                </div>
              ) : (
                <ChartContainer config={categoryConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categoryTimeData}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis
                        type="category"
                        dataKey="category_name"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        width={120}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value: number) => [
                          value ? `${value.toFixed(1)} days` : "N/A",
                          "Avg Completion Time",
                        ]}
                      />
                      <Bar
                        dataKey="avg_completion_days"
                        fill="var(--color-avg_days)"
                        radius={[0, 8, 8, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </AppLayout>
  )
}
