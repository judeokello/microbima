import {
  packageDetailPath,
  packagePricingPath,
  packageWizardPath,
} from '@/app/(main)/admin/underwriters/packages/[packageId]/_components/package-wizard-routes';

describe('package-wizard-routes', () => {
  it('keeps setup and utilization on package detail', () => {
    expect(packageWizardPath(3, 1)).toBe('/admin/underwriters/packages/3?step=1');
    expect(packageWizardPath(3, 3)).toBe('/admin/underwriters/packages/3?step=3');
    expect(packageDetailPath(3)).toBe('/admin/underwriters/packages/3');
  });

  it('routes pricing wizard step to the pricing page', () => {
    expect(packageWizardPath(3, 2)).toBe(
      '/admin/underwriters/packages/3/pricing?step=2'
    );
    expect(packagePricingPath(3)).toBe('/admin/underwriters/packages/3/pricing');
    expect(packagePricingPath(3, 2)).toBe(
      '/admin/underwriters/packages/3/pricing?step=2'
    );
  });
});
