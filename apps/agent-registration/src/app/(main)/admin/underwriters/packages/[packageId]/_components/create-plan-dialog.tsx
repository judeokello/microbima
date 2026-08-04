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

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  packageId: number;
}

function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export default function CreatePlanDialog({
  open,
  onOpenChange,
  onSuccess,
  packageId,
}: CreatePlanDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', isActive: true });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const name = toTitleCase(formData.name);
      const description = formData.description.trim();
      if (!name) {
        throw new Error('Plan name is required');
      }
      if (name.length > 200) {
        throw new Error('Plan name must be at most 200 characters');
      }
      if (description.length > 200) {
        throw new Error('Description must be at most 200 characters');
      }

      const token = await getSupabaseToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}/plans`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
          body: JSON.stringify({
            name,
            description: description || undefined,
            isActive: formData.isActive,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error?.details && typeof errorData.error.details === 'object') {
            const detailMsgs = Object.values(errorData.error.details as Record<string, string>);
            if (detailMsgs.length) errorMessage = detailMsgs.join('; ');
          } else if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          /* ignore parse errors */
        }
        throw new Error(errorMessage);
      }

      resetForm();
      onSuccess();
    } catch (err) {
      console.error('Error creating plan:', err);
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: { component: 'CreatePlanDialog', action: 'create_plan' },
          extra: { packageId },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to create plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Plan</DialogTitle>
          <DialogDescription>
            Add a plan for this package. The name is saved in title case and should match pricing file plan keys
            (e.g. Silver, Gold).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="plan-name">Name *</Label>
            <Input
              id="plan-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Silver"
              maxLength={200}
              required
            />
          </div>
          <div>
            <Label htmlFor="plan-description">Description</Label>
            <Input
              id="plan-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              maxLength={200}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="plan-active"
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isActive: checked === true })
              }
            />
            <Label htmlFor="plan-active" className="font-normal cursor-pointer">
              Active
            </Label>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
