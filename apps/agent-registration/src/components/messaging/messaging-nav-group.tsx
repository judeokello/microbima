'use client'

import Link from 'next/link'
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

export interface MessagingNavItem {
  href: string
  label: string
  icon: LucideIcon
  match?: (pathname: string | null) => boolean
}

interface MessagingNavGroupProps {
  pathname: string | null
  items: MessagingNavItem[]
  onNavigate?: () => void
}

export function MessagingNavGroup({ pathname, items, onNavigate }: MessagingNavGroupProps) {
  const isChildActive = items.some((item) =>
    item.match ? item.match(pathname) : !!pathname?.startsWith(item.href),
  )
  const [open, setOpen] = useState(isChildActive)

  useEffect(() => {
    if (isChildActive) setOpen(true)
  }, [isChildActive])

  return (
    <div className="space-y-1">
      <button
        type="button"
        className="flex w-full items-center rounded-md px-3 py-2 text-left transition-colors hover:bg-white/10"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="mr-2 h-4 w-4" />
        ) : (
          <ChevronRight className="mr-2 h-4 w-4" />
        )}
        Messaging
      </button>
      {open ? (
        <div className="ml-2 space-y-1 border-l border-white/20 pl-2">
          {items.map((item) => {
            const Icon = item.icon
            const active = item.match
              ? item.match(pathname)
              : !!pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-md px-3 py-2 transition-colors hover:bg-white/10 ${
                  active ? 'bg-white/10' : ''
                }`}
                onClick={onNavigate}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
