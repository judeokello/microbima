'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { CampaignPreviewPanel } from '@/components/messaging/campaign-preview-panel'
import { RichTextEmailEditor } from '@/components/messaging/rich-text-email-editor'
import { EntityMultiSelect } from '@/components/messaging/entity-multi-select'
import { PlaceholderPillsPanel } from '@/components/messaging/placeholder-pills-panel'
import {
  createMessagingCampaign,
  getPackages,
  listSchemesForPicker,
  previewMessagingCampaign,
  type AudienceMode,
  type CampaignChannel,
  type CampaignPreviewResponse,
  type CampaignPreflightRow,
  type Package,
  type Scheme,
} from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { extractUsedPlaceholderKeys } from '@/lib/messaging/placeholder-catalog'
import { colorTokenForKey } from '@/components/messaging/placeholder-composer'
import { X } from 'lucide-react'

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

function UsedPlaceholderChips({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const usedKeys = extractUsedPlaceholderKeys(value)
  if (usedKeys.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {usedKeys.map((key, idx) => (
        <span
          key={`${key}-${idx}`}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${colorTokenForKey(key)}`}
        >
          {`{${key}}`}
          <button
            type="button"
            aria-label={`Remove ${key}`}
            onClick={() => onChange(value.replaceAll(`{${key}}`, ''))}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}

export default function ComposeCampaignPage() {
  const router = useRouter()
  const { isAdmin, loading: authLoading } = useAuth()
  const [channel, setChannel] = useState<CampaignChannel>('SMS')
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('Hello {first_name}')
  const [smsBody, setSmsBody] = useState('Hi {first_name}')
  const [emailBody, setEmailBody] = useState('<p>Hi <strong>{first_name}</strong></p>')
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<number[]>([])
  const [selectedPackageIds, setSelectedPackageIds] = useState<number[]>([])
  const [schemes, setSchemes] = useState<Scheme[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [entitiesLoading, setEntitiesLoading] = useState(true)
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setEntitiesLoading(true)
        const [schemeRows, packageRows] = await Promise.all([
          listSchemesForPicker(),
          getPackages({ includeInactive: true }),
        ])
        if (!cancelled) {
          setSchemes(schemeRows)
          setPackages(packageRows)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load schemes/packages')
        }
      } finally {
        if (!cancelled) setEntitiesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const schemeEntities = useMemo(
    () =>
      schemes.map((s) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive !== false,
      })),
    [schemes]
  )

  const packageEntities = useMemo(
    () =>
      packages.map((p) => ({
        id: p.id,
        name: p.name,
        isActive: p.isActive !== false,
      })),
    [packages]
  )

  const audience = useMemo(() => {
    const modes: AudienceMode[] =
      audienceMode === 'scheme_customers'
        ? ['SCHEME_CUSTOMERS']
        : audienceMode === 'scheme_contacts'
          ? ['SCHEME_CONTACTS']
          : ['PASTE_LIST']
    const paste = pasteList
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    return {
      modes,
      schemeIds: audienceMode === 'paste' ? undefined : selectedSchemeIds,
      packageIds: audienceMode === 'scheme_customers' ? selectedPackageIds : undefined,
      customerStatuses: audienceMode === 'scheme_customers' ? ['ACTIVE'] : undefined,
      policyStatuses: audienceMode === 'scheme_customers' ? ['ACTIVE'] : undefined,
      pasteList: audienceMode === 'paste' ? paste : undefined,
    }
  }, [audienceMode, selectedSchemeIds, selectedPackageIds, pasteList])

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
                <EntityMultiSelect
                  label="Schemes"
                  entities={schemeEntities}
                  selectedIds={selectedSchemeIds}
                  onChange={setSelectedSchemeIds}
                  loading={entitiesLoading}
                  placeholder="Search schemes…"
                />
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
                  <EntityMultiSelect
                    label="Packages"
                    entities={packageEntities}
                    selectedIds={selectedPackageIds}
                    onChange={setSelectedPackageIds}
                    loading={entitiesLoading}
                    placeholder="Search packages…"
                  />
                  <p className="text-xs text-gray-500">
                    Customer/policy status filters default to ACTIVE for this MVP compose form.
                    Inactive schemes/packages appear in the list but cannot be selected.
                  </p>
                </div>
              ) : null}

              <TabsContent value="SMS" className="mt-0 space-y-3">
                <Label htmlFor="sms-body">SMS body</Label>
                <UsedPlaceholderChips value={smsBody} onChange={setSmsBody} />
                <Textarea
                  id="sms-body"
                  rows={6}
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  placeholder="Compose SMS…"
                />
                <div className="text-xs text-gray-500">{smsBody.length} characters</div>
              </TabsContent>

              <TabsContent value="EMAIL" className="mt-0 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <UsedPlaceholderChips value={subject} onChange={setSubject} />
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <UsedPlaceholderChips value={emailBody} onChange={setEmailBody} />
                <RichTextEmailEditor value={emailBody} onChange={setEmailBody} label="Email body" />
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
                  onClick={() => void runPreview()}
                  disabled={loadingPreview || !name}
                >
                  {loadingPreview ? 'Previewing…' : 'Preview'}
                </Button>
                <Button type="button" onClick={() => void send()} disabled={sending || !name}>
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Preview</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[280px] overflow-y-auto">
                <CampaignPreviewPanel
                  preview={preview}
                  loading={loadingPreview}
                  onDownloadErrorsCsv={
                    preview
                      ? () => downloadCsv('campaign-errors.csv', preview.blockingErrors)
                      : undefined
                  }
                  onDownloadSkipsCsv={
                    preview
                      ? () => downloadCsv('campaign-skips.csv', preview.softSkips)
                      : undefined
                  }
                />
              </CardContent>
            </Card>

            <PlaceholderPillsPanel
              title={channel === 'SMS' ? 'Insert into SMS body' : 'Insert into email body'}
              value={channel === 'SMS' ? smsBody : emailBody}
              onChange={channel === 'SMS' ? setSmsBody : setEmailBody}
            />
          </div>
        </div>
      </Tabs>
    </div>
  )
}
