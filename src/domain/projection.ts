import type { ProjectionConfiguration } from './projectionConfiguration.ts'
import type { ProjectionRate } from '../data/projectionRates.ts'

export interface ProjectionResult {
  grossMin: number
  grossMax: number
  expenses: number
  afterExpensesMin: number
  afterExpensesMax: number
  hourlyMin: number
  hourlyMax: number
}

export function calculateProjection(preferences: ProjectionConfiguration, rates: ProjectionRate[]): ProjectionResult | null {
  if (!Number.isFinite(preferences.hours) || preferences.hours < 1 || preferences.hours > 12
    || [preferences.expenseFuel, preferences.expenseMaintenance, preferences.expenseOther].some((value) => !Number.isFinite(value) || value < 0)) return null
  const rate = rates.find((item) => item.zone === preferences.zone && item.moment === preferences.moment && item.vehicle === preferences.vehicle)
  if (!rate) return null
  const grossMin = rate.grossMinPerHour * preferences.hours
  const grossMax = rate.grossMaxPerHour * preferences.hours
  const expenses = preferences.expenseFuel + preferences.expenseMaintenance + preferences.expenseOther
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
  return { grossMin: round(grossMin), grossMax: round(grossMax), expenses: round(expenses), afterExpensesMin: round(grossMin - expenses), afterExpensesMax: round(grossMax - expenses), hourlyMin: rate.grossMinPerHour, hourlyMax: rate.grossMaxPerHour }
}
