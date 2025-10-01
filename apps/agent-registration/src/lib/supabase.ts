import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Log warning on server side if environment variables are missing
if (typeof window === 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('⚠️ Missing Supabase environment variables on server side. Using fallback values.')
}

// For client-side, provide fallback values to prevent crashes
const safeSupabaseUrl = supabaseUrl ?? 'https://placeholder.supabase.co'
const safeSupabaseAnonKey = supabaseAnonKey ?? 'placeholder-key'

export const supabase = createClient(safeSupabaseUrl, safeSupabaseAnonKey)

// Admin client for server-side operations (user creation, etc.)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Only check service role key on server side
if (typeof window === 'undefined' && !supabaseServiceRoleKey) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not found. Admin operations will not work.')
  console.warn('Environment variables:', {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: process.env.NODE_ENV
  })
}

export const supabaseAdmin = supabaseServiceRoleKey ? createClient(safeSupabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
}) : null

// Types for our application
export interface UserMetadata {
  roles: string[]  // ['brand_ambassador', 'registration_admin']
  partnerId?: number
  displayName?: string
  phone?: string
  perRegistrationRateCents?: number
}

// Role checking utilities
export const ROLES = {
  BRAND_AMBASSADOR: 'brand_ambassador',
  REGISTRATION_ADMIN: 'registration_admin'
} as const

export type UserRole = typeof ROLES[keyof typeof ROLES]

export function hasRole(userMetadata: UserMetadata | null, role: UserRole): boolean {
  if (!userMetadata?.roles) return false
  return userMetadata.roles.includes(role)
}

export function hasAnyRole(userMetadata: UserMetadata | null, roles: UserRole[]): boolean {
  if (!userMetadata?.roles) return false
  return roles.some(role => userMetadata.roles.includes(role))
}

export function hasAllRoles(userMetadata: UserMetadata | null, roles: UserRole[]): boolean {
  if (!userMetadata?.roles) return false
  return roles.every(role => userMetadata.roles.includes(role))
}

export interface BrandAmbassador {
  id: string
  partnerId: number
  userId: string
  displayName?: string
  phone?: string
  perRegistrationRateCents?: number
  isActive: boolean
  createdAt: string
}

export interface Partner {
  id: number
  partnerName: string
  website?: string
  officeLocation?: string
  isActive: boolean
}
