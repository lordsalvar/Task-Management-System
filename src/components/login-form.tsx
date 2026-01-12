import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { userService } from "@/services"
import { supabase } from "@/lib/supabase"
import { Separator } from "@/components/ui/separator"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleGoogleSignIn = async () => {
    setOauthLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (oauthError) {
        throw new Error(oauthError.message || 'Failed to sign in with Google')
      }
      // The redirect will happen automatically, so we don't need to navigate manually
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google")
      setOauthLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isSignUp) {
        // Sign up - goes through API Gateway → User Service → Database
        const result = await userService.signUp({
          email,
          password,
        })

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to create account")
        }

        if (result.data?.user) {
          setMessage("Account created! Please check your email to verify your account.")
          // Optionally auto-login after signup
          // navigate("/dashboard")
        }
      } else {
        // Sign in - goes through API Gateway → User Service → Database
        const result = await userService.signIn(email, password)

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to sign in")
        }

        if (result.data?.user) {
          navigate("/dashboard")
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">
            {isSignUp ? "Create an account" : "Login to your account"}
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            {isSignUp
              ? "Enter your email to create a new account"
              : "Enter your email below to login to your account"}
          </p>
        </div>
        
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        
        {message && (
          <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-600 dark:text-green-400">
            {message}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            disabled={loading || oauthLoading}
          />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            disabled={loading || oauthLoading}
            minLength={6}
          />
        </Field>
        <Field>
          <Button type="submit" disabled={loading || oauthLoading} className="w-full">
            {loading
              ? isSignUp
                ? "Creating account..."
                : "Logging in..."
              : isSignUp
              ? "Sign Up"
              : "Login"}
          </Button>
        </Field>
        <Field>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
        </Field>
        <Field>
          <Button 
            type="button" 
            variant="outline" 
            disabled={loading || oauthLoading} 
            className="w-full"
            onClick={handleGoogleSignIn}
          >
            {oauthLoading ? "Connecting..." : "Continue with Google"}
          </Button>
        </Field>
        <Field>
          <FieldDescription className="text-center">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false)
                    setError(null)
                    setMessage(null)
                  }}
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true)
                    setError(null)
                    setMessage(null)
                  }}
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Sign up
                </button>
              </>
            )}
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
