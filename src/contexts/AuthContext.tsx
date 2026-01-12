import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { userService } from '../services'
import { syncUserToDimUser } from '../lib/db-helpers'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true) // Start as true to check initial state

  useEffect(() => {
    // Helper function to sync user to dim_user
    const syncUser = async (user: User | null) => {
      if (!user) return
      
      try {
        // Sync user to dim_user table (handles both new and existing users)
        await syncUserToDimUser(
          user.id,
          user.email || '',
          user.user_metadata?.name || user.user_metadata?.full_name
        )
      } catch (error) {
        console.error('Failed to sync user to dim_user:', error)
        // Don't throw - we don't want to break auth flow if sync fails
      }
    }

    // Get initial session first
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      // Sync user if session exists (handles OAuth callbacks and page refreshes)
      if (session?.user) {
        await syncUser(session.user)
      }
      
      setLoading(false)
    })

    // Then listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      // Sync user when they sign in (especially important for OAuth sign-ups)
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        await syncUser(session.user)
      }
      
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    // Goes through API Gateway → User Service → Database
    await userService.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}