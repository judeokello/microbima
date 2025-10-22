'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Download, RefreshCw } from 'lucide-react';
import { formatDate, formatPhoneNumber } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface AdminCustomer {
  id: string;
  fullName: string;
  phoneNumber: string;
  gender: string;
  createdAt: string;
  registeredBy: string;
  idType: string;
  idNumber: string;
  hasMissingRequirements: boolean;
}

interface BrandAmbassador {
  displayName: string;
  partnerId: number;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface CustomersResponse {
  data: AdminCustomer[];
  pagination: PaginationInfo;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [brandAmbassadors, setBrandAmbassadors] = useState<BrandAmbassador[]>([]);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [createdBy, setCreatedBy] = useState('all');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (createdBy && createdBy !== 'all') params.append('createdBy', createdBy);

      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/all?${params}`, {
        headers: {
          'Authorization': `Bearer ${await getSupabaseToken()}`,
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
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const fetchBrandAmbassadors = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/brand-ambassadors`, {
        headers: {
          'Authorization': `Bearer ${await getSupabaseToken()}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setBrandAmbassadors(data.brandAmbassadors || []);
    } catch (err) {
      console.error('Error fetching brand ambassadors:', err);
      // Don't show error to user, just log it
    }
  }, []);

  const handleExport = async () => {
    try {
      setExporting(true);
      setError(null);

      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);

      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${await getSupabaseToken()}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting customers:', err);
      setError(err instanceof Error ? err.message : 'Failed to export customers');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchBrandAmbassadors();
  }, [fetchBrandAmbassadors]);

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1); // Reset to first page when changing page size
    fetchCustomers(); // Fetch immediately for page size changes
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleFilter = () => {
    setCurrentPage(1); // Reset to first page when filtering
    fetchCustomers();
  };

  const handleFilterReset = () => {
    setFromDate('');
    setToDate('');
    setCreatedBy('all');
    setCurrentPage(1);
    // Apply the reset immediately
    fetchCustomers();
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

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading customers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Customers</h1>
          <p className="text-muted-foreground mt-2">
            View and manage all customer registrations in the system
          </p>
        </div>
        <Button onClick={handleExport} disabled={exporting}>
          {exporting ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Set your filters and click "Filter" to apply them</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
              <Label htmlFor="createdBy">Created By</Label>
              <Select value={createdBy} onValueChange={setCreatedBy}>
                <SelectTrigger>
                  <SelectValue placeholder="All Brand Ambassadors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brand Ambassadors</SelectItem>
                  {brandAmbassadors.map((ba, index) => (
                    <SelectItem key={`${ba.displayName}-${ba.partnerId}-${index}`} value={ba.displayName}>
                      {ba.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="flex items-end gap-2">
              <Button onClick={handleFilter}>
                Filter
              </Button>
              <Button variant="outline" onClick={handleFilterReset}>
                Reset
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

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
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
                      <TableHead>Full Name</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Registration Date</TableHead>
                      <TableHead>Registered By</TableHead>
                      <TableHead>ID Type</TableHead>
                      <TableHead>ID Number</TableHead>
                      <TableHead>Data Complete?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                          {customer.fullName}
                        </TableCell>
                        <TableCell>
                          {formatPhoneNumber(customer.phoneNumber)}
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
                          {customer.registeredBy}
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
