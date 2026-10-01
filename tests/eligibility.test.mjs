import assert from 'node:assert/strict'
import test from 'node:test'
import { getReactivationEligibility, getReactivationPriority } from '../src/domain/eligibility.ts'

const now = new Date('2026-09-30T12:00:00.000Z')
const delivery = (id, completedAt, status = 'completed') => ({ id, completedAt, status })

test('pilot attention prioritizes 15–30 before 31–60; ineligible profiles have no priority', () => {
  for (const [days, priority] of [[15, 1], [30, 1], [31, 2], [60, 2], [61, 3]]) {
    const history = [delivery('one', new Date(now.getTime() - days * 86400000).toISOString())]
    assert.equal(getReactivationPriority(getReactivationEligibility(history, now)), priority)
    assert.equal(getReactivationPriority(getReactivationEligibility(history, now, 'blocked')), null)
  }
  assert.equal(getReactivationPriority(getReactivationEligibility([], now)), null)
  assert.equal(getReactivationPriority(getReactivationEligibility([delivery('one', now.toISOString())], now)), null)
})

test('the 15-day boundary includes exactly 15 complete days', () => {
  const result = getReactivationEligibility([delivery('one', '2026-09-15T12:00:00.000Z')], now)
  assert.equal(result.eligible, true)
  assert.equal(result.daysInactive, 15)
})

test('one minute before the boundary is not eligible', () => {
  const result = getReactivationEligibility([delivery('one', '2026-09-15T12:01:00.000Z')], now)
  assert.deepEqual(result, { eligible: false, reason: 'active', daysInactive: 14 })
})

test('the latest completed delivery determines inactivity; cancellations do not reset it', () => {
  const deliveries = [
    delivery('old', '2026-08-01T12:00:00.000Z'),
    delivery('recent', '2026-09-25T12:00:00.000Z'),
    delivery('cancelled', '2026-09-29T12:00:00.000Z', 'cancelled'),
  ]
  assert.deepEqual(getReactivationEligibility(deliveries, now), { eligible: false, reason: 'active', daysInactive: 5 })
})

test('a cancelled-only history and invalid dates do not qualify', () => {
  assert.deepEqual(getReactivationEligibility([delivery('one', '2026-08-01T12:00:00.000Z', 'cancelled')], now), { eligible: false, reason: 'no-completed-delivery' })
  assert.deepEqual(getReactivationEligibility([delivery('one', 'bad-date')], now), { eligible: false, reason: 'invalid-date' })
})
