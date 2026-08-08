'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { PlaceholderComposer } from '@/components/messaging/placeholder-composer'
import { CampaignPreviewPanel } from '@/components/messaging/campaign-preview-panel'
import { RichTextEmailEditor } from '@/components/messaging/rich-text-email-editor'
import {
  createMessagingCampaign,
  previewMessagingCampaign,
  type AudienceMode,
  type CampaignChannel,
  type CampaignPreviewResponse,
  type CampaignPreflightRow,
} from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

function rowsToCsv(rows: CampaignPreflightRow[]): string {
  const header = 'customerName,phone,email,customerId,error'
  const body = rows
    .map((r) =>
      [r.customerName, r.phone, r.email, r.customerId, r.error]
        .map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`)
        .join(',')
    )
    .join('\n')
  return `${header}\n${body}`
}

function downloadCsv(filename: string, rows: CampaignPreflightRow[]) {
  const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ComposeCampaignPage() {
  const router = useRouter()
  const { isAdmin, loading: authLoading } = useAuth()
  const [channel, setChannel] = useState<CampaignChannel>('SMS')
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('Hello {first_name}')
  const [smsBody, setSmsBody] = useState('Hi {first_name}')
  const [emailBody, setEmailBody] = useState('<p>Hi <strong>{first_name}</strong></p>')
  const [schemeIds, setSchemeIds] = useState('')
  const [packageIds, setPackageIds] = useState('')
  const [pasteList, setPasteList] = useState('')
  const [audienceMode, setAudienceMode] = useState<'scheme_customers' | 'scheme_contacts' | 'paste'>(
    'scheme_customers'
  )
  const [confirmationName, setConfirmationName] = useState('')
  const [preview, setPreview] = useState<CampaignPreviewResponse | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const body = channel === 'SMS' ? smsBody : emailBody

  const audience = useMemo(() => {
    const modes: AudienceMode[] =
      audienceMode === 'scheme_customers'
        ? ['SCHEME_CUSTOMERS']
        : audienceMode === 'scheme_contacts'
          ? ['SCHEME_CONTACTS']
          : ['PASTE_LIST']
    const schemeIdList = schemeIds
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
    const packageIdList = packageIds
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
    const paste = pasteList
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    return {
      modes,
      schemeIds: audienceMode === 'paste' ? undefined : schemeIdList,
      packageIds: audienceMode === 'scheme_customers' ? packageIdList : undefined,
      customerStatuses: audienceMode === 'scheme_customers' ? ['ACTIVE'] : undefined,
      policyStatuses: audienceMode === 'scheme_customers' ? ['ACTIVE'] : undefined,
      pasteList: audienceMode === 'paste' ? paste : undefined,
    }
  }, [audienceMode, schemeIds, packageIds, pasteList])

  const runPreview = async () => {
    try {
      setLoadingPreview(true)
      setError(null)
      const result = await previewMessagingCampaign({
        name,
        channel,
        subject: channel === 'EMAIL' ? subject : undefined,
        body,
        audience,
      })
      setPreview(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
      setPreview(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  const send = async () => {
    try {
      setSending(true)
      setError(null)
      const campaign = await createMessagingCampaign({
        name,
        channel,
        subject: channel === 'EMAIL' ? subject : undefined,
        body,
        audience,
        confirmationName: confirmationName || undefined,
      })
      router.push(`/admin/campaigns/${campaign.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  if (authLoading) {
    return <p className="text-sm text-gray-600">Loading…</p>
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Compose unavailable</h1>
        <p className="text-sm text-gray-600">Customer care can view campaign history only.</p>
        <Button asChild variant="outline">
          <Link href="/admin/campaigns">Back to history</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compose campaign</h1>
          <p className="text-sm text-gray-600">
            Admin shells only — ad hoc content is not saved as a reusable template. English only.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/campaigns">Back to history</Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      <Tabs
        value={channel}
        onValueChange={(v) => {
          setChannel(v as CampaignChannel)
          setPreview(null)
          if (v === 'EMAIL' && audienceMode === 'paste') {
            /* paste stays; SMS phones vs emails */
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="SMS">SMS</TabsTrigger>
          <TabsTrigger value="EMAIL">Email</TabsTrigger>
        </TabsList>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Compose</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Audience</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={audienceMode}
                  onChange={(e) =>
                    setAudienceMode(e.target.value as 'scheme_customers' | 'scheme_contacts' | 'paste')
                  }
                >
                  <option value="scheme_customers">Scheme customers</option>
                  <option value="scheme_contacts">Scheme contacts</option>
                  <option value="paste">
                    {channel === 'SMS' ? 'Pasted phone list' : 'Pasted email list'}
                  </option>
                </select>
              </div>

              {audienceMode !== 'paste' ? (
                <div className="space-y-2">
                  <Label htmlFor="schemes">Scheme IDs (comma-separated)</Label>
                  <Input
                    id="schemes"
                    value={schemeIds}
                    onChange={(e) => setSchemeIds(e.target.value)}
                    placeholder="e.g. 1"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="paste">
                    {channel === 'SMS' ? 'Phone numbers' : 'Email addresses'} (one per line)
                  </Label>
                  <Textarea
                    id="paste"
                    rows={4}
                    value={pasteList}
                    onChange={(e) => setPasteList(e.target.value)}
                  />
                </div>
              )}

              {audienceMode === 'scheme_customers' ? (
                <div className="space-y-2">
                  <Label htmlFor="packages">Package IDs (comma-separated)</Label>
                  <Input
                    id="packages"
                    value={packageIds}
                    onChange={(e) => setPackageIds(e.target.value)}
                    placeholder="e.g. 10"
                  />
                  <p className="text-xs text-gray-500">
                    Customer/policy status filters default to ACTIVE for this MVP compose form.
                  </p>
                </div>
              ) : null}

              <TabsContent value="SMS" className="mt-0 space-y-4">
                <PlaceholderComposer value={smsBody} onChange={setSmsBody} label="SMS body" />
                <div className="text-xs text-gray-500">{smsBody.length} characters</div>
              </TabsContent>

              <TabsContent value="EMAIL" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <RichTextEmailEditor value={emailBody} onChange={setEmailBody} label="Email body" />
                <PlaceholderComposer
                  value={emailBody}
                  onChange={setEmailBody}
                  label="Insert placeholders (updates HTML)"
                  rows={3}
                />
              </TabsContent>

              {preview?.largeAudienceWarning ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Warning: 5,000 or more sendable recipients. Review the audience carefully before
                  Send (this does not block sending).
                </p>
              ) : null}

              {preview?.requiresNameConfirmation ? (
                <div className="space-y-2">
                  <Label htmlFor="confirm">
                    Type the exact campaign name to confirm (required at ≥ confirm threshold)
                  </Label>
                  <Input
                    id="confirm"
                    value={confirmationName}
                    onChange={(e) => setConfirmationName(e.target.value)}
                    placeholder={name || 'Campaign name'}
                  />
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={runPreview}
                  disabled={loadingPreview || !name}
                >
                  {loadingPreview ? 'Previewing…' : 'Preview'}
                </Button>
                <Button type="button" onClick={send} disabled={sending || !name}>
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <CampaignPreviewPanel
                preview={preview}
                loading={loadingPreview}
                onDownloadErrorsCsv={
                  preview
                    ? () => downloadCsv('campaign-errors.csv', preview.blockingErrors)
                    : undefined
                }
                onDownloadSkipsCsv={
                  preview ? () => downloadCsv('campaign-skips.csv', preview.softSkips) : undefined
                }
              />
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </div>
  )
}
