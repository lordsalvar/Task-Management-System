import { Navigate } from "react-router-dom"
import { LoginForm } from "@/components/login-form"
import { Target } from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

export function Login() {
  const { user, loading } = useAuth()

  // Redirect to dashboard if already logged in
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 hover:opacity-80 transition-opacity">
          <Target className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Task Management System</span>
        </Link>
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

