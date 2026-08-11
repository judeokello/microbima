'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Edit, Plus, RefreshCw } from 'lucide-react';
import { getPackagePricing, type PackagePricingData } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import PackagePricingGrid from '../_components/package-pricing-grid';
import PackageWizard, { type PackageWizardStep } from '../_components/package-wizard';
import CreatePlanDialog from '../_components/create-plan-dialog';
import EditPlanDialog, { type EditablePlan } from '../_components/edit-plan-dialog';
import {
  packageDetailPath,
  packageWizardPath,
} from '../_components/package-wizard-routes';

interface PackagePlan {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
}

interface PlansResponse {
  status: number;
  data: PackagePlan[];
}

interface PackageSummary {
  id: number;
  name: string;
}

export default function PackagePricingPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const packageId = parseInt(params.packageId as string, 10);
  const { isSetupAdmin } = useAuth();

  const stepParam = searchParams.get('step');
  const inWizard = stepParam === '2';
  const wizardStep: PackageWizardStep | null = inWizard ? 2 : null;

  const [pkgName, setPkgName] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PackagePricingData | null>(null);
  const [pricingWarning, setPricingWarning] = useState<string | null>(null);
  const [plans, setPlans] = useState<PackagePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createPlanDialogOpen, setCreatePlanDialogOpen] = useState(false);
  const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false);
  const [planBeingEdited, setPlanBeingEdited] = useState<EditablePlan | null>(null);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const fetchPackageSummary = useCallback(async () => {
    try {
      const token = await getSupabaseToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}/details`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-correlation-id': `pkg-pricing-summary-${Date.now()}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = (await response.json()) as { data: PackageSummary };
      setPkgName(data.data.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load package');
    }
  }, [packageId]);

  const fetchPlans = useCallback(async () => {
    try {
      const token = await getSupabaseToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}/plans?includeInactive=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-correlation-id': `pkg-pricing-plans-${Date.now()}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = (await response.json()) as PlansResponse;
      setPlans(data.data ?? []);
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  }, [packageId]);

  const fetchPricing = useCallback(async () => {
    try {
      const data = await getPackagePricing(packageId);
      setPricing(data);
      setPricingWarning(data.warning ?? null);
    } catch (err) {
      console.error('Error fetching pricing:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pricing');
    }
  }, [packageId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([fetchPackageSummary(), fetchPlans(), fetchPricing()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPackageSummary, fetchPlans, fetchPricing]);

  const goToWizardStep = (step: PackageWizardStep) => {
    router.push(packageWizardPath(packageId, step));
  };

  const finishWizard = () => {
    router.push(packageDetailPath(packageId));
  };

  const plansCard = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Plans</CardTitle>
            <CardDescription>
              Plans for this package. At least one active plan is required before activation.
            </CardDescription>
          </div>
          {isSetupAdmin && (
            <Button onClick={() => setCreatePlanDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Plan
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {plans.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No plans found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>{plan.description ?? '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          plan.isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-secondary text-secondary-foreground border-transparent'
                        }
                      >
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isSetupAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPlanBeingEdited({
                              id: plan.id,
                              name: plan.name,
                              description: plan.description,
                              isActive: plan.isActive,
                            });
                            setEditPlanDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const pricingCard = pricing ? (
    <Card>
      <CardHeader>
        <CardTitle>Package Pricing</CardTitle>
        <CardDescription>
          Configure rates by category, frequency, and plan. Double-click a cell to edit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PackagePricingGrid
          packageId={packageId}
          pricing={pricing}
          readOnly={!isSetupAdmin}
          onSaved={(saved) => {
            setPricing(saved);
            setPricingWarning(saved.warning ?? null);
            fetchPlans();
          }}
          onWarning={setPricingWarning}
        />
      </CardContent>
    </Card>
  ) : (
    <Card>
      <CardContent className="pt-6">
        <p className="text-muted-foreground">Loading pricing…</p>
      </CardContent>
    </Card>
  );

  if (loading && !pricing && !pkgName) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading pricing…</span>
      </div>
    );
  }

  const body = (
    <div className="space-y-6">
      {pricingWarning && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription className="text-amber-900">{pricingWarning}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}
      {plansCard}
      {pricingCard}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {pkgName ? `${pkgName} — Pricing & Plans` : 'Pricing & Plans'}
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage package plans and pricing rates
          </p>
        </div>
        {!wizardStep && (
          <Button variant="outline" onClick={() => router.push(packageDetailPath(packageId))}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to package
          </Button>
        )}
      </div>

      {wizardStep && isSetupAdmin ? (
        <PackageWizard
          currentStep={wizardStep}
          onBack={() => goToWizardStep(1)}
          onNext={() => goToWizardStep(3)}
          onFinish={finishWizard}
          nextDisabled={!pricing?.isPricingComplete}
          loading={loading}
        >
          {body}
        </PackageWizard>
      ) : (
        body
      )}

      <CreatePlanDialog
        open={createPlanDialogOpen}
        onOpenChange={setCreatePlanDialogOpen}
        onSuccess={() => {
          setCreatePlanDialogOpen(false);
          fetchPlans();
          fetchPricing();
        }}
        packageId={packageId}
      />

      <EditPlanDialog
        open={editPlanDialogOpen}
        onOpenChange={setEditPlanDialogOpen}
        onSuccess={() => {
          setEditPlanDialogOpen(false);
          setPlanBeingEdited(null);
          fetchPlans();
        }}
        packageId={packageId}
        plan={planBeingEdited}
      />
    </div>
  );
}
