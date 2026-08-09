'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface SelectableEntity {
  id: number
  name: string
  isActive: boolean
}

interface EntityMultiSelectProps {
  label: string
  entities: SelectableEntity[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  loading?: boolean
  placeholder?: string
  emptyText?: string
  /** Optional sendable/matched counts keyed by entity id (shown on selected pills). */
  countsById?: Record<number, number>
}

export function EntityMultiSelect({
  label,
  entities,
  selectedIds,
  onChange,
  loading,
  placeholder = 'Search…',
  emptyText = 'No matches',
  countsById,
}: EntityMultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const selected = entities.filter((e) => selectedIds.includes(e.id))

  const toggle = (entity: SelectableEntity) => {
    if (!entity.isActive) return
    if (selectedIds.includes(entity.id)) {
      onChange(selectedIds.filter((id) => id !== entity.id))
    } else {
      onChange([...selectedIds, entity.id])
    }
  }

  const remove = (id: number) => onChange(selectedIds.filter((x) => x !== id))

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={loading}
          >
            {loading
              ? 'Loading…'
              : selected.length > 0
                ? `${selected.length} selected`
                : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {entities.map((entity) => {
                  const checked = selectedIds.includes(entity.id)
                  return (
                    <CommandItem
                      key={entity.id}
                      value={`${entity.name} ${entity.id}`}
                      disabled={!entity.isActive}
                      onSelect={() => toggle(entity)}
                      className={cn(!entity.isActive && 'opacity-60')}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!entity.isActive}
                        className="mr-2"
                        aria-hidden
                      />
                      <span className="flex-1 truncate">{entity.name}</span>
                      {!entity.isActive ? (
                        <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600">
                          Inactive
                        </span>
                      ) : null}
                      {checked ? <Check className="ml-2 h-4 w-4 opacity-70" /> : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((e) => (
            <span
              key={e.id}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-800"
            >
              <span>
                {e.name}
                {countsById && e.id in countsById ? (
                  <span className="ml-1 text-slate-500">({countsById[e.id]})</span>
                ) : null}
              </span>
              <button type="button" aria-label={`Remove ${e.name}`} onClick={() => remove(e.id)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
