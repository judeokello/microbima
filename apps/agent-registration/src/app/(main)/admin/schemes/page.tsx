'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as Sentry from '@sentry/nextjs';

interface Scheme {
  id: number;
  packageSchemeId: number;
  schemeName: string;
  description: string;
  isActive: boolean;
  isPostpaid: boolean;
  generalSchemeWaitingPeriod?: number | null;
  customersCount: number;
  packageId: number;
  packageName: string;
  underwriterId: number | null;
  underwriterName: string | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface SchemesResponse {
  status: number;
  correlationId: string;
  message: string;
  data: Scheme[];
  pagination: PaginationInfo;
}

export default function SchemesPage() {
  const router = useRouter();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const fetchSchemes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes-with-counts?${params}`,
        {
          headers: {
            Authorization: `Bearer ${await getSupabaseToken()}`,
            'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SchemesResponse = await response.json();
      setSchemes(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching schemes:', err);
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'SchemesPage',
            action: 'fetch_schemes',
          },
          extra: {
            page: currentPage,
            pageSize,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch schemes');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchSchemes();
  }, [fetchSchemes]);

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (loading && schemes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading schemes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schemes</h1>
          <p className="text-muted-foreground mt-2">
            View all schemes across underwriters and packages
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchSchemes()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Schemes List</CardTitle>
          <CardDescription>
            {pagination ? `${pagination.totalItems} total schemes` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schemes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No schemes found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scheme Name</TableHead>
                      <TableHead>Underwriter</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Waiting period (days)</TableHead>
                      <TableHead>Customers</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schemes.map((scheme) => (
                      <TableRow
                        key={scheme.packageSchemeId}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          router.push(
                            `/admin/underwriters/packages/${scheme.packageId}/schemes/${scheme.id}`
                          )
                        }
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-600 hover:underline">
                              {scheme.schemeName}
                            </span>
                            {scheme.isPostpaid && (
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-700 border-purple-200"
                              >
                                Postpaid
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{scheme.underwriterName ?? '—'}</TableCell>
                        <TableCell>{scheme.packageName}</TableCell>
                        <TableCell>{scheme.generalSchemeWaitingPeriod ?? '—'}</TableCell>
                        <TableCell>{scheme.customersCount}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              scheme.isActive
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-secondary text-secondary-foreground border-transparent'
                            }
                          >
                            {scheme.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
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
