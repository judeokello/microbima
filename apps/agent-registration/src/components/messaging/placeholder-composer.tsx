'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'

export interface PlaceholderOption {
  key: string
  label: string
}

const COLOR_TOKENS = [
  'bg-sky-100 text-sky-800 border-sky-300',
  'bg-amber-100 text-amber-800 border-amber-300',
  'bg-emerald-100 text-emerald-800 border-emerald-300',
  'bg-rose-100 text-rose-800 border-rose-300',
  'bg-violet-100 text-violet-800 border-violet-300',
  'bg-cyan-100 text-cyan-800 border-cyan-300',
]

const DEFAULT_PLACEHOLDERS: PlaceholderOption[] = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'phone_number', label: 'Phone number' },
  { key: 'policy_number', label: 'Policy number' },
  { key: 'product_name', label: 'Product name' },
  { key: 'scheme_name', label: 'Scheme name' },
  { key: 'general_support_number', label: 'General support number' },
  { key: 'medical_support_number', label: 'Medical support number' },
]

export function colorTokenForKey(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash + key.charCodeAt(i) * (i + 1)) % COLOR_TOKENS.length
  return COLOR_TOKENS[hash]
}

interface PlaceholderComposerProps {
  value: string
  onChange: (value: string) => void
  placeholders?: PlaceholderOption[]
  placeholder?: string
  rows?: number
  label?: string
}

export function PlaceholderComposer({
  value,
  onChange,
  placeholders = DEFAULT_PLACEHOLDERS,
  placeholder = 'Compose message…',
  rows = 6,
  label,
}: PlaceholderComposerProps) {
  const [picker, setPicker] = useState<string>('')

  const usedKeys = useMemo(() => {
    const matches = value.match(/\{([a-z0-9_]+)\}/g) ?? []
    return matches.map((m) => m.slice(1, -1))
  }, [value])

  const insertPlaceholder = (key: string) => {
    if (!key) return
    onChange(`${value}{${key}}`)
    setPicker('')
  }

  const removePlaceholder = (key: string) => {
    onChange(value.replaceAll(`{${key}}`, ''))
  }

  return (
    <div className="space-y-2">
      {label ? <label className="text-sm font-medium text-gray-700">{label}</label> : null}
      <div className="flex flex-wrap gap-2">
        {usedKeys.map((key) => (
          <span
            key={`${key}-${usedKeys.indexOf(key)}`}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${colorTokenForKey(key)}`}
          >
            {`{${key}}`}
            <button
              type="button"
              aria-label={`Remove ${key}`}
              className="hover:opacity-70"
              onClick={() => removePlaceholder(key)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Select value={picker} onValueChange={(v) => insertPlaceholder(v)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Insert placeholder" />
          </SelectTrigger>
          <SelectContent>
            {placeholders.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => insertPlaceholder(picker)} disabled={!picker}>
          Insert
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  )
}
