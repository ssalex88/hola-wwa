import type { PilotParticipant } from '../domain/pilotEvaluation.ts'
const DAY = 86_400_000
/** Independent fictional cohort, with both answered and unanswered assignments. */
export function createPilotCohort(reference: Date): PilotParticipant[] {
  return ['intervention', 'comparison'].flatMap(group => [20, 45, 80].flatMap((pause, bandIndex) => [50, 20, 20, 5].map((age, index) => {
    const id = `PILOTO-${group === 'intervention' ? 'I' : 'C'}-${pause}-${index + 1}`
    const assigned = reference.getTime() - age * DAY
    const at = (days: number) => new Date(assigned + days * DAY).toISOString()
    let returnDay: number | null = index === 0 ? 2 : index === 1 ? 7 : null
    if (group === 'intervention') {
      if (bandIndex === 0 && index === 2) returnDay = 6 // Spontaneous return despite no flow entry.
      if (bandIndex === 2 && index === 0) returnDay = null
    } else {
      if (index === 1) returnDay = bandIndex === 2 ? 8 : 16
      if (index === 2 && bandIndex === 1) returnDay = 4
    }
    const entry = group === 'intervention' && index < 2 ? { at: at(1), origin: index === 0 ? 'app' as const : 'external' as const } : null
    const deliveries = returnDay === null ? [] : [{ id: `${id}-REGRESO`, completedAt: at(returnDay), status: 'completed' as const }]
    if (returnDay !== null && index === 0 && bandIndex !== 1) deliveries.push({ id: `${id}-CONTINUA`, completedAt: at(returnDay + 24), status: 'completed' })
    return { id, group: group as PilotParticipant['group'], assignedAt: at(0), observedUntil: reference.toISOString(), accountStatus: 'active' as const,
      baselineDeliveries: [{ id: `${id}-PREVIA`, completedAt: at(-pause), status: 'completed' as const }], deliveries,
      entry, projections: entry ? index === 0 ? [at(1.1), at(1.2)] : [at(1.1)] : [], saves: entry ? [at(1.3)] : [],
      rejections: group === 'intervention' && index === 2 ? [{ at: at(2), kind: bandIndex === 0 ? 'now-no' as const : 'not-interested' as const }] : [], noContactRequests: group === 'intervention' && index === 2 && bandIndex > 0 ? [at(2)] : [] }
  })))
}
