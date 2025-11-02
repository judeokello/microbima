/**
 * Payment Cadence Constants
 * 
 * Maps payment frequencies to their corresponding number of days.
 * Used to calculate payment cadence based on the selected frequency.
 * 
 * @constant PAYMENT_CADENCE
 * @property {number} DAILY - Daily payment frequency (1 day)
 * @property {number} WEEKLY - Weekly payment frequency (7 days)
 * @property {number} MONTHLY - Monthly payment frequency (30 days)
 * @property {number} QUARTERLY - Quarterly payment frequency (90 days)
 * @property {number} ANNUALLY - Annual payment frequency (365 days)
 * 
 * Note: CUSTOM frequency requires a custom value to be provided
 */
export const PAYMENT_CADENCE = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
  ANNUALLY: 365,
} as const;

export type PaymentCadenceKey = keyof typeof PAYMENT_CADENCE;


