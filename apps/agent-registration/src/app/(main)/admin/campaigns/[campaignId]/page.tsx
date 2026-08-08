'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  cancelMessagingCampaign,
  downloadMessagingCampaignCsv,
  getMessagingCampaign,
  type CampaignDetail,
} from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

export default function CampaignDetailPage() {
  const { isAdmin } = useAuth()
  const params = useParams<{ campaignId: string }>()
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getMessagingCampaign(params.campaignId)
      setCampaign(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }, [params.campaignId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (campaign?.status !== 'DELAYED') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [campaign?.status])

  const remainingMs =
    campaign?.dispatchStartsAt != null
      ? Math.max(0, new Date(campaign.dispatchStartsAt).getTime() - now)
      : null

  const canCancel =
    isAdmin && (campaign?.status === 'DELAYED' || campaign?.status === 'DISPATCHING')

  const onCancel = async () => {
    if (!campaign) return
    try {
      setCancelling(true)
      const updated = await cancelMessagingCampaign(campaign.id)
      setCampaign(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setCancelling(false)
    }
  }

  const onDownload = async (kind: 'errors' | 'skips') => {
    if (!campaign) return
    try {
      const blob = await downloadMessagingCampaignCsv(campaign.id, kind)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `campaign-${campaign.id}-${kind}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to download ${kind}.csv`)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Campaign detail</h1>
        <Button asChild variant="outline">
          <Link href="/admin/campaigns">Back</Link>
        </Button>
      </div>
      {loading ? <p className="text-sm text-gray-600">Loading…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {campaign ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{campaign.name}</CardTitle>
            {canCancel ? (
              <Button variant="destructive" size="sm" disabled={cancelling} onClick={onCancel}>
                {cancelling ? 'Cancelling…' : 'Cancel campaign'}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-gray-500">Status:</span> {campaign.status}
            </p>
            <p>
              <span className="text-gray-500">Channel:</span> {campaign.channel}
            </p>
            <p>
              <span className="text-gray-500">Targeted:</span> {campaign.progress.targetedCount}
            </p>
            <p>
              <span className="text-gray-500">Handed off:</span> {campaign.progress.handedOffCount}
            </p>
            <p>
              <span className="text-gray-500">Receipt confirmed:</span>{' '}
              {campaign.progress.receiptConfirmedCount}
              {campaign.channel === 'EMAIL' ? (
                <span className="text-xs text-gray-400"> (may stay 0 without email receipts)</span>
              ) : null}
            </p>
            {remainingMs != null && campaign.status === 'DELAYED' ? (
              <p className="rounded bg-amber-50 px-3 py-2 text-amber-900">
                Dispatch in ~{Math.ceil(remainingMs / 1000)}s
              </p>
            ) : null}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onDownload('errors')}>
                Errors CSV
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onDownload('skips')}>
                Skips CSV
              </Button>
            </div>
            {campaign.subjectWithPlaceholders ? (
              <p className="font-medium">{campaign.subjectWithPlaceholders}</p>
            ) : null}
            <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs">
              {campaign.bodyWithPlaceholders}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
