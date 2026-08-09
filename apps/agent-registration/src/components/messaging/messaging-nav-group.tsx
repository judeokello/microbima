'use client'

import {
  ExpandableNavGroup,
  type ExpandableNavItem,
} from '@/components/messaging/expandable-nav-group'

export type MessagingNavItem = ExpandableNavItem

interface MessagingNavGroupProps {
  pathname: string | null
  items: MessagingNavItem[]
  onNavigate?: () => void
}

/** @deprecated Prefer ExpandableNavGroup with title="Messaging" */
export function MessagingNavGroup({ pathname, items, onNavigate }: MessagingNavGroupProps) {
  return (
    <ExpandableNavGroup
      title="Messaging"
      pathname={pathname}
      items={items}
      onNavigate={onNavigate}
    />
  )
}
