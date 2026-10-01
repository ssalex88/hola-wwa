import { getPauseBand, getReactivationEligibility, type DeliveryRecord } from './eligibility.ts'

export type PilotGroup = 'intervention' | 'comparison'
export type PilotBand = '15–30 días' | '31–60 días' | 'Más de 60 días'
export interface PilotParticipant {
  id: string
  group: PilotGroup
  assignedAt: string
  observedUntil: string
  accountStatus: 'active' | 'blocked'
  baselineDeliveries: DeliveryRecord[]
  deliveries: DeliveryRecord[]
  entry: { at: string; origin: 'app' | 'external' } | null
  projections: string[]
  saves: string[]
  rejections: { at: string; kind: 'now-no' | 'not-interested' }[]
  noContactRequests: string[]
}
const DAY = 86_400_000
export function evaluateParticipant(person: PilotParticipant, reference: Date) {
  const assigned = Date.parse(person.assignedAt)
  const cutoff = Math.min(reference.getTime(), Date.parse(person.observedUntil))
  if (!Number.isFinite(assigned) || !Number.isFinite(cutoff) || assigned > cutoff) return null
  const eligibility = getReactivationEligibility(person.baselineDeliveries, new Date(assigned), person.accountStatus)
  if (!eligibility.eligible) return null
  const band = getPauseBand(eligibility.lastCompletedAt, new Date(assigned)) as PilotBand
  const observedEvent = (at: string) => Number.isFinite(Date.parse(at)) && Date.parse(at) >= assigned && Date.parse(at) <= cutoff
  const deliveries = person.deliveries.filter(item => item.status === 'completed' && Number.isFinite(Date.parse(item.completedAt)) && Date.parse(item.completedAt) > assigned && Date.parse(item.completedAt) <= cutoff)
  const returnedAt = deliveries.length ? Math.min(...deliveries.map(item => Date.parse(item.completedAt))) : null
  const window14Complete = cutoff >= assigned + 14 * DAY
  const returned14 = returnedAt !== null && returnedAt <= assigned + 14 * DAY
  const continued = returnedAt !== null && deliveries.some(item => Date.parse(item.completedAt) >= returnedAt + 24 * DAY && Date.parse(item.completedAt) < returnedAt + 31 * DAY)
  const continuityComplete = returnedAt !== null && cutoff >= returnedAt + 31 * DAY
  const entry = person.entry && observedEvent(person.entry.at) ? person.entry : null
  return { id: person.id, group: person.group, assignedAt: person.assignedAt, band, returnedAt: returnedAt === null ? null : new Date(returnedAt).toISOString(), returned14, window14Complete, continued, continuityComplete,
    origin: entry?.origin ?? null, projectionCount: person.projections.filter(at => entry && Date.parse(at) >= Date.parse(entry.at) && observedEvent(at)).length,
    saveCount: person.saves.filter(at => entry && Date.parse(at) >= Date.parse(entry.at) && observedEvent(at)).length,
    rejected: person.rejections.some(item => observedEvent(item.at)), nowNo: person.rejections.some(item => item.kind === 'now-no' && observedEvent(item.at)), notInterested: person.rejections.some(item => item.kind === 'not-interested' && observedEvent(item.at)), noContact: person.noContactRequests.some(observedEvent) }
}
export function evaluatePilot(people: PilotParticipant[], reference: Date, band: PilotBand | 'all' = 'all') {
  const unique = people.filter((person, index) => people.findIndex(other => other.id === person.id) === index)
  const participants = unique.flatMap(person => {
    const evaluated = evaluateParticipant(person, reference)
    return evaluated && (band === 'all' || evaluated.band === band) ? [evaluated] : []
  })
  const summarize = (group: PilotGroup) => {
    const members = participants.filter(person => person.group === group)
    const count = (predicate: (person: typeof members[number]) => boolean) => members.filter(predicate).length
    const assigned = members.length
    const returns = count(person => person.returnedAt !== null)
    const returned14 = count(person => person.returned14)
    const continued = count(person => person.continued)
    return { assigned, entered: count(person => person.origin !== null), appEntries: count(person => person.origin === 'app'), externalEntries: count(person => person.origin === 'external'), unanswered: count(person => person.origin === null), projections: members.reduce((sum, person) => sum + person.projectionCount, 0), projectionUsers: count(person => person.projectionCount > 0), saves: members.reduce((sum, person) => sum + person.saveCount, 0), savingUsers: count(person => person.saveCount > 0), returns, returned14, reactivationRate: assigned ? returned14 / assigned : null,
      pending14: count(person => !person.window14Complete), noReturn14Complete: count(person => person.window14Complete && !person.returned14), continued, continuityRate: returns ? continued / returns : null, pendingContinuity: count(person => person.returnedAt !== null && !person.continuityComplete), noContinuityComplete: count(person => person.returnedAt !== null && person.continuityComplete && !person.continued), rejected: count(person => person.rejected), nowNo: count(person => person.nowNo), notInterested: count(person => person.notInterested), noContact: count(person => person.noContact) }
  }
  return { participants, intervention: summarize('intervention'), comparison: summarize('comparison') }
}
export function incrementalReturnCost(intervention: { assigned: number; reactivationRate: number | null }, comparison: { assigned: number; reactivationRate: number | null }, costs: number[]) {
  if (!intervention.assigned || !comparison.assigned || intervention.reactivationRate === null || comparison.reactivationRate === null) return { difference: null, additionalReturns: null, costPerAdditionalReturn: null, reason: 'no-groups' as const }
  const difference = intervention.reactivationRate - comparison.reactivationRate
  const additionalReturns = difference * intervention.assigned
  if (difference <= 0) return { difference, additionalReturns, costPerAdditionalReturn: null, reason: 'no-positive-difference' as const }
  const totalCost = costs.reduce((sum, cost) => sum + cost, 0)
  if (!costs.length || costs.some(cost => !Number.isFinite(cost) || cost < 0) || !Number.isFinite(totalCost) || !Number.isFinite(totalCost / additionalReturns)) return { difference, additionalReturns, costPerAdditionalReturn: null, reason: 'invalid-costs' as const }
  return { difference, additionalReturns, costPerAdditionalReturn: totalCost / additionalReturns, reason: null }
}
