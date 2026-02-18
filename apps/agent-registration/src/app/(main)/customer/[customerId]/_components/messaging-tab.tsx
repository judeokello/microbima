'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw } from 'lucide-react';
import {
  listMessagingDeliveries,
  resendMessagingDelivery,
  type MessagingDelivery,
} from '@/lib/api';

interface MessagingTabProps {
  customerId: string;
}

export default function MessagingTab({ customerId }: MessagingTabProps) {
  const [deliveries, setDeliveries] = useState<MessagingDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listMessagingDeliveries({
        customerId,
        page: 1,
        pageSize: 50,
      });
      setDeliveries(result.data);
    } catch (err) {
      console.error('Error fetching deliveries:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch deliveries');
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId) {
      fetchDeliveries();
    }
  }, [customerId, fetchDeliveries]);

  const handleResend = async (deliveryId: string) => {
    try {
      setResendingId(deliveryId);
      await resendMessagingDelivery(deliveryId);
      await fetchDeliveries();
    } catch (err) {
      console.error('Error resending:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend');
    } finally {
      setResendingId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const recipientDisplay = (d: MessagingDelivery) => {
    if (d.channel === 'SMS') return d.recipientPhone ?? '-';
    return d.recipientEmail ?? '-';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-600">Loading deliveries...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Message Deliveries</CardTitle>
          <CardDescription>
            SMS and email history for this customer. View details or resend from the messaging admin page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>
          )}
          {deliveries.length === 0 ? (
            <p className="text-gray-600 py-4">No message deliveries found for this customer.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{recipientDisplay(d)}</TableCell>
                    <TableCell>{d.templateKey}</TableCell>
                    <TableCell>{d.channel}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          d.status === 'SENT'
                            ? 'bg-green-100 text-green-800'
                            : d.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {d.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(d.createdAt)}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs text-red-600" title={d.renderError ?? d.lastError ?? ''}>
                      {d.renderError ?? d.lastError ?? '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="link" size="sm" asChild>
                          <Link href={`/admin/messages/${d.id}`}>View</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resendingId === d.id || d.status === 'PENDING' || d.status === 'PROCESSING'}
                          onClick={() => handleResend(d.id)}
                        >
                          <RefreshCw className={`h-3 w-3 mr-1 ${resendingId === d.id ? 'animate-spin' : ''}`} />
                          Resend
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
