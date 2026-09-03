export type AddProductWizardState = {
  schemeId: number | null;
  schemeName: string;
  parentsSupported: boolean;
  isPostpaid: boolean;
  packageId: number | null;
  packageName: string;
  packageSlug: string | null;
  packageSchemeId: number | null;
  packagePlanId: number | null;
  planName: string;
  occupyingBlocked: boolean;
  occupyingMessage: string;
  existingDependantIds: string[];
  newSpouses: Array<Record<string, string>>;
  newChildren: Array<Record<string, string>>;
  newParents: Array<Record<string, string>>;
  beneficiaryId: string | null;
  newBeneficiary: Record<string, string> | null;
  extraSpouseCount: number;
  householdSize: number;
  familyCategoryKey: string;
  premium: number;
  annualPremium: number;
  frequency: string;
  skipPayment: boolean;
};

export const emptyWizardState = (): AddProductWizardState => ({
  schemeId: null,
  schemeName: '',
  parentsSupported: false,
  isPostpaid: false,
  packageId: null,
  packageName: '',
  packageSlug: null,
  packageSchemeId: null,
  packagePlanId: null,
  planName: '',
  occupyingBlocked: false,
  occupyingMessage: '',
  existingDependantIds: [],
  newSpouses: [],
  newChildren: [],
  newParents: [],
  beneficiaryId: null,
  newBeneficiary: null,
  extraSpouseCount: 0,
  householdSize: 1,
  familyCategoryKey: '',
  premium: 0,
  annualPremium: 0,
  frequency: '',
  skipPayment: false,
});

export function wizardKey(customerId: string): string {
  return `add-product-wizard-${customerId}`;
}

export function loadWizard(customerId: string): AddProductWizardState {
  if (typeof window === 'undefined') return emptyWizardState();
  const raw = sessionStorage.getItem(wizardKey(customerId));
  if (!raw) return emptyWizardState();
  try {
    return { ...emptyWizardState(), ...JSON.parse(raw) };
  } catch {
    return emptyWizardState();
  }
}

export function saveWizard(customerId: string, state: AddProductWizardState): void {
  sessionStorage.setItem(wizardKey(customerId), JSON.stringify(state));
}
