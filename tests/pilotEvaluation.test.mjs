import test from 'node:test'
import assert from 'node:assert/strict'
import { createPilotCohort } from '../src/data/pilotCohort.ts'
import { evaluateParticipant, evaluatePilot, incrementalReturnCost } from '../src/domain/pilotEvaluation.ts'
const reference = new Date('2026-09-30T19:00:00Z')
const DAY = 86_400_000
const cohort = createPilotCohort(reference)
const base = cohort[0]
const at = days => new Date(Date.parse(base.assignedAt) + days * DAY).toISOString()

test('HU17 assigned denominators include nonresponders and spontaneous returns; events and users are distinct', () => {
  const results = evaluatePilot(cohort, reference)
  assert.equal(results.intervention.assigned, 12)
  assert.equal(results.comparison.assigned, 12)
  assert.equal(results.intervention.entered, 6)
  assert.equal(results.intervention.appEntries, 3)
  assert.equal(results.intervention.externalEntries, 3)
  assert.equal(results.intervention.unanswered, 6)
  assert.equal(results.intervention.projections, 9)
  assert.equal(results.intervention.projectionUsers, 6)
  assert.equal(results.intervention.saves, 6)
  assert.equal(results.intervention.returned14, 6)
  assert.equal(results.comparison.returned14, 5)
  assert.equal(results.intervention.reactivationRate, 6 / 12)
  assert.equal(results.comparison.reactivationRate, 5 / 12)
  assert.equal(results.intervention.pending14, 3)
  assert.equal(results.intervention.noReturn14Complete, 3)
  assert.equal(results.intervention.rejected, 3)
  assert.equal(results.intervention.noContact, 2)
  const recent = evaluatePilot(cohort, reference, '15–30 días')
  assert.equal(recent.intervention.assigned, 4)
  assert.equal(recent.intervention.returned14, 3)
  assert.equal(recent.participants.find(person => person.id === 'PILOTO-I-20-3').origin, null)
  assert.ok(recent.participants.every(person => person.band === '15–30 días'))
})
test('HU17 14-day boundary is inclusive; pending coverage never becomes failure or uses future events', () => {
  const person = { ...base, deliveries: [{ id: 'boundary', status: 'completed', completedAt: at(14) }], observedUntil: at(14) }
  assert.equal(evaluateParticipant(person, reference).returned14, true)
  assert.equal(evaluateParticipant({ ...person, deliveries: [{ ...person.deliveries[0], completedAt: new Date(Date.parse(at(14)) + 1).toISOString() }] }, reference).returned14, false)
  const pending = { ...person, observedUntil: at(13), entry: { at: at(14), origin: 'external' }, projections: [at(14)], saves: [at(14)], rejections: [{ at: at(14), kind: 'not-interested' }], noContactRequests: [at(14)] }
  const result = evaluatePilot([pending], new Date('2027-01-01T00:00:00Z')).intervention
  assert.equal(result.pending14, 1)
  assert.equal(result.noReturn14Complete, 0)
  assert.equal(result.returns, 0)
  assert.equal(result.entered, 0)
  assert.equal(result.projections, 0)
  assert.equal(result.saves, 0)
  assert.equal(result.rejected, 0)
  assert.equal(result.noContact, 0)
})
test('HU17 continuity uses days 24 through 30 relative to first return, excluding canceled and later deliveries', () => {
  const returns = [0, 24, 30, 31].map((day, index) => ({ id: String(index), status: 'completed', completedAt: at(day + 2) }))
  const result = evaluateParticipant({ ...base, deliveries: returns }, reference)
  assert.equal(result.continued, true)
  assert.equal(result.continuityComplete, true)
  assert.equal(evaluateParticipant({ ...base, deliveries: [returns[0], returns[3]] }, reference).continued, false)
  assert.equal(evaluateParticipant({ ...base, deliveries: [returns[0], { ...returns[1], status: 'cancelled' }] }, reference).continued, false)
  const pending = evaluatePilot([{ ...base, deliveries: returns, observedUntil: at(25) }], reference).intervention
  assert.equal(pending.pendingContinuity, 1)
  assert.equal(pending.noContinuityComplete, 0)
  assert.equal(pending.continued, 0)
  const earlySuccess = evaluateParticipant({ ...base, deliveries: returns, observedUntil: at(26) }, reference)
  assert.equal(earlySuccess.continued, true)
  assert.equal(earlySuccess.continuityComplete, false)
})
test('HU17 ineligible assignments, unknown coverage and duplicate participants do not inflate results', () => {
  assert.equal(evaluateParticipant({ ...base, accountStatus: 'blocked' }, reference), null)
  assert.equal(evaluateParticipant({ ...base, baselineDeliveries: [] }, reference), null)
  assert.equal(evaluateParticipant({ ...base, baselineDeliveries: [{ id: 'active', status: 'completed', completedAt: at(-14) }] }, reference), null)
  assert.equal(evaluateParticipant({ ...base, observedUntil: 'bad' }, reference), null)
  assert.equal(evaluatePilot([base, base], reference).intervention.assigned, 1)
})
test('HU17 incremental cost normalizes group sizes and is unavailable for zero/negative differences or invalid costs', () => {
  const positive = incrementalReturnCost({ assigned: 10, reactivationRate: .5 }, { assigned: 20, reactivationRate: .3 }, [40, 50, 10])
  assert.equal(positive.additionalReturns, 2)
  assert.equal(positive.costPerAdditionalReturn, 50)
  for (const rate of [.5, .6]) assert.equal(incrementalReturnCost({ assigned: 10, reactivationRate: .5 }, { assigned: 20, reactivationRate: rate }, [100]).reason, 'no-positive-difference')
  for (const costs of [[], [NaN], [-1], [Infinity], [1e308, 1e308]]) assert.equal(incrementalReturnCost({ assigned: 10, reactivationRate: .5 }, { assigned: 20, reactivationRate: .3 }, costs).reason, 'invalid-costs')
  assert.equal(incrementalReturnCost({ assigned: 0, reactivationRate: null }, { assigned: 20, reactivationRate: .3 }, [100]).reason, 'no-groups')
})
