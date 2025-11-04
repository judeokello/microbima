'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { checkBrandAmbassadorActiveStatus } from '@/lib/api'
import { toast } from 'sonner'
import { ROLES } from '@/lib/supabase'

/**
 * Hook to check and monitor Brand Ambassador active status
 * Only checks users with ONLY brand_ambassador role (excluding registration_admin)
 * Automatically signs out inactive BAs
 */
export function useBAStatusCheck() {
  const { user, userMetadata } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const hasCheckedRef = useRef(false)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check if user is a BA-only (no registration_admin role)
  const isBAOnly = useCallback(() => {
    if (!userMetadata?.roles) return false
    const roles = userMetadata.roles
    return (
      roles.includes(ROLES.BRAND_AMBASSADOR) &&
      !roles.includes(ROLES.REGISTRATION_ADMIN)
    )
  }, [userMetadata?.roles])

  const checkBAStatus = useCallback(async () => {
    if (!user || !isBAOnly()) {
      return
    }

    try {
      const status = await checkBrandAmbassadorActiveStatus(user.id)

      if (!status.exists || !status.isActive) {
        // BA is inactive or doesn't exist - clear cache and sign out
        localStorage.removeItem('baInfo')
        await supabase.auth.signOut()
        toast.error('Your account has been deactivated. Please contact your administrator.')
        router.push('/auth/login')
        return
      }
    } catch (error) {
      console.error('Error checking BA status:', error)
      
      // If we get a 404 or 401, treat it as inactive (user might be deactivated)
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase()
        if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
          // Treat as inactive - clear cache and sign out
          localStorage.removeItem('baInfo')
          await supabase.auth.signOut()
          toast.error('Your account has been deactivated. Please contact your administrator.')
          router.push('/auth/login')
          return
        }
      }
      // For other errors, don't sign out - could be temporary network issues
    }
  }, [user, isBAOnly, router])

  useEffect(() => {
    // Only check for BA-only users
    if (!user || !isBAOnly()) {
      return
    }

    // Check immediately on mount
    checkBAStatus()
    hasCheckedRef.current = true

    // Set up periodic check (every 10 seconds - more frequent for better responsiveness)
    checkIntervalRef.current = setInterval(() => {
      checkBAStatus()
    }, 10000)

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [user, checkBAStatus, isBAOnly])

  // Check on pathname changes as well
  useEffect(() => {
    if (user && isBAOnly() && hasCheckedRef.current) {
      checkBAStatus()
    }
  }, [pathname, user, isBAOnly, checkBAStatus])

  // Reset check flag when user changes
  useEffect(() => {
    hasCheckedRef.current = false
  }, [user?.id])
}

