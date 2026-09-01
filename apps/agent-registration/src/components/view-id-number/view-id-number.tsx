'use client'

import { Loader2 } from 'lucide-react'
import type { MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { revealIdNumber } from '@/lib/api'
import {
  hasRevealableIdNumber,
  idNumberRevealKey,
  type IdNumberEntityKind,
} from '@/lib/id-number-reveal'
import { useRevealId } from './reveal-id-provider'

interface ViewIdNumberProps {
  customerId: string
  entityKind: IdNumberEntityKind
  entityId?: string
  maskedValue?: string | null
  className?: string
}

export function ViewIdNumber({
  customerId,
  entityKind,
  entityId,
  maskedValue,
  className,
}: ViewIdNumberProps) {
  const { revealedKey, revealedValue, isRevealingKey, reveal } = useRevealId()
  const key = idNumberRevealKey(customerId, entityKind, entityId)
  const isRevealed = revealedKey === key && revealedValue != null
  const isLoading = isRevealingKey === key

  if (!hasRevealableIdNumber(maskedValue)) {
    return <span className={className}>N/A</span>
  }

  const handleView = async (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    try {
      await reveal(key, () =>
        revealIdNumber(customerId, entityKind, entityKind === 'CUSTOMER' ? undefined : entityId)
      )
    } catch (err) {
      console.error('Failed to reveal ID number', err)
    }
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`} onClick={(e) => e.stopPropagation()}>
      <span className="font-mono tabular-nums">
        {isRevealed ? revealedValue : maskedValue}
      </span>
      {!isRevealed && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={isLoading}
          onClick={handleView}
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'View ID'}
        </Button>
      )}
    </span>
  )
}
