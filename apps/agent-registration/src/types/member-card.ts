/**
 * Member card data (matches API MemberCardData)
 */
export interface MemberCardData {
  schemeName: string;
  principalMemberName: string;
  insuredMemberName: string;
  memberNumber: string | null;
  dateOfBirth: string;
  datePrinted: string;
}

/**
 * One policy's worth of member cards
 */
export interface MemberCardsByPolicyItem {
  policyId: string;
  policyNumber: string | null;
  policyStatus?: string;
  packageId: number;
  packageName: string;
  cardTemplateName: string | null;
  schemeName: string;
  cardsAvailable: boolean;
  principal: MemberCardData;
  dependants: MemberCardData[];
}

export const MEMBER_CARDS_PENDING_PAYMENT_MESSAGE =
  'Member cards will be available after policy premium payment';

/**
 * Response from GET /internal/customers/:customerId/member-cards
 */
export interface MemberCardsResponse {
  memberCardsByPolicy: MemberCardsByPolicyItem[];
}

/** Per-field config for image-based card templates (config.json) */
export interface CardTemplateFieldConfig {
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: string;
}

/** Image-based template config (public/member-cards/{name}/config.json) */
export interface CardTemplateConfig {
  version: number;
  defaults?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    fontWeight?: string;
  };
  fields: {
    schemeName: CardTemplateFieldConfig;
    principalMemberName: CardTemplateFieldConfig;
    insuredMemberName: CardTemplateFieldConfig;
    memberNumber: CardTemplateFieldConfig;
    dateOfBirth: CardTemplateFieldConfig;
    datePrinted: CardTemplateFieldConfig;
  };
}
