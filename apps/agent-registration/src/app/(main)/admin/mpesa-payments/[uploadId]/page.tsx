'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, RefreshCw } from 'lucide-react';
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
  filePath?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface MpesaPaymentItem {
  id: string;
  transactionReference: string;
  completionTime: string;
  initiationTime: string;
  paymentDetails?: string;
  transactionStatus?: string;
  paidIn: number;
  withdrawn: number;
  accountBalance: number;
  balanceConfirmed?: string;
  reasonType: string;
  otherPartyInfo?: string;
  linkedTransactionId?: string;
  accountNumber?: string;
  isProcessed: boolean;
  isMapped: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UploadDetailsResponse {
  upload: MpesaPaymentUpload;
  items: MpesaPaymentItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export default function MpesaPaymentDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const uploadId = params.uploadId as string;

  const [upload, setUpload] = useState<MpesaPaymentUpload | null>(null);
  const [items, setItems] = useState<MpesaPaymentItem[]>([]);
  const [pagination, setPagination] = useState<UploadDetailsResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const fetchUploadDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/mpesa-payments/uploads/${uploadId}?${params}`, {
        headers: {
          'Authorization': `Bearer ${await getSupabaseToken()}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: UploadDetailsResponse = await response.json();
      setUpload(data.upload);
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching upload details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch upload details');
    } finally {
      setLoading(false);
    }
  }, [uploadId, currentPage, pageSize]);

  useEffect(() => {
    if (uploadId) {
      fetchUploadDetails();
    }
  }, [uploadId, fetchUploadDetails]);

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(value);
  };

  if (loading && !upload) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading upload details...</span>
      </div>
    );
  }

  if (error && !upload) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/admin/mpesa-payments')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push('/admin/mpesa-payments')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">MPESA Payment Details</h1>
            <p className="text-muted-foreground mt-2">
              Transaction details for uploaded statement
            </p>
          </div>
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

      {/* Upload Metadata */}
      {upload && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Information</CardTitle>
            <CardDescription>Details of the uploaded MPESA statement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Account Holder</p>
                <p className="text-sm font-semibold">{upload.accountHolder}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Short Code</p>
                <p className="text-sm font-semibold">{upload.shortCode ?? '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Account</p>
                <p className="text-sm font-semibold">{upload.account ?? '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Operator</p>
                <p className="text-sm font-semibold">{upload.operator ?? '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Time From</p>
                <p className="text-sm font-semibold">{formatDate(upload.timeFrom)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Time To</p>
                <p className="text-sm font-semibold">{formatDate(upload.timeTo)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Opening Balance</p>
                <p className="text-sm font-semibold">
                  {upload.openingBalance ? formatCurrency(upload.openingBalance) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Closing Balance</p>
                <p className="text-sm font-semibold">
                  {upload.closingBalance ? formatCurrency(upload.closingBalance) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Available Balance</p>
                <p className="text-sm font-semibold">
                  {upload.availableBalance ? formatCurrency(upload.availableBalance) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Paid In</p>
                <p className="text-sm font-semibold">
                  {upload.totalPaidIn ? formatCurrency(upload.totalPaidIn) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Withdrawn</p>
                <p className="text-sm font-semibold">
                  {upload.totalWithdrawn ? formatCurrency(upload.totalWithdrawn) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Uploaded At</p>
                <p className="text-sm font-semibold">{formatDate(upload.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Items */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Items</CardTitle>
          <CardDescription>
            {pagination ? `${pagination.totalItems} total transactions` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt No.</TableHead>
                      <TableHead>Completion Time</TableHead>
                      <TableHead>Initiation Time</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid In</TableHead>
                      <TableHead>Withdrawn</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Balance Confirmed</TableHead>
                      <TableHead>Reason Type</TableHead>
                      <TableHead>Other Party Info</TableHead>
                      <TableHead>Linked Transaction ID</TableHead>
                      <TableHead>A/C No.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.transactionReference}</TableCell>
                        <TableCell>{formatDate(item.completionTime)}</TableCell>
                        <TableCell>{formatDate(item.initiationTime)}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.paymentDetails ?? '-'}</TableCell>
                        <TableCell>{item.transactionStatus ?? '-'}</TableCell>
                        <TableCell>{formatCurrency(item.paidIn)}</TableCell>
                        <TableCell>{formatCurrency(item.withdrawn)}</TableCell>
                        <TableCell>{formatCurrency(item.accountBalance)}</TableCell>
                        <TableCell>{item.balanceConfirmed ?? '-'}</TableCell>
                        <TableCell>{item.reasonType}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.otherPartyInfo ?? '-'}</TableCell>
                        <TableCell>{item.linkedTransactionId ?? '-'}</TableCell>
                        <TableCell>{item.accountNumber ?? '-'}</TableCell>
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

