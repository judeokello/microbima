import { NextResponse } from 'next/server'

export async function middleware() {
  // Middleware disabled to prevent redirect loops; staff/auth live in route/layout components.
  // Customer self-service: `/self/customer/**` may add role checks later (spec FR-002) without breaking
  // existing matcher-driven behaviour.
  return NextResponse.next()
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
