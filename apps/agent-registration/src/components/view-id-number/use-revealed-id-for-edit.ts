import { useEffect, useState } from 'react'
import { revealIdNumber } from '@/lib/api'
import { hasRevealableIdNumber, type IdNumberEntityKind } from '@/lib/id-number-reveal'

export function useRevealedIdForEdit(params: {
  open: boolean
  customerId: string
  entityKind: IdNumberEntityKind
  entityId?: string
  maskedValue?: string | null
}): string {
  const { open, customerId, entityKind, entityId, maskedValue } = params
  const [value, setValue] = useState(maskedValue ?? '')

  useEffect(() => {
    if (!open) {
      return
    }
    setValue(maskedValue ?? '')
    if (!hasRevealableIdNumber(maskedValue)) {
      return
    }
    let cancelled = false
    revealIdNumber(customerId, entityKind, entityKind === 'CUSTOMER' ? undefined : entityId)
      .then((idNumber) => {
        if (!cancelled) setValue(idNumber)
      })
      .catch((err) => {
        console.error('Failed to load ID number for edit', err)
      })
    return () => {
      cancelled = true
    }
  }, [open, customerId, entityKind, entityId, maskedValue])

  return value
}
