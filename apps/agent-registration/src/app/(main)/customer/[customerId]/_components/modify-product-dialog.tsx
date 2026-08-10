'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import {
  formatMigrationPaymentStatusLabel,
  formatTransactionReferenceForDisplay,
} from '@/lib/transaction-reference-display';
import {
  getModifyPolicyOptions,
  getPackagePlans,
  getPackagePricingBySlug,
  modifyCustomerPolicy,
  type ModifyPolicyOptions,
  type ModifyPolicyRequest,
  type PolicyNumberChoice,
  type Plan,
} from '@/lib/api';
import {
  computeAnnualPremium,
  computeInstallmentPremium,
  isFrequencySupportedByPackage,
  isPricingSubmitBlocked,
  type PricingRateBand,
} from '@/lib/insurance-installment';
import { mapPackagePricingToUi, type UiInsurancePricing } from '@/lib/package-pricing-ui';

interface ModifyProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  policyId: string;
  onSuccess: (newPolicyId: string) => void;
}

export default function ModifyProductDialog({
  open,
  onOpenChange,
  customerId,
  policyId,
  onSuccess,
}: ModifyProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ModifyPolicyOptions | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pricing, setPricing] = useState<UiInsurancePricing | null>(null);
  const [pricingLoadError, setPricingLoadError] = useState<string | null>(null);

  const [reason, setReason] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [frequency, setFrequency] = useState<string>('DAILY');
  const [packageSchemeId, setPackageSchemeId] = useState<string>('');
  const [policyNumberChoice, setPolicyNumberChoice] = useState<PolicyNumberChoice | ''>('');
  const [firstPaymentId, setFirstPaymentId] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPricingLoadError(null);
    try {
      const opts = await getModifyPolicyOptions(customerId, policyId);
      setOptions(opts);
      setFrequency(opts.currentFrequency);
      setPackageSchemeId(
        opts.currentPackageSchemeId != null ? String(opts.currentPackageSchemeId) : ''
      );

      if (!opts.packageSlug) {
        setPricing(null);
        setPricingLoadError('Package slug is not configured. Contact support.');
      } else {
        try {
          const apiPricing = await getPackagePricingBySlug(opts.packageSlug);
          setPricing(mapPackagePricingToUi(apiPricing));
        } catch {
          setPricing(null);
          setPricingLoadError(`Pricing not available for package “${opts.packageSlug}”.`);
        }
      }

      const plansData = await getPackagePlans(opts.packageId);
      setPlans(plansData);
      if (opts.currentPlanName) {
        setSelectedPlan(opts.currentPlanName.toLowerCase());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load modify options');
    } finally {
      setLoading(false);
    }
  }, [customerId, policyId]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const pricingRates = useMemo(() => {
    if (!pricing || !options || !selectedPlan) return null;
    const plan = pricing.plans[selectedPlan];
    if (!plan) return null;
    const cat = plan.categories[options.familyCategory];
    if (!cat) return null;
    const spouse = options.additionalSpouse;
    const daily = (cat.daily ?? 0) + (spouse ? plan.additional_spouse.daily ?? 0 : 0);
    const weekly = (cat.weekly ?? 0) + (spouse ? plan.additional_spouse.weekly ?? 0 : 0);
    const lookupRates: PricingRateBand = {
      daily,
      weekly,
      monthly: (cat.monthly ?? 0) + (spouse ? plan.additional_spouse.monthly ?? 0 : 0),
      annually: (cat.annually ?? 0) + (spouse ? plan.additional_spouse.annually ?? 0 : 0),
    };
    return { daily, weekly, lookupRates };
  }, [pricing, options, selectedPlan]);

  const installmentAmount = useMemo(() => {
    if (!pricingRates) return 0;
    return computeInstallmentPremium({
      frequency,
      daily: pricingRates.daily,
      weekly: pricingRates.weekly,
      lookupRates: pricingRates.lookupRates,
    });
  }, [pricingRates, frequency]);

  const annualPremium = useMemo(() => {
    if (!pricingRates) return 0;
    return computeAnnualPremium({
      daily: pricingRates.daily,
      lookupRates: pricingRates.lookupRates,
    });
  }, [pricingRates]);

  const packagePlanId = useMemo(() => {
    if (!selectedPlan || plans.length === 0) return 0;
    const match = plans.find((p) => p.name.toLowerCase() === selectedPlan.toLowerCase());
    return match?.id ?? 0;
  }, [selectedPlan, plans]);

  const handleSubmit = async () => {
    setError(null);
    if (isPricingSubmitBlocked(pricingLoadError, pricing)) {
      setError(pricingLoadError ?? 'Missing price setup for this package.');
      return;
    }
    if (!selectedPlan || !packagePlanId) {
      setError('Select a plan');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    if (!policyNumberChoice) {
      setError('Select Keep Existing or Generate New policy number');
      return;
    }
    if (!isFrequencySupportedByPackage(frequency, options?.paymentFrequencies)) {
      setError('Selected frequency is not supported for this package');
      return;
    }
    if (installmentAmount <= 0) {
      setError('Could not calculate installment for this selection');
      return;
    }

    setSubmitting(true);
    try {
      const body: ModifyPolicyRequest = {
        reason: reason.trim(),
        packagePlanId,
        frequency: frequency as ModifyPolicyRequest['frequency'],
        premium: installmentAmount,
        annualPremium,
        policyNumberChoice,
        ...(packageSchemeId ? { packageSchemeId: parseInt(packageSchemeId, 10) } : {}),
        ...(firstPaymentId ? { firstPaymentId: parseInt(firstPaymentId, 10) } : {}),
      };
      const res = await modifyCustomerPolicy(customerId, policyId, body);
      onSuccess(res.policy.id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Modify failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modify product</DialogTitle>
          <DialogDescription>
            Creates a new policy superseding the current one. Family category is derived from
            dependants ({options?.familyCategory ?? '…'}).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {pricingLoadError && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {pricingLoadError}
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div>
              <Label>Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan} disabled={!pricing}>
                <SelectTrigger>
                  <SelectValue placeholder={pricing ? 'Select plan' : 'No pricing available'} />
                </SelectTrigger>
                <SelectContent>
                  {pricing &&
                    Object.entries(pricing.plans).map(([key, plan]) => (
                      <SelectItem key={key} value={key}>
                        {plan.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Family category (read-only)</Label>
              <Input value={options?.familyCategory ?? ''} disabled />
            </div>

            <div>
              <Label>Payment frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(options?.paymentFrequencies ?? []).map((pf) => (
                    <SelectItem key={pf.frequency} value={pf.frequency}>
                      {pf.frequency} · {pf.installmentCount} installments
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Installment amount (KES)</Label>
              <Input value={String(installmentAmount)} disabled />
            </div>

            <div>
              <Label>Scheme (optional)</Label>
              <Select value={packageSchemeId || 'none'} onValueChange={(v) => setPackageSchemeId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep current" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keep current</SelectItem>
                  {(options?.schemes ?? []).map((s) => (
                    <SelectItem key={s.packageSchemeId} value={String(s.packageSchemeId)}>
                      {s.schemeName}
                      {s.isPostpaid ? ' (postpaid)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Policy number *</Label>
              <Select
                value={policyNumberChoice}
                onValueChange={(v) => setPolicyNumberChoice(v as PolicyNumberChoice)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KEEP_EXISTING">Keep Existing</SelectItem>
                  <SelectItem value="GENERATE_NEW">Generate New</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {options?.paymentMigrationAllowed && (
              <div>
                <Label>First payment to migrate (optional)</Label>
                <Select value={firstPaymentId || 'none'} onValueChange={(v) => setFirstPaymentId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(options?.eligiblePayments ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {formatTransactionReferenceForDisplay(p.transactionReference)} ·{' '}
                        {formatMigrationPaymentStatusLabel(p.paymentStatus)} · {p.amount}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Reason *</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || loading || !!pricingLoadError || !pricing}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm modify'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
