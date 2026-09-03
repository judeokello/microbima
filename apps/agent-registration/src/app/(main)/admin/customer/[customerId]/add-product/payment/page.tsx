'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  createAdditionalPolicy,
  getCustomerDetails,
  getInternalConfig,
  getPackagePricingBySlug,
  initiateStkPush,
} from '@/lib/api';
import {
  computeAnnualPremium,
  computeInstallmentPremium,
  isFrequencySupportedByPackage,
  type PackagePaymentFrequencyOption,
} from '@/lib/insurance-installment';
import { extraSpouseAddonCount, resolveFamilyCategoryForHousehold } from '@/lib/family-category';
import { mapPackagePricingToUi, pricingBandsFromApi } from '@/lib/package-pricing-ui';
import { loadWizard } from '../_lib/wizard-state';

export default function AddProductPaymentStep() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;
  const wizard = loadWizard(customerId);
  const [frequency, setFrequency] = useState('');
  const [phone, setPhone] = useState('');
  const [stkEnabled, setStkEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [premium, setPremium] = useState(0);
  const [annual, setAnnual] = useState(0);
  const [freqs, setFreqs] = useState<PackagePaymentFrequencyOption[]>([]);
  const extraSpouse = wizard.extraSpouseCount;

  useEffect(() => {
    if (!wizard.packageSchemeId) {
      router.replace(`/admin/customer/${customerId}/add-product`);
      return;
    }
    void getCustomerDetails(customerId).then((res) => {
      setPhone(res.data.customer.phoneNumber ?? '');
    });
    void getInternalConfig().then((c) => setStkEnabled(c.mpesaStkPushEnabled)).catch(() => setStkEnabled(false));
    if (wizard.packageSlug) {
      void getPackagePricingBySlug(wizard.packageSlug).then((data) => {
        const ui = mapPackagePricingToUi(data);
        const planKey = Object.keys(ui.plans).find(
          (k) => ui.plans[k].name.toLowerCase() === wizard.planName.toLowerCase()
        );
        const bands = pricingBandsFromApi(data);
        const resolved = resolveFamilyCategoryForHousehold(wizard.householdSize, bands);
        const categoryKey = resolved.ok ? resolved.categoryKey : Object.keys(ui.plans[planKey ?? '']?.categories ?? {})[0];
        const plan = planKey ? ui.plans[planKey] : undefined;
        const category = plan && categoryKey ? plan.categories[categoryKey] : undefined;
        const spouseUnits = extraSpouseAddonCount(extraSpouse + 1, categoryKey);
        if (plan && category) {
          const lookup = {
            daily: (category.daily ?? 0) + spouseUnits * (plan.additional_spouse.daily ?? 0),
            weekly: (category.weekly ?? 0) + spouseUnits * (plan.additional_spouse.weekly ?? 0),
            monthly: (category.monthly ?? 0) + spouseUnits * (plan.additional_spouse.monthly ?? 0),
            annually: (category.annually ?? 0) + spouseUnits * (plan.additional_spouse.annually ?? 0),
          };
          setPremium(lookup.monthly ?? lookup.daily ?? 0);
          setAnnual(computeAnnualPremium({ daily: lookup.daily, lookupRates: lookup }));
        }
        setFreqs(
          Object.entries(data.installmentCounts ?? {}).map(([frequency, installmentCount]) => ({
            frequency,
            installmentCount,
          }))
        );
      });
    }
  }, [customerId, extraSpouse, router, wizard.householdSize, wizard.packageSchemeId, wizard.packageSlug, wizard.planName]);

  const installment = useMemo(() => {
    if (!frequency) return premium;
    return computeInstallmentPremium({
      frequency,
      daily: premium,
      weekly: premium,
      lookupRates: { monthly: premium, annually: annual },
    });
  }, [annual, frequency, premium]);

  const submit = async (skipPayment: boolean) => {
    setError(null);
    if (!wizard.isPostpaid && !skipPayment && !frequency) {
      setError('Select a payment frequency.');
      return;
    }
    if (wizard.packageSchemeId == null || wizard.packagePlanId == null) {
      setError('Product selection is incomplete.');
      return;
    }
    if (frequency && !wizard.isPostpaid && !isFrequencySupportedByPackage(frequency, freqs)) {
      setError('Selected frequency is not supported for this package.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createAdditionalPolicy(customerId, {
        packageSchemeId: wizard.packageSchemeId,
        packagePlanId: wizard.packagePlanId,
        frequency: (wizard.isPostpaid ? 'MONTHLY' : frequency || 'MONTHLY') as 'MONTHLY',
        premium: installment || premium,
        annualPremium: annual,
        productName: `${wizard.packageName} ${wizard.planName}`.trim(),
        existingDependantIds: wizard.existingDependantIds,
        newSpouses: wizard.newSpouses,
        newChildren: wizard.newChildren,
        newParents: wizard.newParents,
        beneficiaryId: wizard.beneficiaryId ?? undefined,
        newBeneficiary: wizard.newBeneficiary ?? undefined,
        skipPayment: skipPayment || wizard.isPostpaid,
      });
      if (!skipPayment && !wizard.isPostpaid && stkEnabled && result.policy.paymentAcNumber) {
        await initiateStkPush({
          phoneNumber: phone,
          amount: installment || premium,
          accountReference: result.policy.paymentAcNumber,
          transactionDesc: `Premium for additional product ${result.policy.productName}`,
        });
      }
      sessionStorage.setItem(
        `add-product-pan-${customerId}`,
        result.policy.paymentAcNumber ?? ''
      );
      sessionStorage.removeItem(`add-product-wizard-${customerId}`);
      router.push(`/admin/customer/${customerId}?tab=products`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Payment</h1>
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between"><span>Package / plan</span><span>{wizard.packageName} {wizard.planName}</span></div>
          <div className="flex justify-between"><span>Family size</span><span>{wizard.householdSize}</span></div>
          <div className="flex justify-between"><span>Extra spouses billed</span><span>{wizard.extraSpouseCount}</span></div>
          <div className="flex justify-between"><span>Derived premium</span><span>{installment || premium}</span></div>
          {!wizard.isPostpaid && (
            <div>
              <Label>Frequency *</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {freqs.map((pf) => (
                    <SelectItem key={pf.frequency} value={pf.frequency}>{pf.frequency}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!wizard.isPostpaid && (
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          )}
          {wizard.isPostpaid && (
            <p className="text-muted-foreground">Postpaid products never send STK. The policy is created as pending activation.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => router.push(`/admin/customer/${customerId}/add-product/beneficiary`)}>Back</Button>
            <div className="flex gap-2">
              {!wizard.isPostpaid && (
                <Button type="button" variant="outline" disabled={submitting} onClick={() => void submit(true)}>
                  Skip payment
                </Button>
              )}
              <Button type="button" disabled={submitting} onClick={() => void submit(wizard.isPostpaid)}>
                {wizard.isPostpaid ? 'Create policy' : 'Send STK'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
