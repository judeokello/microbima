import { supabase, supabaseAdmin, ROLES } from './supabase'

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

// Customer Registration API Types and Functions
export interface CustomerRegistrationRequest {
  principalMember: {
    firstName: string
    lastName: string
    middleName?: string
    dateOfBirth: string
    gender: string
    email?: string
    phoneNumber?: string
    idType: string
    idNumber: string
    partnerCustomerId: string
  }
  product: {
    productId: string
    planId: string
  }
  spouses?: Array<{
    firstName: string
    lastName: string
    middleName?: string
    dateOfBirth?: string
    gender: string
    phoneNumber?: string
    idType: string
    idNumber: string
  }>
  children?: Array<{
    firstName: string
    lastName: string
    middleName?: string
    dateOfBirth?: string
    gender: string
    idType: string
    idNumber: string
  }>
  beneficiaries?: Array<{
    firstName: string
    lastName: string
    middleName?: string
    dateOfBirth: string
    gender: string
    idType: string
    idNumber: string
    phoneNumber?: string
    email?: string
    relationship: string
    customRelationship?: string
  }>
}

export interface CustomerRegistrationResponse {
  success: boolean
  customerId?: string
  error?: string
}

export interface AgentRegistrationRequest {
  customerId: string
  baId: string
  partnerId: string
  registrationStatus?: string
}

export interface AgentRegistrationResponse {
  success: boolean
  registrationId?: string
  error?: string
}

export async function createCustomer(data: CustomerRegistrationRequest): Promise<CustomerRegistrationResponse> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY ?? '',
        'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      },
      body: JSON.stringify({
        correlationId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...data
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      
      // Handle detailed validation errors
      if (errorData.error?.details && typeof errorData.error.details === 'object') {
        const fieldErrors = Object.entries(errorData.error.details)
          .map(([field, message]) => `${field}: ${message}`)
          .join(', ')
        throw new Error(`Validation failed: ${fieldErrors}`)
      }
      
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    return {
      success: true,
      customerId: result.data.principalId
    }
  } catch (error) {
    console.error('Error creating customer:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function createAgentRegistration(data: AgentRegistrationRequest): Promise<AgentRegistrationResponse> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/agent-registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getSupabaseToken()}`,
        'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    return {
      success: true,
      registrationId: result.id
    }
  } catch (error) {
    console.error('Error creating agent registration:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

// Beneficiary API Types and Functions
export interface BeneficiaryData {
  firstName: string
  lastName: string
  middleName?: string
  dateOfBirth: string
  gender: string
  email?: string
  phoneNumber?: string
  idType: string
  idNumber: string
  relationship: string
  relationshipDescription?: string
  percentage: number
}

export interface AddBeneficiariesRequest {
  correlationId: string
  beneficiaries: BeneficiaryData[]
}

export interface AddBeneficiariesResponse {
  success: boolean
  beneficiaryIds?: string[]
  error?: string
}

export interface CreateMissingRequirementRequest {
  registrationId: string
  customerId: string
  partnerId: string
  entityKind: string
  entityId?: string
  fieldPath: string
  status?: string
}

export interface CreateMissingRequirementResponse {
  success: boolean
  missingRequirementId?: string
  error?: string
}

export async function addBeneficiaries(customerId: string, beneficiaries: BeneficiaryData[]): Promise<AddBeneficiariesResponse> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/customers/${customerId}/beneficiaries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY ?? '',
        'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      },
      body: JSON.stringify({
        correlationId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        beneficiaries
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    return {
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      beneficiaryIds: result.beneficiaries?.map((b: any) => b.beneficiaryId) ?? []
    }
  } catch (error) {
    console.error('Error adding beneficiaries:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function createMissingRequirement(data: CreateMissingRequirementRequest): Promise<CreateMissingRequirementResponse> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/agent-registrations/missing-requirements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getSupabaseToken()}`,
        'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    return {
      success: true,
      missingRequirementId: result.id
    }
  } catch (error) {
    console.error('Error creating missing requirement:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

// Payment API Types and Functions (Mock Implementation)
export interface PaymentRequest {
  customerId: string
  registrationId: string
  phoneNumber: string
  amount: number
  currency: string
}

export interface PaymentResponse {
  success: boolean
  paymentId?: string
  transactionId?: string
  error?: string
}

export async function processPayment(data: PaymentRequest): Promise<PaymentResponse> {
  try {
    // Mock payment processing - simulate MPESA STK push
    console.log('Processing payment:', data)

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Mock successful payment response
    const mockPaymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const mockTransactionId = `TXN${Date.now()}`

    // Simulate 90% success rate for demo purposes
    if (Math.random() > 0.1) {
      return {
        success: true,
        paymentId: mockPaymentId,
        transactionId: mockTransactionId
      }
    } else {
      // Simulate payment failure
      throw new Error('Payment failed. Please try again or use a different payment method.')
    }
  } catch (error) {
    console.error('Error processing payment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment processing failed'
    }
  }
}

async function getSupabaseToken(): Promise<string> {
  try {
    // Get the current session from the client-side supabase instance
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session?.access_token) {
      throw new Error('No valid session found')
    }
    return session.access_token
  } catch (error) {
    console.error('Error getting Supabase token:', error)
    throw new Error('Authentication failed')
  }
}
