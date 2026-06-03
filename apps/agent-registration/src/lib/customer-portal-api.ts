export type LoginDisplayContext = {
  maskedPhoneNational: string;
  firstName: string;
  lastName: string;
};

// ── Shared types (re-using shapes from api.ts for consistency) ───────────────

export type PortalPolicyOption = {
  id: string;
  displayText: string;
  packageName: string;
  planName?: string;
};

export type PortalPoliciesResponse = {
  status: number;
  correlationId: string;
  message: string;
  data: PortalPolicyOption[];
};

export type PortalProductListItem = {
  id: string;
  productName: string;
  packageName: string;
  planName?: string | null;
  schemeName: string;
  underwriterName?: string | null;
  status: string;
  totalPremium: string;
  installment: string;
  installmentsPaid: number;
  missedPayments: number;
};

export type PortalProductsListResponse = {
  status: number;
  correlationId: string;
  message: string;
  data: PortalProductListItem[];
};

export type PortalProductDetail = {
  id: string;
  policyNumber: string | null;
  status: string;
  packageId: number;
  packageSchemeId: number | null;
  schemeBillingMode: 'prepaid' | 'postpaid';
  product: {
    underwriterName: string | null;
    packageName: string;
    planName: string | null;
    schemeName: string;
    productName: string;
    productDurationDays: number | null;
  };
  enrollment: {
    startDate: string | null;
    endDate: string | null;
    frequency: string;
    paymentCadence: number;
  };
  totalPremium: string;
  installmentAmount: string;
  totalPaidToDate: string;
  installmentsPaid: number;
  missedPayments: number;
};

export type PortalProductDetailResponse = {
  status: number;
  correlationId: string;
  message: string;
  data: PortalProductDetail;
};

export type PortalPayment = {
  id: number;
  paymentType: string;
  transactionReference: string;
  accountNumber?: string;
  expectedPaymentDate: string;
  actualPaymentDate?: string;
  amount: number;
  paymentStatus?: string;
};

export type PortalPaymentsResponse = {
  status: number;
  correlationId: string;
  message: string;
  data: PortalPayment[];
};

export type PortalMemberCardsResponse = {
  memberCardsByPolicy: Array<{
    policyId: string;
    policyNumber: string | null;
    packageId: number;
    packageName: string;
    cardTemplateName: string | null;
    schemeName: string;
    principal: {
      schemeName: string;
      principalMemberName: string;
      insuredMemberName: string;
      memberNumber: string | null;
      dateOfBirth: string;
      datePrinted: string;
    };
    dependants: Array<{
      schemeName: string;
      principalMemberName: string;
      insuredMemberName: string;
      memberNumber: string | null;
      dateOfBirth: string;
      datePrinted: string;
    }>;
  }>;
};

export type PortalSetupStatus = {
  portalPinSetupCompleted: boolean;
  portalPinSetupCompletedAt: string | null;
};

function internalBase(): string {
  const base = process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL?.replace(/\/$/, '') ?? '';
  return base;
}

export async function fetchLoginDisplayContext(customerId: string): Promise<LoginDisplayContext | null> {
  const base = internalBase();
  if (!base) return null;

  const url = `${base}/internal/customer-portal/me/context?customerId=${encodeURIComponent(customerId)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-correlation-id': `portal-context-${customerId}-${Date.now()}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) return null;

  try {
    return (await res.json()) as LoginDisplayContext;
  } catch {
    return null;
  }
}

export async function fetchPortalSetupStatus(accessToken: string): Promise<PortalSetupStatus> {
  const base = internalBase();
  const res = await fetch(`${base}/internal/customer-portal/me/portal-status`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'x-correlation-id': `portal-status-${Date.now()}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      (body as { error?: { message?: string } })?.error?.message ??
      (body as { message?: string })?.message ??
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return (await res.json()) as PortalSetupStatus;
}

export async function completePortalPinSetup(
  accessToken: string,
  pin: string,
  pinConfirm: string,
): Promise<void> {
  const base = internalBase();
  const res = await fetch(`${base}/internal/customer-portal/me/pin-complete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-correlation-id': `portal-pin-${Date.now()}`,
    },
    body: JSON.stringify({ pin, pinConfirm }),
  });

  if (res.status === 204) return;

  const body = await res.json().catch(() => ({}));
  const err = (body as { error?: { message?: string; details?: Record<string, string> } })?.error;
  if (err?.details && typeof err.details === 'object') {
    const first = Object.values(err.details)[0];
    throw new Error(typeof first === 'string' ? first : err.message ?? 'Validation failed');
  }
  throw new Error(err?.message ?? `HTTP ${res.status}`);
}

// ── Portal-scoped read helpers (customer Bearer token) ───────────────────────

async function portalFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const base = internalBase();
  const res = await fetch(`${base}/internal/customer-portal${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'x-correlation-id': `portal-${Date.now()}`,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      (body as { error?: { message?: string } })?.error?.message ??
      (body as { message?: string })?.message ??
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function fetchPortalPolicies(
  accessToken: string,
): Promise<PortalPoliciesResponse> {
  return portalFetch<PortalPoliciesResponse>('/me/policies', accessToken);
}

export async function fetchPortalProducts(
  accessToken: string,
): Promise<PortalProductsListResponse> {
  return portalFetch<PortalProductsListResponse>('/me/products', accessToken);
}

export async function fetchPortalProductDetail(
  accessToken: string,
  policyId: string,
): Promise<PortalProductDetailResponse> {
  return portalFetch<PortalProductDetailResponse>(`/me/products/${encodeURIComponent(policyId)}`, accessToken);
}

export async function fetchPortalPayments(
  accessToken: string,
  filters?: { policyId?: string; fromDate?: string; toDate?: string },
): Promise<PortalPaymentsResponse> {
  const params = new URLSearchParams();
  if (filters?.policyId) params.set('policyId', filters.policyId);
  if (filters?.fromDate) params.set('fromDate', filters.fromDate);
  if (filters?.toDate) params.set('toDate', filters.toDate);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return portalFetch<PortalPaymentsResponse>(`/me/payments${qs}`, accessToken);
}

export async function fetchPortalMemberCards(
  accessToken: string,
): Promise<PortalMemberCardsResponse> {
  return portalFetch<PortalMemberCardsResponse>('/me/member-cards', accessToken);
}
