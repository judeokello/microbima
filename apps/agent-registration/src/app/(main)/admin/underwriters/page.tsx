'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as Sentry from '@sentry/nextjs';
import CreateUnderwriterDialog from './_components/create-underwriter-dialog';

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
  packagesCount?: number;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface UnderwritersResponse {
  status: number;
  correlationId: string;
  message: string;
  data: Underwriter[];
  pagination: PaginationInfo;
}

export default function UnderwritersPage() {
  const router = useRouter();
  const [underwriters, setUnderwriters] = useState<Underwriter[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchUnderwriters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/underwriters?${params}`, {
        headers: {
          'Authorization': `Bearer ${await getSupabaseToken()}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: UnderwritersResponse = await response.json();
      setUnderwriters(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching underwriters:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'UnderwritersPage',
            action: 'fetch_underwriters',
          },
          extra: {
            page: currentPage,
            pageSize,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch underwriters');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  useEffect(() => {
    fetchUnderwriters();
  }, [fetchUnderwriters]);

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (loading && underwriters.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading underwriters...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Underwriters</h1>
          <p className="text-muted-foreground mt-2">
            Manage underwriters and their packages
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Underwriter
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Underwriters Table */}
      <Card>
        <CardHeader>
          <CardTitle>Underwriters List</CardTitle>
          <CardDescription>
            {pagination ? `${pagination.totalItems} total underwriters` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {underwriters.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No underwriters found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Short Name</TableHead>
                      <TableHead>Packages</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>Office Location</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {underwriters.map((underwriter) => (
                      <TableRow
                        key={underwriter.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => router.push(`/admin/underwriters/${underwriter.id}`)}
                      >
                        <TableCell className="font-medium">
                          <span className="text-blue-600 hover:underline">
                            {underwriter.name}
                          </span>
                        </TableCell>
                        <TableCell>{underwriter.shortName}</TableCell>
                        <TableCell>{underwriter.packagesCount ?? 0}</TableCell>
                        <TableCell>
                          <a
                            href={underwriter.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {underwriter.website}
                          </a>
                        </TableCell>
                        <TableCell>{underwriter.officeLocation}</TableCell>
                        <TableCell>
                          <Badge variant={underwriter.isActive ? 'default' : 'secondary'}>
                            {underwriter.isActive ? 'Active' : 'Inactive'}
                          </Badge>
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

      {/* Create Underwriter Dialog */}
      <CreateUnderwriterDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
          fetchUnderwriters();
        }}
      />
    </div>
  );
}

