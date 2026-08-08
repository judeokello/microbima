'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listMessagingCampaigns, type CampaignDetail } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

export default function CampaignsHistoryPage() {
  const { isAdmin } = useAuth()
  const [campaigns, setCampaigns] = useState<CampaignDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const result = await listMessagingCampaigns({ page: 1, pageSize: 50 })
      setCampaigns(result.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns')
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-600">Compose and track admin messaging campaigns.</p>
        </div>
        {isAdmin ? (
          <Button asChild>
            <Link href="/admin/campaigns/compose">Compose campaign</Link>
          </Button>
        ) : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>Newest first. Open a row for countdown, cancel, and CSVs.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {!loading && !error && campaigns.length === 0 ? (
            <p className="text-sm text-gray-500">No campaigns yet.</p>
          ) : null}
          {campaigns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Targeted</TableHead>
                  <TableHead>Handed off</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link className="text-blue-700 underline" href={`/admin/campaigns/${c.id}`}>
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>{c.channel}</TableCell>
                    <TableCell>{c.status}</TableCell>
                    <TableCell>{c.progress.targetedCount}</TableCell>
                    <TableCell>{c.progress.handedOffCount}</TableCell>
                    <TableCell>{new Date(c.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
