/**
 * Maps backend STK / WebSocket statuses to the product vocabulary (FR-019)
 * used in notifications and in-page copy. Align with onboarding payment:
 * in-flight STK shows as `processing` while the gateway reports `PENDING`.
 *
 * @see apps/agent-registration/src/app/(main)/register/payment/page.tsx
 */
export type StkGatewayStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

/** Spec / FR-019 vocabulary (lowercase) */
export type SpecPaymentStatusVocabulary =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export function mapStkGatewayStatusToSpecVocabulary(
  stkStatus: StkGatewayStatus | string | undefined | null
): SpecPaymentStatusVocabulary {
  switch (stkStatus) {
    case 'PENDING':
      return 'processing';
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    case 'EXPIRED':
      return 'timeout';
    default:
      return 'pending';
  }
}
