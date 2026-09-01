/** Split ISO datetime into readable date + time (en-GB). */
export function formatPolicyDateTimeParts(iso: string | null | undefined): {
  date: string
  time: string
} | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return {
    date: d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    time: d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }) + ' UTC',
  }
}

export function formatInstallmentsPaidDisplay(
  value: number,
  approximate?: boolean
): string {
  if (approximate) return `~${value}`
  return String(value)
}

type PolicyStatusKey =
  | 'ACTIVE'
  | 'PENDING_ACTIVATION'
  | 'SUSPENDED'
  | 'INACTIVE'
  | 'DEACTIVATED'
  | 'TERMINATED'
  | 'EXPIRED'

export function getPolicyStatusDisplay(status: string): { label: string; className: string } {
  const map: Record<PolicyStatusKey, { label: string; className: string }> = {
    ACTIVE: {
      label: 'Active',
      className: 'bg-green-50 text-green-700 border-green-200',
    },
    PENDING_ACTIVATION: {
      label: 'Pending Activation',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    SUSPENDED: {
      label: 'Suspended',
      className: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    INACTIVE: {
      label: 'Inactive',
      className: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    DEACTIVATED: {
      label: 'Deactivated',
      className: 'bg-gray-100 text-gray-700 border-gray-300',
    },
    TERMINATED: {
      label: 'Terminated',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
    EXPIRED: {
      label: 'Expired',
      className: 'bg-orange-50 text-orange-700 border-orange-200',
    },
  }
  const key = status as PolicyStatusKey
  return (
    map[key] ?? {
      label: status.replaceAll('_', ' '),
      className: 'bg-muted text-muted-foreground border-border',
    }
  )
}
