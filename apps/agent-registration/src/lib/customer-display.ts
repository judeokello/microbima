type CustomerStatusKey =
  | 'ACTIVE'
  | 'PENDING_ACTIVATION'
  | 'PENDING_KYC'
  | 'SUSPENDED'
  | 'DEACTIVATED'
  | 'DELETED'
  | 'TERMINATED'
  | 'KYC_VERIFIED'

export function getCustomerStatusDisplay(status: string): { label: string; className: string } {
  const map: Record<CustomerStatusKey, { label: string; className: string }> = {
    ACTIVE: {
      label: 'Active',
      className: 'bg-green-50 text-green-700 border-green-200',
    },
    PENDING_ACTIVATION: {
      label: 'Pending Activation',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    PENDING_KYC: {
      label: 'KYC Pending',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    SUSPENDED: {
      label: 'Suspended',
      className: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    DEACTIVATED: {
      label: 'Deactivated',
      className: 'bg-gray-100 text-gray-700 border-gray-300',
    },
    DELETED: {
      label: 'Deleted',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
    TERMINATED: {
      label: 'Terminated',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
    KYC_VERIFIED: {
      label: 'KYC Verified',
      className: 'bg-green-50 text-green-700 border-green-200',
    },
  }
  const key = status as CustomerStatusKey
  return (
    map[key] ?? {
      label: status.replaceAll('_', ' '),
      className: 'bg-muted text-muted-foreground border-border',
    }
  )
}
