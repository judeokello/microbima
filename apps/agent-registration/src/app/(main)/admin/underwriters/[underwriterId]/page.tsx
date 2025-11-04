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

export default function UnderwriterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const underwriterId = parseInt(params.underwriterId as string);

  const [underwriter, setUnderwriter] = useState<Underwriter | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
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
    } catch (err) {
      console.error('Error fetching underwriter:', err);
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

            {underwriter.logoPath && (
              <div className="md:col-span-2">
                <Label>Logo</Label>
                <div className="mt-2">
                  <Image
                    src={underwriter.logoPath}
                    alt={`${underwriter.name} logo`}
                    width={200}
                    height={200}
                    className="object-contain"
                  />
                </div>
              </div>
            )}
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

