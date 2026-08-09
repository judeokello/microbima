export interface TemplateDraftFields {
  subject: string
  body: string
  description: string
  isActive: boolean
}

/** True when draft differs from the baseline snapshot (Save should be enabled). */
export function isTemplateDraftDirty(
  draft: TemplateDraftFields,
  baseline: TemplateDraftFields | null,
): boolean {
  if (!baseline) return false
  return (
    draft.subject !== baseline.subject ||
    draft.body !== baseline.body ||
    draft.description !== baseline.description ||
    draft.isActive !== baseline.isActive
  )
}
