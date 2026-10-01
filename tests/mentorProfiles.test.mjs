import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createDemoProfiles } from '../src/data/demoProfiles.ts'
import { dateInLima } from '../src/domain/demoDates.ts'
import { startIntervention, addDemoDelivery } from '../src/domain/returnTracking.ts'
import { copyConfiguration } from '../src/domain/projectionConfiguration.ts'
import { readFile } from 'node:fs/promises'

const reference = new Date('2026-09-30T19:00:00.000Z')
const memory = new Map([['vuelve-a-tu-ritmo:session-reference:v3', reference.toISOString()]])
globalThis.sessionStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
const { createDemoState, loadDemoState, saveDemoState, DEMO_STORAGE_KEY } = await import('../src/services/demoStorage.ts')
const { createMentorProfileService } = await import('../src/services/mentor.local.ts')
// B-01 keeps testing its legacy-session reader; the public entry now selects the full motor.
const { localMentorProfileService: mentorService } = await import('../src/services/mentor.local.ts')
const profiles = createDemoProfiles(reference)
beforeEach(() => { memory.clear(); saveDemoState(createDemoState(profiles, reference)) })

async function snapshot(id, service = mentorService) {
  const response = await service.getProfile(id)
  assert.equal(response.ok, true, JSON.stringify(response))
  assert.equal(response.revision, response.data.revision)
  return response.data
}

test('B01 exposes all eight scenarios and a complete serializable contract to A', async () => {
  const list = await mentorService.listProfiles()
  assert.equal(list.ok, true)
  assert.equal(list.data.length, 8)
  assert.equal(new Set(list.data.map(item => item.id)).size, 8)
  const days = { active: 4, 'interruption-10': 10, 'inactive-recent': 20, 'inactive-31-60': 45, 'inactive-over-60': 75, 'declared-pause': 28, 'no-deliveries': null, blocked: 42 }
  for (const [id, inactiveDays] of Object.entries(days)) {
    const data = await snapshot(id)
    assert.equal(data.contractVersion, '1.0')
    assert.deepEqual(data.profile, list.data.find(item => item.id === id))
    assert.equal(data.eligibility.daysInactive, inactiveDays)
    assert.equal(data.clock.referenceAt, reference.toISOString())
    assert.equal(data.clock.observedAt, reference.toISOString())
    assert.equal(data.clock.timeZone, 'America/Lima')
    assert.equal(data.profile.simulated, true)
    assert.ok(data.profile.vehicle && data.profile.zoneId && data.profile.accountStatus)
    assert.equal(data.progress.configuration.vehicle, data.profile.vehicle)
    assert.ok(data.preferences.channels)
    assert.equal(data.deliveries.every(item => item.profileId === id && item.simulated), true)
    assert.deepEqual(JSON.parse(JSON.stringify(data)), data, 'snapshot contains only JSON values')
  }
  assert.equal((await snapshot('blocked')).eligibility.reason, 'blocked')
  assert.equal((await snapshot('interruption-10')).eligibility.eligible, false)
  const paused = await snapshot('declared-pause')
  assert.equal(paused.eligibility.eligible, true, 'declared pause is independent of eligibility')
  assert.equal(paused.pause.status, 'active')
  assert.equal(paused.contactPermission.canSendExternalInvitation, false)
  assert.equal(paused.contactPermission.reason, 'paused')
})

test('B01 consulting and listing never reset or write the current session', async () => {
  const before = memory.get(DEMO_STORAGE_KEY)
  await mentorService.listProfiles()
  await snapshot('inactive-recent')
  await snapshot('inactive-recent')
  assert.equal(memory.get(DEMO_STORAGE_KEY), before)
  assert.equal((await snapshot('inactive-recent')).progress.interventionStartedAt, null)
  assert.deepEqual((await snapshot('inactive-recent')).invitations, [])
  assert.equal((await mentorService.getProfile('unknown')).error.code, 'NOT_FOUND')
  assert.equal(memory.get(DEMO_STORAGE_KEY), before)
})

test('B01 example shared with A matches the actual service response', async () => {
  const date = new Date('2026-10-01T15:00:00.000Z')
  const seeds = createDemoProfiles(date)
  const state = createDemoState(seeds, date)
  const service = createMentorProfileService({ profiles: seeds, referenceDate: date, readState: () => state })
  const example = JSON.parse(await readFile(new URL('../docs/integracion/ejemplo-perfil-camila.json', import.meta.url), 'utf8'))
  assert.deepEqual(await service.getProfile('inactive-recent'), example)
})

test('B01 returns detached data; modifying results cannot change another read or profile', async () => {
  const camila = await snapshot('inactive-recent')
  const original = structuredClone(camila)
  camila.deliveries[0].status = 'cancelled'
  camila.preferences.channels.app = false
  camila.progress.configuration.hours = 12
  camila.profile.name = 'Changed'
  camila.legacyGoalNotes.push('Not persisted')
  const list = await mentorService.listProfiles()
  list.data[0].zoneId = 'surco'
  assert.deepEqual(await snapshot('inactive-recent'), original)
  assert.equal((await snapshot('inactive-31-60')).profile.name, 'Marco Salas')
})

test('B01 fresh reads expose saved preferences, notes and progress; revisions isolate changes', async () => {
  const originalMarco = await snapshot('inactive-31-60')
  const state = loadDemoState(profiles)
  const data = state.profileDataById['inactive-recent']
  data.goals = ['Revisar los gastos de mi bicicleta']
  data.preferences.hours = 1
  data.preferences.programStep = 'projection'
  data.preferences.returnNeed = 'time'
  data.preferences.comparisonOption = { ...copyConfiguration(data.preferences), hours: 3, zone: 'Surco' }
  saveDemoState(state)
  const updated = await snapshot('inactive-recent')
  assert.equal(updated.revision, 1)
  assert.equal(updated.progress.configuration.hours, 1)
  assert.equal(updated.progress.comparisonConfiguration.zone, 'Surco')
  assert.equal(updated.progress.need, 'time')
  assert.equal(updated.progress.currentProjection.status, 'available')
  assert.deepEqual(updated.legacyGoalNotes, data.goals)
  assert.deepEqual(updated.goals, [], 'old text goals do not invent monetary amounts')
  assert.deepEqual(updated.contributions, [])
  assert.deepEqual(await snapshot('inactive-31-60'), originalMarco)
  saveDemoState(state)
  assert.equal((await snapshot('inactive-recent')).revision, 1, 'identical writes do not bump revision')
  assert.equal(state.profileDataById['inactive-recent'].revision, 0, 'saving does not mutate React state')
  saveDemoState(loadDemoState(profiles))
  assert.equal((await snapshot('inactive-recent')).revision, 1, 'loading and saving is stable')
})

test('B01 shares the demo timeline and updates history after a simulated return', async () => {
  let state = loadDemoState(profiles)
  const beforeMarco = await snapshot('inactive-31-60')
  const camila = state.profileDataById['inactive-recent']
  camila.returnTracking = startIntervention(camila.returnTracking, reference)
  camila.returnTracking.observedAt = reference.toISOString()
  state.profileDataById['inactive-recent'] = addDemoDelivery(camila, 'completed', reference, 'delivery-return')
  saveDemoState(state)
  const returned = await snapshot('inactive-recent')
  assert.equal(returned.eligibility.daysInactive, 0)
  assert.equal(returned.eligibility.eligible, false)
  assert.match(returned.profile.scenario, /^Activo/)
  assert.equal(returned.progress.eligibleAtStart, true)
  assert.equal(returned.progress.returnDeliveryId, 'delivery-return')
  assert.equal(returned.profile.lastCompletedAt, '2026-09-30T19:01:00.000Z')
  assert.equal(returned.clock.observedAt, '2026-09-30T19:01:00.000Z')
  assert.equal(returned.clock.referenceAt, reference.toISOString())
  assert.deepEqual(await snapshot('inactive-31-60'), beforeMarco)
  const list = await mentorService.listProfiles()
  assert.deepEqual(list.data.find(item => item.id === 'inactive-recent'), returned.profile)
})

test('B01 reference dates in future years keep ages stable and use Lima across midnight', async () => {
  for (const timestamp of ['2026-10-01T02:30:00Z', '2030-01-01T02:30:00Z']) {
    const date = new Date(timestamp)
    const seeds = createDemoProfiles(date)
    const state = createDemoState(seeds, date)
    const service = createMentorProfileService({ profiles: seeds, referenceDate: date, readState: () => state })
    const profile = await snapshot('inactive-recent', service)
    assert.equal(profile.eligibility.daysInactive, 20)
    assert.equal(profile.progress.configuration.moment, 'Noche')
    assert.equal(profile.clock.referenceAt, date.toISOString())
    assert.equal(profile.preferences.consentRecordedAt, date.toISOString())
    assert.equal(dateInLima(new Date(profile.clock.referenceAt)), timestamp.startsWith('2030') ? '2029-12-31' : '2026-09-30')
    const original = profile.clock.referenceAt
    date.setUTCFullYear(2040)
    seeds[0].name = 'Changed seed'
    assert.equal((await snapshot('inactive-recent', service)).clock.referenceAt, original)
    assert.equal((await snapshot('inactive-recent', service)).profile.name, 'Camila Torres')
  }
})

test('B01 old or corrupt state cannot manufacture consent, monetary goals or timestamps', async () => {
  const state = loadDemoState(profiles)
  const old = state.profileDataById['inactive-recent']
  delete old.revision
  delete old.preferences.channels
  delete old.preferences.remindersAllowed
  delete old.preferences.consentRecordedAt
  old.goals = ['Comprar una bicicleta']
  memory.set(DEMO_STORAGE_KEY, JSON.stringify(state))
  const migrated = await snapshot('inactive-recent')
  assert.equal(migrated.revision, 0)
  assert.equal(migrated.preferences.consentRecordedAt, null)
  assert.equal(migrated.contactPermission.canSendExternalInvitation, false)
  assert.equal(migrated.contactPermission.reason, 'no-consent')
  assert.deepEqual(migrated.goals, [])
  assert.deepEqual(migrated.legacyGoalNotes, old.goals)
  assert.equal(migrated.cases[0].createdAt, null)
  memory.set(DEMO_STORAGE_KEY, '{bad json')
  saveDemoState(createDemoState(profiles, reference))
  assert.equal((await snapshot('inactive-recent')).eligibility.daysInactive, 20)
  const failed = createMentorProfileService({ profiles, referenceDate: reference, readState: () => { throw new Error('private internal details') } })
  const response = await failed.getProfile('inactive-recent')
  assert.equal(response.ok, false)
  assert.equal(response.error.code, 'UNEXPECTED')
  assert.doesNotMatch(response.error.message, /private internal details/)
})
