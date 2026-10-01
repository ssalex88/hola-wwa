import { addDemoDelivery, startIntervention } from '../domain/returnTracking.ts'
import type { ProfileDemoData } from './demoStorage.ts'
import { DEMO_REFERENCE_DATE } from './demoClock.ts'
export const returnService = {
  start: (data: ProfileDemoData): ProfileDemoData => ({ ...data, returnTracking: startIntervention(data.returnTracking, evaluationReference(data)) }),
  addDelivery: (data: ProfileDemoData, status: 'completed' | 'cancelled') => addDemoDelivery(data, status, DEMO_REFERENCE_DATE, `demo-delivery-${crypto.randomUUID()}`),
}
export function evaluationReference(data: ProfileDemoData): Date {
  const observed = Date.parse(data.returnTracking.observedAt ?? '')
  return new Date(Math.max(DEMO_REFERENCE_DATE.getTime(), Number.isFinite(observed) ? observed : 0))
}
