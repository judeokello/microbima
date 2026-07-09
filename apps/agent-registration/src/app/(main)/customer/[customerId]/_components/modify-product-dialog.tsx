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
  modifyCustomerPolicy,
  type ModifyPolicyOptions,
  type ModifyPolicyRequest,
  type PolicyNumberChoice,
  type Plan,
} from '@/lib/api';

interface InsurancePricing {
  plans: Record<
    string,
    {
      name: string;
      categories: Record<string, { display: string; daily: number; weekly: number }>;
      additional_spouse: { daily: number; weekly: number };
    }
  >;
}

const FREQUENCY_OPTIONS = [
  { value: 'DAILY', label: 'Daily (1 day)' },
  { value: 'WEEKLY', label: 'Weekly (7 days)' },
  { value: 'MONTHLY', label: 'Monthly (31 days)' },
  { value: 'QUARTERLY', label: 'Quarterly (90 days)' },
  { value: 'ANNUALLY', label: 'Annually (365 days)' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

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
  const [pricing, setPricing] = useState<InsurancePricing | null>(null);

  const [reason, setReason] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [frequency, setFrequency] = useState<string>('DAILY');
  const [customDays, setCustomDays] = useState('');
  const [packageSchemeId, setPackageSchemeId] = useState<string>('');
  const [policyNumberChoice, setPolicyNumberChoice] = useState<PolicyNumberChoice | ''>('');
  const [firstPaymentId, setFirstPaymentId] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [opts, pricingRes] = await Promise.all([
        getModifyPolicyOptions(customerId, policyId),
        fetch('/insurance-pricing.json').then((r) => r.json() as Promise<InsurancePricing>),
      ]);
      setOptions(opts);
      setPricing(pricingRes);
      const plansData = await getPackagePlans(opts.packageId);
      setPlans(plansData);
      setFrequency(opts.currentFrequency);
      setCustomDays(
        opts.currentFrequency === 'CUSTOM' ? String(opts.currentPaymentCadence) : ''
      );
      if (opts.currentPlanName) {
        setSelectedPlan(opts.currentPlanName.toLowerCase());
      }
      if (opts.schemes.length > 0) {
        setPackageSchemeId(
          String(opts.currentPackageSchemeId ?? opts.schemes[0]?.packageSchemeId ?? '')
        );
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
      setReason('');
      setPolicyNumberChoice('');
      setFirstPaymentId('');
    }
  }, [open, load]);

  const premium = useMemo(() => {
    if (!pricing || !options || !selectedPlan) return 0;
    const plan = pricing.plans[selectedPlan];
    if (!plan) return 0;
    const cat = plan.categories[options.familyCategory as keyof typeof plan.categories];
    if (!cat) return 0;
    let daily = cat.daily;
    let weekly = cat.weekly;
    if (options.additionalSpouse) {
      daily += plan.additional_spouse.daily;
      weekly += plan.additional_spouse.weekly;
    }
    return frequency === 'WEEKLY' ? weekly : daily;
  }, [pricing, options, selectedPlan, frequency, options?.additionalSpouse, options?.familyCategory]);

  const packagePlanId = useMemo(() => {
    if (!selectedPlan || plans.length === 0) return 0;
    const match = plans.find((p) => p.name.toLowerCase() === selectedPlan.toLowerCase());
    return match?.id ?? 0;
  }, [selectedPlan, plans]);

  const handleSubmit = async () => {
    if (!options) return;
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    if (!selectedPlan || !packagePlanId) {
      setError('Select a plan');
      return;
    }
    if (!policyNumberChoice) {
      setError('Select policy number option (Keep Existing or Generate New)');
      return;
    }
    if (options.paymentMigrationAllowed && !firstPaymentId) {
      setError('Select the first payment to migrate');
      return;
    }
    if (frequency === 'CUSTOM' && (!customDays || parseInt(customDays, 10) < 1)) {
      setError('Enter valid custom cadence days');
      return;
    }

    const body: ModifyPolicyRequest = {
      reason: reason.trim(),
      packagePlanId,
      frequency: frequency as ModifyPolicyRequest['frequency'],
      premium,
      policyNumberChoice,
      ...(frequency === 'CUSTOM' ? { customDays: parseInt(customDays, 10) } : {}),
      ...(packageSchemeId ? { packageSchemeId: parseInt(packageSchemeId, 10) } : {}),
      ...(firstPaymentId ? { firstPaymentId: parseInt(firstPaymentId, 10) } : {}),
    };

    setSubmitting(true);
    setError(null);
    try {
      const res = await modifyCustomerPolicy(customerId, policyId, body);
      const newId = res.newPolicyId ?? res.policy.id;
      onSuccess(newId);
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
            Deactivates the current policy and creates a new one on the same package. Family
            category is derived from dependants ({options?.familyCategory ?? '…'}).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : options ? (
          <div className="space-y-4 py-2">
            <div>
              <Label>Package</Label>
              <Input value={options.packageName} disabled />
            </div>
            <div>
              <Label>Insurance plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
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
              <Input value={options.familyCategory} disabled />
            </div>
            <div>
              <Label>Payment frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {frequency === 'CUSTOM' && (
              <div>
                <Label>Cadence (days)</Label>
                <Input
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value.replace(/\D/g, '').slice(0, 3))}
                />
              </div>
            )}
            <div>
              <Label>Scheme</Label>
              <Select value={packageSchemeId} onValueChange={setPackageSchemeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scheme" />
                </SelectTrigger>
                <SelectContent>
                  {options.schemes.map((s) => (
                    <SelectItem key={s.packageSchemeId} value={String(s.packageSchemeId)}>
                      {s.schemeName}
                      {s.isPostpaid ? ' (postpaid)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Installment (KES)</Label>
              <Input value={premium > 0 ? String(premium) : ''} disabled />
            </div>
            <div>
              <Label>Policy number</Label>
              <Select
                value={policyNumberChoice}
                onValueChange={(v) => setPolicyNumberChoice(v as PolicyNumberChoice)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select option (required)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KEEP_EXISTING">Keep existing</SelectItem>
                  <SelectItem value="GENERATE_NEW">Generate new</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {options.paymentMigrationAllowed && (
              <div>
                <Label>First payment to migrate</Label>
                <Select
                  value={firstPaymentId}
                  onValueChange={(v) => {
                    setFirstPaymentId(v);
                    setError(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select first payment" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.eligiblePayments.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {formatTransactionReferenceForDisplay(p.transactionReference)} — KES{' '}
                        {p.amount} —{' '}
                        {new Date(p.expectedPaymentDate).toLocaleDateString()}{' '}
                        {formatMigrationPaymentStatusLabel(p.paymentStatus)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Reason (required)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          error && <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting || loading || !options}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Modify product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
