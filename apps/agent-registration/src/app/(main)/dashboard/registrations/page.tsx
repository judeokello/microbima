'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface BrandAmbassadorRegistration {
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

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface RegistrationsResponse {
  data: BrandAmbassadorRegistration[];
  pagination: PaginationInfo;
}

export default function RegistrationsPage() {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<BrandAmbassadorRegistration[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchRegistrations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);

      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/my-registrations?${params}`, {
        headers: {
          'Authorization': `Bearer ${await getSupabaseToken()}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RegistrationsResponse = await response.json();
      setRegistrations(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching registrations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch registrations');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, fromDate, toDate]);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleFilterReset = () => {
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
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

  if (loading && registrations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading registrations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">My Registrations</h1>
        <p className="text-muted-foreground mt-2">
          View and manage your customer registrations
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter registrations by date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pageSize">Page Size</Label>
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="80">80</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={handleFilterReset}>
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Registrations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Registrations</CardTitle>
          <CardDescription>
            {pagination ? `${pagination.totalItems} total registrations` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registrations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No registrations found</p>
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
                    {registrations.map((registration) => (
                      <TableRow
                        key={registration.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => router.push(`/dashboard/customer/${registration.id}`)}
                      >
                        <TableCell className="font-medium">
                          <span className="text-blue-600 hover:underline">
                            {[registration.firstName, registration.middleName, registration.lastName].filter(Boolean).join(' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          {registration.phoneNumber}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getGenderBadgeVariant(registration.gender)}>
                            {registration.gender}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatDate(registration.createdAt)}
                        </TableCell>
                        <TableCell>
                          {registration.idType}
                        </TableCell>
                        <TableCell>
                          {registration.idNumber}
                        </TableCell>
                        <TableCell>
                          {getMissingDataIcon(registration.hasMissingRequirements)}
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
