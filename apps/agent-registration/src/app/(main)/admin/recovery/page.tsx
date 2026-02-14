'use client';

import { useEffect, useState } from 'react';
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
  createPolicyFromRecovery,
  getPackagePlans,
  type RecoveryCustomer,
  type Plan,
} from '@/lib/api';
import { Loader2, RefreshCw, Plus } from 'lucide-react';

interface InsurancePricing {
  plans: {
    silver: {
      name: string;
      categories: {
        member_only: { display: string; daily: number; weekly: number };
        up_to_5: { display: string; daily: number; weekly: number };
        up_to_8: { display: string; daily: number; weekly: number };
      };
      additional_spouse: { daily: number; weekly: number };
    };
    gold: {
      name: string;
      categories: {
        member_only: { display: string; daily: number; weekly: number };
        up_to_5: { display: string; daily: number; weekly: number };
        up_to_8: { display: string; daily: number; weekly: number };
      };
      additional_spouse: { daily: number; weekly: number };
    };
  };
}

const PAYMENT_CADENCE: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 31,
  QUARTERLY: 90,
  ANNUALLY: 365,
};

const FREQUENCY_OPTIONS = [
  { value: 'DAILY', label: 'Daily (1 day)' },
  { value: 'WEEKLY', label: 'Weekly (7 days)' },
  { value: 'MONTHLY', label: 'Monthly (31 days)' },
  { value: 'QUARTERLY', label: 'Quarterly (90 days)' },
  { value: 'ANNUALLY', label: 'Annually (365 days)' },
  { value: 'CUSTOM', label: 'Custom' },
];

export default function RecoveryPage() {
  const [customers, setCustomers] = useState<RecoveryCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<RecoveryCustomer | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pricingData, setPricingData] = useState<InsurancePricing | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    selectedPlan: '',
    selectedCategory: '',
    additionalSpouse: false,
    packagePlanId: '',
    premium: '',
    frequency: 'MONTHLY' as string,
    customDays: '',
  });

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getCustomersWithoutPolicies();
      setCustomers(res.customers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    fetch('/insurance-pricing.json')
      .then((res) => res.json())
      .then((data) => setPricingData(data))
      .catch(() => setPricingData(null));
  }, []);

  const openCreateDialog = async (customer: RecoveryCustomer) => {
    setSelectedCustomer(customer);
    setFormData({
      selectedPlan: '',
      selectedCategory: '',
      additionalSpouse: false,
      packagePlanId: '',
      premium: '',
      frequency: 'MONTHLY',
      customDays: '',
    });
    setCreateDialogOpen(true);
    try {
      const plansData = await getPackagePlans(customer.packageId);
      setPlans(plansData);
    } catch {
      setPlans([]);
    }
  };

  const calculatedPricing = (() => {
    if (!pricingData || !formData.selectedPlan || !formData.selectedCategory) {
      return { daily: 0, weekly: 0, totalDaily: 0, totalWeekly: 0 };
    }
    const plan = pricingData.plans[formData.selectedPlan as keyof typeof pricingData.plans];
    const category = plan.categories[formData.selectedCategory as keyof typeof plan.categories];
    const spousePremium = plan.additional_spouse;
    const baseDaily = category.daily;
    const baseWeekly = category.weekly;
    const spouseDaily = formData.additionalSpouse ? spousePremium.daily : 0;
    const spouseWeekly = formData.additionalSpouse ? spousePremium.weekly : 0;
    return {
      daily: baseDaily,
      weekly: baseWeekly,
      totalDaily: baseDaily + spouseDaily,
      totalWeekly: baseWeekly + spouseWeekly,
    };
  })();

  useEffect(() => {
    if (formData.selectedPlan && formData.selectedCategory) {
      const premium =
        formData.frequency === 'WEEKLY'
          ? calculatedPricing.totalWeekly
          : calculatedPricing.totalDaily;
      setFormData((f) => ({ ...f, premium: premium.toString() }));
    }
  }, [formData.selectedPlan, formData.selectedCategory, formData.additionalSpouse, formData.frequency, calculatedPricing.totalDaily, calculatedPricing.totalWeekly]);

  const handleSubmit = async () => {
    if (!selectedCustomer) return;
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
    if (formData.frequency === 'CUSTOM' && !formData.customDays) {
      setError('Custom days required for CUSTOM frequency');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await createPolicyFromRecovery({
        customerId: selectedCustomer.id,
        packageId: selectedCustomer.packageId,
        packagePlanId,
        premium,
        frequency: formData.frequency as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'CUSTOM',
        customDays: formData.frequency === 'CUSTOM' ? parseInt(formData.customDays, 10) : undefined,
      });
      setCreateDialogOpen(false);
      setSelectedCustomer(null);
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create policy');
    } finally {
      setSubmitting(false);
    }
  };

  const paymentCadence = formData.frequency === 'CUSTOM'
    ? parseInt(formData.customDays, 10) || 0
    : PAYMENT_CADENCE[formData.frequency] ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Policy Recovery</h1>
        <p className="text-muted-foreground mt-1">
          Customers with M-Pesa payments but no policy record. Create policy and activate.
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
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No customers found without policies. Import an M-Pesa statement first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {customers.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{c.fullName}</CardTitle>
                    <CardDescription>ID: {c.idNumber} | Package: {c.packageName}</CardDescription>
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
                      {p.transactionReference} - KES {p.paidIn.toLocaleString()} - {new Date(p.completionTime).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
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
            <div>
              <Label>Package</Label>
              <Input value={selectedCustomer?.packageName ?? ''} disabled />
            </div>
            <div>
              <Label>Insurance Plan</Label>
              <Select
                value={formData.selectedPlan}
                onValueChange={(v) => setFormData((f) => ({ ...f, selectedPlan: v, selectedCategory: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select insurance plan" />
                </SelectTrigger>
                <SelectContent>
                  {pricingData && (
                    <>
                      <SelectItem value="silver">{pricingData.plans.silver.name}</SelectItem>
                      <SelectItem value="gold">{pricingData.plans.gold.name}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Family Category</Label>
              <Select
                value={formData.selectedCategory}
                onValueChange={(v) => setFormData((f) => ({ ...f, selectedCategory: v }))}
                disabled={!formData.selectedPlan}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select family category" />
                </SelectTrigger>
                <SelectContent>
                  {pricingData && formData.selectedPlan && (
                    <>
                      {Object.entries(
                        pricingData.plans[formData.selectedPlan as keyof typeof pricingData.plans].categories
                      ).map(([key, category]) => (
                        <SelectItem key={key} value={key}>
                          {category.display} - {category.daily}d - {category.weekly}w
                        </SelectItem>
                      ))}
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
              <Label>Premium (KES)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={formData.premium}
                onChange={(e) => setFormData((f) => ({ ...f, premium: e.target.value }))}
                placeholder="Enter premium"
              />
            </div>
            <div>
              <Label>Frequency</Label>
              <Select value={formData.frequency} onValueChange={(v) => setFormData((f) => ({ ...f, frequency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.frequency === 'CUSTOM' && (
              <div>
                <Label>Custom Days</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.customDays}
                  onChange={(e) => setFormData((f) => ({ ...f, customDays: e.target.value }))}
                  placeholder="Days"
                />
              </div>
            )}
            <div>
              <Label>Cadence (days)</Label>
              <Input value={paymentCadence} disabled />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
