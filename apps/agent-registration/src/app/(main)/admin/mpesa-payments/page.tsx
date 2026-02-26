'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface MpesaPaymentUpload {
  id: string;
  accountHolder: string;
  shortCode?: string;
  account?: string;
  timeFrom: string;
  timeTo: string;
  operator?: string;
  openingBalance?: number;
  closingBalance?: number;
  availableBalance?: number;
  totalPaidIn?: number;
  totalWithdrawn?: number;
  createdBy?: string;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface UploadsResponse {
  data: MpesaPaymentUpload[];
  pagination: PaginationInfo;
}

interface UserDisplayNameResponse {
  status: number;
  data: {
    userId: string;
    displayName: string;
    email: string;
  };
}

export default function MpesaPaymentsPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState<MpesaPaymentUpload[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processedByMap, setProcessedByMap] = useState<Map<string, string>>(new Map());

  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const fetchUploads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/mpesa-payments/uploads?${params}`, {
        headers: {
          'Authorization': `Bearer ${await getSupabaseToken()}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        // Try to parse error response body for detailed error message
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
          }
        } catch {
          // If parsing fails, use the status text
        }
        throw new Error(errorMessage);
      }

      const data: UploadsResponse = await response.json();
      setUploads(data.data);
      setPagination(data.pagination);

      // Fetch user display names for createdBy fields
      const userIds = [...new Set(data.data.map(u => u.createdBy).filter((id): id is string => id !== undefined && id !== null))];
      const token = await getSupabaseToken();
      const displayNamePromises = userIds.map(async (userId) => {
        try {
          const userResponse = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/users/${userId}/display-name`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              'X-Source-Page': typeof window !== 'undefined' ? window.location.pathname : '',
            }
          });
          if (userResponse.ok) {
            const userData: UserDisplayNameResponse = await userResponse.json();
            return [userId, userData.data.displayName] as [string, string];
          }
        } catch (err) {
          console.error(`Error fetching display name for user ${userId}:`, err);
        }
        return [userId, 'Unknown'] as [string, string];
      });

      const displayNames = await Promise.all(displayNamePromises);
      const newMap = new Map(displayNames);
      setProcessedByMap(newMap);
    } catch (err) {
      console.error('Error fetching uploads:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch uploads');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedExtensions = ['.xls', '.xlsx'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
      setError('Invalid file type. Only .xls and .xlsx files are allowed.');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/mpesa-payments/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getSupabaseToken()}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));

        // Extract error message from nested error structure if present
        let errorMessage = 'Failed to upload file';
        if (errorData.error) {
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (errorData.error.message) {
            errorMessage = errorData.error.message;
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }

        throw new Error(errorMessage);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh the list
      await fetchUploads();
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(value);
  };

  if (loading && uploads.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading MPESA payments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">MPESA Payments</h1>
          <p className="text-muted-foreground mt-2">
            Upload and manage MPESA payment statements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
            disabled={uploading}
            aria-label="Upload MPESA statement file"
            title="Upload MPESA statement file"
          />
          <Button
            onClick={() => {
              if (!uploading && fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
            disabled={uploading}
            type="button"
          >
            {uploading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Statement
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Uploads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Statement Uploads</CardTitle>
          <CardDescription>
            {pagination ? `${pagination.totalItems} total uploads` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No uploads found</p>
              <p className="text-sm text-muted-foreground mt-2">
                Click "Upload Statement" to upload your first MPESA payment statement
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Holder</TableHead>
                      <TableHead>PayBill</TableHead>
                      <TableHead>Time From</TableHead>
                      <TableHead>Time To</TableHead>
                      <TableHead>Operator</TableHead>
                      <TableHead>Opening Balance</TableHead>
                      <TableHead>Closing Balance</TableHead>
                      <TableHead>Available Balance</TableHead>
                      <TableHead>Total Paid In</TableHead>
                      <TableHead>Total Withdrawn</TableHead>
                      <TableHead>Processed By</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploads.map((upload) => (
                      <TableRow
                        key={upload.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => router.push(`/admin/mpesa-payments/${upload.id}`)}
                      >
                        <TableCell className="font-medium">
                          <span className="text-blue-600 hover:underline">{upload.accountHolder}</span>
                        </TableCell>
                        <TableCell>{upload.shortCode ?? '-'}</TableCell>
                        <TableCell>{formatDate(upload.timeFrom)}</TableCell>
                        <TableCell>{formatDate(upload.timeTo)}</TableCell>
                        <TableCell>{upload.operator ?? '-'}</TableCell>
                        <TableCell>{formatCurrency(upload.openingBalance)}</TableCell>
                        <TableCell>{formatCurrency(upload.closingBalance)}</TableCell>
                        <TableCell>{formatCurrency(upload.availableBalance)}</TableCell>
                        <TableCell>{formatCurrency(upload.totalPaidIn)}</TableCell>
                        <TableCell>{formatCurrency(upload.totalWithdrawn)}</TableCell>
                        <TableCell>
                          {upload.createdBy ? (processedByMap.get(upload.createdBy) ?? 'Unknown') : '-'}
                        </TableCell>
                        <TableCell>{formatDate(upload.createdAt)}</TableCell>
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
                    <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
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

