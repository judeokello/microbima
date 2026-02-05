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
  packageId: number;
  packageName: string;
  cardTemplateName: string | null;
  schemeName: string;
  principal: MemberCardData;
  dependants: MemberCardData[];
}

/**
 * Response from GET /internal/customers/:customerId/member-cards
 */
export interface MemberCardsResponse {
  memberCardsByPolicy: MemberCardsByPolicyItem[];
}
