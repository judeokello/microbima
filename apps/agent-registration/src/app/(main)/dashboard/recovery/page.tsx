'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getCustomersWithoutPolicies,
  getCustomersWithoutPolicyNoPayments,
  createPolicyFromRecovery,
  createPolicyWithoutPayments,
  getPackagePlans,
  type RecoveryCustomer,
  type Plan,
} from '@/lib/api';
import {
  computeAnnualPremium,
  isFrequencySupportedByPackage,
  isPricingSubmitBlocked,
  nextInstallmentPremiumFormValue,
  productPricingPath,
  type PricingMode,
  type PricingRateBand,
} from '@/lib/insurance-installment';
import { formatTransactionReferenceForDisplay } from '@/lib/transaction-reference-display';
import { formatDate } from '@/lib/utils';
import { Loader2, RefreshCw, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface InsurancePricing {
  packageSlug?: string;
  pricingMode?: PricingMode;
  plans: Record<
    string,
    {
      name: string;
      categories: Record<string, PricingRateBand & { display: string }>;
      additional_spouse: PricingRateBand;
    }
  >;
}

export default function RecoveryPage() {
  const [customersWithPayments, setCustomersWithPayments] = useState<RecoveryCustomer[]>([]);
  const [customersNoPayments, setCustomersNoPayments] = useState<RecoveryCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<RecoveryCustomer | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pricingData, setPricingData] = useState<InsurancePricing | null>(null);
  const [pricingLoadError, setPricingLoadError] = useState<string | null>(null);
  const [paymentFrequencies, setPaymentFrequencies] = useState<
    Array<{ frequency: string; installmentCount: number }>
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    selectedPlan: '',
    selectedCategory: '',
    additionalSpouse: false,
    packagePlanId: '',
    premium: '',
    frequency: 'DAILY' as string,
    customDays: '',
  });

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const [withPaymentsRes, noPaymentsRes] = await Promise.all([
        getCustomersWithoutPolicies(),
        getCustomersWithoutPolicyNoPayments(),
      ]);
      setCustomersWithPayments(withPaymentsRes.customers);
      setCustomersNoPayments(noPaymentsRes.customers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const openCreateDialog = async (customer: RecoveryCustomer) => {
    setSelectedCustomer(customer);
    setFormData({
      selectedPlan: '',
      selectedCategory: '',
      additionalSpouse: false,
      packagePlanId: '',
      premium: '',
      frequency: 'DAILY',
      customDays: '',
    });
    setPricingData(null);
    setPricingLoadError(null);
    setPaymentFrequencies([]);
    setCreateDialogOpen(true);
    try {
      const plansData = await getPackagePlans(customer.packageId);
      setPlans(plansData);

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const pkgRes = await fetch(
        `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${customer.packageId}/details`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-correlation-id': `recovery-pkg-${Date.now()}`,
          },
        }
      );
      if (!pkgRes.ok) {
        throw new Error('Failed to load package details');
      }
      const pkgJson = await pkgRes.json();
      const slug = pkgJson.data?.slug as string | undefined;
      const freqs = (pkgJson.data?.paymentFrequencies ?? []) as Array<{
        frequency: string;
        installmentCount: number;
      }>;
      setPaymentFrequencies(freqs);
      if (freqs[0]) {
        setFormData((f) => ({ ...f, frequency: freqs[0].frequency }));
      }
      if (!slug) {
        setPricingLoadError('Package slug is not configured.');
      } else {
        const pricingRes = await fetch(productPricingPath(slug));
        if (!pricingRes.ok) {
          setPricingLoadError(`Pricing file not found for “${slug}”.`);
        } else {
          setPricingData((await pricingRes.json()) as InsurancePricing);
        }
      }
    } catch {
      setPlans([]);
      setPricingLoadError('Failed to load package pricing.');
    }
  };

  const pricingMode: PricingMode = pricingData?.pricingMode ?? 'extrapolate';

  const calculatedPricing = useMemo(() => {
    if (!pricingData || !formData.selectedPlan || !formData.selectedCategory) {
      return { daily: 0, weekly: 0, totalDaily: 0, totalWeekly: 0, lookupRates: null as PricingRateBand | null };
    }
    const plan = pricingData.plans[formData.selectedPlan];
    if (!plan) {
      return { daily: 0, weekly: 0, totalDaily: 0, totalWeekly: 0, lookupRates: null };
    }
    const category = plan.categories[formData.selectedCategory];
    if (!category) {
      return { daily: 0, weekly: 0, totalDaily: 0, totalWeekly: 0, lookupRates: null };
    }
    const spousePremium = plan.additional_spouse;
    const spouseDaily = formData.additionalSpouse ? spousePremium.daily ?? 0 : 0;
    const spouseWeekly = formData.additionalSpouse ? spousePremium.weekly ?? 0 : 0;
    const lookupRates: PricingRateBand = {
      daily: (category.daily ?? 0) + spouseDaily,
      weekly: (category.weekly ?? 0) + spouseWeekly,
      monthly:
        (category.monthly ?? 0) +
        (formData.additionalSpouse ? spousePremium.monthly ?? 0 : 0),
      annually:
        (category.annually ?? 0) +
        (formData.additionalSpouse ? spousePremium.annually ?? 0 : 0),
    };
    return {
      daily: category.daily ?? 0,
      weekly: category.weekly ?? 0,
      totalDaily: (category.daily ?? 0) + spouseDaily,
      totalWeekly: (category.weekly ?? 0) + spouseWeekly,
      lookupRates,
    };
  }, [
    pricingData,
    formData.selectedPlan,
    formData.selectedCategory,
    formData.additionalSpouse,
  ]);

  // Sync installment premium from pricing inputs. Bail out when unchanged;
  // useMemo keeps lookupRates identity stable so this effect cannot loop.
  useEffect(() => {
    if (!formData.selectedPlan || !formData.selectedCategory) {
      return;
    }
    setFormData((f) => {
      const next = nextInstallmentPremiumFormValue(f.premium, {
        frequency: formData.frequency,
        daily: calculatedPricing.totalDaily,
        weekly: calculatedPricing.totalWeekly,
        pricingMode,
        lookupRates: calculatedPricing.lookupRates ?? undefined,
      });
      if (next == null) {
        return f;
      }
      return { ...f, premium: next };
    });
  }, [
    formData.selectedPlan,
    formData.selectedCategory,
    formData.frequency,
    calculatedPricing.totalDaily,
    calculatedPricing.totalWeekly,
    calculatedPricing.lookupRates,
    pricingMode,
  ]);

  const handleSubmit = async () => {
    if (!selectedCustomer) return;
    if (isPricingSubmitBlocked(pricingLoadError, pricingData)) {
      setError(pricingLoadError ?? 'Missing price setup for this package');
      return;
    }
    let packagePlanId = parseInt(formData.packagePlanId, 10);
    if (!packagePlanId && formData.selectedPlan && plans.length > 0) {
      const matchingPlan = plans.find(
        (p: Plan) => p.name.toLowerCase() === formData.selectedPlan.toLowerCase()
      );
      if (matchingPlan) packagePlanId = matchingPlan.id;
    }
    const premium = parseFloat(formData.premium);
    if (!packagePlanId || isNaN(premium) || premium < 0) {
      setError('Please select plan and category (premium will be calculated)');
      return;
    }
    if (!isFrequencySupportedByPackage(formData.frequency, paymentFrequencies)) {
      setError('Selected frequency is not supported for this package');
      return;
    }
    const annualPremium = computeAnnualPremium({
      daily: calculatedPricing.totalDaily,
      pricingMode,
      lookupRates: calculatedPricing.lookupRates ?? undefined,
    });
    const hasPayments = selectedCustomer.payments.length > 0;
    try {
      setSubmitting(true);
      setError(null);
      if (hasPayments) {
        await createPolicyFromRecovery({
          customerId: selectedCustomer.id,
          packageId: selectedCustomer.packageId,
          packagePlanId,
          premium,
          annualPremium,
          frequency: formData.frequency as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'CUSTOM',
          customDays: formData.frequency === 'CUSTOM' ? parseInt(formData.customDays, 10) : undefined,
        });
      } else {
        await createPolicyWithoutPayments({
          customerId: selectedCustomer.id,
          packageId: selectedCustomer.packageId,
          packagePlanId,
          premium,
          annualPremium,
          frequency: formData.frequency as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'CUSTOM',
          customDays: formData.frequency === 'CUSTOM' ? parseInt(formData.customDays, 10) : undefined,
        });
      }
      setCreateDialogOpen(false);
      setSelectedCustomer(null);
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create policy');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Policy Recovery</h1>
        <p className="text-muted-foreground mt-1">
          Customers with no policy: with M-Pesa payments (create and activate) or with no payments (create policy only; activation on first payment).
        </p>
      </div>

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={loadCustomers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-900 rounded-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : customersWithPayments.length === 0 && customersNoPayments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No customers found without policies.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {customersWithPayments.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">With M-Pesa payments (no policy)</h2>
              <p className="text-sm text-muted-foreground">Create policy and activate using payment dates.</p>
              {customersWithPayments.map((c) => (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{c.fullName}</CardTitle>
                        <CardDescription>
                          ID: {c.idNumber} | Package: {c.packageName}
                          <br />
                          Registered: {formatDate(c.registeredAt)}
                          {' · '}
                          Agent: {c.registeredByDisplayName ?? 'Unknown'}
                        </CardDescription>
                      </div>
                      <Button size="sm" onClick={() => openCreateDialog(c)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Create Policy
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium mb-2">Payments ({c.payments.length})</div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {c.payments.map((p) => (
                        <li key={p.id}>
                          {formatTransactionReferenceForDisplay(p.transactionReference)} - KES {p.paidIn.toLocaleString()} - {new Date(p.completionTime).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {customersNoPayments.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">No policy, no payments</h2>
              <p className="text-sm text-muted-foreground">Create policy only (PENDING_ACTIVATION); activation when first payment is received.</p>
              {customersNoPayments.map((c) => (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{c.fullName}</CardTitle>
                        <CardDescription>
                          ID: {c.idNumber} | Package: {c.packageName}
                          <br />
                          Registered: {formatDate(c.registeredAt)}
                          {' · '}
                          Agent: {c.registeredByDisplayName ?? 'Unknown'}
                        </CardDescription>
                      </div>
                      <Button size="sm" onClick={() => openCreateDialog(c)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Create Policy
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">No M-Pesa payments</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Policy</DialogTitle>
            <DialogDescription>
              {selectedCustomer?.fullName} - {selectedCustomer?.idNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {pricingLoadError && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {pricingLoadError}
              </div>
            )}
            <div>
              <Label>Package</Label>
              <Input value={selectedCustomer?.packageName ?? ''} disabled />
            </div>
            <div>
              <Label>Insurance Plan</Label>
              <Select
                value={formData.selectedPlan}
                onValueChange={(v) => setFormData((f) => ({ ...f, selectedPlan: v, selectedCategory: '' }))}
                disabled={!pricingData}
              >
                <SelectTrigger>
                  <SelectValue placeholder={pricingData ? 'Select insurance plan' : 'No pricing available'} />
                </SelectTrigger>
                <SelectContent>
                  {pricingData &&
                    Object.entries(pricingData.plans).map(([key, plan]) => (
                      <SelectItem key={key} value={key}>
                        {plan.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Family Category</Label>
              <Select
                value={formData.selectedCategory}
                onValueChange={(v) => setFormData((f) => ({ ...f, selectedCategory: v }))}
                disabled={!formData.selectedPlan || !pricingData}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select family category" />
                </SelectTrigger>
                <SelectContent>
                  {pricingData && formData.selectedPlan && pricingData.plans[formData.selectedPlan] && (
                    <>
                      {Object.entries(pricingData.plans[formData.selectedPlan].categories).map(
                        ([key, category]) => (
                          <SelectItem key={key} value={key}>
                            {category.display} - {category.daily ?? 0}d - {category.weekly ?? 0}w
                          </SelectItem>
                        )
                      )}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="additionalSpouse"
                checked={formData.additionalSpouse}
                onCheckedChange={(checked) => setFormData((f) => ({ ...f, additionalSpouse: checked === true }))}
                disabled={!formData.selectedCategory || formData.selectedCategory === 'member_only'}
              />
              <Label htmlFor="additionalSpouse" className="text-sm">
                Additional Spouse Premium
              </Label>
            </div>
            <div>
              <Label>Installment (KES)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={formData.premium}
                onChange={(e) => setFormData((f) => ({ ...f, premium: e.target.value }))}
                placeholder="Installment per payment period"
              />
            </div>
            <div>
              <Label>Frequency</Label>
              <Select value={formData.frequency} onValueChange={(v) => setFormData((f) => ({ ...f, frequency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentFrequencies.map((pf) => (
                    <SelectItem key={pf.frequency} value={pf.frequency}>
                      {pf.frequency} · {pf.installmentCount} installments
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !!pricingLoadError || !pricingData}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
