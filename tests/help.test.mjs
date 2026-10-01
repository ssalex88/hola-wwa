import assert from 'node:assert/strict'
import test from 'node:test'
import { getNeedActions } from '../src/domain/returnHelp.ts'
import { saveHelpFollowup } from '../src/domain/invitations.ts'
import { copyConfiguration } from '../src/domain/projectionConfiguration.ts'

test('each explicit need offers the required actions and omitted answers allow continuation', () => {
  const actions = (need) => getNeedActions(need).map((item) => item.action)
  assert.deepEqual(actions('savings'), ['compare', 'incentives'])
  assert.deepEqual(actions('time'), ['adjust-time', 'save'])
  assert.deepEqual(actions('payment-order'), ['support'])
  assert.deepEqual(actions('personal-vehicle'), ['schedule'])
  assert.deepEqual(actions('other'), ['continue'])
  assert.deepEqual(actions('skipped'), ['continue'])
})

test('saved proposal is an independent snapshot including costs and calendar timing', () => {
  const current = { zone: 'Surco', hours: 3, moment: 'Tarde', vehicle: 'Moto', scheduleMode: 'another-day', scheduledDate: '2026-10-03', expenseFuel: 7, expenseMaintenance: 1, expenseOther: 2, returnNeed: 'time' }
  const saved = copyConfiguration(current)
  current.hours = 1
  current.expenseFuel = 20
  assert.equal(saved.hours, 3)
  assert.equal(saved.expenseFuel, 7)
  assert.equal(saved.scheduledDate, '2026-10-03')
  assert.equal('returnNeed' in saved, false)
})

test('explicit help contact requires a future date and cannot generate an invitation or modify permission', () => {
  const data = { requestedHelpFollowupDate: null, scheduledContactDatesByCampaign: {}, preferences: { allowProgramInvitations: false } }
  for (const date of ['', '2026-09-29', '2026-09-30', '2026-02-30', 'invalid']) assert.throws(() => saveHelpFollowup(data, date, '2026-09-30'), RangeError)
  const requested = saveHelpFollowup(data, '2026-10-02', '2026-09-30')
  assert.equal(requested.requestedHelpFollowupDate, '2026-10-02')
  assert.deepEqual(requested.scheduledContactDatesByCampaign, {})
  assert.equal(requested.preferences.allowProgramInvitations, false)
  assert.equal(data.requestedHelpFollowupDate, null)
  assert.equal(saveHelpFollowup(requested, null, '2026-09-30').requestedHelpFollowupDate, null)
})
