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
import { Checkbox } from '@/components/ui/checkbox'
import { CampaignPreviewPanel } from '@/components/messaging/campaign-preview-panel'
import { RichTextEmailEditor } from '@/components/messaging/rich-text-email-editor'
import { EntityMultiSelect } from '@/components/messaging/entity-multi-select'
import { PlaceholderPillsPanel } from '@/components/messaging/placeholder-pills-panel'
import {
  createMessagingCampaign,
  getPackages,
  listPackagesForSchemes,
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
import {
  extractUsedPlaceholderKeys,
  removePlaceholderOccurrence,
} from '@/lib/messaging/placeholder-catalog'
import { colorTokenForKey } from '@/components/messaging/placeholder-composer'
import { X } from 'lucide-react'

const POLICY_STATUSES = [
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUSPENDED',
  'INACTIVE',
  'DEACTIVATED',
  'TERMINATED',
  'EXPIRED',
] as const

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
      {usedKeys.map((key, idx) => {
        const occurrenceIndex = usedKeys.slice(0, idx + 1).filter((k) => k === key).length - 1
        return (
          <span
            key={`${key}-${idx}`}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${colorTokenForKey(key)}`}
          >
            {`{${key}}`}
            <button
              type="button"
              aria-label={`Remove ${key}`}
              onClick={() => onChange(removePlaceholderOccurrence(value, key, occurrenceIndex))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}

function countValidPasteLines(pasteList: string, channel: CampaignChannel): number {
  const lines = pasteList
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (channel === 'EMAIL') {
    return lines.filter((line) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line.toLowerCase())).length
  }
  // National or international Kenyan phone shapes (preview does full normalize).
  return lines.filter((line) => {
    const digits = line.replace(/\D/g, '')
    return (
      /^07\d{8}$/.test(digits) ||
      /^2547\d{8}$/.test(digits) ||
      /^7\d{8}$/.test(digits) ||
      /^\+2547\d{8}$/.test(line.replace(/\s/g, ''))
    )
  }).length
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
  const [policyStatuses, setPolicyStatuses] = useState<string[]>(['ACTIVE'])
  const [schemes, setSchemes] = useState<Scheme[]>([])
  const [allPackages, setAllPackages] = useState<Package[]>([])
  const [linkedPackages, setLinkedPackages] = useState<Package[]>([])
  const [entitiesLoading, setEntitiesLoading] = useState(true)
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [pasteList, setPasteList] = useState('')
  const [audienceMode, setAudienceMode] = useState<'scheme_customers' | 'scheme_contacts' | 'paste'>(
    'scheme_customers'
  )
  const [confirmationName, setConfirmationName] = useState('')
  const [preview, setPreview] = useState<CampaignPreviewResponse | null>(null)
  const [liveSendableCount, setLiveSendableCount] = useState<number | null>(null)
  const [liveSchemeCounts, setLiveSchemeCounts] = useState<Record<number, number>>({})
  const [livePackageCounts, setLivePackageCounts] = useState<Record<number, number>>({})
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
          setAllPackages(packageRows)
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

  // When schemes change: clear packages, load linked packages, auto-select active ones.
  useEffect(() => {
    if (audienceMode !== 'scheme_customers') return
    let cancelled = false
    ;(async () => {
      if (selectedSchemeIds.length === 0) {
        setLinkedPackages([])
        return
      }
      try {
        setPackagesLoading(true)
        const rows = await listPackagesForSchemes(selectedSchemeIds)
        if (cancelled) return
        setLinkedPackages(rows)
        setSelectedPackageIds(rows.filter((p) => p.isActive !== false).map((p) => p.id))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load packages for schemes')
        }
      } finally {
        if (!cancelled) setPackagesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedSchemeIds, audienceMode])

  const schemeEntities = useMemo(
    () =>
      schemes.map((s) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive !== false,
      })),
    [schemes]
  )

  const packageEntities = useMemo(() => {
    const source = selectedSchemeIds.length > 0 ? linkedPackages : allPackages
    return source.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: p.isActive !== false,
    }))
  }, [selectedSchemeIds.length, linkedPackages, allPackages])

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
      policyStatuses: audienceMode === 'scheme_customers' ? policyStatuses : undefined,
      pasteList: audienceMode === 'paste' ? paste : undefined,
    }
  }, [audienceMode, selectedSchemeIds, selectedPackageIds, policyStatuses, pasteList])

  const canLiveCount = useMemo(() => {
    if (!name.trim()) return false
    if (channel === 'SMS' && !smsBody.trim()) return false
    if (channel === 'EMAIL' && (!subject.trim() || !emailBody.trim())) return false
    if (audienceMode === 'scheme_customers') {
      return (
        (selectedSchemeIds.length > 0 || selectedPackageIds.length > 0) &&
        policyStatuses.length > 0
      )
    }
    if (audienceMode === 'scheme_contacts') return selectedSchemeIds.length > 0
    return pasteList.trim().length > 0
  }, [
    name,
    channel,
    smsBody,
    subject,
    emailBody,
    audienceMode,
    selectedSchemeIds,
    selectedPackageIds,
    policyStatuses,
    pasteList,
  ])

  // Debounced live sendable count (same rules as Preview).
  useEffect(() => {
    if (!canLiveCount) {
      setLiveSendableCount(null)
      setLiveSchemeCounts({})
      setLivePackageCounts({})
      return
    }
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await previewMessagingCampaign({
            name,
            channel,
            subject: channel === 'EMAIL' ? subject : undefined,
            body,
            audience,
          })
          setLiveSendableCount(result.sendableCount)
          const schemeMap: Record<number, number> = {}
          for (const row of result.perSchemeCounts ?? []) {
            schemeMap[row.schemeId] = row.recipientCount
          }
          setLiveSchemeCounts(schemeMap)
          const packageMap: Record<number, number> = {}
          for (const row of result.perPackageCounts ?? []) {
            packageMap[row.packageId] = row.recipientCount
          }
          setLivePackageCounts(packageMap)
        } catch {
          // Live count is best-effort; explicit Preview still shows errors.
        }
      })()
    }, 450)
    return () => window.clearTimeout(handle)
  }, [canLiveCount, name, channel, subject, body, audience])

  const pasteValidCount = useMemo(
    () => (audienceMode === 'paste' ? countValidPasteLines(pasteList, channel) : null),
    [audienceMode, pasteList, channel]
  )

  const togglePolicyStatus = (status: string, checked: boolean) => {
    setPolicyStatuses((prev) => {
      if (checked) return prev.includes(status) ? prev : [...prev, status]
      return prev.filter((s) => s !== status)
    })
  }

  const onSchemesChange = (ids: number[]) => {
    setSelectedSchemeIds(ids)
    setSelectedPackageIds([])
  }

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
      setLiveSendableCount(result.sendableCount)
      const schemeMap: Record<number, number> = {}
      for (const row of result.perSchemeCounts ?? []) {
        schemeMap[row.schemeId] = row.recipientCount
      }
      setLiveSchemeCounts(schemeMap)
      const packageMap: Record<number, number> = {}
      for (const row of result.perPackageCounts ?? []) {
        packageMap[row.packageId] = row.recipientCount
      }
      setLivePackageCounts(packageMap)
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
                  onChange={onSchemesChange}
                  loading={entitiesLoading}
                  placeholder="Search schemes…"
                  countsById={liveSchemeCounts}
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
                  {pasteValidCount != null ? (
                    <p className="text-xs text-gray-500">{pasteValidCount} valid addresses</p>
                  ) : null}
                </div>
              )}

              {audienceMode === 'scheme_customers' ? (
                <>
                  <EntityMultiSelect
                    label="Packages"
                    entities={packageEntities}
                    selectedIds={selectedPackageIds}
                    onChange={setSelectedPackageIds}
                    loading={entitiesLoading || packagesLoading}
                    placeholder={
                      selectedSchemeIds.length > 0
                        ? 'Packages linked to selected schemes…'
                        : 'Search packages…'
                    }
                    countsById={livePackageCounts}
                  />
                  <div className="space-y-2">
                    <Label>Policy status</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {POLICY_STATUSES.map((status) => {
                        const checked = policyStatuses.includes(status)
                        return (
                          <label
                            key={status}
                            className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs text-gray-800"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => togglePolicyStatus(status, v === true)}
                            />
                            <span className="truncate">{status.replaceAll('_', ' ')}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </>
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

              <div className="space-y-2">
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
                <p className="text-sm text-gray-600">
                  Sendable recipients:{' '}
                  <span className="font-medium text-gray-900">
                    {liveSendableCount == null ? '—' : liveSendableCount.toLocaleString()}
                  </span>
                </p>
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
