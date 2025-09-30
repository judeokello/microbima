import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables in middleware')
}

export async function middleware(request: NextRequest) {
  console.log('🚀 MIDDLEWARE EXECUTING for path:', request.nextUrl.pathname)
  const { pathname } = request.nextUrl

  // Re-enabled middleware for proper authentication flow

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname.startsWith('/auth/login') ||
    pathname.startsWith('/auth/v1/login') ||
    pathname.startsWith('/auth/v1/register') ||
    pathname.startsWith('/bootstrap')
  ) {
    return NextResponse.next()
  }

  // Check if the route requires authentication
  const isProtectedRoute = pathname.startsWith('/admin') || pathname.startsWith('/dashboard')

  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Get the session from cookies
    const { data: { session }, error } = await supabase.auth.getSession()

    console.log('🔍 Session check:', {
      hasSession: !!session,
      hasError: !!error,
      userId: session?.user?.id,
      userEmail: session?.user?.email
    })

    if (error || !session) {
      console.log('❌ No valid session found:', error?.message || 'No session')
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // Get user metadata for role checking
    const userMetadata = session?.user?.user_metadata as { roles?: string[] }
    console.log('✅ User authenticated:', {
      email: session?.user?.email,
      roles: userMetadata?.roles,
      userId: session?.user?.id,
      userMetadata: userMetadata
    })

    // Check admin routes
    if (pathname.startsWith('/admin')) {
      const hasAdminRole = userMetadata?.roles?.includes('registration_admin')
      console.log('🔐 Checking admin role:', hasAdminRole, 'for path:', pathname)

      if (!hasAdminRole) {
        console.log('❌ No admin role, redirecting to dashboard')
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    // Check dashboard routes
    if (pathname.startsWith('/dashboard')) {
      const hasBARole = userMetadata?.roles?.includes('brand_ambassador')

      if (!hasBARole) {
        // If user has admin role but not BA role, redirect to admin
        const hasAdminRole = userMetadata?.roles?.includes('registration_admin')
        if (hasAdminRole) {
          return NextResponse.redirect(new URL('/admin', request.url))
        } else {
          // User has no valid roles, redirect to login
          return NextResponse.redirect(new URL('/auth/login', request.url))
        }
      }
    }

    // Add user data to headers for use in components
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', session?.user?.id || '')
    requestHeaders.set('x-user-roles', JSON.stringify(userMetadata?.roles || []))

    console.log('✅ Access granted to:', pathname)
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

  } catch (error) {
    console.error('❌ Middleware error:', error)
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
