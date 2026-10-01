import type { DemoProfile } from '../data/demoProfiles'
import { getReactivationEligibility, type DeliveryRecord } from '../domain/eligibility.ts'

/** Presenter labels follow the profile's current history, including simulated deliveries. */
export function profileWithHistory(seed: DemoProfile, history: DeliveryRecord[], reference: Date): DemoProfile {
  const completed = history.filter(item => item.status === 'completed')
  const lastDeliveryAt = completed.length ? completed.reduce((latest, item) => Date.parse(item.completedAt) > Date.parse(latest) ? item.completedAt : latest, completed[0].completedAt) : null
  let scenario = seed.scenario
  if (lastDeliveryAt !== seed.lastDeliveryAt && seed.accountStatus === 'active') {
    const eligibility = getReactivationEligibility(history, reference, seed.accountStatus)
    if (eligibility.eligible) scenario = `Inactivo de ${eligibility.daysInactive} días`
    else if (eligibility.reason === 'active') scenario = `Activo · ${eligibility.daysInactive} días desde su última entrega`
    else if (eligibility.reason === 'no-completed-delivery') scenario = 'Sin entregas previas'
  }
  return { ...seed, scenario, lastDeliveryAt, deliveries: history }
}
