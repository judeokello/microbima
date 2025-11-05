'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Edit, Save, X, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as Sentry from '@sentry/nextjs';
import Image from 'next/image';
import { TruncatedDescription } from './_components/truncated-description';
import CreatePackageDialog from './_components/create-package-dialog';

interface Underwriter {
  id: number;
  name: string;
  shortName: string;
  website: string;
  officeLocation: string;
  isActive: boolean;
  logoPath?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Package {
  id: number;
  name: string;
  description: string;
  fullDescription: string;
  schemesCount: number;
  totalCustomers: number;
}

interface UnderwriterResponse {
  status: number;
  correlationId: string;
  message: string;
  data: Underwriter;
}

interface PackagesResponse {
  status: number;
  correlationId: string;
  message: string;
  data: Package[];
}

interface UserDisplayNameResponse {
  status: number;
  correlationId: string;
  message: string;
  data: {
    userId: string;
    displayName: string;
    email: string;
  };
}

export default function UnderwriterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const underwriterId = parseInt(params.underwriterId as string);

  const [underwriter, setUnderwriter] = useState<Underwriter | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [createdByName, setCreatedByName] = useState<string>('Loading...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [createPackageDialogOpen, setCreatePackageDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    website: '',
    officeLocation: '',
    isActive: true,
  });

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const fetchUnderwriter = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getSupabaseToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/underwriters/${underwriterId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: UnderwriterResponse = await response.json();
      setUnderwriter(data.data);
      setFormData({
        name: data.data.name,
        shortName: data.data.shortName,
        website: data.data.website,
        officeLocation: data.data.officeLocation,
        isActive: data.data.isActive,
      });

      // Fetch createdBy display name
      if (data.data.createdBy) {
        try {
          const userResponse = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/users/${data.data.createdBy}/display-name`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }
          });
          if (userResponse.ok) {
            const userData: UserDisplayNameResponse = await userResponse.json();
            setCreatedByName(userData.data.displayName);
          }
        } catch (err) {
          console.error('Error fetching user display name:', err);
          setCreatedByName('Unknown');
        }
      }
    } catch (err) {
      console.error('Error fetching underwriter:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'UnderwriterDetailPage',
            action: 'fetch_underwriter',
          },
          extra: {
            underwriterId,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch underwriter');
    } finally {
      setLoading(false);
    }
  }, [underwriterId]);

  const fetchPackages = useCallback(async () => {
    try {
      const token = await getSupabaseToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/underwriters/${underwriterId}/packages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PackagesResponse = await response.json();
      setPackages(data.data);
    } catch (err) {
      console.error('Error fetching packages:', err);
    }
  }, [underwriterId]);

  useEffect(() => {
    fetchUnderwriter();
    fetchPackages();
  }, [fetchUnderwriter, fetchPackages]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !underwriter) return;

    setUploadingLogo(true);
    try {
      const oldLogoPath = underwriter.logoPath;
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('entityType', 'underwriter');
      uploadFormData.append('entityId', underwriter.id.toString());

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

      // Update underwriter with logo path
      const updateResponse = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/underwriters/${underwriterId}`, {
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
        throw new Error('Failed to update underwriter with logo path');
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
            // Filesystem path (relative path like /logos/underwriters/1/logo.png)
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

      fetchUnderwriter();
    } catch (err) {
      console.error('Error uploading logo:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'UnderwriterDetailPage',
            action: 'upload_logo',
          },
          extra: {
            underwriterId,
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/underwriters/${underwriterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`);
      }

      setEditing(false);
      fetchUnderwriter();
    } catch (err) {
      console.error('Error updating underwriter:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'UnderwriterDetailPage',
            action: 'update_underwriter',
          },
          extra: {
            underwriterId,
            formData,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to update underwriter');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (underwriter) {
      setFormData({
        name: underwriter.name,
        shortName: underwriter.shortName,
        website: underwriter.website,
        officeLocation: underwriter.officeLocation,
        isActive: underwriter.isActive,
      });
    }
    setEditing(false);
  };

  if (loading && !underwriter) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading underwriter...</span>
      </div>
    );
  }

  if (error && !underwriter) {
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

  if (!underwriter) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Underwriter Details</h1>
          <p className="text-muted-foreground mt-2">
            View and manage underwriter information
          </p>
        </div>
        {!editing ? (
          <Button onClick={() => setEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        ) : (
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Underwriter Details */}
      <Card>
        <CardHeader>
          <CardTitle>Underwriter Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              {editing ? (
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              ) : (
                <p className="text-sm font-medium">{underwriter.name}</p>
              )}
            </div>

            <div>
              <Label>Short Name</Label>
              {editing ? (
                <Input
                  value={formData.shortName}
                  onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                  required
                />
              ) : (
                <p className="text-sm font-medium">{underwriter.shortName}</p>
              )}
            </div>

            <div>
              <Label>Website</Label>
              {editing ? (
                <Input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  required
                />
              ) : (
                <a
                  href={underwriter.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  {underwriter.website}
                </a>
              )}
            </div>

            <div>
              <Label>Office Location</Label>
              {editing ? (
                <Input
                  value={formData.officeLocation}
                  onChange={(e) => setFormData({ ...formData, officeLocation: e.target.value })}
                  required
                />
              ) : (
                <p className="text-sm font-medium">{underwriter.officeLocation}</p>
              )}
            </div>

            <div>
              <Label>Status</Label>
              {editing ? (
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
              ) : (
                <Badge variant={underwriter.isActive ? 'default' : 'secondary'}>
                  {underwriter.isActive ? 'Active' : 'Inactive'}
                </Badge>
              )}
            </div>

            <div>
              <Label>Created By</Label>
              <p className="text-sm font-medium">{createdByName}</p>
            </div>

            <div>
              <Label>Created At</Label>
              <p className="text-sm font-medium">
                {underwriter.createdAt ? new Date(underwriter.createdAt).toLocaleString() : 'N/A'}
              </p>
            </div>

            <div className="md:col-span-2">
              <Label>Logo</Label>
              {underwriter.logoPath && (
                <div className="mt-2">
                  <Image
                    src={underwriter.logoPath}
                    alt={`${underwriter.name} logo`}
                    width={200}
                    height={200}
                    className="object-contain"
                  />
                </div>
              )}
              {editing && (
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

      {/* Packages Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Packages</CardTitle>
              <CardDescription>
                Packages linked to this underwriter
              </CardDescription>
            </div>
            <Button onClick={() => setCreatePackageDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Package
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No packages found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Schemes</TableHead>
                    <TableHead>Total Customers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((pkg) => (
                    <TableRow
                      key={pkg.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/admin/underwriters/packages/${pkg.id}`)}
                    >
                      <TableCell className="font-medium">
                        <span className="text-blue-600 hover:underline">
                          {pkg.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <TruncatedDescription
                          description={pkg.description}
                          fullDescription={pkg.fullDescription}
                        />
                      </TableCell>
                      <TableCell>{pkg.schemesCount}</TableCell>
                      <TableCell>{pkg.totalCustomers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Package Dialog */}
      <CreatePackageDialog
        open={createPackageDialogOpen}
        onOpenChange={setCreatePackageDialogOpen}
        onSuccess={() => {
          setCreatePackageDialogOpen(false);
          fetchPackages();
        }}
        underwriterId={underwriterId}
      />
    </div>
  );
}

