'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SchemeTypeahead from '@/components/scheme-typeahead';
import {
  getCustomerPoliciesList,
  getPackagePlans,
  listPackagesForSchemes,
  type Package,
  type Plan,
  type Scheme,
} from '@/lib/api';
import { loadWizard, saveWizard } from './_lib/wizard-state';

export default function AddProductProductStep() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [packageId, setPackageId] = useState<number | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(false);

  useEffect(() => {
    const saved = loadWizard(customerId);
    if (saved.schemeId) {
      setScheme({
        id: saved.schemeId,
        name: saved.schemeName,
        parentsSupported: saved.parentsSupported,
      });
      setPackageId(saved.packageId);
      setPlanId(saved.packagePlanId);
    }
  }, [customerId]);

  useEffect(() => {
    if (!scheme) {
      setPackages([]);
      setPackageId(null);
      setPlans([]);
      setPlanId(null);
      return;
    }
    setLoadingPackages(true);
    void listPackagesForSchemes([scheme.id])
      .then((list) => setPackages(list.filter((p) => p.isActive !== false)))
      .catch(() => setPackages([]))
      .finally(() => setLoadingPackages(false));
  }, [scheme]);

  useEffect(() => {
    if (!packageId) {
      setPlans([]);
      setPlanId(null);
      return;
    }
    void getPackagePlans(packageId)
      .then((list) => setPlans(list.filter((p) => p.isActive !== false)))
      .catch(() => setPlans([]));
  }, [packageId]);

  const selectedPackage = packages.find((p) => p.id === packageId) ?? null;

  const handleNext = async () => {
    setError(null);
    if (!scheme || !selectedPackage || !planId) {
      setError('Select a scheme, package, and plan.');
      return;
    }
    const occupying = await getCustomerPoliciesList(customerId);
    const samePackageOccupying = occupying.data.some(
      (p) =>
        (p.packageId != null
          ? p.packageId === selectedPackage.id
          : p.packageName === selectedPackage.name) &&
        (p.status === 'ACTIVE' || p.status === 'PENDING_ACTIVATION' || p.status === 'SUSPENDED')
    );
    const plan = plans.find((p) => p.id === planId);
    const next = {
      ...loadWizard(customerId),
      schemeId: scheme.id,
      schemeName: scheme.name,
      parentsSupported: Boolean(scheme.parentsSupported),
      isPostpaid: Boolean(selectedPackage.isPostpaid),
      packageId: selectedPackage.id,
      packageName: selectedPackage.name,
      packageSlug: selectedPackage.slug ?? null,
      packageSchemeId: selectedPackage.packageSchemeId ?? null,
      packagePlanId: planId,
      planName: plan?.name ?? '',
      occupyingBlocked: samePackageOccupying,
      occupyingMessage: samePackageOccupying
        ? 'This customer already has an occupying policy for this package. Deactivate it manually before adding the same package again.'
        : '',
    };
    saveWizard(customerId, next);
    if (samePackageOccupying) {
      setError(next.occupyingMessage);
      return;
    }
    router.push(`/admin/customer/${customerId}/add-product/household`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add product</h1>
        <p className="text-muted-foreground">Search a scheme, then choose its package and plan.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Product</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SchemeTypeahead selected={scheme} onSelect={setScheme} />
          <div>
            <Label>Package *</Label>
            <Select
              value={packageId?.toString() ?? ''}
              onValueChange={(v) => setPackageId(Number(v))}
              disabled={!scheme || loadingPackages}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingPackages ? 'Loading…' : 'Select package'} />
              </SelectTrigger>
              <SelectContent>
                {packages.map((pkg) => (
                  <SelectItem key={pkg.id} value={String(pkg.id)}>
                    {pkg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Plan *</Label>
            <Select
              value={planId?.toString() ?? ''}
              onValueChange={(v) => setPlanId(Number(v))}
              disabled={!packageId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={String(plan.id)}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.push(`/admin/customer/${customerId}?tab=products`)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleNext()}>
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
