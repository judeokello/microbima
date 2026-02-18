'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw } from 'lucide-react';
import {
  listMessagingDeliveries,
  type MessagingDelivery,
  type ListDeliveriesParams,
} from '@/lib/api';

export default function AdminMessagesPage() {
  const [deliveries, setDeliveries] = useState<MessagingDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [channel, setChannel] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [page] = useState(1);
  const pageSize = 20;

  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: ListDeliveriesParams = {
        page,
        pageSize,
      };
      if (customerId.trim()) params.customerId = customerId.trim();
      if (policyId.trim()) params.policyId = policyId.trim();
      if (channel) params.channel = channel as 'SMS' | 'EMAIL';
      if (status) params.status = status;

      const result = await listMessagingDeliveries(params);
      setDeliveries(result.data);
    } catch (err) {
      console.error('Error fetching deliveries:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch deliveries');
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [customerId, policyId, channel, status, page]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const recipientDisplay = (d: MessagingDelivery) => {
    if (d.channel === 'SMS') return d.recipientPhone ?? '-';
    return d.recipientEmail ?? '-';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-sm text-gray-600 mt-1">
          View message delivery history. Filter by customer, policy, channel, or status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow down deliveries by customer, policy, channel, or status</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Customer ID</label>
            <Input
              placeholder="Customer UUID"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-64"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Policy ID</label>
            <Input
              placeholder="Policy UUID"
              value={policyId}
              onChange={(e) => setPolicyId(e.target.value)}
              className="w-64"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Channel</label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="SMS">SMS</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="RETRY_WAIT">Retry Wait</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={fetchDeliveries} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery History</CardTitle>
          <CardDescription>
            Recipient, template, language, timestamps, status. View details or resend from the detail page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>
          )}
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : deliveries.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No deliveries found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested / Used Lang</TableHead>
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
                              : d.status === 'PENDING' || d.status === 'PROCESSING'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {d.status}
                      </span>
                    </TableCell>
                    <TableCell>{d.requestedLanguage} → {d.usedLanguage ?? '-'}</TableCell>
                    <TableCell className="text-sm">{formatDate(d.createdAt)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-red-600" title={d.renderError ?? d.lastError ?? ''}>
                      {d.renderError ?? d.lastError ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Button variant="link" size="sm" asChild>
                        <Link href={`/admin/messages/${d.id}`}>View</Link>
                      </Button>
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
