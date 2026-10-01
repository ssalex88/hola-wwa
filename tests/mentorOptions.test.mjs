import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalMentorService } from '../src/services/mentor.local.ts'
import { configuration, referenceAt, unwrap, expectError } from './mentor.contract-suite.mjs'

const create = extra => createLocalMentorService({ storage: null, referenceAt, ...extra })
const contexts = () => { let n = 0; return () => ({ profileId: 'inactive-recent', requestId: `a10-${++n}` }) }
const save = async (service, ctx, input = configuration) => {
  const projection = unwrap(await service.calculateProjection(ctx(), input))
  const snapshot = unwrap(await service.saveOption(ctx(), { projectionId: projection.id }))
  return snapshot.savedOptions.at(-1)
}

test('A-10: saving, editing and deleting options preserves identity, avoids reservations and never connects', async () => {
  const { service } = create(); const ctx = contexts()
  const option = await save(service, ctx)
  assert.equal(option.isReservation, false)
  assert.equal(option.reminderId, null)
  const projection = unwrap(await service.calculateProjection(ctx(), { ...configuration, hours: 1, expenseMaintenance: 5 }))
  const request = ctx(); const input = { projectionId: projection.id, optionId: option.id }
  const result = await service.saveOption(request, input)
  const snapshot = unwrap(result)
  assert.equal(snapshot.savedOptions.length, 1)
  assert.equal(snapshot.savedOptions[0].id, option.id)
  assert.equal(snapshot.savedOptions[0].savedAt, option.savedAt)
  assert.equal(snapshot.savedOptions[0].configuration.hours, 1)
  assert.equal(snapshot.savedOptions[0].isReservation, false)
  assert.deepEqual(await service.saveOption(request, input), result)
  assert.equal(snapshot.progress.connectedAt, null)
  assert.equal(snapshot.progress.interventionStartedAt, null)
  assert.deepEqual(snapshot.reminders, [])
  expectError(await service.saveOption({ profileId: 'inactive-31-60', requestId: 'foreign' }, input), 'NOT_FOUND')
  expectError(await service.deleteOption({ profileId: 'inactive-31-60', requestId: 'foreign-delete' }, { optionId: option.id }), 'NOT_FOUND')
  assert.deepEqual(unwrap(await service.deleteOption(ctx(), { optionId: option.id })).savedOptions, [])
})

test('A-10: review recalculates now with current Lima slot and cancels only the changed option reminder', async () => {
  const { service, admin } = create(); const ctx = contexts()
  const option = await save(service, ctx, { ...configuration, moment: 'Mañana' })
  const baseline = unwrap(await service.getProfile('inactive-recent'))
  unwrap(await service.updatePreferences(ctx(), { ...baseline.preferences, remindersAllowed: true }))
  const scheduled = unwrap(await service.scheduleReminder(ctx(), { savedOptionId: option.id, scheduledAt: '2026-10-02T15:00:00.000Z', explicitConsent: true }))
  const reminderId = scheduled.savedOptions[0].reminderId
  unwrap(await admin.advanceClock({ observedAt: '2026-10-01T18:00:00.000Z' }))
  const request = ctx()
  const response = await service.reviewOption(request, { optionId: option.id })
  const reviewed = unwrap(response)
  assert.equal(reviewed.projection.status, 'available')
  assert.equal(reviewed.projection.configuration.moment, 'Tarde')
  assert.equal(reviewed.option.referenceAt, '2026-10-01T18:00:00.000Z')
  assert.notEqual(reviewed.option.projectionId, option.projectionId)
  assert.equal(reviewed.option.isReservation, false)
  assert.equal(reviewed.option.reminderId, null)
  assert.deepEqual(await service.reviewOption(request, { optionId: option.id }), response)
  const snapshot = unwrap(await service.getProfile('inactive-recent'))
  assert.equal(snapshot.reminders.find(item => item.id === reminderId).status, 'cancelled')
  assert.equal(snapshot.progress.connectedAt, null)
  assert.equal(snapshot.progress.interventionStartedAt, null)
})

test('A-10: review without configuration changes preserves voluntary reminder; editing cancels and deletion removes it', async () => {
  const { service } = create(); const ctx = contexts()
  const option = await save(service, ctx, { ...configuration, scheduleMode: 'another-day', scheduledDate: '2026-10-03' })
  const before = unwrap(await service.getProfile('inactive-recent'))
  unwrap(await service.updatePreferences(ctx(), { ...before.preferences, remindersAllowed: true }))
  const scheduled = unwrap(await service.scheduleReminder(ctx(), { savedOptionId: option.id, scheduledAt: '2026-10-02T15:00:00.000Z', explicitConsent: true }))
  const reminderId = scheduled.savedOptions[0].reminderId
  const reviewed = unwrap(await service.reviewOption(ctx(), { optionId: option.id }))
  assert.equal(reviewed.option.reminderId, reminderId)
  assert.equal(unwrap(await service.getProfile('inactive-recent')).reminders[0].status, 'scheduled')
  const edited = unwrap(await service.calculateProjection(ctx(), { ...reviewed.option.configuration, hours: 3 }))
  const snapshot = unwrap(await service.saveOption(ctx(), { optionId: option.id, projectionId: edited.id }))
  assert.equal(snapshot.savedOptions[0].reminderId, null)
  assert.equal(snapshot.reminders[0].status, 'cancelled')
  assert.deepEqual(unwrap(await service.deleteOption(ctx(), { optionId: option.id })).reminders, [])
})

test('A-10: reminders start disabled for every profile and enabling permission does not schedule one', async () => {
  const { service } = create(); const ctx = contexts()
  for (const profile of unwrap(await service.listProfiles())) {
    const snapshot = unwrap(await service.getProfile(profile.id))
    assert.equal(snapshot.preferences.remindersAllowed, false)
    assert.deepEqual(snapshot.reminders, [])
  }
  const option = await save(service, ctx)
  const input = { savedOptionId: option.id, scheduledAt: '2026-10-02T15:00:00.000Z', explicitConsent: true }
  expectError(await service.scheduleReminder(ctx(), input), 'CONTACT_BLOCKED')
  const before = unwrap(await service.getProfile('inactive-recent'))
  const enabled = unwrap(await service.updatePreferences(ctx(), { ...before.preferences, remindersAllowed: true }))
  assert.deepEqual(enabled.reminders, [])
  expectError(await service.scheduleReminder(ctx(), { ...input, explicitConsent: false }), 'VALIDATION')
  unwrap(await service.scheduleReminder(ctx(), input))
  const disabled = unwrap(await service.updatePreferences(ctx(), { ...before.preferences, remindersAllowed: false }))
  assert.equal(disabled.reminders[0].status, 'cancelled')
  assert.equal(disabled.progress.connectedAt, null)
})

test('A-10: connection requires true consent, is idempotent and does not imply a reservation or return', async () => {
  const { service } = create(); const ctx = contexts()
  const option = await save(service, ctx)
  for (const explicitConsent of [false, undefined, 'true', 1]) expectError(await service.confirmConnection(ctx(), { explicitConsent }), 'VALIDATION')
  assert.equal(unwrap(await service.getProfile('inactive-recent')).progress.connectedAt, null)
  const request = ctx(); const first = await service.confirmConnection(request, { explicitConsent: true })
  const snapshot = unwrap(first)
  assert.deepEqual(await service.confirmConnection(request, { explicitConsent: true }), first)
  assert.equal(snapshot.progress.connectedAt, referenceAt)
  assert.equal(snapshot.progress.returnedAt, null)
  assert.equal(snapshot.savedOptions[0].isReservation, false)
  assert.equal(snapshot.savedOptions[0].id, option.id)
  assert.deepEqual(snapshot.reminders, [])
  expectError(await service.confirmConnection({ profileId: 'blocked', requestId: 'blocked' }, { explicitConsent: true }), 'NOT_ELIGIBLE')
})
