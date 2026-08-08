'use client'

import type { CampaignPreviewResponse } from '@/lib/api'
import { colorTokenForKey } from './placeholder-composer'
import { Button } from '@/components/ui/button'

interface CampaignPreviewPanelProps {
  preview: CampaignPreviewResponse | null
  loading?: boolean
  onDownloadErrorsCsv?: () => void
  onDownloadSkipsCsv?: () => void
}

export function CampaignPreviewPanel({
  preview,
  loading,
  onDownloadErrorsCsv,
  onDownloadSkipsCsv,
}: CampaignPreviewPanelProps) {
  if (loading) {
    return <div className="rounded-md border p-4 text-sm text-gray-600">Computing preview…</div>
  }
  if (!preview) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-gray-500">
        Preview will appear here after you run Preflight.
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-gray-500">Sendable</span>
          <div className="text-lg font-semibold">{preview.sendableCount}</div>
        </div>
        {preview.smsSegmentCount != null ? (
          <div>
            <span className="text-gray-500">SMS segments</span>
            <div className="text-lg font-semibold">{preview.smsSegmentCount}</div>
          </div>
        ) : null}
        <div>
          <span className="text-gray-500">Characters</span>
          <div className="text-lg font-semibold">{preview.characterCount}</div>
        </div>
      </div>

      {preview.largeAudienceWarning ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Large audience warning: 5,000+ sendable recipients.
        </p>
      ) : null}

      {preview.requiresNameConfirmation ? (
        <p className="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-900">
          You must type the exact campaign name to confirm Send.
        </p>
      ) : null}

      {preview.perSchemeCounts.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">
            Per-scheme sendable counts (after dedupe; paste-only recipients are not included here)
          </p>
          <div className="flex flex-wrap gap-2">
            {preview.perSchemeCounts.map((s) => (
              <span
                key={s.schemeId}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
              >
                {s.schemeName}: {s.recipientCount}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {preview.sample ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Sample recipient</h4>
          <p className="text-xs text-gray-500">{preview.sample.address}</p>
          {preview.sample.renderedSubject ? (
            <p className="text-sm font-medium">{preview.sample.renderedSubject}</p>
          ) : null}
          <p className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">
            {preview.sample.renderedBody}
          </p>
          <div className="flex flex-wrap gap-2">
            {preview.sample.placeholderHighlights.map((h) => (
              <span
                key={h.key}
                className={`rounded-md border px-2 py-0.5 text-xs ${colorTokenForKey(h.key)}`}
              >
                {h.key}: {h.value}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {(preview.blockingErrors.length > 0 || preview.softSkips.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {preview.blockingErrors.length > 0 && onDownloadErrorsCsv ? (
            <Button type="button" variant="outline" size="sm" onClick={onDownloadErrorsCsv}>
              Download errors CSV ({preview.blockingErrors.length})
            </Button>
          ) : null}
          {preview.softSkips.length > 0 && onDownloadSkipsCsv ? (
            <Button type="button" variant="outline" size="sm" onClick={onDownloadSkipsCsv}>
              Download skips CSV ({preview.softSkips.length})
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
