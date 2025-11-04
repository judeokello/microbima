'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Edit, Save, X, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { TruncatedDescription } from '../../../../[underwriterId]/_components/truncated-description';

interface Scheme {
  id: number;
  schemeName: string;
  description: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Customer {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  phoneNumber: string;
  gender: string;
  createdAt: string;
  idType: string;
  idNumber: string;
  hasMissingRequirements: boolean;
}

interface SchemeResponse {
  status: number;
  correlationId: string;
  message: string;
  data: Scheme;
}

interface CustomersResponse {
  status: number;
  correlationId: string;
  message: string;
  data: Customer[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
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

export default function SchemeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const schemeId = parseInt(params.schemeId as string);

  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<CustomersResponse['pagination'] | null>(null);
  const [createdByName, setCreatedByName] = useState<string>('Loading...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    schemeName: '',
    description: '',
    isActive: true,
  });

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const fetchScheme = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getSupabaseToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SchemeResponse = await response.json();
      setScheme(data.data);
      setFormData({
        schemeName: data.data.schemeName,
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
      console.error('Error fetching scheme:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch scheme');
    } finally {
      setLoading(false);
    }
  }, [schemeId]);

  const fetchCustomers = useCallback(async () => {
    try {
      const token = await getSupabaseToken();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}/customers?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CustomersResponse = await response.json();
      setCustomers(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  }, [schemeId, currentPage, pageSize]);

  useEffect(() => {
    fetchScheme();
  }, [fetchScheme]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getSupabaseToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}`, {
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
      fetchScheme();
    } catch (err) {
      console.error('Error updating scheme:', err);
      setError(err instanceof Error ? err.message : 'Failed to update scheme');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (scheme) {
      setFormData({
        schemeName: scheme.schemeName,
        description: scheme.description,
        isActive: scheme.isActive,
      });
    }
    setEditing(false);
  };

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const getGenderBadgeVariant = (gender: string) => {
    switch (gender.toLowerCase()) {
      case 'male':
        return 'default';
      case 'female':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getMissingDataIcon = (hasMissingRequirements: boolean) => {
    return hasMissingRequirements ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : (
      <CheckCircle className="h-4 w-4 text-green-500" />
    );
  };

  if (loading && !scheme) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading scheme...</span>
      </div>
    );
  }

  if (error && !scheme) {
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

  if (!scheme) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheme Details</h1>
          <p className="text-muted-foreground mt-2">
            View and manage scheme information
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

      {/* Scheme Details */}
      <Card>
        <CardHeader>
          <CardTitle>Scheme Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Scheme Name</Label>
              {editing ? (
                <Input
                  value={formData.schemeName}
                  onChange={(e) => setFormData({ ...formData, schemeName: e.target.value })}
                  required
                />
              ) : (
                <p className="text-sm font-medium">{scheme.schemeName}</p>
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
                <Badge variant={scheme.isActive ? 'default' : 'secondary'}>
                  {scheme.isActive ? 'Active' : 'Inactive'}
                </Badge>
              )}
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
                    description={scheme.description.length > 40 ? scheme.description.substring(0, 40) + '...' : scheme.description}
                    fullDescription={scheme.description}
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Created At</Label>
              <p className="text-sm font-medium">{formatDate(scheme.createdAt)}</p>
            </div>

            <div>
              <Label>Created By</Label>
              <p className="text-sm font-medium">{createdByName}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            {pagination ? `${pagination.totalItems} total customers` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No customers found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Registration Date</TableHead>
                      <TableHead>ID Type</TableHead>
                      <TableHead>ID Number</TableHead>
                      <TableHead>Data Complete?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => router.push(`/dashboard/customer/${customer.id}`)}
                      >
                        <TableCell className="font-medium">
                          <span className="text-blue-600 hover:underline">
                            {[customer.firstName, customer.middleName, customer.lastName].filter(Boolean).join(' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          {customer.phoneNumber}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getGenderBadgeVariant(customer.gender)}>
                            {customer.gender}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatDate(customer.createdAt)}
                        </TableCell>
                        <TableCell>
                          {customer.idType}
                        </TableCell>
                        <TableCell>
                          {customer.idNumber}
                        </TableCell>
                        <TableCell>
                          {getMissingDataIcon(customer.hasMissingRequirements)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                    {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of{' '}
                    {pagination.totalItems} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      value={pageSize.toString()}
                      onChange={(e) => handlePageSizeChange(e.target.value)}
                      className="px-3 py-1 border rounded-md text-sm"
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="30">30</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!pagination.hasPreviousPage}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!pagination.hasNextPage}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

