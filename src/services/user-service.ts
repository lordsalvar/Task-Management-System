/**
 * User Service
 * 
 * Responsibility: Manages user accounts and authentication
 */

import { supabase } from '../lib/supabase'
import { apiGateway } from './api-gateway'
import type { ApiResponse } from './types'
import { syncUserToDimUser, getCurrentUserDimUser } from '../lib/db-helpers'
import type { DimUserInsert } from '../lib/db-helpers'

export interface UserProfile {
  user_id: string
  auth_user_id: string
  name: string
  email: string | null
  created_at: string
  updated_at: string | null
}

export interface CreateUserRequest {
  email: string
  password: string
  name?: string
}

export interface UpdateUserRequest {
  name?: string
  email?: string
}

class UserService {
  /**
   * Sign up a new user
   */
  async signUp(request: CreateUserRequest): Promise<ApiResponse<{ user: UserProfile; session: unknown }>> {
    const response = await apiGateway.route<{ user: UserProfile; session: unknown }>(
      'USER',
      '/signup',
      {
        method: 'POST',
        body: request,
        requireAuth: false,
      }
    )

    if (!response.success) {
      return response as ApiResponse<{ user: UserProfile; session: unknown }>
    }

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: request.email,
        password: request.password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('User creation failed')

      // Sync to dim_user
      await syncUserToDimUser(
        authData.user.id,
        request.email,
        request.name
      )

      // Get user profile
      const userProfile = await this.getProfile()

      return {
        success: true,
        data: {
          user: userProfile.data as UserProfile,
          session: authData.session,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SIGNUP_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create user',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Sign in a user
   */
  async signIn(email: string, password: string): Promise<ApiResponse<{ user: UserProfile; session: unknown }>> {
    const response = await apiGateway.route<{ user: UserProfile; session: unknown }>(
      'USER',
      '/signin',
      {
        method: 'POST',
        body: { email, password },
        requireAuth: false,
      }
    )

    if (!response.success) {
      return response as ApiResponse<{ user: UserProfile; session: unknown }>
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      if (!data.user) throw new Error('Sign in failed')

      // Ensure user exists in dim_user
      await syncUserToDimUser(data.user.id, email)

      const userProfile = await this.getProfile()

      return {
        success: true,
        data: {
          user: userProfile.data as UserProfile,
          session: data.session,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SIGNIN_ERROR',
          message: error instanceof Error ? error.message : 'Failed to sign in',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<ApiResponse<void>> {
    const response = await apiGateway.route<void>('USER', '/signout', {
      method: 'POST',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<void>
    }

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      return {
        success: true,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SIGNOUT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to sign out',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<ApiResponse<UserProfile>> {
    const response = await apiGateway.route<UserProfile>('USER', '/profile', {
      method: 'GET',
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<UserProfile>
    }

    try {
      const dimUser = await getCurrentUserDimUser()
      
      if (!dimUser) {
        return {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User profile not found',
          },
          timestamp: new Date().toISOString(),
        }
      }

      return {
        success: true,
        data: {
          user_id: dimUser.user_id,
          auth_user_id: dimUser.auth_user_id || '',
          name: dimUser.name,
          email: dimUser.email,
          created_at: dimUser.created_at,
          updated_at: dimUser.updated_at,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROFILE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get profile',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(request: UpdateUserRequest): Promise<ApiResponse<UserProfile>> {
    const response = await apiGateway.route<UserProfile>('USER', '/profile', {
      method: 'PUT',
      body: request,
      requireAuth: true,
    })

    if (!response.success) {
      return response as ApiResponse<UserProfile>
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const dimUser = await getCurrentUserDimUser()
      if (!dimUser) throw new Error('User profile not found')

      const updateData: Partial<DimUserInsert> = {}
      if (request.name) updateData.name = request.name
      if (request.email) updateData.email = request.email

      const { data, error } = await supabase
        .from('dim_user')
        .update(updateData)
        .eq('user_id', dimUser.user_id)
        .select()
        .single()

      if (error) throw error

      const profile: UserProfile = {
        user_id: data.user_id,
        auth_user_id: data.auth_user_id || '',
        name: data.name,
        email: data.email,
        created_at: data.created_at,
        updated_at: data.updated_at,
      }

      return {
        success: true,
        data: profile,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update profile',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<ApiResponse<unknown>> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) throw error

      return {
        success: true,
        data: session,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SESSION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get session',
        },
        timestamp: new Date().toISOString(),
      }
    }
  }
}

// Singleton instance
export const userService = new UserService()

