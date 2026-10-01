import { isFutureDate } from './demoDates.ts'

export const PROJECTION_ZONES = ['Lima Centro', 'Miraflores', 'Surco', 'San Miguel', 'Jesús María']
export const PROJECTION_VEHICLES = ['Bicicleta', 'Moto', 'Auto']
export const PROJECTION_MOMENTS = [
  { value: 'Mañana', label: 'Mañana · 6 a. m. a 12 p. m.' },
  { value: 'Tarde', label: 'Tarde · 12 p. m. a 6 p. m.' },
  { value: 'Noche', label: 'Noche · 6 p. m. a 6 a. m.' },
]

export interface ProjectionConfiguration {
  zone: string
  hours: number
  moment: string
  vehicle: string
  scheduleMode: 'now' | 'another-day'
  scheduledDate: string | null
  expenseFuel: number
  expenseMaintenance: number
  expenseOther: number
}

export type ProjectionErrors = Partial<Record<keyof ProjectionConfiguration, string>>

export function validateProjectionConfiguration(config: ProjectionConfiguration, today: string): ProjectionErrors {
  const errors: ProjectionErrors = {}
  if (!PROJECTION_ZONES.includes(config.zone)) errors.zone = 'Elige una zona disponible.'
  if (!Number.isFinite(config.hours) || config.hours < 1 || config.hours > 12) errors.hours = 'Elige entre 1 y 12 horas.'
  if (!PROJECTION_MOMENTS.some((slot) => slot.value === config.moment)) errors.moment = 'Elige una franja disponible.'
  if (!PROJECTION_VEHICLES.includes(config.vehicle)) errors.vehicle = 'Elige un vehículo disponible.'
  if (config.scheduleMode === 'another-day' && (!config.scheduledDate || !isFutureDate(config.scheduledDate, today))) errors.scheduledDate = 'Elige una fecha futura válida.'
  for (const key of ['expenseFuel', 'expenseMaintenance', 'expenseOther'] as const) {
    if (!Number.isFinite(config[key]) || config[key] < 0) errors[key] = 'Ingresa un gasto igual o mayor a cero.'
  }
  return errors
}

/** Copy just proposal fields; swapping options never swaps invitation preferences. */
export function copyConfiguration(config: ProjectionConfiguration): ProjectionConfiguration {
  return {
    zone: config.zone, hours: config.hours, moment: config.moment, vehicle: config.vehicle,
    scheduleMode: config.scheduleMode, scheduledDate: config.scheduledDate,
    expenseFuel: config.expenseFuel, expenseMaintenance: config.expenseMaintenance, expenseOther: config.expenseOther,
  }
}
