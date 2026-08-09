'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw } from 'lucide-react'
import {
  listMessagingDeliveries,
  type MessagingDelivery,
  type ListDeliveriesParams,
} from '@/lib/api'

interface MessagesListProps {
  /** Base path for detail links, e.g. /admin/messages or /dashboard/messages */
  basePath: string
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString()
  } catch {
    return dateStr
  }
}

function recipientDisplay(d: MessagingDelivery) {
  if (d.channel === 'SMS') return d.recipientPhone ?? '-'
  return d.recipientEmail ?? '-'
}

export function MessagesList({ basePath }: MessagesListProps) {
  const [deliveries, setDeliveries] = useState<MessagingDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [channel, setChannel] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [page] = useState(1)
  const pageSize = 20

  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params: ListDeliveriesParams = { page, pageSize }
      if (customerName.trim()) params.customerName = customerName.trim()
      if (recipientPhone.trim()) params.recipientPhone = recipientPhone.trim()
      if (channel && channel !== 'all') params.channel = channel as 'SMS' | 'EMAIL'
      if (status && status !== 'all') params.status = status

      const result = await listMessagingDeliveries(params)
      setDeliveries(result.data)
    } catch (err) {
      console.error('Error fetching deliveries:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch deliveries')
      setDeliveries([])
    } finally {
      setLoading(false)
    }
  }, [customerName, recipientPhone, channel, status, page])

  useEffect(() => {
    void fetchDeliveries()
  }, [fetchDeliveries])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="mt-1 text-sm text-gray-600">
          View message delivery history. Filter by customer name, phone, channel, or status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow down by customer name, phone, channel, or status</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Customer name</label>
            <Input
              placeholder="e.g. Jane Doe"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-64"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Phone number</label>
            <Input
              placeholder="e.g. 0722000000"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
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
                <SelectItem value="all">All</SelectItem>
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
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="RETRY_WAIT">Retry Wait</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={() => void fetchDeliveries()} variant="outline" disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery History</CardTitle>
          <CardDescription>
            Recipient, template, language, timestamps, status. View details or resend from the detail
            page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}
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
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
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
                    <TableCell>
                      {d.requestedLanguage} → {d.usedLanguage ?? '-'}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(d.createdAt)}</TableCell>
                    <TableCell
                      className="max-w-[200px] truncate text-xs text-red-600"
                      title={d.renderError ?? d.lastError ?? ''}
                    >
                      {d.renderError ?? d.lastError ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Button variant="link" size="sm" asChild>
                        <Link href={`${basePath}/${d.id}`}>View</Link>
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
  )
}
