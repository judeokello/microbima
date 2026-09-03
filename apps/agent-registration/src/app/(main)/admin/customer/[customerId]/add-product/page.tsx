'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SchemeTypeahead from '@/components/scheme-typeahead';
import {
  createAdditionalPolicy,
  getAdditionalPolicyEligibility,
  getCustomerDetails,
  getPackagePlans,
  getPackagePricing,
  getPackageSchemes,
  listPackagesForSchemes,
  type CustomerDetailData,
  type Package,
  type PackagePricingData,
  type Plan,
  type Scheme,
} from '@/lib/api';
import {
  additionalSpouseCount,
  maxDependantSlots,
  packageHasFamilyBands,
  resolveFamilyCategoryForHousehold,
} from '@/lib/family-category';
import { mapPackagePricingToUi, pricingBandsFromApi } from '@/lib/package-pricing-ui';
import {
  computeAnnualPremium,
  computeInstallmentPremium,
  type PricingRateBand,
} from '@/lib/insurance-installment';

type Step = 'product' | 'household' | 'beneficiary' | 'payment';

type NewPerson = {
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  idNumber: string;
  phoneNumber: string;
};

const emptyPerson = (): NewPerson => ({
  firstName: '',
  lastName: '',
  gender: 'female',
  dateOfBirth: '',
  idNumber: '',
  phoneNumber: '',
});

function usablePhone(value?: string): string {
  if (!value || value.includes('*')) return '';
  return value;
}

function filledPerson(p: NewPerson): boolean {
  return Boolean(p.firstName.trim() && p.lastName.trim());
}

export default function AddProductPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [step, setStep] = useState<Step>('product');
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [packageId, setPackageId] = useState<number | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [packageSchemeId, setPackageSchemeId] = useState<number | null>(null);
  const [samePackageOccupying, setSamePackageOccupying] = useState(false);
  const [isPostpaid, setIsPostpaid] = useState(false);
  const [schemeFrequency, setSchemeFrequency] = useState<string | null>(null);
  const [hasFamily, setHasFamily] = useState(true);
  const [dependantCap, setDependantCap] = useState(0);
  const [parentsSupported, setParentsSupported] = useState(false);
  const [pricingApi, setPricingApi] = useState<PackagePricingData | null>(null);

  const [existingDependants, setExistingDependants] = useState<
    Array<{ id: string; firstName: string; lastName: string; relationship: string; deletedAt?: string | null }>
  >([]);
  const [existingBeneficiaries, setExistingBeneficiaries] = useState<
    Array<{ id: string; firstName: string; lastName: string }>
  >([]);
  const [occupyingPolicies, setOccupyingPolicies] = useState<
    Array<{ packageId?: number; status: string }>
  >([]);
  const [selectedDependantIds, setSelectedDependantIds] = useState<string[]>([]);
  const [newSpouses, setNewSpouses] = useState<NewPerson[]>([]);
  const [newChildren, setNewChildren] = useState<NewPerson[]>([]);
  const [beneficiaryId, setBeneficiaryId] = useState<string>('');
  const [newBeneficiary, setNewBeneficiary] = useState<NewPerson | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');

  const [frequency, setFrequency] = useState('');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [skipPayment, setSkipPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void getAdditionalPolicyEligibility(customerId)
      .then((res) => {
        const payload = (res as { canAdd?: boolean; blockedReasons?: string[]; data?: { canAdd: boolean; blockedReasons: string[] } });
        const body = payload.data ?? payload;
        if (!body.canAdd) setBlocked(body.blockedReasons ?? ['Cannot add a product']);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Eligibility check failed'));

    void getCustomerDetails(customerId)
      .then((res) => {
        const data: CustomerDetailData = res.data;
        setExistingDependants((data.dependants ?? []).filter((d) => !d.deletedAt));
        setExistingBeneficiaries((data.beneficiaries ?? []).filter((b) => !b.deletedAt));
        const phone = usablePhone(data.customer.phoneNumber);
        setCustomerPhone(phone);
        setPaymentPhone(phone);
        setOccupyingPolicies(data.policies ?? []);
      })
      .catch(() => undefined);
  }, [customerId]);

  const occupyingStatuses = useMemo(() => ['ACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED'], []);

  const onScheme = async (next: Scheme) => {
    setScheme(next);
    setPackageId(null);
    setPlanId(null);
    setPackageSchemeId(null);
    setPricingApi(null);
    const pkgs = await listPackagesForSchemes([next.id]);
    setPackages(pkgs.filter((p) => p.isActive !== false));
  };

  const onPackage = async (id: number) => {
    setPackageId(id);
    setPlanId(null);
    const [pkgPlans, pkgSchemes, pricing] = await Promise.all([
      getPackagePlans(id),
      getPackageSchemes(id),
      getPackagePricing(id).catch(() => null),
    ]);
    setPlans(pkgPlans.filter((p) => p.isActive !== false));
    const junction = pkgSchemes.find((s) => s.id === scheme?.id);
    setPackageSchemeId(junction?.packageSchemeId ?? null);
    setParentsSupported(Boolean(junction?.parentsSupported));
    setIsPostpaid(Boolean(junction?.isPostpaid));
    setSchemeFrequency(null);
    const bands = pricing ? pricingBandsFromApi(pricing) : [];
    setHasFamily(packageHasFamilyBands(bands));
    setDependantCap(maxDependantSlots(bands));
    setPricingApi(pricing);
    if (!packageHasFamilyBands(bands)) {
      setSelectedDependantIds([]);
      setNewSpouses([]);
      setNewChildren([]);
    }
    setSamePackageOccupying(
      occupyingPolicies.some((p) => p.packageId === id && occupyingStatuses.includes(p.status))
    );
  };

  const selectedPlan = plans.find((p) => p.id === planId);
  const selectedExisting = existingDependants.filter((d) => selectedDependantIds.includes(d.id));
  const filledNewSpouses = newSpouses.filter(filledPerson);
  const filledNewChildren = newChildren.filter(filledPerson);
  const spouseSelected =
    selectedExisting.filter((d) => d.relationship === 'SPOUSE').length + filledNewSpouses.length;
  const childSelected =
    selectedExisting.filter((d) => d.relationship === 'CHILD').length + filledNewChildren.length;
  const householdSize = 1 + spouseSelected + childSelected;
  const bands = pricingApi ? pricingBandsFromApi(pricingApi) : [];
  const categoryResolution = resolveFamilyCategoryForHousehold(householdSize, bands);
  const categoryKey = categoryResolution.ok ? categoryResolution.categoryKey : '';
  const extraSpouse = additionalSpouseCount(categoryKey || (hasFamily ? 'up_to_n' : 'member_only'), spouseSelected);

  const enabledFrequencies = pricingApi?.enabledFrequencies ?? ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'];
  const effectiveFrequency = isPostpaid ? (schemeFrequency ?? frequency) : frequency;

  const priced = useMemo(() => {
    if (!pricingApi || !selectedPlan || !categoryKey) return null;
    const ui = mapPackagePricingToUi(pricingApi);
    const planKey = Object.keys(ui.plans).find(
      (k) => ui.plans[k].name.toLowerCase() === selectedPlan.name.toLowerCase()
    );
    if (!planKey) return null;
    const plan = ui.plans[planKey];
    const category = plan.categories[categoryKey];
    if (!category) return null;
    const spousePremium = plan.additional_spouse;
    const lookupRates: PricingRateBand = {
      daily: (category.daily ?? 0) + extraSpouse * (spousePremium.daily ?? 0),
      weekly: (category.weekly ?? 0) + extraSpouse * (spousePremium.weekly ?? 0),
      monthly: (category.monthly ?? 0) + extraSpouse * (spousePremium.monthly ?? 0),
      annually: (category.annually ?? 0) + extraSpouse * (spousePremium.annually ?? 0),
    };
    const freq = effectiveFrequency || 'MONTHLY';
    return {
      premium: computeInstallmentPremium({
        frequency: freq,
        daily: lookupRates.daily,
        weekly: lookupRates.weekly,
        lookupRates,
      }),
      annualPremium: computeAnnualPremium({ daily: lookupRates.daily, lookupRates }),
      lookupRates,
    };
  }, [pricingApi, selectedPlan, categoryKey, extraSpouse, effectiveFrequency]);

  const householdSlotsUsed = spouseSelected + childSelected;

  const goNext = () => {
    setError(null);
    if (step === 'product') {
      if (!scheme || !packageId || !planId || !packageSchemeId) {
        setError('Select scheme, package, and plan');
        return;
      }
      if (samePackageOccupying) {
        setError('Deactivate the occupying policy for this package before adding another.');
        return;
      }
      setStep(hasFamily ? 'household' : 'beneficiary');
      return;
    }
    if (step === 'household') {
      if (householdSlotsUsed > dependantCap) {
        setError(`This product allows at most ${dependantCap} spouse(s) or children`);
        return;
      }
      if (!categoryResolution.ok) {
        setError('Household is larger than this package allows');
        return;
      }
      setStep('beneficiary');
      return;
    }
    if (step === 'beneficiary') {
      if (!beneficiaryId && (!newBeneficiary || !filledPerson(newBeneficiary))) {
        setError('Select an existing beneficiary or add a new one');
        return;
      }
      if (beneficiaryId && newBeneficiary && filledPerson(newBeneficiary)) {
        setError('Select an existing beneficiary or create one, not both');
        return;
      }
      setStep('payment');
    }
  };

  const submit = async () => {
    if (!packageId || !planId || !packageSchemeId || !selectedPlan) return;
    if (!isPostpaid && !frequency && !skipPayment) {
      setError('Select a payment frequency');
      return;
    }
    if (!priced || priced.premium <= 0) {
      setError('Could not calculate premium for this household and frequency');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await createAdditionalPolicy(customerId, {
        packageId,
        packagePlanId: planId,
        packageSchemeId,
        frequency: (isPostpaid ? schemeFrequency : frequency) || 'MONTHLY',
        premium: priced.premium,
        annualPremium: priced.annualPremium,
        productName: `${selectedPlan.name}`,
        dependantIds: hasFamily ? selectedDependantIds : [],
        newSpouses: hasFamily
          ? filledNewSpouses.map((s) => ({
              firstName: s.firstName.trim(),
              lastName: s.lastName.trim(),
              gender: s.gender,
              dateOfBirth: s.dateOfBirth || undefined,
              idNumber: s.idNumber || undefined,
              phoneNumber: s.phoneNumber || undefined,
            }))
          : [],
        newChildren: hasFamily
          ? filledNewChildren.map((c) => ({
              firstName: c.firstName.trim(),
              lastName: c.lastName.trim(),
              gender: c.gender,
              dateOfBirth: c.dateOfBirth || undefined,
              idNumber: c.idNumber || undefined,
              phoneNumber: c.phoneNumber || undefined,
            }))
          : [],
        beneficiaryId: beneficiaryId || undefined,
        newBeneficiary:
          !beneficiaryId && newBeneficiary && filledPerson(newBeneficiary)
            ? {
                firstName: newBeneficiary.firstName.trim(),
                lastName: newBeneficiary.lastName.trim(),
                gender: newBeneficiary.gender,
                dateOfBirth: newBeneficiary.dateOfBirth || '1990-01-01',
                relationship: 'other',
                idNumber: newBeneficiary.idNumber || undefined,
                phoneNumber: newBeneficiary.phoneNumber || undefined,
              }
            : undefined,
        skipPayment: isPostpaid ? true : skipPayment,
        paymentPhone,
        initiateStk: !isPostpaid && !skipPayment,
      });
      setSuccess(
        `Policy created (${result.data.policy.status}). Payment account: ${result.data.policy.paymentAcNumber ?? '—'}`
      );
      setTimeout(() => router.push(`/admin/customer/${customerId}?tab=products`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setSubmitting(false);
    }
  };

  if (blocked.length > 0) {
    return (
      <Card className="m-6">
        <CardHeader>
          <CardTitle>Cannot add product</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 text-sm text-destructive">
            {blocked.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <Button className="mt-4" variant="outline" onClick={() => router.back()}>
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Add product</h1>
        <Button variant="ghost" onClick={() => router.push(`/admin/customer/${customerId}?tab=products`)}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      {step === 'product' && (
        <Card>
          <CardHeader>
            <CardTitle>Product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SchemeTypeahead
              value={scheme?.id}
              selectedName={scheme?.name}
              onSelect={(s) => void onScheme(s)}
            />
            <div>
              <Label>Package *</Label>
              <Select
                value={packageId?.toString() ?? ''}
                onValueChange={(v) => void onPackage(parseInt(v, 10))}
                disabled={!scheme}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id.toString()}>
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
                onValueChange={(v) => setPlanId(parseInt(v, 10))}
                disabled={!packageId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id.toString()}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {samePackageOccupying && (
              <p className="text-sm text-destructive">
                This customer already has an occupying policy for this package. Deactivate it first.
              </p>
            )}
            <Button onClick={goNext}>Continue</Button>
          </CardContent>
        </Card>
      )}

      {step === 'household' && (
        <Card>
          <CardHeader>
            <CardTitle>Household</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select existing people or add new ones for this policy (max {dependantCap} spouses or
              children). They stay on their current policies. Parents{' '}
              {parentsSupported ? 'can' : 'cannot'} be collected on customer details for this scheme
              and do not count toward the family size.
            </p>
            {existingDependants.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedDependantIds.includes(d.id)}
                  onCheckedChange={(checked) => {
                    setSelectedDependantIds((ids) =>
                      checked === true ? [...ids, d.id] : ids.filter((id) => id !== d.id)
                    );
                  }}
                />
                {d.firstName} {d.lastName} ({d.relationship})
              </label>
            ))}
            {existingDependants.length === 0 && (
              <p className="text-sm text-muted-foreground">No existing dependants on file.</p>
            )}

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label>New spouses</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={householdSlotsUsed >= dependantCap}
                  onClick={() => setNewSpouses((rows) => [...rows, emptyPerson()])}
                >
                  Add spouse
                </Button>
              </div>
              {newSpouses.map((person, index) => (
                <div key={`ns-${index}`} className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="First name"
                    value={person.firstName}
                    onChange={(e) =>
                      setNewSpouses((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, firstName: e.target.value } : r))
                      )
                    }
                  />
                  <Input
                    placeholder="Last name"
                    value={person.lastName}
                    onChange={(e) =>
                      setNewSpouses((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, lastName: e.target.value } : r))
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label>New children</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={householdSlotsUsed >= dependantCap}
                  onClick={() => setNewChildren((rows) => [...rows, emptyPerson()])}
                >
                  Add child
                </Button>
              </div>
              {newChildren.map((person, index) => (
                <div key={`nc-${index}`} className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="First name"
                    value={person.firstName}
                    onChange={(e) =>
                      setNewChildren((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, firstName: e.target.value } : r))
                      )
                    }
                  />
                  <Input
                    placeholder="Last name"
                    value={person.lastName}
                    onChange={(e) =>
                      setNewChildren((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, lastName: e.target.value } : r))
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('product')}>
                Back
              </Button>
              <Button onClick={goNext}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'beneficiary' && (
        <Card>
          <CardHeader>
            <CardTitle>Beneficiary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>Existing next of kin</Label>
            <Select
              value={beneficiaryId}
              onValueChange={(v) => {
                setBeneficiaryId(v);
                setNewBeneficiary(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select beneficiary" />
              </SelectTrigger>
              <SelectContent>
                {existingBeneficiaries.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.firstName} {b.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Or add a new next of kin for this policy.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setBeneficiaryId('');
                setNewBeneficiary(emptyPerson());
              }}
            >
              Add new beneficiary
            </Button>
            {newBeneficiary && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="First name"
                  value={newBeneficiary.firstName}
                  onChange={(e) => setNewBeneficiary({ ...newBeneficiary, firstName: e.target.value })}
                />
                <Input
                  placeholder="Last name"
                  value={newBeneficiary.lastName}
                  onChange={(e) => setNewBeneficiary({ ...newBeneficiary, lastName: e.target.value })}
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(hasFamily ? 'household' : 'product')}>
                Back
              </Button>
              <Button onClick={goNext}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'payment' && (
        <Card>
          <CardHeader>
            <CardTitle>Payment summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              {selectedPlan?.name} · household {householdSize} · extra spouse add-ons: {extraSpouse}
            </p>
            <p className="text-sm">
              Installment: {priced?.premium ?? 0} · Annual: {priced?.annualPremium ?? 0}
            </p>
            {isPostpaid ? (
              <p className="text-sm text-muted-foreground">
                Postpaid products never send STK. Frequency comes from the scheme.
              </p>
            ) : (
              <div>
                <Label>Payment frequency *</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledFrequencies.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!isPostpaid && (
              <>
                <div>
                  <Label>Phone for STK</Label>
                  <Input value={paymentPhone} onChange={(e) => setPaymentPhone(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Default is {customerPhone || 'the customer phone (enter it if masked)'}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={skipPayment} onCheckedChange={(c) => setSkipPayment(c === true)} />
                  Do not collect payment now
                </label>
              </>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('beneficiary')}>
                Back
              </Button>
              <Button onClick={() => void submit()} disabled={submitting}>
                {submitting
                  ? 'Saving…'
                  : isPostpaid || skipPayment
                    ? 'Create policy'
                    : 'Create and STK'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
