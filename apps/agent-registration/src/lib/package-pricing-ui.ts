import type { PackagePricingData } from './api';
import type { PricingRateBand } from './insurance-installment';
import type { PackagePricingBand } from './family-category';

export type UiInsurancePricing = {
  packageSlug?: string;
  plans: Record<
    string,
    {
      name: string;
      categories: Record<string, PricingRateBand & { display: string }>;
      additional_spouse: PricingRateBand;
    }
  >;
};

/** Map API package pricing to legacy UI shape (lookup-only; no pricingMode). */
export function mapPackagePricingToUi(data: PackagePricingData): UiInsurancePricing {
  const plans: UiInsurancePricing['plans'] = {};

  for (const [planKey, plan] of Object.entries(data.plans)) {
    const categories: Record<string, PricingRateBand & { display: string }> = {};
    let additional_spouse: PricingRateBand = {};

    for (const cat of data.categories) {
      const rates = plan.rates[cat.key] ?? {};
      if (cat.kind === 'ADDITIONAL_SPOUSE') {
        additional_spouse = { ...rates };
      } else {
        categories[cat.key] = { ...rates, display: cat.display };
      }
    }

    plans[planKey] = {
      name: plan.name,
      categories,
      additional_spouse,
    };
  }

  return {
    packageSlug: data.packageSlug ?? undefined,
    plans,
  };
}

export function pricingBandsFromApi(data: PackagePricingData): PackagePricingBand[] {
  return data.categories.map((c) => ({
    key: c.key,
    kind: c.kind,
    maxMembers: c.maxMembers ?? null,
  }));
}

export async function loadPackagePricingBySlug(slug: string): Promise<UiInsurancePricing> {
  const { getPackagePricingBySlug } = await import('./api');
  const data = await getPackagePricingBySlug(slug);
  return mapPackagePricingToUi(data);
}
