import test from 'node:test'
import assert from 'node:assert/strict'
import { getReturnResult, startIntervention, addDemoDelivery, recordReturnFeedback } from '../src/domain/returnTracking.ts'
import { getReactivationEligibility } from '../src/domain/eligibility.ts'
const reference = new Date('2026-09-30T19:00:00Z')
const empty = { interventionStartedAt: null, observedAt: null, feedback: null }
const delivery = (id, completedAt, status = 'completed') => ({ id, completedAt, status })
test('HU16 only a completed delivery strictly after a known intervention and within observed time records return', () => {
  const tracking = { ...startIntervention(empty, reference), observedAt: '2026-09-30T19:02:00Z' }
  const historical = delivery('before', '2026-09-10T19:00:00Z')
  const equal = delivery('equal', reference.toISOString())
  const cancelled = delivery('cancelled', '2026-09-30T19:01:00Z', 'cancelled')
  const invalid = delivery('bad', 'bad')
  const future = delivery('future', '2026-09-30T19:03:00Z')
  const ignored = [historical, equal, cancelled, invalid, future]
  assert.equal(getReturnResult(ignored, tracking), null)
  assert.equal(getReturnResult([delivery('after', '2026-09-30T19:01:00Z')], empty), null)
  const history = [...ignored, delivery('second', '2026-09-30T19:02:00Z'), delivery('first', '2026-09-30T19:01:00Z')]
  assert.deepEqual(getReturnResult(history, tracking), { deliveryId: 'first', returnedAt: '2026-09-30T19:01:00Z', completedSinceStart: 2 })
  assert.equal(startIntervention(tracking, new Date('2026-10-01T00:00:00Z')), tracking)
})
test('HU16 adding simulated deliveries advances only the profile timeline; cancellation does not reactivate', () => {
  const data = { deliveryHistory: [delivery('old', '2026-09-10T19:00:00Z')], returnTracking: startIntervention(empty, reference), preferences: { savedProposals: [], allowProgramInvitations: false, preferredContactDate: null }, connection: { connectedAt: reference.toISOString() } }
  assert.equal(getReturnResult(data.deliveryHistory, data.returnTracking), null)
  const cancelled = addDemoDelivery(data, 'cancelled', reference, 'cancel')
  assert.equal(getReturnResult(cancelled.deliveryHistory, cancelled.returnTracking), null)
  const completed = addDemoDelivery(cancelled, 'completed', reference, 'done')
  assert.equal(completed.returnTracking.observedAt, '2026-09-30T19:02:00.000Z')
  assert.equal(getReturnResult(completed.deliveryHistory, completed.returnTracking).deliveryId, 'done')
  assert.equal(getReactivationEligibility(completed.deliveryHistory, new Date(completed.returnTracking.observedAt), 'active').reason, 'active')
  assert.deepEqual(completed.preferences, data.preferences)
  assert.deepEqual(completed.connection, data.connection)
  assert.equal(addDemoDelivery(completed, 'completed', reference, 'done'), completed)
  const beforeStart = addDemoDelivery({ ...data, returnTracking: empty }, 'completed', reference, 'before-start')
  assert.equal(getReturnResult(beforeStart.deliveryHistory, beforeStart.returnTracking), null)
  const laterStart = startIntervention(beforeStart.returnTracking, new Date(beforeStart.returnTracking.observedAt))
  assert.equal(getReturnResult(beforeStart.deliveryHistory, laterStart), null)
})
test('HU16 feedback is optional and cannot be recorded before return; changing it has no delivery effects', () => {
  const tracking = startIntervention(empty, reference)
  assert.equal(recordReturnFeedback(tracking, [], 'good'), tracking)
  const returned = { ...tracking, observedAt: '2026-09-30T19:01:00Z' }
  const history = [delivery('done', '2026-09-30T19:01:00Z')]
  assert.equal(recordReturnFeedback(returned, history, 'problem').feedback, 'problem')
  assert.equal(recordReturnFeedback(returned, history, 'skipped').feedback, 'skipped')
  assert.equal(recordReturnFeedback(returned, history, 'invalid'), returned)
})
