'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  listMessagingTemplates,
  updateMessagingTemplate,
  type MessagingTemplateRow,
} from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { PlaceholderPillsPanel } from '@/components/messaging/placeholder-pills-panel'
import {
  isTemplateDraftDirty,
  type TemplateDraftFields,
} from '@/lib/messaging/template-draft'

function truncate(text: string | null | undefined, max = 48): string {
  const t = (text ?? '').trim()
  if (!t) return '—'
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export default function MessagingTemplatesPage() {
  const { isAdmin, loading: authLoading } = useAuth()
  const [templates, setTemplates] = useState<MessagingTemplateRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [channelTab, setChannelTab] = useState<'SMS' | 'EMAIL'>('SMS')
  const [editing, setEditing] = useState(false)
  const [baseline, setBaseline] = useState<TemplateDraftFields | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const rows = await listMessagingTemplates({ excludeAdminCampaignShells: true })
      setTemplates(rows)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = templates.find((t) => t.id === selectedId) ?? null

  const filtered = useMemo(
    () => templates.filter((t) => t.channel === channelTab),
    [templates, channelTab]
  )

  const loadDraftFromTemplate = (t: MessagingTemplateRow) => {
    const draft: TemplateDraftFields = {
      subject: t.subject ?? '',
      body: t.body,
      description: t.description ?? '',
      isActive: t.isActive,
    }
    setSubject(draft.subject)
    setBody(draft.body)
    setDescription(draft.description)
    setIsActive(draft.isActive)
    setBaseline(draft)
    setEditing(false)
  }

  useEffect(() => {
    if (!selected) {
      setBaseline(null)
      setEditing(false)
      return
    }
    loadDraftFromTemplate(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when selection changes
  }, [selectedId])

  const draft: TemplateDraftFields = { subject, body, description, isActive }
  const dirty = isTemplateDraftDirty(draft, baseline)
  const canSave = editing && dirty && !saving

  const selectTemplate = (t: MessagingTemplateRow) => {
    setSelectedId(t.id)
  }

  const cancelEdit = () => {
    if (baseline) {
      setSubject(baseline.subject)
      setBody(baseline.body)
      setDescription(baseline.description)
      setIsActive(baseline.isActive)
    }
    setEditing(false)
  }

  const save = async () => {
    if (!selected || !canSave) return
    try {
      setSaving(true)
      setError(null)
      const updated = await updateMessagingTemplate(selected.id, {
        subject: selected.channel === 'EMAIL' ? subject : null,
        body,
        description: description || null,
        isActive,
      })
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      loadDraftFromTemplate(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) return <p className="text-sm text-gray-600">Loading…</p>

  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Templates unavailable</h1>
        <p className="text-sm text-gray-600">Admin only. Customer care can view campaign history.</p>
        <Button asChild variant="outline">
          <Link href="/admin/campaigns">Campaign history</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messaging templates</h1>
        <p className="text-sm text-gray-600">
          Edit live system templates. Admin campaign shells are excluded — use Campaigns to compose
          sends. No Send action here.
        </p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>
              {loading ? 'Loading…' : `${filtered.length} ${channelTab} templates`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={channelTab}
              onValueChange={(v) => {
                setChannelTab(v as 'SMS' | 'EMAIL')
                setSelectedId(null)
              }}
            >
              <TabsList className="mb-3">
                <TabsTrigger value="SMS">SMS</TabsTrigger>
                <TabsTrigger value="EMAIL">Email</TabsTrigger>
              </TabsList>
              <TabsContent value={channelTab} className="mt-0">
                <div className="max-h-[480px] space-y-1 overflow-y-auto">
                  {filtered.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTemplate(t)}
                      className={`block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 ${
                        selectedId === t.id ? 'bg-slate-100 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs">{t.templateKey}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                            t.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {t.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {truncate(t.description)}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm text-xs">
                          {(t.description ?? '').trim() || 'No description'}
                        </TooltipContent>
                      </Tooltip>
                    </button>
                  ))}
                  {!loading && filtered.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500">No templates</p>
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle>{editing ? 'Edit' : 'View'}</CardTitle>
              <CardDescription>
                {selected ? selected.templateKey : 'Select a template'}
              </CardDescription>
            </div>
            {selected ? (
              <div className="flex gap-2">
                {!editing ? (
                  <Button type="button" size="sm" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                )}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {selected ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={description}
                    disabled={!editing}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <Label htmlFor="active">Active</Label>
                  <Switch
                    id="active"
                    checked={isActive}
                    disabled={!editing}
                    onCheckedChange={setIsActive}
                  />
                </div>
                {selected.channel === 'EMAIL' ? (
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={subject}
                      disabled={!editing}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="body">Body</Label>
                  <Textarea
                    id="body"
                    rows={10}
                    value={body}
                    disabled={!editing}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </div>

                <PlaceholderPillsPanel
                  title="Placeholders"
                  value={body}
                  onChange={setBody}
                  disabled={!editing}
                />

                <Button type="button" onClick={() => void save()} disabled={!canSave}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <p className="text-sm text-gray-500">No template selected.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
