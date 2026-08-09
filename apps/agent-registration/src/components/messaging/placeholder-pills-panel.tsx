'use client'

import { X } from 'lucide-react'
import {
  PLACEHOLDER_CATALOG,
  extractUsedPlaceholderKeys,
  placeholdersByCategory,
  removePlaceholderOccurrence,
  type PlaceholderDef,
} from '@/lib/messaging/placeholder-catalog'
import { colorTokenForKey } from './placeholder-composer'

interface PlaceholderPillsPanelProps {
  value: string
  onChange: (next: string) => void
  catalog?: PlaceholderDef[]
  disabled?: boolean
  title?: string
  /** When false, hide the body textarea (compose already has one). */
  showUsedOnly?: boolean
}

export function PlaceholderPillsPanel({
  value,
  onChange,
  catalog = PLACEHOLDER_CATALOG,
  disabled = false,
  title = 'Placeholders',
  showUsedOnly = false,
}: PlaceholderPillsPanelProps) {
  const usedKeys = extractUsedPlaceholderKeys(value)
  const groups = placeholdersByCategory(catalog)

  const insert = (key: string) => {
    if (disabled) return
    onChange(`${value}{${key}}`)
  }

  const remove = (key: string, occurrenceIndex: number) => {
    if (disabled) return
    onChange(removePlaceholderOccurrence(value, key, occurrenceIndex))
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="text-sm font-medium text-gray-800">{title}</div>

      {usedKeys.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">In message</p>
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
                    className="hover:opacity-70 disabled:opacity-40"
                    disabled={disabled}
                    onClick={() => remove(key, occurrenceIndex)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      ) : null}

      {!showUsedOnly
        ? groups.map((group) => (
            <div key={group.category} className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => insert(item.key)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 ${colorTokenForKey(item.key)}`}
                    title={`Insert {${item.key}}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))
        : null}
    </div>
  )
}
