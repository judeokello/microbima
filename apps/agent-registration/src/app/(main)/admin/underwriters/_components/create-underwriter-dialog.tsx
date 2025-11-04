'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as Sentry from '@sentry/nextjs';

interface CreateUnderwriterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function CreateUnderwriterDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateUnderwriterDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    website: '',
    officeLocation: '',
    logo: null as File | null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
    setUploading(false);

    try {
      // Validate required fields
      if (!formData.name || !formData.shortName || !formData.website || !formData.officeLocation) {
        throw new Error('All fields are required');
      }

      // Auto-prepend https:// if not present
      let websiteUrl = formData.website.trim();
      if (websiteUrl && !websiteUrl.match(/^https?:\/\//i)) {
        websiteUrl = `https://${websiteUrl}`;
      }

      let logoPath: string | undefined;

      // Upload logo if provided
      if (formData.logo) {
        setUploading(true);

        // First, we need to create a temporary entity to get an ID
        // For now, we'll upload without an ID and update after creation
        // Actually, let's create the underwriter first, then upload the logo
        // But we need the underwriter ID first... Let's create without logo first, then update
      }

      // Create underwriter
      const token = await getSupabaseToken();
      const createResponse = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/underwriters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify({
          name: formData.name,
          shortName: formData.shortName,
          website: websiteUrl,
          officeLocation: formData.officeLocation,
          logoPath: logoPath,
          isActive: false, // Always create as inactive
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error?.message ?? `HTTP ${createResponse.status}: ${createResponse.statusText}`);
      }

      const createdUnderwriter = await createResponse.json();

      // Upload logo if provided (now that we have the underwriter ID)
      if (formData.logo && createdUnderwriter.data?.id) {
        setUploading(true);
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.logo);
        uploadFormData.append('entityType', 'underwriter');
        uploadFormData.append('entityId', createdUnderwriter.data.id.toString());

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
          throw new Error(`Logo upload failed: ${errorData.error ?? 'Unknown error'}`);
        } else {
          const uploadResult = await uploadResponse.json();
          logoPath = uploadResult.path;

          // Update underwriter with logo path
          const updateResponse = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/underwriters/${createdUnderwriter.data.id}`, {
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
            const updateError = await updateResponse.json();
            console.error('Failed to update underwriter with logo path:', updateError);
            throw new Error('Failed to update underwriter with logo path');
          }
        }
      }

      // Reset form
      setFormData({
        name: '',
        shortName: '',
        website: '',
        officeLocation: '',
        logo: null,
      });

      onSuccess();
    } catch (err) {
      console.error('Error creating underwriter:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'CreateUnderwriterDialog',
            action: 'create_underwriter',
          },
          extra: {
            formData: {
              name: formData.name,
              shortName: formData.shortName,
              website: formData.website,
              officeLocation: formData.officeLocation,
            },
            hasLogo: !!formData.logo,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to create underwriter');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Underwriter</DialogTitle>
          <DialogDescription>
            Create a new underwriter. All fields are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={100}
              />
            </div>

            <div>
              <Label htmlFor="shortName">Short Name *</Label>
              <Input
                id="shortName"
                value={formData.shortName}
                onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            <div>
              <Label htmlFor="website">Website *</Label>
              <Input
                id="website"
                type="text"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                required
                maxLength={100}
                placeholder="example.com or https://example.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                https:// will be added automatically if not provided
              </p>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="officeLocation">Office Location *</Label>
              <Input
                id="officeLocation"
                value={formData.officeLocation}
                onChange={(e) => setFormData({ ...formData, officeLocation: e.target.value })}
                required
                maxLength={200}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="logo">Logo *</Label>
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                required
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

