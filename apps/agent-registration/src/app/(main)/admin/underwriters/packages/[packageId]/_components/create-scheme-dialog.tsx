'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as Sentry from '@sentry/nextjs';
import {
  cadenceDaysForFrequency,
  derivePostpaidSchemeDateLabels,
} from '@/lib/insurance-installment';

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUALLY: 'Yearly',
};

function formatUtcDateLabel(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface CreateSchemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  packageId: number;
  /** Package-supported frequencies (no CUSTOM). */
  paymentFrequencies?: Array<{ frequency: string; installmentCount: number }>;
}

export default function CreateSchemeDialog({
  open,
  onOpenChange,
  onSuccess,
  packageId,
  paymentFrequencies = [],
}: CreateSchemeDialogProps) {
  const [formData, setFormData] = useState({
    schemeName: '',
    description: '',
    generalSchemeWaitingPeriod: '',
    isActive: true,
    isPostpaid: false,
    frequency: '' as string,
    startDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frequencyOptions = paymentFrequencies.map((pf) => ({
    value: pf.frequency,
    label: FREQUENCY_LABELS[pf.frequency] ?? pf.frequency,
  }));

  const selectedFrequencyConfig = paymentFrequencies.find(
    (pf) => pf.frequency === formData.frequency
  );
  const paymentCadence = formData.frequency
    ? cadenceDaysForFrequency(formData.frequency)
    : 0;

  const derivedDates = useMemo(() => {
    if (!formData.isPostpaid || !formData.startDate || !selectedFrequencyConfig) {
      return null;
    }
    if (selectedFrequencyConfig.installmentCount <= 0 || paymentCadence <= 0) {
      return null;
    }
    return derivePostpaidSchemeDateLabels({
      startDateYmd: formData.startDate,
      installmentCount: selectedFrequencyConfig.installmentCount,
      paymentCadence,
    });
  }, [
    formData.isPostpaid,
    formData.startDate,
    selectedFrequencyConfig,
    paymentCadence,
  ]);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Trim and validate required fields
      const schemeName = formData.schemeName.trim();
      const description = formData.description.trim();
      const waitingPeriodRaw = formData.generalSchemeWaitingPeriod.trim();
      if (!schemeName || !description || !waitingPeriodRaw) {
        throw new Error('All fields are required');
      }
      const generalSchemeWaitingPeriod = parseInt(waitingPeriodRaw, 10);
      if (Number.isNaN(generalSchemeWaitingPeriod) || generalSchemeWaitingPeriod < 0 || generalSchemeWaitingPeriod > 9999) {
        throw new Error('Waiting period must be a number between 0 and 9999');
      }

      if (formData.isPostpaid) {
        if (!formData.frequency) {
          throw new Error('Payment frequency is required for postpaid schemes');
        }
        if (!paymentFrequencies.some((pf) => pf.frequency === formData.frequency)) {
          throw new Error('Selected frequency is not supported for this package');
        }
        if (!formData.startDate.trim()) {
          throw new Error('Policy start date is required for postpaid schemes');
        }
      }

      const token = await getSupabaseToken();

      // Prepare payload
      const payload: {
        schemeName: string;
        description: string;
        isActive: boolean;
        packageId: number;
        generalSchemeWaitingPeriod: number;
        isPostpaid?: boolean;
        frequency?: string;
        startDate?: string;
      } = {
        schemeName,
        description,
        isActive: formData.isActive,
        packageId: packageId,
        generalSchemeWaitingPeriod,
      };

      if (formData.isPostpaid) {
        payload.isPostpaid = true;
        payload.frequency = formData.frequency;
        payload.startDate = formData.startDate.trim();
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error('Scheme creation error response:', errorData);
          // Handle different error response formats
          if (errorData.error) {
            errorMessage = errorData.error.message ?? errorData.error ?? errorMessage;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (typeof errorData === 'string') {
            errorMessage = errorData;
          }
        } catch (e) {
          console.error('Error parsing error response:', e);
          const text = await response.text().catch(() => '');
          if (text) {
            errorMessage = text;
          }
        }
        throw new Error(errorMessage);
      }

      // Reset form
      setFormData({
        schemeName: '',
        description: '',
        generalSchemeWaitingPeriod: '',
        isActive: true,
        isPostpaid: false,
        frequency: '',
        startDate: '',
      });

      onSuccess();
    } catch (err) {
      console.error('Error creating scheme:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'CreateSchemeDialog',
            action: 'create_scheme',
          },
          extra: {
            packageId,
            formData: {
              schemeName: formData.schemeName,
              description: formData.description,
              isActive: formData.isActive,
            },
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to create scheme');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Scheme</DialogTitle>
          <DialogDescription>
            Create a new scheme for this package. All fields are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="schemeName">Scheme Name *</Label>
              <Input
                id="schemeName"
                value={formData.schemeName}
                onChange={(e) => setFormData({ ...formData, schemeName: e.target.value })}
                required
                maxLength={100}
              />
            </div>

            <div>
              <Label htmlFor="generalSchemeWaitingPeriod">Waiting period (days) *</Label>
              <Input
                id="generalSchemeWaitingPeriod"
                type="number"
                inputMode="numeric"
                value={formData.generalSchemeWaitingPeriod}
                onChange={(e) => setFormData({ ...formData, generalSchemeWaitingPeriod: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                required
                min={0}
                max={9999}
                placeholder="e.g. 30"
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                maxLength={300}
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isActive" className="font-normal cursor-pointer">
                  Active
                </Label>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPostpaid"
                  checked={formData.isPostpaid}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isPostpaid: e.target.checked,
                      frequency: '',
                      startDate: '',
                    })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="isPostpaid" className="font-normal cursor-pointer">
                  Postpaid
                </Label>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Enable if payments are collected after service delivery
              </p>
            </div>

            {formData.isPostpaid && (
              <>
                <div>
                  <Label htmlFor="frequency">Payment Frequency *</Label>
                  {frequencyOptions.length === 0 ? (
                    <p className="text-sm text-amber-800 mt-1">
                      This package has no supported payment frequencies. Configure them on the package first.
                    </p>
                  ) : (
                    <Select
                      value={formData.frequency}
                      onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label htmlFor="startDate">Policy start date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Coverage / billing start for this postpaid scheme (stored as scheme start date).
                  </p>
                </div>

                {formData.startDate && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 space-y-1">
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">Policy end date:</span>{' '}
                      {derivedDates
                        ? formatUtcDateLabel(derivedDates.endDate)
                        : '—'}
                    </p>
                    {derivedDates && (
                      <p className="text-sm text-gray-800">
                        <span className="font-medium">Nominal payment period end date:</span>{' '}
                        {formatUtcDateLabel(derivedDates.nominalPaymentPeriodEndDate)}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
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
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
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
