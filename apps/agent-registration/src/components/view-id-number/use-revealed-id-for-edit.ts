import { useEffect, useState } from 'react'
import { revealPii } from '@/lib/api'
import {
  hasRevealableIdNumber,
  needsPiiReveal,
  type IdNumberEntityKind,
  type PiiRevealField,
} from '@/lib/id-number-reveal'

export function useRevealedFieldForEdit(params: {
  open: boolean
  customerId: string
  entityKind: IdNumberEntityKind
  entityId?: string
  field: PiiRevealField
  maskedValue?: string | null
}): string {
  const { open, customerId, entityKind, entityId, field, maskedValue } = params
  const [value, setValue] = useState(maskedValue ?? '')

  useEffect(() => {
    if (!open) {
      return
    }
    setValue(maskedValue ?? '')
    if (!hasRevealableIdNumber(maskedValue) || !needsPiiReveal(field, maskedValue)) {
      return
    }
    let cancelled = false
    revealPii(customerId, entityKind, field, entityKind === 'CUSTOMER' ? undefined : entityId)
      .then((revealed) => {
        if (!cancelled) setValue(revealed)
      })
      .catch((err) => {
        console.error(`Failed to load ${field} for edit`, err)
      })
    return () => {
      cancelled = true
    }
  }, [open, customerId, entityKind, entityId, field, maskedValue])

  return value
}

export function useRevealedIdForEdit(params: {
  open: boolean
  customerId: string
  entityKind: IdNumberEntityKind
  entityId?: string
  maskedValue?: string | null
}): string {
  return useRevealedFieldForEdit({ ...params, field: 'ID_NUMBER' })
}
