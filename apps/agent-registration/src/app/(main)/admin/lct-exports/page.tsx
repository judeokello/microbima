'use client'

import { useCallback, useEffect, useMemo, useState, Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  cancelLctBatch,
  createLctBatch,
  downloadLctBatch,
  getLctBatch,
  getLctBatches,
  getLctErrors,
  getLctPending,
  getLctRecipientConfig,
  sendLctBatch,
  type LctOpenBatch,
  type LctPendingGroup,
  type LctPendingRow,
} from '@/lib/api'
import { AlertTriangle, Download, Loader2, RefreshCw, UserPlus, ArrowRightLeft, UserCog, CircleAlert } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Tab = 'pending' | 'history' | 'errors'

const TABLE_HEAD_CLASS =
  'bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-700 border-b border-slate-200'

const REASON_LEGEND = [
  {
    key: 'NEW',
    label: 'New',
    description: 'Never sent to LCT (or first activation)',
    icon: <UserPlus className="h-3.5 w-3.5 text-emerald-600" aria-hidden />,
  },
  {
    key: 'STATUS_CHANGE',
    label: 'Status change',
    description: 'Policy status changed (e.g. active → suspended)',
    icon: <ArrowRightLeft className="h-3.5 w-3.5 text-amber-600" aria-hidden />,
  },
  {
    key: 'PROFILE_CHANGE',
    label: 'Profile change',
    description: 'Name, DOB, ID, phone, gender, or staff number changed',
    icon: <UserCog className="h-3.5 w-3.5 text-blue-600" aria-hidden />,
  },
  {
    key: 'DEPENDANT_REMOVED',
    label: 'Dependant removed',
    description: 'Spouse/child soft-deleted; send DEACTIVATE to LCT',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-hidden />,
  },
  {
    key: 'POLICY_REPLACED',
    label: 'Policy replaced',
    description: 'Product change with new member numbers',
    icon: <ArrowRightLeft className="h-3.5 w-3.5 text-purple-600" aria-hidden />,
  },
  {
    key: 'MISSING_INFO',
    label: 'Missing information',
    description: 'Required spouse/child fields incomplete — not selectable until care-ops updates the record',
    icon: <CircleAlert className="h-3.5 w-3.5 text-rose-600" aria-hidden />,
  },
] as const

function actionBadgeClass(action: string | null | undefined): string {
  switch (action) {
    case 'ACTIVATE':
      return 'border-emerald-300 bg-emerald-50 text-emerald-800'
    case 'SUSPENDED':
      return 'border-amber-300 bg-amber-50 text-amber-800'
    case 'DEACTIVATE':
      return 'border-red-300 bg-red-50 text-red-800'
    default:
      return ''
  }
}

function ReasonIcon({
  label,
  description,
  icon,
}: {
  label: string
  description: string
  icon: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex rounded p-0.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          aria-label={`${label}: ${description}`}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">{label}</p>
        <p className="text-xs opacity-90">{description}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function reasonIcons(reasons: string[]) {
  return (
    <TooltipProvider delayDuration={200}>
      <span className="inline-flex items-center gap-0.5">
        {REASON_LEGEND.filter((item) => reasons.includes(item.key)).map((item) => (
          <ReasonIcon
            key={item.key}
            label={item.label}
            description={item.description}
            icon={item.icon}
          />
        ))}
      </span>
    </TooltipProvider>
  )
}

function ReasonsLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <span className="font-medium text-slate-500 uppercase tracking-wide">Reasons</span>
      {REASON_LEGEND.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5" title={item.description}>
          {item.icon}
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  )
}

function rowCheckboxId(row: LctPendingRow) {
  return row.id
}

export default function LctExportsAdminPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<LctPendingGroup[]>([])
  const [openBatch, setOpenBatch] = useState<LctOpenBatch | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    name: '',
    idNumber: '',
    memberNumber: '',
    phone: '',
    product: '',
    scheme: '',
  })
  const [batches, setBatches] = useState<LctOpenBatch[]>([])
  const [errors, setErrors] = useState<Array<Record<string, unknown>>>([])
  const [batchDetail, setBatchDetail] = useState<Record<string, unknown> | null>(null)

  const [sendOpen, setSendOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [toEmails, setToEmails] = useState('')
  const [ccEmails, setCcEmails] = useState('')
  const [bccEmails, setBccEmails] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [subjectPreview, setSubjectPreview] = useState('Maisha Poa Customer Export - …')

  const loadPending = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getLctPending({
        name: filters.name || undefined,
        idNumber: filters.idNumber || undefined,
        memberNumber: filters.memberNumber || undefined,
        phone: filters.phone || undefined,
        product: filters.product || undefined,
        scheme: filters.scheme || undefined,
      })
      setGroups(res.data.groups)
      setOpenBatch(res.data.openBatch)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pending')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getLctBatches()
      setBatches(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadErrors = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getLctErrors()
      setErrors(res.data as Array<Record<string, unknown>>)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load errors')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'pending') void loadPending()
    if (tab === 'history') void loadHistory()
    if (tab === 'errors') void loadErrors()
  }, [tab, loadPending, loadHistory, loadErrors])

  const selectablePendingIds = useMemo(() => {
    const ids: string[] = []
    for (const g of groups) {
      if (g.principal && g.principal.exportEligible !== false) ids.push(g.principal.id)
      for (const d of g.dependants) {
        if (d.exportEligible !== false) ids.push(d.id)
      }
    }
    return ids
  }, [groups])

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(selectablePendingIds) : new Set())
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleExport = async () => {
    if (!selected.size) return
    setLoading(true)
    setError(null)
    try {
      await createLctBatch(Array.from(selected))
      setSelected(new Set())
      await loadPending()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  const openSendDialog = async () => {
    if (!openBatch) return
    try {
      const cfg = await getLctRecipientConfig()
      setToEmails((cfg.data.toEmails ?? []).join(', '))
      setCcEmails((cfg.data.ccEmails ?? []).join(', '))
      setBccEmails((cfg.data.bccEmails ?? []).join(', '))
      setBodyHtml(
        `<p>Dear LCT Africa,</p><p>Please find attached the Maisha Poa customer export file.</p><p>Customer count: <strong>${openBatch.rowCount}</strong></p>`
      )
      setSubjectPreview('Maisha Poa Customer Export - (set on send)')
      setSendOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recipients')
    }
  }

  const parseEmails = (raw: string) =>
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)

  const handleSend = async () => {
    if (!openBatch) return
    setSending(true)
    setError(null)
    try {
      await sendLctBatch(openBatch.id, {
        toEmails: parseEmails(toEmails),
        ccEmails: parseEmails(ccEmails),
        bccEmails: parseEmails(bccEmails),
        bodyHtml,
      })
      setSendOpen(false)
      await loadPending()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const handleCancel = async () => {
    if (!openBatch) return
    if (!confirm('Cancel this export batch and return members to pending?')) return
    setLoading(true)
    try {
      await cancelLctBatch(openBatch.id)
      await loadPending()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (batchId: string, filename?: string) => {
    try {
      const blob = await downloadLctBatch(batchId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename ?? 'lct_export.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    }
  }

  const renderRow = (row: LctPendingRow, indent = false) => {
    const incomplete = row.exportEligible === false
    const checkboxDisabled = !!openBatch || incomplete
    return (
      <tr
        key={row.id}
        className={`border-b text-sm ${incomplete ? 'bg-rose-50/60 text-muted-foreground' : ''}`}
      >
        <td className="p-2">
          <input
            type="checkbox"
            checked={selected.has(rowCheckboxId(row))}
            onChange={(e) => toggleOne(row.id, e.target.checked)}
            disabled={checkboxDisabled}
            title={incomplete ? 'Missing required information' : undefined}
          />
        </td>
        <td className={`p-2 whitespace-nowrap ${indent ? 'pl-8' : 'font-medium'}`}>{row.personName}</td>
        <td className="p-2 font-mono text-xs whitespace-nowrap">{row.memberNumber}</td>
        <td className="p-2 whitespace-nowrap">{row.relationship}</td>
        <td className="p-2 whitespace-nowrap">
          <Badge variant="outline" className={actionBadgeClass(row.pendingAction)}>
            {row.pendingAction}
          </Badge>
        </td>
        <td className="p-2 whitespace-nowrap">{reasonIcons(row.pendingReasons)}</td>
        <td className="p-2 text-muted-foreground">{row.schemeName || '—'}</td>
        <td className="p-2 text-muted-foreground">{row.productName}</td>
        <td className="p-2">
          <Link
            href={`/admin/customer/${row.customerId}`}
            className="text-blue-600 hover:underline text-xs"
          >
            View
          </Link>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">LCT Customer Export</h1>
          <p className="text-sm text-muted-foreground">
            Sync member changes to LCT Africa via CSV email
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          if (tab === 'pending') void loadPending()
          if (tab === 'history') void loadHistory()
          if (tab === 'errors') void loadErrors()
        }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex gap-2 border-b">
        {(['pending', 'history', 'errors'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px ${
              tab === t ? 'border-foreground font-medium' : 'border-transparent text-muted-foreground'
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {tab === 'pending' && (
        <>
          {openBatch && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center gap-3 justify-between">
              <div>
                <p className="font-medium">Open export batch</p>
                <p className="text-sm text-muted-foreground">
                  {openBatch.filename} · {openBatch.rowCount} rows ·{' '}
                  {new Date(openBatch.exportedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void openSendDialog()}>
                  Send
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleDownload(openBatch.id, openBatch.filename)}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button size="sm" variant="destructive" onClick={() => void handleCancel()}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ['name', 'Name'],
                ['idNumber', 'ID number'],
                ['memberNumber', 'Member #'],
                ['phone', 'Phone'],
                ['scheme', 'Scheme'],
                ['product', 'Product'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input
                  value={filters[key]}
                  onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
                  onBlur={() => void loadPending()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadPending()
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={
                  selectablePendingIds.length > 0 && selected.size === selectablePendingIds.length
                }
                onChange={(e) => toggleAll(e.target.checked)}
                disabled={!!openBatch || !selectablePendingIds.length}
              />
              Select all eligible ({selected.size})
            </label>
            <Button
              onClick={() => void handleExport()}
              disabled={!selected.size || !!openBatch || loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Export selected
            </Button>
          </div>

          <ReasonsLegend />

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-10" />
                <col className="w-[18%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[9%]" />
                <col className="w-[12%]" />
                <col />
                <col className="w-14" />
              </colgroup>
              <thead className={TABLE_HEAD_CLASS}>
                <tr>
                  <th className="p-2" />
                  <th className="p-2">Name</th>
                  <th className="p-2">Member #</th>
                  <th className="p-2">Relationship</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">Reasons</th>
                  <th className="p-2">Scheme</th>
                  <th className="p-2">Product</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {loading && !groups.length ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Loading…
                    </td>
                  </tr>
                ) : !groups.length ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">
                      No pending LCT changes
                    </td>
                  </tr>
                ) : (
                  groups.map((g) => (
                    <Fragment key={`${g.customerId}:${g.policyId}`}>
                      {g.principal && renderRow(g.principal)}
                      {g.dependants.map((d) => renderRow(d, true))}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className={TABLE_HEAD_CLASS}>
                <tr>
                  <th className="p-2">Exported</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Rows</th>
                  <th className="p-2">Filename</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b">
                    <td className="p-2">{new Date(b.exportedAt).toLocaleString()}</td>
                    <td className="p-2">
                      <Badge variant="outline">{b.status}</Badge>
                    </td>
                    <td className="p-2">{b.rowCount}</td>
                    <td className="p-2 font-mono text-xs">{b.filename}</td>
                    <td className="p-2 space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const res = await getLctBatch(b.id)
                          setBatchDetail(res.data)
                        }}
                      >
                        Detail
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleDownload(b.id, b.filename)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {batchDetail && (
            <div className="rounded-md border p-4 space-y-2">
              <div className="flex justify-between">
                <h3 className="font-medium">Batch detail</h3>
                <Button size="sm" variant="ghost" onClick={() => setBatchDetail(null)}>
                  Close
                </Button>
              </div>
              <pre className="text-xs overflow-auto max-h-96 bg-muted p-2 rounded">
                {JSON.stringify(batchDetail, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {tab === 'errors' && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <th className="p-2">Error</th>
                <th className="p-2">Member #</th>
                <th className="p-2">Customer</th>
                <th className="p-2">Product</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {!errors.length ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No LCT errors
                  </td>
                </tr>
              ) : (
                errors.map((row) => (
                  <tr key={String(row.id)} className="border-b">
                    <td className="p-2">
                      <Badge variant="destructive">{String(row.errorCode)}</Badge>
                    </td>
                    <td className="p-2 font-mono text-xs">{String(row.memberNumber)}</td>
                    <td className="p-2 font-mono text-xs">{String(row.customerId)}</td>
                    <td className="p-2">
                      {String((row.policy as { productName?: string } | undefined)?.productName ?? '—')}
                    </td>
                    <td className="p-2">
                      <Link
                        href={`/admin/customer/${String(row.customerId)}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Fix on customer
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send LCT export</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Subject (read-only)</Label>
              <Input value={subjectPreview} readOnly />
            </div>
            <div>
              <Label>To</Label>
              <Input value={toEmails} onChange={(e) => setToEmails(e.target.value)} />
            </div>
            <div>
              <Label>CC</Label>
              <Input value={ccEmails} onChange={(e) => setCcEmails(e.target.value)} />
            </div>
            <div>
              <Label>BCC</Label>
              <Input value={bccEmails} onChange={(e) => setBccEmails(e.target.value)} />
            </div>
            <div>
              <Label>Body (HTML)</Label>
              <Textarea rows={6} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
            </div>
            {openBatch && (
              <p className="text-sm text-muted-foreground">
                Attachment: {openBatch.filename} ({openBatch.rowCount} rows)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSend()} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
