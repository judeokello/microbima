import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Only check environment variables on server side
if (typeof window === 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

// Provide fallback values for client-side rendering
const safeSupabaseUrl = supabaseUrl || 'https://yowgqzgqxvkqyyzhxvej.supabase.co'
const safeSupabaseAnonKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

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
