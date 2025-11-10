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
import { TruncatedDescription } from '../../[underwriterId]/_components/truncated-description';
import CreateSchemeDialog from './_components/create-scheme-dialog';

interface Package {
  id: number;
  name: string;
  description: string;
  underwriterId?: number | null;
  underwriterName?: string | null;
  isActive: boolean;
  logoPath?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Scheme {
  id: number;
  schemeName: string;
  description: string;
  isActive: boolean;
  isPostpaid: boolean;
  customersCount: number;
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

export default function PackageDetailPage() {
  const router = useRouter();
  const params = useParams();
  const packageId = parseInt(params.packageId as string);

  const [pkg, setPkg] = useState<Package | null>(null);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [createdByName, setCreatedByName] = useState<string>('Loading...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [createSchemeDialogOpen, setCreateSchemeDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
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
        description: data.data.description,
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
      setSchemes(data.data);
    } catch (err) {
      console.error('Error fetching schemes:', err);
    }
  }, [packageId]);

  useEffect(() => {
    fetchPackage();
    fetchSchemes();
  }, [fetchPackage, fetchSchemes]);

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
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}`, {
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
      fetchPackage();
    } catch (err) {
      console.error('Error updating package:', err);
      // Report error to Sentry
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
        description: pkg.description,
        isActive: pkg.isActive,
      });
    }
    setEditing(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Package Details</h1>
          <p className="text-muted-foreground mt-2">
            View and manage package information
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

      {/* Package Details */}
      <Card>
        <CardHeader>
          <CardTitle>Package Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Package Name</Label>
              {editing ? (
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
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
              <Label>Description</Label>
              {editing ? (
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  required
                />
              ) : (
                <div className="flex items-start gap-2">
                  <TruncatedDescription
                    description={pkg.description.length > 40 ? pkg.description.substring(0, 40) + '...' : pkg.description}
                    fullDescription={pkg.description}
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Status</Label>
              {editing ? (
                <select
                  value={formData.isActive ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              ) : (
                <Badge variant={pkg.isActive ? 'default' : 'secondary'}>
                  {pkg.isActive ? 'Active' : 'Inactive'}
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
            <Button onClick={() => setCreateSchemeDialogOpen(true)}>
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
                      <TableCell>{scheme.customersCount}</TableCell>
                      <TableCell>
                        <Badge variant={scheme.isActive ? 'default' : 'secondary'}>
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

      {/* Create Scheme Dialog */}
      <CreateSchemeDialog
        open={createSchemeDialogOpen}
        onOpenChange={setCreateSchemeDialogOpen}
        onSuccess={() => {
          setCreateSchemeDialogOpen(false);
          fetchSchemes();
        }}
        packageId={packageId}
      />
    </div>
  );
}

