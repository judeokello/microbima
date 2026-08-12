'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as Sentry from '@sentry/nextjs';

const CONFIGURABLE_FREQUENCIES = [
  { value: 'DAILY', label: 'Daily', min: 1, max: 365, defaultCount: '276' },
  { value: 'WEEKLY', label: 'Weekly', min: 1, max: 52, defaultCount: '39' },
  { value: 'MONTHLY', label: 'Monthly', min: 1, max: 12, defaultCount: '9' },
  { value: 'QUARTERLY', label: 'Quarterly', min: 1, max: 4, defaultCount: '4' },
  { value: 'ANNUALLY', label: 'Annually', min: 1, max: 1, defaultCount: '1' },
] as const;

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface CreatePackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onCreated?: (packageId: number) => void;
  underwriterId: number;
}

export default function CreatePackageDialog({
  open,
  onOpenChange,
  onSuccess,
  onCreated,
  underwriterId,
}: CreatePackageDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    isActive: false,
    parentsSupported: false,
    maximumFamilySize: '8',
    logo: null as File | null,
    frequencies: {
      DAILY: { enabled: true, count: '276' },
      WEEKLY: { enabled: true, count: '39' },
      MONTHLY: { enabled: true, count: '9' },
      QUARTERLY: { enabled: false, count: '4' },
      ANNUALLY: { enabled: false, count: '1' },
    } as Record<string, { enabled: boolean; count: string }>,
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, logo: file });
    }
  };

  const buildPaymentFrequencies = () => {
    const rows: { frequency: string; installmentCount: number }[] = [];
    for (const freq of CONFIGURABLE_FREQUENCIES) {
      const row = formData.frequencies[freq.value];
      if (!row?.enabled) continue;
      const count = parseInt(row.count, 10);
      if (!Number.isInteger(count) || count < freq.min || count > freq.max) {
        throw new Error(
          `${freq.label} installment count must be a whole number between ${freq.min} and ${freq.max}`
        );
      }
      rows.push({ frequency: freq.value, installmentCount: count });
    }
    if (rows.length === 0) {
      throw new Error('Select at least one payment frequency');
    }
    return rows;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const name = formData.name.trim();
      const description = formData.description.trim();
      const slug = formData.slug.trim().toLowerCase();
      if (!name || !description || !slug) {
        throw new Error('Name, slug, and description are required');
      }
      if (!SLUG_REGEX.test(slug)) {
        throw new Error('Slug must be lowercase letters, numbers, and hyphens only');
      }

      const paymentFrequencies = buildPaymentFrequencies();
      const maximumFamilySize = parseInt(formData.maximumFamilySize, 10);
      if (!Number.isInteger(maximumFamilySize) || maximumFamilySize < 2 || maximumFamilySize > 99) {
        throw new Error('Maximum family size must be a whole number between 2 and 99');
      }
      const token = await getSupabaseToken();
      let logoPath: string | undefined;

      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify({
          name,
          slug,
          description,
          underwriterId: underwriterId,
          isActive: formData.isActive,
          parentsSupported: formData.parentsSupported,
          maximumFamilySize,
          paymentFrequencies,
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error.message ?? errorData.error ?? errorMessage;
            if (errorData.error.details && typeof errorData.error.details === 'object') {
              const detailMsgs = Object.values(errorData.error.details as Record<string, string>);
              if (detailMsgs.length) errorMessage = detailMsgs.join('; ');
            }
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          const text = await response.text().catch(() => '');
          if (text) errorMessage = text;
        }
        throw new Error(errorMessage);
      }

      const createdPackage = await response.json();

      if (formData.logo && createdPackage.data?.id) {
        setUploading(true);
        try {
          const uploadFormData = new FormData();
          uploadFormData.append('file', formData.logo);
          uploadFormData.append('entityType', 'package');
          uploadFormData.append('entityId', createdPackage.data.id.toString());
          uploadFormData.append('underwriterId', underwriterId.toString());

          const uploadResponse = await fetch('/api/upload/logo', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: uploadFormData,
            signal: AbortSignal.timeout(60_000),
          });

          if (!uploadResponse.ok) {
            let uploadError = 'Failed to upload logo';
            try {
              const body = await uploadResponse.json();
              if (typeof body.error === 'string') uploadError = body.error;
            } catch {
              /* keep default */
            }
            throw new Error(
              `${uploadError}. Package was created — you can add a logo from the package page.`
            );
          }

          const uploadResult = await uploadResponse.json();
          logoPath = uploadResult.path;

          const saveLogoResponse = await fetch(
            `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${createdPackage.data.id}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              },
              body: JSON.stringify({
                logoPath,
              }),
              signal: AbortSignal.timeout(30_000),
            }
          );

          if (!saveLogoResponse.ok) {
            throw new Error(
              'Logo uploaded but failed to save on the package. You can retry from the package page.'
            );
          }
        } finally {
          setUploading(false);
        }
      }

      setFormData({
        name: '',
        slug: '',
        description: '',
        isActive: false,
        parentsSupported: false,
        maximumFamilySize: '8',
        logo: null,
        frequencies: {
          DAILY: { enabled: true, count: '276' },
          WEEKLY: { enabled: true, count: '39' },
          MONTHLY: { enabled: true, count: '9' },
          QUARTERLY: { enabled: false, count: '4' },
          ANNUALLY: { enabled: false, count: '1' },
        },
      });

      onSuccess();
      if (createdPackage.data?.id && onCreated) {
        onCreated(createdPackage.data.id);
      }
    } catch (err) {
      console.error('Error creating package:', err);
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'CreatePackageDialog',
            action: 'create_package',
          },
          extra: {
            underwriterId,
            formData: {
              name: formData.name,
              slug: formData.slug,
              description: formData.description,
              isActive: formData.isActive,
            },
            hasLogo: !!formData.logo,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Package</DialogTitle>
          <DialogDescription>
            Create a new package for this underwriter. Slug and at least one payment frequency are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="name">Package Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={100}
              />
            </div>

            <div>
              <Label htmlFor="slug">Package slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  })
                }
                required
                maxLength={100}
                placeholder="mfanisi-boda"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase letters, numbers, and hyphens. Used for pricing file lookup.
              </p>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                maxLength={500}
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  disabled
                  className="h-4 w-4"
                />
                <Label htmlFor="isActive" className="font-normal cursor-not-allowed opacity-50">
                  Active (packages are created as inactive by default)
                </Label>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="parentsSupported"
                  checked={formData.parentsSupported}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, parentsSupported: checked === true })
                  }
                />
                <Label htmlFor="parentsSupported" className="font-normal cursor-pointer">
                  Parents Supported
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Allow schemes under this package to capture parent details at registration.
              </p>
            </div>

            <div>
              <Label htmlFor="maximumFamilySize">Maximum Family Size *</Label>
              <Input
                id="maximumFamilySize"
                type="number"
                inputMode="numeric"
                min={2}
                max={99}
                required
                value={formData.maximumFamilySize}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maximumFamilySize: e.target.value.replace(/\D/g, '').slice(0, 2),
                  })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 2. Caps Up to N pricing categories for this package.
              </p>
            </div>

            <div className="space-y-3">
              <Label>Supported payment frequencies *</Label>
              <p className="text-xs text-muted-foreground">
                Enable frequencies and set installment counts (daily = days, weekly = weeks, monthly = months).
              </p>
              {CONFIGURABLE_FREQUENCIES.map((freq) => {
                const row = formData.frequencies[freq.value];
                return (
                  <div key={freq.value} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <Checkbox
                        id={`freq-${freq.value}`}
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
                      <Label htmlFor={`freq-${freq.value}`} className="font-normal cursor-pointer">
                        {freq.label}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`count-${freq.value}`} className="text-sm text-muted-foreground whitespace-nowrap">
                        Installments
                      </Label>
                      <Input
                        id={`count-${freq.value}`}
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
                      />
                      <span className="text-xs text-muted-foreground">
                        ({freq.min}–{freq.max})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <Label htmlFor="logo">Logo</Label>
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={loading || uploading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: JPEG, PNG, GIF, WebP. Max size: 5MB
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploading}>
              {(loading || uploading) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploading ? 'Uploading...' : 'Creating...'}
                </>
              ) : (
                'Create'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
