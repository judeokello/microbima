/**
 * Placeholder catalog for admin campaign compose picker (FR-008).
 * Keys must match PlaceholderRendererService /^[a-z0-9_]+$/ and {key} syntax.
 */

export type CampaignPlaceholderCategory = 'customer' | 'policy' | 'support';

export interface CampaignPlaceholderDef {
  key: string;
  label: string;
  category: CampaignPlaceholderCategory;
  /** When true, recipient needs policy context or preflight blocks */
  requiresPolicyContext?: boolean;
}

export const CAMPAIGN_PLACEHOLDERS: CampaignPlaceholderDef[] = [
  { key: 'first_name', label: 'First name', category: 'customer' },
  { key: 'last_name', label: 'Last name', category: 'customer' },
  { key: 'email', label: 'Email', category: 'customer' },
  { key: 'phone_number', label: 'Phone number', category: 'customer' },
  {
    key: 'policy_number',
    label: 'Policy number',
    category: 'policy',
    requiresPolicyContext: true,
  },
  {
    key: 'product_name',
    label: 'Product name',
    category: 'policy',
    requiresPolicyContext: true,
  },
  {
    key: 'scheme_name',
    label: 'Scheme name',
    category: 'policy',
    requiresPolicyContext: true,
  },
  { key: 'general_support_number', label: 'General support number', category: 'support' },
  { key: 'medical_support_number', label: 'Medical support number', category: 'support' },
];

export const CAMPAIGN_PLACEHOLDER_KEYS = CAMPAIGN_PLACEHOLDERS.map((p) => p.key);

export function getCampaignPlaceholdersByCategory(
  category: CampaignPlaceholderCategory,
): CampaignPlaceholderDef[] {
  return CAMPAIGN_PLACEHOLDERS.filter((p) => p.category === category);
}
