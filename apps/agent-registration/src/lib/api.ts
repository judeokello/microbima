import { supabase, ROLES } from './supabase'

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
  phoneNumber?: string
  perRegistrationRateCents?: number
  isActive: boolean
  createdAt: string
  updatedAt?: string
  partner?: {
    id: number
    partnerName: string
    isActive: boolean
  }
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
  firstName: string
  lastName: string
  phone?: string
  partnerId: number
  perRegistrationRateShillings: number  // Rate in shillings (KES)
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
    // Get current user session for createdBy
    const { data: { session } } = await supabase.auth.getSession()
    const currentUserId = session?.user?.id

    // Prepare data for backend API (backend will handle user creation)
    // Convert shillings to cents for backend
    const perRegistrationRateCents = Math.round(data.perRegistrationRateShillings * 100)

    const baData = {
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: `${data.firstName} ${data.lastName}`.trim(),
      roles: data.roles,
      phoneNumber: data.phone,
      perRegistrationRateCents: perRegistrationRateCents,
      isActive: true,
      createdBy: currentUserId
    }

    // Get admin token for API call
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/partner-management/partners/${data.partnerId}/brand-ambassadors`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `ba-create-${Date.now()}`
        },
        body: JSON.stringify(baData)
      }
    )

    if (!response.ok) {
      try {
        const errorData = await response.json();
        const errorMessage = errorData.error?.details?.message ?? errorData.error?.message ?? `Failed to create BA record: ${response.statusText}`;
        throw new Error(errorMessage);
      } catch {
        throw new Error(`Failed to create BA record: ${response.statusText}`);
      }
    }

    const result = await response.json();
    return {
      success: true,
      userId: result.userId,
      baId: result.id
    };

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
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/partner-management/brand-ambassadors?limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `ba-list-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      try {
        const errorData = await response.json();
        const errorMessage = errorData.error?.details?.message ?? errorData.error?.message ?? `Failed to fetch brand ambassadors: ${response.statusText}`;
        throw new Error(errorMessage);
      } catch {
        throw new Error(`Failed to fetch brand ambassadors: ${response.statusText}`);
      }
    }
    const data = await response.json();
    return data.brandAmbassadors ?? [];
  } catch (error) {
    console.error('Error fetching brand ambassadors:', error)
    // Return empty array on error to prevent UI breaking
    return []
  }
}

export async function getPartners(): Promise<Partner[]> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/partner-management/partners?limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `partners-list-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      try {
        const errorData = await response.json();
        const errorMessage = errorData.error?.details?.message ?? errorData.error?.message ?? `Failed to fetch partners: ${response.statusText}`;
        throw new Error(errorMessage);
      } catch {
        throw new Error(`Failed to fetch partners: ${response.statusText}`);
      }
    }
    const data = await response.json();
    // Response structure: { status, message, data: { partners: [...], pagination: {...} } }
    return data.data?.partners ?? [];
  } catch (error) {
    console.error('Error fetching partners:', error)
    // Return empty array on error to prevent UI breaking
    return []
  }
}

export interface UpdateBARequest {
  partnerId?: number
  phoneNumber?: string
  perRegistrationRateShillings?: number  // Rate in shillings (KES)
  isActive?: boolean
  roles?: string[]
}

export async function updateBrandAmbassador(id: string, data: UpdateBARequest): Promise<boolean> {
  try {
    const token = await getSupabaseToken()

    // Convert shillings to cents if rate is provided
    const updateData: {
      partnerId?: number
      phoneNumber?: string | null
      perRegistrationRateCents?: number
      isActive?: boolean
      roles?: string[]
    } = {}
    if (data.partnerId !== undefined) {
      updateData.partnerId = data.partnerId
    }
    if (data.phoneNumber !== undefined) {
      updateData.phoneNumber = data.phoneNumber || null
    }
    if (data.perRegistrationRateShillings !== undefined) {
      updateData.perRegistrationRateCents = Math.round(data.perRegistrationRateShillings * 100)
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive
    }
    if (data.roles !== undefined) {
      updateData.roles = data.roles
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/partner-management/brand-ambassadors/${id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `ba-update-${Date.now()}`
        },
        body: JSON.stringify(updateData)
      }
    )

    if (!response.ok) {
      try {
        const errorData = await response.json()
        const errorMessage = errorData.error?.details?.message ?? errorData.error?.message ?? `Failed to update BA: ${response.statusText}`
        throw new Error(errorMessage)
      } catch {
        throw new Error(`Failed to update BA: ${response.statusText}`)
      }
    }

    return true
  } catch (error) {
    console.error('Error updating brand ambassador:', error)
    throw error
  }
}

export async function getBrandAmbassadorRoles(id: string): Promise<string[]> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/partner-management/brand-ambassadors/${id}/roles`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `ba-roles-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      try {
        const errorData = await response.json()
        const errorMessage = errorData.error?.details?.message ?? errorData.error?.message ?? `Failed to fetch roles: ${response.statusText}`
        throw new Error(errorMessage)
      } catch {
        throw new Error(`Failed to fetch roles: ${response.statusText}`)
      }
    }

    const data = await response.json()
    return data.roles ?? []
  } catch (error) {
    console.error('Error fetching brand ambassador roles:', error)
    throw error
  }
}

export async function checkBrandAmbassadorActiveStatus(userId: string): Promise<{ isActive: boolean; exists: boolean }> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/partner-management/brand-ambassadors/check-status/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `ba-status-check-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      // If 404 or 401, treat as inactive
      if (response.status === 404 || response.status === 401) {
        return { isActive: false, exists: false }
      }

      try {
        const errorData = await response.json()
        const errorMessage = errorData.error?.details?.message ?? errorData.error?.message ?? `Failed to check status: ${response.statusText}`
        throw new Error(errorMessage)
      } catch {
        throw new Error(`Failed to check status: ${response.statusText}`)
      }
    }

    const data = await response.json()
    return { isActive: data.isActive ?? false, exists: data.exists ?? false }
  } catch (error) {
    console.error('Error checking brand ambassador status:', error)
    // Re-throw to let the hook handle it
    throw error
  }
}

export async function updateBrandAmbassadorPassword(id: string, password: string): Promise<boolean> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/partner-management/brand-ambassadors/${id}/password`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `ba-password-update-${Date.now()}`
        },
        body: JSON.stringify({ password })
      }
    )

    if (!response.ok) {
      try {
        const errorData = await response.json()
        const errorMessage = errorData.error?.details?.message ?? errorData.error?.message ?? `Failed to update password: ${response.statusText}`
        throw new Error(errorMessage)
      } catch {
        throw new Error(`Failed to update password: ${response.statusText}`)
      }
    }

    return true
  } catch (error) {
    console.error('Error updating brand ambassador password:', error)
    throw error
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
  partnerId?: string // Optional - will be derived from BA record if not provided
  registrationStatus?: string
}

export interface AgentRegistrationResponse {
  success: boolean
  registrationId?: string
  error?: string
}

export async function createCustomer(data: CustomerRegistrationRequest): Promise<CustomerRegistrationResponse> {
  try {
    // Get Supabase session token for internal API
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    if (!token) {
      throw new Error('No Supabase session token found');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
    console.log('🔍 DEBUG: createAgentRegistration called with:', data);
    console.log('🔍 DEBUG: API URL:', `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/agent-registrations`);

    const token = await getSupabaseToken();
    console.log('🔍 DEBUG: Supabase token obtained:', token ? 'YES' : 'NO');

    const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/agent-registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      },
      body: JSON.stringify(data)
    })

    console.log('🔍 DEBUG: Response status:', response.status);
    console.log('🔍 DEBUG: Response ok:', response.ok);

    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ API Error Response:', errorData);
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('✅ API Success Response:', result);
    return {
      success: true,
      registrationId: result.id
    }
  } catch (error) {
    console.error('❌ Error creating agent registration:', error)
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
    // Get Supabase session token for internal API
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    if (!token) {
      throw new Error('No Supabase session token found');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/${customerId}/beneficiaries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
      beneficiaryIds: result.data?.beneficiaries?.addedBeneficiaries?.map((b: any) => b.beneficiaryId) ?? []
    }
  } catch (error) {
    console.error('Error adding beneficiaries:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export interface SpouseData {
  firstName: string
  lastName: string
  middleName?: string
  dateOfBirth?: string
  gender: string
  email?: string
  phoneNumber?: string
  idType: string
  idNumber: string
}

export interface ChildData {
  firstName: string
  lastName: string
  middleName?: string
  dateOfBirth?: string
  gender: string
  idType?: string
  idNumber?: string
}

export interface AddDependantsRequest {
  correlationId: string
  children?: ChildData[]
  spouses?: SpouseData[]
}

export interface AddDependantsResponse {
  success: boolean
  error?: string
}

export async function addDependants(customerId: string, request: AddDependantsRequest): Promise<AddDependantsResponse> {
  try {
    // Get Supabase session token for internal API
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    if (!token) {
      throw new Error('No Supabase session token found');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/${customerId}/dependants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error adding dependants:', error)
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

// Customer Search API Types and Functions
export interface CustomerSearchResult {
  id: string
  fullName: string
  idType: string
  idNumber: string
  phoneNumber: string
  email?: string
  numberOfSpouses: number
  numberOfChildren: number
  nokAdded: boolean
}

export interface CustomerSearchPagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface CustomerSearchResponse {
  data: CustomerSearchResult[]
  pagination: CustomerSearchPagination
}

export interface ChartDataPoint {
  date: string
  count: number
}

export interface RegistrationsChartResponse {
  data: ChartDataPoint[]
  total: number
  period: string
}

export async function searchCustomers(
  idNumber?: string,
  phoneNumber?: string,
  email?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<CustomerSearchResponse> {
  try {
    const token = await getSupabaseToken()

    // Build query params
    const params = new URLSearchParams()
    if (idNumber) params.append('idNumber', idNumber)
    if (phoneNumber) params.append('phoneNumber', phoneNumber)
    if (email) params.append('email', email)
    params.append('page', page.toString())
    params.append('pageSize', pageSize.toString())

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/search?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error searching customers:', error)
    throw error
  }
}

export async function getMyRegistrationsChart(
  period: '7d' | '30d' | '90d' = '30d'
): Promise<RegistrationsChartResponse> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/my-registrations-chart?period=${period}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `chart-agent-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch chart data: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching agent chart data:', error)
    throw error
  }
}

export async function getAllRegistrationsChart(
  period: '7d' | '30d' | '90d' = '30d'
): Promise<RegistrationsChartResponse> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/all-registrations-chart?period=${period}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `chart-admin-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch chart data: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching admin chart data:', error)
    throw error
  }
}

// Customer Detail API Types and Functions
export interface CustomerDetailData {
  customer: {
    id: string
    firstName: string
    middleName?: string
    lastName: string
    dateOfBirth: string
    email?: string
    phoneNumber?: string
    gender?: string
    idType: string
    idNumber: string
    partnerCustomerId: string
    createdAt: string
    createdBy?: string
    createdByDisplayName?: string
  }
  beneficiaries: Array<{
    id: string
    firstName: string
    middleName?: string
    lastName: string
    dateOfBirth?: string
    phoneNumber?: string
    idType: string
    idNumber: string
  }>
  dependants: Array<{
    id: string
    firstName: string
    middleName?: string
    lastName: string
    dateOfBirth?: string
    phoneNumber?: string
    idType?: string
    idNumber?: string
    relationship: string
  }>
  policies: Array<{
    id: string
    policyNumber: string
    packageName: string
    planName?: string
    status: string
  }>
}

export interface CustomerDetailResponse {
  status: number
  correlationId: string
  message: string
  data: CustomerDetailData
}

export interface PolicyOption {
  id: string
  displayText: string
  packageName: string
  planName?: string
}

export interface CustomerPoliciesResponse {
  status: number
  correlationId: string
  message: string
  data: PolicyOption[]
}

export interface PaymentFilter {
  policyId?: string
  fromDate?: string
  toDate?: string
}

export interface Payment {
  id: number
  paymentType: string
  transactionReference: string
  accountNumber?: string
  expectedPaymentDate: string
  actualPaymentDate?: string
  amount: number
}

export interface CustomerPaymentsResponse {
  status: number
  correlationId: string
  message: string
  data: Payment[]
}

export interface UpdateCustomerData {
  firstName?: string
  middleName?: string
  lastName?: string
  dateOfBirth?: string
  email?: string
  phoneNumber?: string
  gender?: string
  idType?: string
  idNumber?: string
}

export interface UpdateDependantData {
  firstName?: string
  middleName?: string
  lastName?: string
  dateOfBirth?: string
  email?: string
  phoneNumber?: string
  gender?: string
  idType?: string
  idNumber?: string
}

export interface UpdateBeneficiaryData {
  firstName?: string
  middleName?: string
  lastName?: string
  dateOfBirth?: string
  email?: string
  phoneNumber?: string
  gender?: string
  idType?: string
  idNumber?: string
  relationship?: string
  relationshipDescription?: string
  percentage?: number
}

export interface PrincipalMemberDto {
  firstName: string
  middleName?: string
  lastName: string
  dateOfBirth: string
  email?: string
  phoneNumber?: string
  gender?: string
  idType: string
  idNumber: string
  partnerCustomerId: string
}

export async function getCustomerDetails(customerId: string): Promise<CustomerDetailResponse> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/${customerId}/details`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `customer-detail-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching customer details:', error)
    throw error
  }
}

export async function getCustomerPolicies(customerId: string): Promise<CustomerPoliciesResponse> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/${customerId}/policies`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `customer-policies-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching customer policies:', error)
    throw error
  }
}

export async function getCustomerPayments(
  customerId: string,
  filters: PaymentFilter
): Promise<CustomerPaymentsResponse> {
  try {
    const token = await getSupabaseToken()

    // Build query params
    const params = new URLSearchParams()
    if (filters.policyId) params.append('policyId', filters.policyId)
    if (filters.fromDate) params.append('fromDate', filters.fromDate)
    if (filters.toDate) params.append('toDate', filters.toDate)

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/${customerId}/payments?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `customer-payments-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching customer payments:', error)
    throw error
  }
}

export async function updateCustomer(
  customerId: string,
  data: UpdateCustomerData
): Promise<PrincipalMemberDto> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/${customerId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `update-customer-${Date.now()}`
        },
        body: JSON.stringify(data)
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error updating customer:', error)
    throw error
  }
}

export interface UpdatedDependant {
  id: string
  firstName: string
  middleName?: string
  lastName: string
  dateOfBirth?: string
  phoneNumber?: string
  idType?: string
  idNumber?: string
  relationship: string
}

export async function updateDependant(
  dependantId: string,
  data: UpdateDependantData
): Promise<UpdatedDependant> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/dependants/${dependantId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `update-dependant-${Date.now()}`
        },
        body: JSON.stringify(data)
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error updating dependant:', error)
    throw error
  }
}

export interface UpdatedBeneficiary {
  id: string
  firstName: string
  middleName?: string
  lastName: string
  dateOfBirth?: string
  phoneNumber?: string
  idType: string
  idNumber: string
  relationship: string
}

export async function updateBeneficiary(
  customerId: string,
  beneficiaryId: string,
  data: UpdateBeneficiaryData
): Promise<UpdatedBeneficiary> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/${customerId}/beneficiaries/${beneficiaryId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `update-beneficiary-${Date.now()}`
        },
        body: JSON.stringify(data)
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error updating beneficiary:', error)
    throw error
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

// Product Management API Functions

export interface Package {
  id: number
  name: string
}

export interface Scheme {
  id: number
  name: string
  description?: string
}

export interface Plan {
  id: number
  name: string
  description?: string
}

export interface Tag {
  id: number
  name: string
}

export interface PackagesResponse {
  status: number
  correlationId: string
  message: string
  data: Package[]
}

export interface SchemesResponse {
  status: number
  correlationId: string
  message: string
  data: Scheme[]
}

export interface PlansResponse {
  status: number
  correlationId: string
  message: string
  data: Plan[]
}

export interface TagsResponse {
  status: number
  correlationId: string
  message: string
  data: Tag[]
}

export interface CreateTagRequest {
  name: string
}

export interface CreateTagResponse {
  status: number
  correlationId: string
  message: string
  data: Tag
}

export async function getPackages(): Promise<Package[]> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `get-packages-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch packages: ${response.statusText}`)
    }

    const data: PackagesResponse = await response.json()
    return data.data
  } catch (error) {
    console.error('Error fetching packages:', error)
    throw error
  }
}

export async function getPackageSchemes(packageId: number): Promise<Scheme[]> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}/schemes`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `get-schemes-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch schemes: ${response.statusText}`)
    }

    const data: SchemesResponse = await response.json()
    return data.data
  } catch (error) {
    console.error('Error fetching schemes:', error)
    throw error
  }
}

export async function getPackagePlans(packageId: number): Promise<Plan[]> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}/plans`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `get-plans-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch plans: ${response.statusText}`)
    }

    const data: PlansResponse = await response.json()
    return data.data
  } catch (error) {
    console.error('Error fetching plans:', error)
    throw error
  }
}

export async function getSchemeTags(schemeId: number, search?: string): Promise<Tag[]> {
  try {
    const token = await getSupabaseToken()

    const url = new URL(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}/tags`
    )
    if (search) {
      url.searchParams.append('search', search)
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-correlation-id': `get-scheme-tags-${Date.now()}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch scheme tags: ${response.statusText}`)
    }

    const data: TagsResponse = await response.json()
    return data.data
  } catch (error) {
    console.error('Error fetching scheme tags:', error)
    throw error
  }
}

export async function searchTags(search: string, limit: number = 10): Promise<Tag[]> {
  try {
    const token = await getSupabaseToken()

    const url = new URL(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/tags`
    )
    url.searchParams.append('search', search)
    if (limit !== 10) {
      url.searchParams.append('limit', limit.toString())
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-correlation-id': `search-tags-${Date.now()}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to search tags: ${response.statusText}`)
    }

    const data: TagsResponse = await response.json()
    return data.data
  } catch (error) {
    console.error('Error searching tags:', error)
    throw error
  }
}

export async function createTag(name: string): Promise<Tag> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/tags`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `create-tag-${Date.now()}`
        },
        body: JSON.stringify({ name })
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to create tag: ${response.statusText}`)
    }

    const data: CreateTagResponse = await response.json()
    return data.data
  } catch (error) {
    console.error('Error creating tag:', error)
    throw error
  }
}

// Policy Creation API

export interface CreatePolicyRequest {
  customerId: string
  packageId: number
  packagePlanId: number
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'CUSTOM'
  premium: number
  productName: string
  tags?: Array<{ id?: number; name: string }>
  paymentData: {
    paymentType: 'MPESA' | 'SASAPAY'
    transactionReference: string
    amount: number
    accountNumber?: string
    details?: string
    expectedPaymentDate: string
    actualPaymentDate?: string
    paymentMessageBlob?: string
  }
  customDays?: number
}

export interface CreatePolicyResponse {
  status: number
  correlationId: string
  message: string
  policy: {
    id: string
    policyNumber: string
    status: string
    productName: string
    premium: number
    startDate: string
    endDate: string
  }
  payment: {
    id: number
    paymentType: string
    transactionReference: string
    amount: number
    expectedPaymentDate: string
    actualPaymentDate?: string
  }
}

export async function createPolicy(data: CreatePolicyRequest): Promise<CreatePolicyResponse> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/policies`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `create-policy-${Date.now()}`
        },
        body: JSON.stringify(data)
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message ?? `Failed to create policy: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating policy:', error)
    throw error
  }
}

/**
 * Check if a transaction reference already exists
 */
export async function checkTransactionReferenceExists(
  transactionReference: string
): Promise<boolean> {
  try {
    const token = await getSupabaseToken()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/policies/check-transaction-reference?transactionReference=${encodeURIComponent(transactionReference)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `check-transaction-${Date.now()}`
        }
      }
    )

    if (!response.ok) {
      // If request fails, assume it doesn't exist to allow submission
      console.warn('Failed to check transaction reference, allowing submission')
      return false
    }

    const data = await response.json()
    return data.exists === true
  } catch (error) {
    console.error('Error checking transaction reference:', error)
    // On error, return false to allow submission (fail open)
    return false
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
