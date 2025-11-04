'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as Sentry from '@sentry/nextjs';

interface CreatePackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  underwriterId: number;
}

export default function CreatePackageDialog({
  open,
  onOpenChange,
  onSuccess,
  underwriterId,
}: CreatePackageDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: false,
    logo: null as File | null,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.name || !formData.description) {
        throw new Error('All fields are required');
      }

      const token = await getSupabaseToken();
      let logoPath: string | undefined;

      // Create package first
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          underwriterId: underwriterId,
          isActive: formData.isActive,
          logoPath: logoPath,
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error('Package creation error response:', errorData);
          // Handle different error response formats
          if (errorData.error) {
            // Standard error format: { error: { message: "...", code: "...", ... } }
            errorMessage = errorData.error.message ?? errorData.error ?? errorMessage;
          } else if (errorData.message) {
            // Direct message format: { message: "..." }
            errorMessage = errorData.message;
          } else if (typeof errorData === 'string') {
            // Plain string response
            errorMessage = errorData;
          }
        } catch (e) {
          // If response is not JSON, use status text
          console.error('Error parsing error response:', e);
          const text = await response.text().catch(() => '');
          if (text) {
            errorMessage = text;
          }
        }
        throw new Error(errorMessage);
      }

      const createdPackage = await response.json();

      // Upload logo if provided (now that we have the package ID)
      if (formData.logo && createdPackage.data?.id) {
        setUploading(true);
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.logo);
        uploadFormData.append('entityType', 'package');
        uploadFormData.append('entityId', createdPackage.data.id.toString());
        uploadFormData.append('underwriterId', underwriterId.toString());

        const uploadResponse = await fetch('/api/upload/logo', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Logo upload failed:', errorData);
          // Don't throw error - package was created successfully, logo can be added later
        } else {
          const uploadResult = await uploadResponse.json();
          logoPath = uploadResult.path;

          // Update package with logo path
          const updateResponse = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${createdPackage.data.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            },
            body: JSON.stringify({
              logoPath: logoPath,
            }),
          });

          if (!updateResponse.ok) {
            console.error('Failed to update package with logo path');
          }
        }
        setUploading(false);
      }

      // Reset form
      setFormData({
        name: '',
        description: '',
        isActive: false,
        logo: null,
      });

      onSuccess();
    } catch (err) {
      console.error('Error creating package:', err);
      // Report error to Sentry
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
            Create a new package for this underwriter. All fields are required.
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

