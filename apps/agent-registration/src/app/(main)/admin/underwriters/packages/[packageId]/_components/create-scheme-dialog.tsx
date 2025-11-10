'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as Sentry from '@sentry/nextjs';

interface CreateSchemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  packageId: number;
}

export default function CreateSchemeDialog({
  open,
  onOpenChange,
  onSuccess,
  packageId,
}: CreateSchemeDialogProps) {
  const [formData, setFormData] = useState({
    schemeName: '',
    description: '',
    isActive: true,
    isPostpaid: false,
    frequency: '' as string,
    paymentCadence: '' as string,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frequencyOptions = [
    { value: 'DAILY', label: 'Daily', days: 1 },
    { value: 'WEEKLY', label: 'Weekly', days: 7 },
    { value: 'MONTHLY', label: 'Monthly', days: 31 },
    { value: 'QUARTERLY', label: 'Quarterly', days: 90 },
    { value: 'ANNUALLY', label: 'Yearly', days: 365 },
    { value: 'CUSTOM', label: 'Custom', days: null },
  ];

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.schemeName || !formData.description) {
        throw new Error('All fields are required');
      }

      // Validate postpaid requirements
      if (formData.isPostpaid) {
        if (!formData.frequency) {
          throw new Error('Payment frequency is required for postpaid schemes');
        }
        if (formData.frequency === 'CUSTOM' && !formData.paymentCadence) {
          throw new Error('Payment cadence is required when frequency is Custom');
        }
        if (formData.frequency === 'CUSTOM' && parseInt(formData.paymentCadence) > 999) {
          throw new Error('Payment cadence cannot exceed 999 days');
        }
      }

      const token = await getSupabaseToken();

      // Prepare payload
      const payload: {
        schemeName: string;
        description: string;
        isActive: boolean;
        packageId: number;
        isPostpaid?: boolean;
        frequency?: string;
        paymentCadence?: number;
      } = {
        schemeName: formData.schemeName,
        description: formData.description,
        isActive: formData.isActive,
        packageId: packageId,
      };

      // Add postpaid fields if checked
      if (formData.isPostpaid) {
        payload.isPostpaid = true;
        payload.frequency = formData.frequency;
        if (formData.frequency === 'CUSTOM') {
          payload.paymentCadence = parseInt(formData.paymentCadence);
        }
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
        isActive: true,
        isPostpaid: false,
        frequency: '',
        paymentCadence: '',
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
                  onChange={(e) => setFormData({ ...formData, isPostpaid: e.target.checked, frequency: '', paymentCadence: '' })}
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
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => setFormData({ ...formData, frequency: value, paymentCadence: value !== 'CUSTOM' ? '' : formData.paymentCadence })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {frequencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}{option.days !== null ? ` (${option.days} day${option.days !== 1 ? 's' : ''})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.frequency === 'CUSTOM' && (
                  <div>
                    <Label htmlFor="paymentCadence">Payment Cadence (days) *</Label>
                    <Input
                      id="paymentCadence"
                      type="number"
                      value={formData.paymentCadence}
                      onChange={(e) => setFormData({ ...formData, paymentCadence: e.target.value })}
                      placeholder="Enter number of days"
                      min={1}
                      max={999}
                      maxLength={3}
                      required={formData.frequency === 'CUSTOM'}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the number of days between payments (max 999)
                    </p>
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

