import { CheckCircle2, TrendingUp, Clock, BarChart3, History, Target } from "lucide-react"
import { Button } from "./components/ui/button"
import { Routes, Route, Link } from "react-router-dom"
import { Login } from "./pages/Login"
import { Dashboard } from "./pages/Dashboard"
import { Tasks } from "./pages/Tasks"
import { Analytics } from "./pages/Analytics"
import { ChatAssistant } from "./pages/ChatAssistant"
import { ProtectedRoute } from "./components/ProtectedRoute"

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <Tasks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat-assistant"
        element={
          <ProtectedRoute>
            <ChatAssistant />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={
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
                  <Button variant="ghost" asChild>
                    <Link to="/login">Sign In</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/login">Get Started</Link>
                  </Button>
                </div>
              </div>
            </div>
          </nav>

          {/* Hero Section */}
          <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-background to-muted/20 py-20 sm:py-24 lg:py-32">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  Simple and Efficient
                  <span className="block text-primary">Task Management</span>
                </h1>
                <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
                  Create, update, and track tasks while storing historical data for analysis. 
                  Analyze task completion trends to improve productivity and time management.
                </p>
                <div className="mt-10 flex items-center justify-center gap-4">
                  <Button size="lg" className="text-base" asChild>
                    <Link to="/login">Get Started Free</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="text-base">
                    Learn More
                  </Button>
                </div>
              </div>
            </div>
            <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl">
              <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary/20 to-primary/5 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-20 sm:py-24 lg:py-32">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Everything you need to manage tasks effectively
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Powerful features designed to help you stay organized and productive
                </p>
              </div>
              <div className="mx-auto mt-16 max-w-5xl">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Feature 1 */}
                  <div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold">Create & Update Tasks</h3>
                    <p className="mt-2 text-muted-foreground">
                      Easily create new tasks and update them as your priorities change. 
                      Keep everything organized in one place.
                    </p>
                  </div>

                  {/* Feature 2 */}
                  <div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold">Track Progress</h3>
                    <p className="mt-2 text-muted-foreground">
                      Monitor your task completion in real-time. See what's done, 
                      what's in progress, and what's coming up next.
                    </p>
                  </div>

                  {/* Feature 3 */}
                  <div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <History className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold">Historical Data</h3>
                    <p className="mt-2 text-muted-foreground">
                      All your task history is automatically stored. Never lose track 
                      of what you've accomplished.
                    </p>
                  </div>

                  {/* Feature 4 */}
                  <div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <BarChart3 className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold">Trend Analysis</h3>
                    <p className="mt-2 text-muted-foreground">
                      Analyze your task completion trends over time. Identify patterns 
                      and optimize your workflow.
                    </p>
                  </div>

                  {/* Feature 5 */}
                  <div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold">Productivity Insights</h3>
                    <p className="mt-2 text-muted-foreground">
                      Get actionable insights to improve your productivity and 
                      time management skills.
                    </p>
                  </div>

                  {/* Feature 6 */}
                  <div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Target className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold">Goal Achievement</h3>
                    <p className="mt-2 text-muted-foreground">
                      Set and track goals with data-driven insights. Make informed 
                      decisions about your time and priorities.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Benefits Section */}
          <section className="border-t border-border/40 bg-muted/30 py-20 sm:py-24 lg:py-32">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-4xl">
                <div className="text-center">
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    Why Choose Task Management System?
                  </h2>
                  <p className="mt-4 text-lg text-muted-foreground">
                    A comprehensive solution for modern task management
                  </p>
                </div>
                <div className="mt-16 grid gap-8 sm:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Simple & Intuitive</h3>
                    <p className="text-muted-foreground">
                      Our platform is designed with simplicity in mind. No complex setup, 
                      no steep learning curve—just start managing your tasks right away.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Data-Driven Decisions</h3>
                    <p className="text-muted-foreground">
                      Make informed decisions about your productivity with comprehensive 
                      analytics and trend analysis built right in.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Complete History</h3>
                    <p className="text-muted-foreground">
                      Never lose track of your accomplishments. Every task is stored 
                      with its complete history for future reference and analysis.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Continuous Improvement</h3>
                    <p className="text-muted-foreground">
                      Use trend analysis to identify what works best for you and 
                      continuously improve your productivity and time management.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-20 sm:py-24 lg:py-32">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Ready to boost your productivity?
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Start managing your tasks more effectively today. Join thousands of users 
                  who are already improving their productivity with Task Management System.
                </p>
                <div className="mt-10">
                  <Button size="lg" className="text-base" asChild>
                    <Link to="/login">Get Started Free</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-border/40 bg-muted/30 py-12">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Task Management System</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  © 2024 Task Management System. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </div>
      } />
    </Routes>
  )
}

export default App

