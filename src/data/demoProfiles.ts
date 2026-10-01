import type { DeliveryRecord } from '../domain/eligibility'

export type AccountStatus = 'active' | 'blocked'

export interface DemoProfile {
  id: string
  name: string
  initials: string
  vehicle: string
  zone: string
  lastDeliveryAt: string | null
  accountStatus: AccountStatus
  scenario: string
  deliveries: DeliveryRecord[]
  declaredPause?: { declaredAt: string; note: string }
}

function daysAgo(days: number, now: Date): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function completedHistory(id: string, now: Date, intervals: number[]): DeliveryRecord[] {
  return intervals.map((days, index) => ({ id: `${id}-delivery-${index + 1}`, completedAt: daysAgo(days, now), status: 'completed' }))
}

/** All identities and delivery records are synthetic, anchored to the current demo date. */
export function createDemoProfiles(now: Date = new Date()): DemoProfile[] {
  const profiles: DemoProfile[] = [
    {
      id: 'inactive-recent', name: 'Camila Torres', initials: 'CT', vehicle: 'Bicicleta', zone: 'Lima Centro',
      lastDeliveryAt: daysAgo(20, now), accountStatus: 'active', scenario: 'Inactivo de 20 días',
      deliveries: completedHistory('demo-1042', now, [20, 23, 27, 31]),
    },
    {
      id: 'inactive-31-60', name: 'Marco Salas', initials: 'MS', vehicle: 'Moto', zone: 'Miraflores',
      lastDeliveryAt: daysAgo(45, now), accountStatus: 'active', scenario: 'Inactivo de 45 días',
      deliveries: completedHistory('demo-2187', now, [45, 47, 53, 58]),
    },
    {
      id: 'inactive-over-60', name: 'Carlos Cruz', initials: 'CC', vehicle: 'Moto', zone: 'Lima Centro',
      lastDeliveryAt: daysAgo(75, now), accountStatus: 'active', scenario: 'Inactivo de más de 60 días',
      deliveries: completedHistory('demo-2659', now, [75, 78, 84, 90]),
    },
    {
      id: 'active', name: 'Lucía Rojas', initials: 'LR', vehicle: 'Bicicleta', zone: 'Surco',
      lastDeliveryAt: daysAgo(4, now), accountStatus: 'active', scenario: 'Activo',
      deliveries: completedHistory('demo-3271', now, [4, 6, 8, 10, 13]),
    },
    {
      id: 'interruption-10', name: 'Andrés Vega', initials: 'AV', vehicle: 'Moto', zone: 'San Miguel',
      lastDeliveryAt: daysAgo(10, now), accountStatus: 'active', scenario: 'Interrupción de 10 días',
      deliveries: completedHistory('demo-3810', now, [10, 12, 15, 19]),
    },
    {
      id: 'declared-pause', name: 'Elena Medina', initials: 'EM', vehicle: 'Bicicleta', zone: 'Jesús María',
      lastDeliveryAt: daysAgo(28, now), accountStatus: 'active', scenario: 'Pausa declarada',
      deliveries: completedHistory('demo-4128', now, [28, 30, 34, 39]),
      declaredPause: { declaredAt: daysAgo(2, now), note: 'Por ahora no puedo volver. Prefiero revisar opciones por mi cuenta.' },
    },
    {
      id: 'no-deliveries', name: 'Diego Paredes', initials: 'DP', vehicle: 'Moto', zone: 'San Miguel',
      lastDeliveryAt: null, accountStatus: 'active', scenario: 'Sin entregas previas',
      deliveries: [],
    },
    {
      id: 'blocked', name: 'Valeria Núñez', initials: 'VN', vehicle: 'Bicicleta', zone: 'Jesús María',
      lastDeliveryAt: daysAgo(42, now), accountStatus: 'blocked', scenario: 'Cuenta bloqueada',
      deliveries: completedHistory('demo-4953', now, [42, 45, 51]),
    },
  ]
  return profiles
}
