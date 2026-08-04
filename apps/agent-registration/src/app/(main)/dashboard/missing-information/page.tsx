'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getCareOpsMissingQueue,
  updateDependant,
  updateBeneficiary,
  type CareOpsQueueItem,
} from '@/lib/api'
import { Download, Loader2, RefreshCw } from 'lucide-react'

type EditForm = {
  firstName: string
  middleName: string
  lastName: string
  gender: string
  idType: string
  idNumber: string
  dateOfBirth: string
}

function toCsv(items: CareOpsQueueItem[]): string {
  const headers = [
    'Customer',
    'Customer phone',
    'Entity kind',
    'Entity name',
    'Missing fields',
    'First name',
    'Last name',
    'Gender',
    'ID type',
    'ID number',
    'Date of birth',
  ]
  const escape = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const rows = items.map((item) =>
    [
      item.customerName,
      item.customerPhone ?? '',
      item.entityKind,
      item.entityName,
      item.missingFieldLabels.join('; '),
      item.firstName ?? '',
      item.lastName ?? '',
      item.gender ?? '',
      item.idType ?? '',
      item.idNumber ?? '',
      item.dateOfBirth ?? '',
    ]
      .map((c) => escape(String(c)))
      .join(',')
  )
  return [headers.join(','), ...rows].join('\n') + '\n'
}

export default function MissingInformationPage() {
  const { isCustomerCare, isRegistrationAdmin, loading: authLoading } = useAuth()
  const canAccess = isCustomerCare || isRegistrationAdmin

  const [items, setItems] = useState<CareOpsQueueItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<CareOpsQueueItem | null>(null)
  const [form, setForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getCareOpsMissingQueue({ limit: 100, offset: 0 })
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && canAccess) void load()
  }, [authLoading, canAccess, load])

  const openEdit = (item: CareOpsQueueItem) => {
    setEditItem(item)
    setForm({
      firstName: item.firstName ?? '',
      middleName: item.middleName ?? '',
      lastName: item.lastName ?? '',
      gender: (item.gender ?? '').toLowerCase() === 'female' ? 'female' : (item.gender ?? '').toLowerCase() === 'male' ? 'male' : '',
      idType: item.idType ?? 'NATIONAL_ID',
      idNumber: item.idNumber ?? '',
      dateOfBirth: item.dateOfBirth ?? '',
    })
  }

  const mapIdTypeToApi = (idType?: string): string | undefined => {
    if (!idType) return undefined
    const mapping: Record<string, string> = {
      NATIONAL_ID: 'national',
      PASSPORT: 'passport',
      ALIEN: 'alien',
      BIRTH_CERTIFICATE: 'birth_certificate',
      MILITARY: 'military',
    }
    return mapping[idType] ?? idType.toLowerCase()
  }

  const handleSave = async () => {
    if (!editItem?.entityId || !form) return
    setSaving(true)
    setError(null)
    try {
      if (editItem.entityKind === 'BENEFICIARY') {
        await updateBeneficiary(editItem.customerId, editItem.entityId, {
          firstName: form.firstName || undefined,
          middleName: form.middleName || undefined,
          lastName: form.lastName || undefined,
          idType: mapIdTypeToApi(form.idType),
          idNumber: form.idNumber || undefined,
          gender: form.gender || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
        })
      } else {
        await updateDependant(editItem.entityId, {
          firstName: form.firstName || undefined,
          middleName: form.middleName || undefined,
          lastName: form.lastName || undefined,
          gender: form.gender || undefined,
          idType: mapIdTypeToApi(form.idType),
          idNumber: form.idNumber || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
        })
      }
      setEditItem(null)
      setForm(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const downloadCsv = () => {
    const blob = new Blob([toCsv(items)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `missing-information-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const requiredHint = useMemo(() => {
    if (!editItem) return ''
    return editItem.missingFieldLabels.join(', ')
  }, [editItem])

  if (authLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">
          Only Customer Care and Registration Admin can access missing information.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Missing Information</h1>
          <p className="text-sm text-muted-foreground">
            Care-ops queue for deferred spouse, child, and beneficiary fields. Completing these
            unlocks LCT export eligibility.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!items.length}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Showing {items.length} incomplete entit{items.length === 1 ? 'y' : 'ies'}
        {total ? ` across ${total} customer(s)` : ''}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Missing</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No missing information right now
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={`${item.customerId}:${item.entityKind}:${item.entityId}`}>
                    <TableCell>
                      <Link
                        href={`/dashboard/customer/${item.customerId}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {item.customerName}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{item.customerPhone ?? '—'}</TableCell>
                    <TableCell>{item.entityName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.entityKind}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{item.missingFieldLabels.join(', ')}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!item.entityId}
                        onClick={() => openEdit(item)}
                      >
                        Update
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!editItem}
        onOpenChange={(open) => {
          if (!open) {
            setEditItem(null)
            setForm(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Update {editItem?.entityKind.toLowerCase()} — {editItem?.entityName}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <p className="text-xs text-muted-foreground">Required: {requiredHint}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">First name</Label>
                  <Input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Last name</Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Middle name</Label>
                <Input
                  value={form.middleName}
                  onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                />
              </div>
              {(editItem?.entityKind === 'SPOUSE' ||
                editItem?.entityKind === 'CHILD' ||
                editItem?.missingFields.includes('gender')) && (
                <div>
                  <Label className="text-xs">Gender</Label>
                  <Select
                    value={form.gender || undefined}
                    onValueChange={(v) => setForm({ ...form, gender: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(editItem?.entityKind === 'SPOUSE' ||
                editItem?.entityKind === 'CHILD' ||
                editItem?.missingFields.includes('dateOfBirth')) && (
                <div>
                  <Label className="text-xs">Date of birth</Label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  />
                </div>
              )}
              {(editItem?.entityKind === 'SPOUSE' ||
                editItem?.entityKind === 'BENEFICIARY' ||
                editItem?.missingFields.includes('idNumber')) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">ID type</Label>
                    <Select
                      value={form.idType || 'NATIONAL_ID'}
                      onValueChange={(v) => setForm({ ...form, idType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NATIONAL_ID">National ID</SelectItem>
                        <SelectItem value="PASSPORT">Passport</SelectItem>
                        <SelectItem value="ALIEN">Alien</SelectItem>
                        <SelectItem value="BIRTH_CERTIFICATE">Birth certificate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">ID number</Label>
                    <Input
                      value={form.idNumber}
                      onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || !form}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
