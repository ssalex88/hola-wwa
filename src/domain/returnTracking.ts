import type { DeliveryRecord } from './eligibility.ts'
export type ReturnFeedback = 'good' | 'mixed' | 'problem' | 'skipped'
export interface ReturnTracking {
  interventionStartedAt: string | null
  observedAt: string | null
  feedback: ReturnFeedback | null
}
export function startIntervention(tracking: ReturnTracking, reference: Date): ReturnTracking {
  if (tracking.interventionStartedAt || !Number.isFinite(reference.getTime())) return tracking
  return { ...tracking, interventionStartedAt: reference.toISOString(), observedAt: reference.toISOString() }
}
export function getReturnResult(deliveries: DeliveryRecord[], tracking: ReturnTracking) {
  const start = Date.parse(tracking.interventionStartedAt ?? '')
  const observed = Date.parse(tracking.observedAt ?? '')
  if (!Number.isFinite(start) || !Number.isFinite(observed) || observed < start) return null
  const completed = deliveries.filter(item => item.status === 'completed' && Number.isFinite(Date.parse(item.completedAt)) && Date.parse(item.completedAt) > start && Date.parse(item.completedAt) <= observed)
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
  return completed.length ? { deliveryId: completed[0].id, returnedAt: completed[0].completedAt, completedSinceStart: completed.length } : null
}
export function recordReturnFeedback(tracking: ReturnTracking, deliveries: DeliveryRecord[], feedback: ReturnFeedback): ReturnTracking {
  if (!getReturnResult(deliveries, tracking) || !['good', 'mixed', 'problem', 'skipped'].includes(feedback)) return tracking
  return { ...tracking, feedback }
}
export function addDemoDelivery<T extends { deliveryHistory: DeliveryRecord[]; returnTracking: ReturnTracking }>(data: T, status: DeliveryRecord['status'], reference: Date, id: string): T {
  if (!Number.isFinite(reference.getTime()) || !['completed', 'cancelled'].includes(status) || data.deliveryHistory.some(item => item.id === id)) return data
  const observed = Date.parse(data.returnTracking.observedAt ?? '')
  const start = Date.parse(data.returnTracking.interventionStartedAt ?? '')
  const timestamp = Math.max(reference.getTime(), Number.isFinite(observed) ? observed : 0, Number.isFinite(start) ? start : 0) + 60_000
  return { ...data, deliveryHistory: [...data.deliveryHistory, { id, status, completedAt: new Date(timestamp).toISOString() }], returnTracking: { ...data.returnTracking, observedAt: new Date(timestamp).toISOString() } }
}
