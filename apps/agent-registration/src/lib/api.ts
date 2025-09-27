import { supabaseAdmin, ROLES } from './supabase'

// Re-export constants for convenience
export { ROLES }

// Define types directly to avoid import issues
export interface UserMetadata {
  roles: string[]  // ['brand_ambassador', 'registration_admin']
  partnerId?: number
  displayName?: string
  phone?: string
  perRegistrationRateCents?: number
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

export interface CreateBARequest {
  email: string
  password: string
  displayName: string
  phone?: string
  partnerId: number
  perRegistrationRateCents: number
  roles: string[]  // ['brand_ambassador'] or ['brand_ambassador', 'registration_admin']
}

export interface CreateBAResponse {
  success: boolean
  userId?: string
  baId?: string
  error?: string
}

export async function createBrandAmbassador(data: CreateBARequest): Promise<CreateBAResponse> {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available. Check SUPABASE_SERVICE_ROLE_KEY environment variable.')
    }

    // Step 1: Create Supabase user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      user_metadata: {
        roles: data.roles,
        partnerId: data.partnerId,
        displayName: data.displayName,
        phone: data.phone,
        perRegistrationRateCents: data.perRegistrationRateCents
      } as UserMetadata
    })

    if (userError) {
      throw new Error(`Failed to create user: ${userError.message}`)
    }

    if (!userData.user) {
      throw new Error('User creation failed - no user data returned')
    }

    // Step 2: Create BrandAmbassador record in your database
    const baData = {
      userId: userData.user.id,
      partnerId: data.partnerId,
      displayName: data.displayName,
      phone: data.phone,
      perRegistrationRateCents: data.perRegistrationRateCents,
      isActive: true
    }

    // TODO: Call your NestJS API to create the BrandAmbassador record
    // const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/brand-ambassadors`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    //   },
    //   body: JSON.stringify(baData)
    // })

    // For now, return success (we'll implement the actual API call later)
    return {
      success: true,
      userId: userData.user.id,
      baId: 'temp-ba-id' // This will come from the API response
    }

  } catch (error) {
    console.error('Error creating brand ambassador:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function getBrandAmbassadors(): Promise<BrandAmbassador[]> {
  try {
    // TODO: Call your NestJS API to get brand ambassadors
    // const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/brand-ambassadors`, {
    //   headers: {
    //     'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    //   }
    // })

    // For now, return mock data
    return [
      {
        id: '1',
        partnerId: 1,
        userId: 'user-1',
        displayName: 'John Doe',
        phone: '+254700000001',
        perRegistrationRateCents: 500,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        partnerId: 2,
        userId: 'user-2',
        displayName: 'Jane Smith',
        phone: '+254700000002',
        perRegistrationRateCents: 750,
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ]
  } catch (error) {
    console.error('Error fetching brand ambassadors:', error)
    return []
  }
}

export async function getPartners(): Promise<Partner[]> {
  try {
    // TODO: Call your NestJS API to get partners
    // const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/partners`, {
    //   headers: {
    //     'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    //   }
    // })

    // For now, return mock data
    return [
      {
        id: 1,
        partnerName: 'Sample Partner 1',
        website: 'https://partner1.com',
        officeLocation: 'Nairobi, Kenya',
        isActive: true
      },
      {
        id: 2,
        partnerName: 'Sample Partner 2',
        website: 'https://partner2.com',
        officeLocation: 'Mombasa, Kenya',
        isActive: true
      }
    ]
  } catch (error) {
    console.error('Error fetching partners:', error)
    return []
  }
}

export async function updateBrandAmbassador(id: string, data: Partial<BrandAmbassador>): Promise<boolean> {
  try {
    // TODO: Call your NestJS API to update brand ambassador
    console.log('Updating BA:', id, data)
    return true
  } catch (error) {
    console.error('Error updating brand ambassador:', error)
    return false
  }
}

export async function deactivateBrandAmbassador(id: string): Promise<boolean> {
  try {
    // TODO: Call your NestJS API to deactivate brand ambassador
    console.log('Deactivating BA:', id)
    return true
  } catch (error) {
    console.error('Error deactivating brand ambassador:', error)
    return false
  }
}
