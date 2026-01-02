import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Target, LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"

export function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate("/")
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
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome back! Start managing your tasks.
            </p>
          </div>

          {/* Dashboard Content */}
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-muted-foreground">
              Your task management dashboard will go here. You can start building
              your task management features now that authentication is set up!
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

