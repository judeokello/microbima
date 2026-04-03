'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  getCustomerPolicies,
  getCustomerPayments,
  getCustomerPolicyDetail,
  PolicyOption,
  Payment,
  PaymentFilter,
  type CustomerPolicyDetail,
} from '@/lib/api';
import * as Sentry from '@sentry/nextjs';
import RequestPaymentDialog from './request-payment-dialog';

/** Premium period in days per year; used to calculate number of installments. */
const PREMIUM_DAYS_PER_YEAR = 276;

function numberOfInstallments(paymentCadenceDays: number): number {
  if (paymentCadenceDays <= 0) return 0;
  return Math.round(PREMIUM_DAYS_PER_YEAR / paymentCadenceDays);
}

interface PaymentsTabProps {
  customerId: string;
  customerPhone?: string;
}

export default function PaymentsTab({ customerId, customerPhone = '' }: PaymentsTabProps) {
  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [policyDetail, setPolicyDetail] = useState<CustomerPolicyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRanForPolicyId, setFilterRanForPolicyId] = useState<string | null>(null);
  const [requestPaymentOpen, setRequestPaymentOpen] = useState(false);

  useEffect(() => {
    if (customerId) {
      loadPolicies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    setPolicyDetail(null);
    setPayments([]);
    setFilterRanForPolicyId(null);
    setRequestPaymentOpen(false);
  }, [selectedPolicyId]);

  const loadPolicies = async () => {
    try {
      setPoliciesLoading(true);
      const response = await getCustomerPolicies(customerId);
      setPolicies(response.data);
    } catch (err) {
      console.error('Error loading policies:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'PaymentsTab',
            action: 'load_policies',
          },
          extra: {
            customerId,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to load policies');
    } finally {
      setPoliciesLoading(false);
    }
  };

  const handleFilter = async () => {
    if (!selectedPolicyId) {
      setError('Please select a policy');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const filters: PaymentFilter = {
        policyId: selectedPolicyId,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      };

      const [paymentsRes, policyDetailRes] = await Promise.all([
        getCustomerPayments(customerId, filters),
        getCustomerPolicyDetail(customerId, selectedPolicyId).catch((e) => {
          console.error('Error loading policy detail:', e);
          return null;
        }),
      ]);

      setPayments(paymentsRes.data);
      setPolicyDetail(policyDetailRes?.data ?? null);
      setFilterRanForPolicyId(selectedPolicyId);
    } catch (err) {
      console.error('Error loading payments:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'PaymentsTab',
            action: 'load_payments',
          },
          extra: {
            customerId,
            filter: {
              policyId: selectedPolicyId,
              fromDate,
              toDate,
            },
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to load payments');
      setPayments([]);
      setPolicyDetail(null);
      setFilterRanForPolicyId(null);
    } finally {
      setLoading(false);
    }
  };

  const refetchPaymentsForFilter = useCallback(async () => {
    if (!selectedPolicyId) return;
    const filters: PaymentFilter = {
      policyId: selectedPolicyId,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    };
    const paymentsRes = await getCustomerPayments(customerId, filters);
    setPayments(paymentsRes.data);
  }, [customerId, selectedPolicyId, fromDate, toDate]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateOnly = (dateString: string | null) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  const formatCurrencyFromString = (value: string) => {
    const n = parseFloat(value);
    if (Number.isNaN(n)) return value;
    return formatCurrency(n);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
        <CardDescription>View payment records for this customer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!policiesLoading && policies.length === 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No policies are linked to this customer. Contact an administrator if this is unexpected.
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="policy">Package - Plan *</Label>
            <Select
              value={selectedPolicyId}
              onValueChange={setSelectedPolicyId}
              disabled={policiesLoading}
            >
              <SelectTrigger id="policy">
                <SelectValue placeholder="Select policy" />
              </SelectTrigger>
              <SelectContent>
                {policies.map((policy) => (
                  <SelectItem key={policy.id} value={policy.id}>
                    {policy.displayText}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <div className="flex items-end">
            <Button onClick={handleFilter} disabled={loading || !selectedPolicyId} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Filter
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {filterRanForPolicyId === selectedPolicyId &&
          !!selectedPolicyId &&
          !loading &&
          !policyDetail && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Policy details could not be loaded for this selection. Contact an administrator; in-app recovery is not
              available.
            </div>
          )}

        {filterRanForPolicyId === selectedPolicyId && policyDetail?.schemeBillingMode === 'postpaid' && (
          <div className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
            This policy is <strong>postpaid</strong>. On-demand STK is not available; use your postpaid collection process.
          </div>
        )}

        {filterRanForPolicyId === selectedPolicyId &&
          policyDetail?.schemeBillingMode === 'prepaid' &&
          parseFloat(policyDetail.installmentAmount) > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setRequestPaymentOpen(true)}>
                Request payment
              </Button>
            </div>
          )}

        <RequestPaymentDialog
          open={requestPaymentOpen}
          onOpenChange={setRequestPaymentOpen}
          customerId={customerId}
          policyId={selectedPolicyId}
          policyFilterKey={selectedPolicyId}
          policyDetail={policyDetail}
          defaultPhone={customerPhone}
          onPaymentsRefresh={refetchPaymentsForFilter}
        />

        {/* Policy summary card – shown when a policy is selected and results are loaded */}
        {policyDetail && (
          <Card>
            <CardHeader>
              <CardTitle>Policy summary</CardTitle>
              <CardDescription>Payment and enrollment details for the selected policy</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Frequency</dt>
                  <dd className="mt-1 text-sm">{policyDetail.enrollment.frequency ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Installment amount</dt>
                  <dd className="mt-1 text-sm">
                    {formatCurrencyFromString(policyDetail.installmentAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Category / plan</dt>
                  <dd className="mt-1 text-sm flex flex-wrap items-center gap-2">
                    <span>{policyDetail.product.planName ?? '—'}</span>
                    <Badge variant="outline" className="text-xs font-normal shrink-0">
                      {policyDetail.schemeBillingMode === 'postpaid' ? 'Postpaid' : 'Prepaid'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">No. of installments</dt>
                  <dd className="mt-1 text-sm">
                    {numberOfInstallments(policyDetail.enrollment.paymentCadence)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Annual premium</dt>
                  <dd className="mt-1 text-sm">
                    {formatCurrencyFromString(policyDetail.totalPremium)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Total premium paid</dt>
                  <dd className="mt-1 text-sm">
                    {formatCurrencyFromString(policyDetail.totalPaidToDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Missed payments (total amount missed)</dt>
                  <dd className="mt-1 text-sm">N/A</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Policy start date</dt>
                  <dd className="mt-1 text-sm">
                    {formatDateOnly(policyDetail.enrollment.startDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Policy end date</dt>
                  <dd className="mt-1 text-sm">
                    {formatDateOnly(policyDetail.enrollment.endDate)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Payments Table */}
        {payments.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Type</TableHead>
                  <TableHead>Transaction Reference</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expected Payment Date</TableHead>
                  <TableHead>Actual Payment Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.paymentType}</TableCell>
                    <TableCell>{payment.transactionReference}</TableCell>
                    <TableCell>{payment.accountNumber ?? 'N/A'}</TableCell>
                    <TableCell>{payment.paymentStatus ?? '—'}</TableCell>
                    <TableCell>{formatDate(payment.expectedPaymentDate)}</TableCell>
                    <TableCell>
                      {payment.actualPaymentDate ? formatDate(payment.actualPaymentDate) : 'Pending'}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {payments.length === 0 && !loading && selectedPolicyId && (
          <div className="text-center py-8 text-gray-500">
            No payments found for the selected filters
          </div>
        )}

        {!selectedPolicyId && !loading && (
          <div className="text-center py-8 text-gray-500">
            Please select a policy and click Filter to view payments
          </div>
        )}
      </CardContent>
    </Card>
  );
}
