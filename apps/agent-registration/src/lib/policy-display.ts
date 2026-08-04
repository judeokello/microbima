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
