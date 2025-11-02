'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { getCustomerPolicies, getCustomerPayments, PolicyOption, Payment, PaymentFilter } from '@/lib/api';

interface PaymentsTabProps {
  customerId: string;
}

export default function PaymentsTab({ customerId }: PaymentsTabProps) {
  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerId) {
      loadPolicies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const loadPolicies = async () => {
    try {
      setPoliciesLoading(true);
      const response = await getCustomerPolicies(customerId);
      setPolicies(response.data);
    } catch (err) {
      console.error('Error loading policies:', err);
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

      const response = await getCustomerPayments(customerId, filters);
      setPayments(response.data);
    } catch (err) {
      console.error('Error loading payments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load payments');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
        <CardDescription>View payment records for this customer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Payments Table */}
        {payments.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Type</TableHead>
                  <TableHead>Transaction Reference</TableHead>
                  <TableHead>Account Number</TableHead>
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
