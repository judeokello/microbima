export type PackageWizardStep = 1 | 2 | 3;

export function packageDetailPath(packageId: number): string {
  return `/admin/underwriters/packages/${packageId}`;
}

export function packagePricingPath(packageId: number, wizardStep?: PackageWizardStep): string {
  const base = `/admin/underwriters/packages/${packageId}/pricing`;
  if (wizardStep === 2) return `${base}?step=2`;
  return base;
}

export function packageWizardPath(packageId: number, step: PackageWizardStep): string {
  if (step === 2) return packagePricingPath(packageId, 2);
  return `${packageDetailPath(packageId)}?step=${step}`;
}
