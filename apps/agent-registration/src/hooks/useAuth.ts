'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { User } from '@supabase/supabase-js'
import { ROLES, UserRole, hasRole, hasAnyRole, hasAllRoles } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface UserMetadata {
  roles: string[]
  partnerId?: number
  displayName?: string
  phone?: string
  perRegistrationRateCents?: number
}

interface AuthState {
  user: User | null
  userMetadata: UserMetadata | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    userMetadata: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          setAuthState(prev => ({ ...prev, error: error.message, loading: false }))
          return
        }

        if (session?.user) {
          const userMetadata = session.user.user_metadata as UserMetadata
          setAuthState({
            user: session.user,
            userMetadata,
            loading: false,
            error: null
          })
        } else {
          setAuthState(prev => ({ ...prev, loading: false }))
        }
      } catch (error) {
        setAuthState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Unknown error',
          loading: false 
        }))
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const userMetadata = session.user.user_metadata as UserMetadata
          setAuthState({
            user: session.user,
            userMetadata,
            loading: false,
            error: null
          })
        } else {
          setAuthState({
            user: null,
            userMetadata: null,
            loading: false,
            error: null
          })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Role checking functions
  const checkRole = (role: UserRole): boolean => {
    return hasRole(authState.userMetadata, role)
  }

  const checkAnyRole = (roles: UserRole[]): boolean => {
    return hasAnyRole(authState.userMetadata, roles)
  }

  const checkAllRoles = (roles: UserRole[]): boolean => {
    return hasAllRoles(authState.userMetadata, roles)
  }

  // Convenience methods
  const isBrandAmbassador = checkRole(ROLES.BRAND_AMBASSADOR)
  const isRegistrationAdmin = checkRole(ROLES.REGISTRATION_ADMIN)
  const isAdmin = isRegistrationAdmin

  // Sign out function
  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthState(prev => ({ ...prev, error: error.message }))
    }
  }

  return {
    ...authState,
    // Role checking
    checkRole,
    checkAnyRole,
    checkAllRoles,
    // Convenience properties
    isBrandAmbassador,
    isRegistrationAdmin,
    isAdmin,
    // Actions
    signOut
  }
}

