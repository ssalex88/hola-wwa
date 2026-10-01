export const INACTIVITY_DAYS = 15
const DAY_MS = 24 * 60 * 60 * 1000

export type PauseBand = 'Menos de 15 días' | '15–30 días' | '31–60 días' | 'Más de 60 días'

export function getPauseBand(lastCompletedAt: string | null, referenceDate: Date = new Date()): PauseBand | null {
  if (!lastCompletedAt) return null
  const lastDeliveryMs = Date.parse(lastCompletedAt)
  const referenceMs = referenceDate.getTime()
  if (!Number.isFinite(lastDeliveryMs) || !Number.isFinite(referenceMs) || lastDeliveryMs > referenceMs) return null
  const daysSinceDelivery = Math.floor((referenceMs - lastDeliveryMs) / DAY_MS)
  if (daysSinceDelivery < INACTIVITY_DAYS) return 'Menos de 15 días'
  if (daysSinceDelivery <= 30) return '15–30 días'
  if (daysSinceDelivery <= 60) return '31–60 días'
  return 'Más de 60 días'
}

export interface DeliveryRecord {
  id: string
  completedAt: string
  status: 'completed' | 'cancelled'
}

export type Eligibility =
  | { eligible: true; daysInactive: number; lastCompletedAt: string }
  | { eligible: false; reason: 'active' | 'blocked' | 'no-completed-delivery' | 'invalid-date'; daysInactive?: number }

/** Pilot attention order only; it never affects earnings, incentives or order priority. */
export function getReactivationPriority(eligibility: Eligibility): 1 | 2 | 3 | null {
  if (!eligibility.eligible) return null
  return eligibility.daysInactive <= 30 ? 1 : eligibility.daysInactive <= 60 ? 2 : 3
}

/** The demo counts complete 24-hour periods since the latest completed delivery. */
export function getReactivationEligibility(deliveries: DeliveryRecord[], now: Date = new Date(), accountStatus: 'active' | 'blocked' = 'active'): Eligibility {
  if (accountStatus === 'blocked') return { eligible: false, reason: 'blocked' }
  const completed = deliveries.filter((delivery) => delivery.status === 'completed')
  if (completed.length === 0) return { eligible: false, reason: 'no-completed-delivery' }

  const dates = completed.map((delivery) => Date.parse(delivery.completedAt))
  const nowMs = now.getTime()
  if (!Number.isFinite(nowMs) || dates.some((date) => !Number.isFinite(date) || date > nowMs)) {
    return { eligible: false, reason: 'invalid-date' }
  }

  const lastCompletedMs = Math.max(...dates)
  const daysInactive = Math.floor((nowMs - lastCompletedMs) / DAY_MS)
  if (daysInactive < INACTIVITY_DAYS) return { eligible: false, reason: 'active', daysInactive }
  return { eligible: true, daysInactive, lastCompletedAt: new Date(lastCompletedMs).toISOString() }
}
