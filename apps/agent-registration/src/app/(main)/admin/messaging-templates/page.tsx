'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  listMessagingTemplates,
  updateMessagingTemplate,
  type MessagingTemplateRow,
} from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

export default function MessagingTemplatesPage() {
  const { isAdmin, loading: authLoading } = useAuth()
  const [templates, setTemplates] = useState<MessagingTemplateRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
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

  useEffect(() => {
    if (!selected) return
    setSubject(selected.subject ?? '')
    setBody(selected.body)
  }, [selected])

  const save = async () => {
    if (!selected) return
    try {
      setSaving(true)
      setError(null)
      const updated = await updateMessagingTemplate(selected.id, {
        subject: selected.channel === 'EMAIL' ? subject : null,
        body,
      })
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
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
            <CardDescription>{loading ? 'Loading…' : `${templates.length} templates`}</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[480px] space-y-1 overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 ${
                  selectedId === t.id ? 'bg-slate-100 font-medium' : ''
                }`}
              >
                <span className="font-mono text-xs text-slate-500">{t.channel}</span> {t.templateKey}{' '}
                <span className="text-xs text-slate-400">({t.language})</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit</CardTitle>
            <CardDescription>
              {selected ? selected.templateKey : 'Select a template to edit and save'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected ? (
              <>
                {selected.channel === 'EMAIL' ? (
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="body">Body</Label>
                  <Textarea id="body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
                </div>
                <Button type="button" onClick={save} disabled={saving}>
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
