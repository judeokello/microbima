'use client'

import { Eye, Loader2 } from 'lucide-react'
import type { MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { revealPii } from '@/lib/api'
import {
  DATE_OF_BIRTH_REVEAL_MS,
  formatRevealedDateOfBirth,
  hasRevealableIdNumber,
  ID_NUMBER_REVEAL_MS,
  PHONE_REVEAL_MS,
  piiRevealKey,
  type IdNumberEntityKind,
  type PiiRevealField,
} from '@/lib/id-number-reveal'
import { useRevealId } from './reveal-id-provider'

interface ViewMaskedFieldProps {
  customerId: string
  entityKind: IdNumberEntityKind
  entityId?: string
  field: PiiRevealField
  maskedValue?: string | null
  durationMs: number
  ariaLabel: string
  formatRevealed?: (value: string) => string
  className?: string
}

function ViewMaskedField({
  customerId,
  entityKind,
  entityId,
  field,
  maskedValue,
  durationMs,
  ariaLabel,
  formatRevealed,
  className,
}: ViewMaskedFieldProps) {
  const { revealedKey, revealedValue, isRevealingKey, reveal } = useRevealId()
  const key = piiRevealKey(customerId, entityKind, field, entityId)
  const isRevealed = revealedKey === key && revealedValue != null
  const isLoading = isRevealingKey === key

  if (!hasRevealableIdNumber(maskedValue)) {
    return <span className={className}>N/A</span>
  }

  const handleView = async (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    try {
      await reveal(
        key,
        () =>
          revealPii(
            customerId,
            entityKind,
            field,
            entityKind === 'CUSTOMER' ? undefined : entityId
          ),
        durationMs
      )
    } catch (err) {
      console.error(`Failed to reveal ${field}`, err)
    }
  }

  const displayValue = isRevealed
    ? (formatRevealed ? formatRevealed(revealedValue) : revealedValue)
    : maskedValue

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`} onClick={(e) => e.stopPropagation()}>
      <span className={field === 'DATE_OF_BIRTH' ? undefined : 'font-mono tabular-nums'}>
        {displayValue}
      </span>
      {!isRevealed && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          disabled={isLoading}
          aria-label={ariaLabel}
          onClick={handleView}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
        </Button>
      )}
    </span>
  )
}

interface ViewPiiProps {
  customerId: string
  entityKind: IdNumberEntityKind
  entityId?: string
  maskedValue?: string | null
  className?: string
}

export function ViewIdNumber(props: ViewPiiProps) {
  return (
    <ViewMaskedField
      {...props}
      field="ID_NUMBER"
      durationMs={ID_NUMBER_REVEAL_MS}
      ariaLabel="View ID number"
    />
  )
}

export function ViewPhoneNumber(props: ViewPiiProps) {
  return (
    <ViewMaskedField
      {...props}
      field="PHONE"
      durationMs={PHONE_REVEAL_MS}
      ariaLabel="View phone number"
    />
  )
}

export function ViewDateOfBirth(props: ViewPiiProps) {
  return (
    <ViewMaskedField
      {...props}
      field="DATE_OF_BIRTH"
      durationMs={DATE_OF_BIRTH_REVEAL_MS}
      ariaLabel="View date of birth"
      formatRevealed={formatRevealedDateOfBirth}
    />
  )
}
