import { dateInLima } from '../domain/demoDates.ts'
import type { DemoProfile } from './demoProfiles.ts'

export interface ConditionalIncentive {
  id: string
  title: string
  publication: 'published' | 'draft'
  publishedOn: string | null
  startsOn: string
  endsOn: string
  reward: { kind: 'money'; amount: number } | { kind: 'benefit'; description: string }
  zones: string[]
  vehicles: string[]
  moments: string[]
  requiredCompletedDeliveries: number
  minimumPriorDeliveries: number
  enrollmentRequired: boolean
}

export const DEMO_BIKE_BENEFIT_ID = 'demo-bike-review'

function offsetDate(referenceDate: Date, days: number): string {
  const date = new Date(`${dateInLima(referenceDate)}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Entirely fictional campaign scenarios. These are not published Rappi offers. */
export function createDemoIncentives(referenceDate: Date): ConditionalIncentive[] {
  const common = { minimumPriorDeliveries: 1, requiredCompletedDeliveries: 3 }
  return [
    { ...common, id: 'demo-centro-three', title: 'Ejemplo · Tres entregas en Lima Centro',
      publication: 'published', publishedOn: offsetDate(referenceDate, -2), startsOn: offsetDate(referenceDate, -2), endsOn: offsetDate(referenceDate, 7),
      reward: { kind: 'money', amount: 6 }, zones: ['Lima Centro'], vehicles: ['Bicicleta', 'Moto'], moments: ['Tarde'], enrollmentRequired: true },
    { ...common, id: 'demo-miraflores-four', title: 'Ejemplo · Cuatro entregas en Miraflores',
      publication: 'published', publishedOn: offsetDate(referenceDate, -1), startsOn: offsetDate(referenceDate, 0), endsOn: offsetDate(referenceDate, 7),
      reward: { kind: 'money', amount: 8 }, zones: ['Miraflores'], vehicles: ['Moto'], moments: ['Tarde', 'Noche'], requiredCompletedDeliveries: 4, enrollmentRequired: false },
    { ...common, id: DEMO_BIKE_BENEFIT_ID, title: 'Ejemplo · Revisión de bicicleta',
      publication: 'published', publishedOn: offsetDate(referenceDate, -40), startsOn: offsetDate(referenceDate, -35), endsOn: offsetDate(referenceDate, 14),
      reward: { kind: 'benefit', description: '20% de descuento en una revisión de bicicleta' }, zones: ['Lima Centro'], vehicles: ['Bicicleta'], moments: ['Mañana', 'Tarde', 'Noche'], requiredCompletedDeliveries: 4, enrollmentRequired: false },
    { ...common, id: 'demo-draft', title: 'Borrador · Campaña no publicada',
      publication: 'draft', publishedOn: null, startsOn: offsetDate(referenceDate, 1), endsOn: offsetDate(referenceDate, 7),
      reward: { kind: 'money', amount: 9 }, zones: ['Lima Centro'], vehicles: ['Bicicleta', 'Moto'], moments: ['Tarde'], enrollmentRequired: true },
    { ...common, id: 'demo-expired', title: 'Ejemplo · Campaña vencida',
      publication: 'published', publishedOn: offsetDate(referenceDate, -10), startsOn: offsetDate(referenceDate, -10), endsOn: offsetDate(referenceDate, -1),
      reward: { kind: 'money', amount: 4 }, zones: ['Lima Centro'], vehicles: ['Bicicleta', 'Moto'], moments: ['Tarde'], enrollmentRequired: true },
  ]
}

/** A preconfirmed fictional benefit, tied to completed deliveries, never to days inactive. */
export function createDemoIncentiveAwards(profile: DemoProfile, referenceDate: Date): Record<string, string> {
  if (profile.id !== 'inactive-recent' || profile.accountStatus !== 'active') return {}
  const completed = profile.deliveries.filter((delivery) => delivery.status === 'completed'
    && dateInLima(new Date(delivery.completedAt)) >= offsetDate(referenceDate, -35))
  if (completed.length < 4) return {}
  const last = completed.reduce((latest, delivery) => delivery.completedAt > latest ? delivery.completedAt : latest, completed[0].completedAt)
  return { [DEMO_BIKE_BENEFIT_ID]: last }
}
