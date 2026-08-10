'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Edit, Save, X, Plus, Zap } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
import { getPackagePricing, type PackagePricingData } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import * as Sentry from '@sentry/nextjs';
import Image from 'next/image';
import { TruncatedDescription } from '../../[underwriterId]/_components/truncated-description';
import CreateSchemeDialog from './_components/create-scheme-dialog';
import CreatePlanDialog from './_components/create-plan-dialog';
import EditPlanDialog, { type EditablePlan } from './_components/edit-plan-dialog';
import MemberCardWithDownload from '@/components/member-cards/MemberCardWithDownload';
import { SAMPLE_CARD_DATA } from '@/components/member-cards/sample-card-data';
import PackagePricingGrid from './_components/package-pricing-grid';
import PackageWizard, { type PackageWizardStep } from './_components/package-wizard';

const CONFIGURABLE_FREQUENCIES = [
  { value: 'DAILY', label: 'Daily', min: 1, max: 365 },
  { value: 'WEEKLY', label: 'Weekly', min: 1, max: 52 },
  { value: 'MONTHLY', label: 'Monthly', min: 1, max: 12 },
  { value: 'QUARTERLY', label: 'Quarterly', min: 1, max: 4 },
  { value: 'ANNUALLY', label: 'Annually', min: 1, max: 1 },
] as const;

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface PaymentFrequencyRow {
  frequency: string;
  installmentCount: number;
}

interface Package {
  id: number;
  name: string;
  slug?: string | null;
  description: string;
  underwriterId?: number | null;
  underwriterName?: string | null;
  isActive: boolean;
  logoPath?: string | null;
  cardTemplateName?: string | null;
  paymentFrequencies?: PaymentFrequencyRow[];
  createdBy: string;
  createdByDisplayName?: string;
  createdAt: string;
  updatedAt: string;
}

function emptyFrequencyForm() {
  return {
    DAILY: { enabled: false, count: '276' },
    WEEKLY: { enabled: false, count: '39' },
    MONTHLY: { enabled: false, count: '9' },
    QUARTERLY: { enabled: false, count: '4' },
    ANNUALLY: { enabled: false, count: '1' },
  } as Record<string, { enabled: boolean; count: string }>;
}

function frequenciesToForm(rows: PaymentFrequencyRow[] | undefined) {
  const form = emptyFrequencyForm();
  for (const row of rows ?? []) {
    if (form[row.frequency]) {
      form[row.frequency] = {
        enabled: true,
        count: String(row.installmentCount),
      };
    }
  }
  return form;
}

interface Scheme {
  id: number;
  schemeName: string;
  description: string;
  isActive: boolean;
  isPostpaid: boolean;
  generalSchemeWaitingPeriod?: number | null;
  customersCount: number;
}

interface PackagePlan {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
}

interface PackageResponse {
  status: number;
  correlationId: string;
  message: string;
  data: Package;
}

interface SchemesResponse {
  status: number;
  correlationId: string;
  message: string;
  data: Scheme[];
}

interface PlansResponse {
  status: number;
  correlationId: string;
  message: string;
  data: PackagePlan[];
}

export default function PackageDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const packageId = parseInt(params.packageId as string);
  const { isSetupAdmin } = useAuth();

  const stepParam = searchParams.get('step');
  const wizardStep: PackageWizardStep | null =
    stepParam === '1' || stepParam === '2' || stepParam === '3'
      ? (parseInt(stepParam, 10) as PackageWizardStep)
      : null;

  const [pkg, setPkg] = useState<Package | null>(null);
  const [pricing, setPricing] = useState<PackagePricingData | null>(null);
  const [pricingWarning, setPricingWarning] = useState<string | null>(null);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [plans, setPlans] = useState<PackagePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [createSchemeDialogOpen, setCreateSchemeDialogOpen] = useState(false);
  const [createPlanDialogOpen, setCreatePlanDialogOpen] = useState(false);
  const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false);
  const [planBeingEdited, setPlanBeingEdited] = useState<EditablePlan | null>(null);
  const [activating, setActivating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    isActive: true,
    frequencies: emptyFrequencyForm(),
  });

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const fetchPackage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getSupabaseToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PackageResponse = await response.json();
      setPkg(data.data);
      setFormData({
        name: data.data.name,
        slug: data.data.slug ?? '',
        description: data.data.description,
        isActive: data.data.isActive,
        frequencies: frequenciesToForm(data.data.paymentFrequencies),
      });
    } catch (err) {
      console.error('Error fetching package:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'PackageDetailPage',
            action: 'fetch_package',
          },
          extra: {
            packageId,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch package');
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  const fetchSchemes = useCallback(async () => {
    try {
      const token = await getSupabaseToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}/schemes-with-counts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SchemesResponse = await response.json();
      console.log('📋 Schemes data received:', data.data);
      console.log('📋 First scheme isPostpaid:', data.data[0]?.isPostpaid);
      setSchemes(data.data);
    } catch (err) {
      console.error('Error fetching schemes:', err);
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
            'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PlansResponse = await response.json();
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
    }
  }, [packageId]);

  useEffect(() => {
    fetchPackage();
    fetchSchemes();
    fetchPlans();
    fetchPricing();
  }, [fetchPackage, fetchSchemes, fetchPlans, fetchPricing]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pkg) return;

    setUploadingLogo(true);
    try {
      const oldLogoPath = pkg.logoPath;
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('entityType', 'package');
      uploadFormData.append('entityId', pkg.id.toString());
      uploadFormData.append('underwriterId', pkg.underwriterId?.toString() ?? '');

      const token = await getSupabaseToken();
      const uploadResponse = await fetch('/api/upload/logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload logo');
      }

      const uploadResult = await uploadResponse.json();

      // Update package with logo path (reuse token from above)
      const updateResponse = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify({
          logoPath: uploadResult.path,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update package with logo path');
      }

      // Delete old file from storage if it exists
      if (oldLogoPath) {
        try {
          let storagePath: string | undefined;
          let oldPathForDelete: string | undefined;

          // Check if it's a Supabase Storage URL
          if (oldLogoPath.startsWith('http') && oldLogoPath.includes('supabase.co')) {
            // Extract storage path from URL
            // Format: https://{project-id}.supabase.co/storage/v1/object/public/logos/{path}
            const urlParts = oldLogoPath.split('/storage/v1/object/public/logos/');
            if (urlParts.length === 2) {
              storagePath = urlParts[1];
            }
          } else {
            // Filesystem path (relative path like /logos/underwriters/1/packages/2.png)
            oldPathForDelete = oldLogoPath;
          }

          // Call API route to delete old file
          const deleteResponse = await fetch('/api/upload/logo', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              path: storagePath,
              oldLogoPath: oldPathForDelete,
            }),
          });

          if (!deleteResponse.ok) {
            console.warn('Failed to delete old logo file');
            // Don't throw - the new logo is already uploaded and saved
          }
        } catch (deleteErr) {
          console.warn('Error deleting old logo file:', deleteErr);
          // Don't throw - the new logo is already uploaded and saved
        }
      }

      fetchPackage();
    } catch (err) {
      console.error('Error uploading logo:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'PackageDetailPage',
            action: 'upload_logo',
          },
          extra: {
            packageId,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getSupabaseToken();
      const slug = formData.slug.trim().toLowerCase();
      if (!slug || !SLUG_REGEX.test(slug)) {
        throw new Error('Slug must be lowercase letters, numbers, and hyphens only');
      }

      const paymentFrequencies: PaymentFrequencyRow[] = [];
      for (const freq of CONFIGURABLE_FREQUENCIES) {
        const row = formData.frequencies[freq.value];
        if (!row?.enabled) continue;
        const count = parseInt(row.count, 10);
        if (!Number.isInteger(count) || count < freq.min || count > freq.max) {
          throw new Error(
            `${freq.label} installment count must be a whole number between ${freq.min} and ${freq.max}`
          );
        }
        paymentFrequencies.push({ frequency: freq.value, installmentCount: count });
      }
      if (paymentFrequencies.length === 0) {
        throw new Error('Select at least one payment frequency');
      }

      const payload = {
        name: formData.name.trim(),
        slug,
        description: formData.description.trim(),
        isActive: pkg?.isActive ?? false,
        paymentFrequencies,
      };
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const details = errorData.error?.details;
        if (details && typeof details === 'object') {
          throw new Error(Object.values(details as Record<string, string>).join('; '));
        }
        throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`);
      }

      setEditing(false);
      fetchPackage();
      fetchPricing();
    } catch (err) {
      console.error('Error updating package:', err);
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'PackageDetailPage',
            action: 'update_package',
          },
          extra: {
            packageId,
            formData,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to update package');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (pkg) {
      setFormData({
        name: pkg.name,
        slug: pkg.slug ?? '',
        description: pkg.description,
        isActive: pkg.isActive,
        frequencies: frequenciesToForm(pkg.paymentFrequencies),
      });
    }
    setEditing(false);
  };

  const handleActivate = async () => {
    if (!pkg || !pricing?.isPricingComplete) return;
    if (!plans.some((p) => p.isActive)) {
      setError('Package cannot be activated without at least one active plan');
      return;
    }

    setActivating(true);
    setError(null);
    try {
      const token = await getSupabaseToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
          body: JSON.stringify({ isActive: true }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message ?? 'Failed to activate package');
      }

      await fetchPackage();
      await fetchPricing();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate package');
    } finally {
      setActivating(false);
    }
  };

  const goToWizardStep = (step: PackageWizardStep) => {
    router.push(`/admin/underwriters/packages/${packageId}?step=${step}`);
  };

  const finishWizard = () => {
    router.push(`/admin/underwriters/packages/${packageId}`);
  };

  if (loading && !pkg) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading package...</span>
      </div>
    );
  }

  if (error && !pkg) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!pkg) {
    return null;
  }

  const canActivate =
    isSetupAdmin &&
    !pkg.isActive &&
    pricing?.isPricingComplete &&
    plans.some((p) => p.isActive);

  const packageInfoCard = (
    <Card>
      <CardHeader>
        <CardTitle>Package Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Package Name</Label>
            {editing && isSetupAdmin ? (
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={100}
              />
            ) : (
              <p className="text-sm font-medium">{pkg.name}</p>
            )}
          </div>

          <div>
            <Label>Underwriter</Label>
            <p className="text-sm font-medium">{pkg.underwriterName ?? 'N/A'}</p>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="package-description">Description</Label>
            {editing && isSetupAdmin ? (
              <textarea
                id="package-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                placeholder="Enter package description"
                aria-label="Package description"
                required
                maxLength={500}
              />
            ) : (
              <div className="flex items-start gap-2">
                <TruncatedDescription
                  description={
                    pkg.description.length > 40
                      ? pkg.description.substring(0, 40) + '...'
                      : pkg.description
                  }
                  fullDescription={pkg.description}
                />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="package-status">Status</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={
                  pkg.isActive
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-secondary text-secondary-foreground border-transparent'
                }
              >
                {pkg.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {pricing && !pricing.isPricingComplete && (
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                  Pricing incomplete
                </Badge>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="package-slug">Package slug</Label>
            {editing && isSetupAdmin ? (
              <Input
                id="package-slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  })
                }
                placeholder="mfanisi-go"
                aria-label="Package slug"
              />
            ) : (
              <p className="text-sm font-medium">{pkg.slug ?? '—'}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Lowercase letters, numbers, hyphens.
            </p>
          </div>

          <div className="md:col-span-2">
            <Label>Payment frequencies</Label>
            {editing && isSetupAdmin ? (
              <div className="mt-2 space-y-2">
                {CONFIGURABLE_FREQUENCIES.map((freq) => {
                  const row = formData.frequencies[freq.value];
                  return (
                    <div key={freq.value} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <Checkbox
                          id={`edit-freq-${freq.value}`}
                          checked={row.enabled}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              frequencies: {
                                ...formData.frequencies,
                                [freq.value]: { ...row, enabled: checked === true },
                              },
                            })
                          }
                        />
                        <Label htmlFor={`edit-freq-${freq.value}`} className="font-normal cursor-pointer">
                          {freq.label}
                        </Label>
                      </div>
                      <Input
                        className="w-24"
                        inputMode="numeric"
                        disabled={!row.enabled}
                        value={row.count}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            frequencies: {
                              ...formData.frequencies,
                              [freq.value]: {
                                ...row,
                                count: e.target.value.replace(/\D/g, '').slice(0, 3),
                              },
                            },
                          })
                        }
                        aria-label={`${freq.label} installment count`}
                      />
                      <span className="text-xs text-muted-foreground">
                        ({freq.min}–{freq.max})
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {(pkg.paymentFrequencies ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">None configured</p>
                ) : (
                  (pkg.paymentFrequencies ?? []).map((pf) => (
                    <Badge key={pf.frequency} variant="outline">
                      {pf.frequency}: {pf.installmentCount}
                    </Badge>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <Label>Created By</Label>
            <p className="text-sm font-medium">{pkg.createdByDisplayName ?? 'Unknown'}</p>
          </div>

          <div>
            <Label>Created At</Label>
            <p className="text-sm font-medium">
              {pkg.createdAt ? new Date(pkg.createdAt).toLocaleString() : 'N/A'}
            </p>
          </div>

          <div className="md:col-span-2">
            <Label>Logo</Label>
            {pkg.logoPath ? (
              <div className="mt-2">
                <Image
                  src={pkg.logoPath}
                  alt={`${pkg.name} logo`}
                  width={200}
                  height={200}
                  className="object-contain"
                />
              </div>
            ) : null}
            {editing && isSetupAdmin && (
              <div className="mt-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supported formats: JPEG, PNG, GIF, WebP. Max size: 5MB
                </p>
              </div>
            )}
          </div>
        </div>
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
  ) : null;

  const utilizationPlaceholder = (
    <Card>
      <CardHeader>
        <CardTitle>Product Utilization Configuration</CardTitle>
        <CardDescription>
          Placeholder for future utilization rules. No configuration required to finish.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Utilization settings will be available in a future release.
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Package Details</h1>
          <p className="text-muted-foreground mt-2">
            View and manage package information
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canActivate && (
            <Button onClick={handleActivate} disabled={activating}>
              <Zap className="h-4 w-4 mr-2" />
              {activating ? 'Activating...' : 'Activate Package'}
            </Button>
          )}
          {isSetupAdmin && !wizardStep && (
            <>
              {!editing ? (
                <Button onClick={() => setEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => goToWizardStep(1)}>
                Open wizard
              </Button>
            </>
          )}
        </div>
      </div>

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

      {wizardStep && isSetupAdmin ? (
        <PackageWizard
          currentStep={wizardStep}
          onBack={() => wizardStep > 1 && goToWizardStep((wizardStep - 1) as PackageWizardStep)}
          onNext={() => wizardStep < 3 && goToWizardStep((wizardStep + 1) as PackageWizardStep)}
          onFinish={finishWizard}
          nextDisabled={wizardStep === 2 && !pricing?.isPricingComplete}
          loading={loading || activating}
        >
          {wizardStep === 1 && packageInfoCard}
          {wizardStep === 2 && pricingCard}
          {wizardStep === 3 && utilizationPlaceholder}
        </PackageWizard>
      ) : (
        <>
          {packageInfoCard}
          {pricingCard}
        </>
      )}

      {!wizardStep && (
        <>
      {/* Plans */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Plans</CardTitle>
              <CardDescription>
                Plans for this package (names must match pricing file plan keys, e.g. Silver, Gold). A package
                needs at least one active plan before it can be set active.
              </CardDescription>
            </div>
            <Button onClick={() => setCreatePlanDialogOpen(true)} disabled={!isSetupAdmin}>
              <Plus className="h-4 w-4 mr-2" />
              Add Plan
            </Button>
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

      {/* Card template preview */}
      <Card>
        <CardHeader>
          <CardTitle>Card template preview</CardTitle>
          <CardDescription>
            Preview of the membership card layout for this package (sample data)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemberCardWithDownload
            data={SAMPLE_CARD_DATA}
            templateName={pkg.cardTemplateName ?? null}
            className="max-w-sm"
            showDownloadButton={false}
          />
        </CardContent>
      </Card>

      {/* Schemes Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Schemes</CardTitle>
              <CardDescription>
                Schemes linked to this package
              </CardDescription>
            </div>
            <Button onClick={() => setCreateSchemeDialogOpen(true)} disabled={!isSetupAdmin}>
              <Plus className="h-4 w-4 mr-2" />
              Add Scheme
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {schemes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No schemes found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scheme Name</TableHead>
                    <TableHead>Waiting period (days)</TableHead>
                    <TableHead>Customers</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schemes.map((scheme) => (
                    <TableRow
                      key={scheme.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/admin/underwriters/packages/${packageId}/schemes/${scheme.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-600 hover:underline">
                            {scheme.schemeName}
                          </span>
                          {scheme.isPostpaid && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              Postpaid
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{scheme.generalSchemeWaitingPeriod ?? '—'}</TableCell>
                      <TableCell>{scheme.customersCount}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            scheme.isActive
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-secondary text-secondary-foreground border-transparent'
                          }
                        >
                          {scheme.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {/* Create Scheme Dialog */}
      <CreateSchemeDialog
        open={createSchemeDialogOpen}
        onOpenChange={setCreateSchemeDialogOpen}
        onSuccess={() => {
          setCreateSchemeDialogOpen(false);
          fetchSchemes();
        }}
        packageId={packageId}
        paymentFrequencies={pkg?.paymentFrequencies}
      />

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

