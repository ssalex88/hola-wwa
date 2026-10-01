import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalMentorService } from '../src/services/mentor.local.ts'
import { referenceAt, configuration, unwrap, expectError } from './mentor.contract-suite.mjs'

const create = extra => createLocalMentorService({ storage: null, referenceAt, ...extra })
const contexts = () => { let n = 0; return () => ({ profileId: 'inactive-recent', requestId: `a11-${++n}` }) }
const save = async (service, ctx) => {
  const projection = unwrap(await service.calculateProjection(ctx(), configuration))
  return unwrap(await service.saveOption(ctx(), { projectionId: projection.id })).savedOptions[0].id
}

test('A-11: indefinite pause with null reason can be edited and ended without changing preferences or blocking voluntary access', async () => {
  const { service } = create(); const ctx = contexts()
  const before = unwrap(await service.getProfile('inactive-recent'))
  const request = ctx(); const input = { endsAt: null, reason: null }
  const first = await service.activatePause(request, input)
  let snapshot = unwrap(first)
  const pauseId = snapshot.pause.id
  assert.equal(snapshot.pause.endsAt, null)
  assert.equal(snapshot.pause.reason, null)
  assert.equal(snapshot.contactPermission.reason, 'paused')
  assert.deepEqual(snapshot.preferences, before.preferences)
  assert.ok(snapshot.mentor.text.includes('consultar opciones por tu cuenta'))
  assert.deepEqual(await service.activatePause(request, input), first)
  expectError(await service.presentInvitation(ctx(), { campaignId: 'pilot', origin: 'external', mode: 'simulated-contact' }), 'CONTACT_BLOCKED')
  unwrap(await service.getCatalog())
  unwrap(await service.exploreRoute({ originZoneId: 'lima-centro', destinationZoneId: 'surco' }))
  const optionId = await save(service, ctx)
  unwrap(await service.reviewOption(ctx(), { optionId }))
  snapshot = unwrap(await service.updatePause(ctx(), { pauseId, endsAt: '2026-10-03T15:00:00.000Z', reason: '  Descanso  ' }))
  assert.equal(snapshot.pause.id, pauseId)
  assert.equal(snapshot.pause.reason, 'Descanso')
  snapshot = unwrap(await service.updatePause(ctx(), { pauseId, endsAt: null, reason: null }))
  assert.equal(snapshot.pause.endsAt, null)
  snapshot = unwrap(await service.endPause(ctx(), { pauseId }))
  assert.equal(snapshot.pause.status, 'ended')
  assert.deepEqual(snapshot.preferences, before.preferences)
  assert.equal(snapshot.progress.connectedAt, null)
  assert.deepEqual(snapshot.reminders, [])
})

test('A-11: disabling all contact permissions and channels still permits voluntary start and projections', async () => {
  const { service } = create(); const ctx = contexts()
  const preferences = { allowProgramInvitations: false, channels: { app: false, external: false }, remindersAllowed: false, consentRecordedAt: null }
  const snapshot = unwrap(await service.updatePreferences(ctx(), preferences))
  assert.deepEqual(snapshot.preferences, preferences)
  assert.equal(snapshot.contactPermission.canShowAppInvitation, false)
  assert.equal(snapshot.contactPermission.canSendExternalInvitation, false)
  for (const origin of ['app', 'external']) expectError(await service.presentInvitation(ctx(), { campaignId: 'pilot', origin, mode: 'simulated-contact' }), 'CONTACT_BLOCKED')
  unwrap(await service.calculateProjection(ctx(), configuration))
  unwrap(await service.startProgram(ctx(), { origin: 'app' }))
  const after = unwrap(await service.getProfile('inactive-recent'))
  assert.deepEqual(after.preferences, preferences)
  assert.deepEqual(after.invitations, [])
  assert.deepEqual(after.reminders, [])
})

test('A-11: reminders support explicit creation, UTC editing and cancellation; pause never restores cancelled contacts', async () => {
  const { service, admin } = create(); const ctx = contexts()
  const savedOptionId = await save(service, ctx)
  const before = unwrap(await service.getProfile('inactive-recent'))
  unwrap(await service.updatePreferences(ctx(), { ...before.preferences, remindersAllowed: true }))
  let snapshot = unwrap(await service.scheduleReminder(ctx(), { savedOptionId, scheduledAt: '2026-10-02T13:30:00.000Z', explicitConsent: true }))
  const reminderId = snapshot.reminders[0].id
  const request = ctx(); const edit = { savedOptionId, reminderId, scheduledAt: '2026-10-02T14:45:00.000Z', explicitConsent: true }
  const edited = await service.scheduleReminder(request, edit)
  snapshot = unwrap(edited)
  assert.equal(snapshot.reminders.length, 1)
  assert.equal(snapshot.reminders[0].scheduledAt, edit.scheduledAt)
  assert.equal(snapshot.reminders[0].timeZone, 'America/Lima')
  assert.deepEqual(await service.scheduleReminder(request, edit), edited)
  snapshot = unwrap(await service.cancelReminder(ctx(), { reminderId }))
  assert.equal(snapshot.reminders[0].status, 'cancelled')
  expectError(await service.scheduleReminder(ctx(), edit), 'CONFLICT')
  snapshot = unwrap(await service.scheduleReminder(ctx(), { savedOptionId, scheduledAt: edit.scheduledAt, explicitConsent: true }))
  const pendingId = snapshot.reminders.at(-1).id
  snapshot = unwrap(await service.activatePause(ctx(), { endsAt: '2026-10-02T14:00:00.000Z', reason: null }))
  assert.ok(snapshot.reminders.every(item => item.status === 'cancelled'))
  expectError(await service.scheduleReminder(ctx(), { savedOptionId, scheduledAt: edit.scheduledAt, explicitConsent: true }), 'CONTACT_BLOCKED')
  unwrap(await admin.advanceClock({ observedAt: edit.scheduledAt }))
  snapshot = unwrap(await admin.executeReminder(ctx(), { reminderId: pendingId }))
  assert.equal(snapshot.pause.status, 'expired')
  assert.ok(snapshot.reminders.every(item => item.executedAt === null))
})

test('A-11: pause and preferences persist per profile; malformed inputs and foreign entities cannot change them', async () => {
  const data = new Map(); const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  const { service } = create({ storage }); const ctx = contexts()
  const other = unwrap(await service.getProfile('inactive-31-60'))
  const snapshot = unwrap(await service.activatePause(ctx(), { endsAt: null, reason: null }))
  for (const [method, input] of [['activatePause', null], ['updatePause', null], ['endPause', null], ['scheduleReminder', null], ['cancelReminder', null]]) {
    // An existing active pause correctly takes precedence for activatePause.
    expectError(await service[method](ctx(), input), method === 'activatePause' ? 'CONFLICT' : 'VALIDATION')
  }
  expectError(await service.updatePause(ctx(), { pauseId: snapshot.pause.id, endsAt: '', reason: null }), 'VALIDATION')
  expectError(await service.updatePreferences(ctx(), { ...snapshot.preferences, consentRecordedAt: '2026-10-02T15:00:00.000Z' }), 'VALIDATION')
  expectError(await service.endPause({ profileId: other.profile.id, requestId: 'foreign-pause' }, { pauseId: snapshot.pause.id }), 'NOT_FOUND')
  const reloaded = create({ storage }).service
  assert.deepEqual(unwrap(await reloaded.getProfile('inactive-recent')), snapshot)
  assert.deepEqual(unwrap(await reloaded.getProfile(other.profile.id)), other)
})
