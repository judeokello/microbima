'use client'

import { useParams } from 'next/navigation'
import { Suspense } from 'react'
import { MessageDetail } from '@/components/messaging/message-detail'

function DashboardMessageDetailInner() {
  const params = useParams()
  const deliveryId = params?.deliveryId as string
  return <MessageDetail deliveryId={deliveryId} basePath="/dashboard/messages" />
}

export default function DashboardMessageDetailPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-600">Loading…</div>}>
      <DashboardMessageDetailInner />
    </Suspense>
  )
}
