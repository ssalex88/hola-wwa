import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoProfiles } from '../src/data/demoProfiles.ts'
const memory = new Map()
globalThis.sessionStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
const { loadDemoState, saveDemoState, initialProfileData } = await import('../src/services/demoStorage.ts')
const profiles = createDemoProfiles(new Date('2026-09-30T19:00:00Z'))

test('goals and declared invitation preferences belong to each profile, including older snapshots', () => {
  const state = loadDemoState(profiles)
  const camila = state.profileDataById['inactive-recent']
  const marco = state.profileDataById['inactive-31-60']
  camila.goals = ['Organizar una salida corta', 'Revisar mis gastos']
  marco.goals = ['Planear una salida otro día']
  camila.preferences.hours = 1
  marco.preferences.hours = 3
  saveDemoState(state)
  const loaded = loadDemoState(profiles)
  assert.deepEqual(loaded.profileDataById['inactive-recent'].goals, camila.goals)
  assert.deepEqual(loaded.profileDataById['inactive-31-60'].goals, marco.goals)
  assert.equal(loaded.profileDataById['inactive-recent'].preferences.hours, 1)
  assert.equal(loaded.profileDataById['inactive-31-60'].preferences.hours, 3)
  assert.equal(loaded.profileDataById['declared-pause'].preferences.allowProgramInvitations, false)
  assert.deepEqual(loaded.profileDataById['declared-pause'].goals, [])
  loaded.profileDataById['inactive-recent'] = initialProfileData(profiles[0])
  delete loaded.profileDataById['interruption-10'].goals
  saveDemoState(loaded)
  const reset = loadDemoState(profiles)
  assert.deepEqual(reset.profileDataById['inactive-recent'].goals, [])
  assert.deepEqual(reset.profileDataById['inactive-31-60'].goals, marco.goals)
  assert.deepEqual(reset.profileDataById['interruption-10'].goals, [], 'old data defaults to empty goals')
})

test('both proposals, their timing, step, expenses and invitation preferences survive reload per profile', () => {
  const state = loadDemoState(profiles)
  const data = state.profileDataById['inactive-recent']
  data.preferences.expenseFuel = 4.5
  data.preferences.programStep = 'comparison'
  data.preferences.comparisonOption = { ...data.preferences, scheduleMode: 'another-day', scheduledDate: '2026-10-06', zone: 'Miraflores', expenseFuel: 15 }
  data.preferences.allowProgramInvitations = false
  saveDemoState(state)
  const loaded = loadDemoState(profiles)
  const loadedData = loaded.profileDataById['inactive-recent']
  assert.equal(loadedData.preferences.programStep, 'comparison')
  assert.equal(loadedData.preferences.expenseFuel, 4.5)
  assert.equal(loadedData.preferences.comparisonOption.scheduledDate, '2026-10-06')
  assert.equal(loadedData.preferences.comparisonOption.expenseFuel, 15)
  assert.equal(loadedData.preferences.allowProgramInvitations, false)
  assert.equal(loaded.profileDataById['inactive-31-60'].preferences.comparisonOption, null)
  loaded.profileDataById['inactive-recent'] = initialProfileData(profiles[0])
  saveDemoState(loaded)
  assert.equal(loadDemoState(profiles).profileDataById['inactive-recent'].preferences.comparisonOption, null)
})

test('legacy comparison without scheduling fields loads safely and retains its expenses', () => {
  const state = loadDemoState(profiles)
  state.profileDataById['inactive-recent'].preferences.comparisonOption = { zone: 'Surco', hours: 7, moment: 'Noche', vehicle: 'Moto', expenseFuel: 8, expenseMaintenance: 1, expenseOther: 0 }
  saveDemoState(state)
  const loaded = loadDemoState(profiles).profileDataById['inactive-recent'].preferences.comparisonOption
  assert.equal(loaded.scheduleMode, 'now')
  assert.equal(loaded.scheduledDate, null)
  assert.equal(loaded.hours, 7)
  assert.equal(loaded.expenseFuel, 8)
})

test('HU11 snapshots, response, continuation and requested contact survive reload independently per profile', () => {
  const state = loadDemoState(profiles)
  const data = state.profileDataById['inactive-recent']
  data.preferences.returnNeed = 'personal-vehicle'
  data.preferences.proposalContinued = true
  data.preferences.savedProposal = { ...data.preferences, hours: 3, expenseFuel: 4, scheduleMode: 'another-day', scheduledDate: '2099-10-03' }
  data.requestedHelpFollowupDate = '2099-10-04'
  saveDemoState(state)
  const loaded = loadDemoState(profiles)
  const resumed = loaded.profileDataById['inactive-recent']
  assert.equal(resumed.preferences.returnNeed, 'personal-vehicle')
  assert.equal(resumed.preferences.proposalContinued, true)
  assert.equal(resumed.preferences.savedProposal.hours, 3)
  assert.equal(resumed.preferences.savedProposal.expenseFuel, 4)
  assert.equal(resumed.requestedHelpFollowupDate, '2099-10-04')
  assert.equal(loaded.profileDataById['inactive-31-60'].preferences.savedProposal, null)
  assert.equal(loaded.profileDataById['inactive-31-60'].requestedHelpFollowupDate, null)
  resumed.preferences.hours = 1
  assert.equal(resumed.preferences.savedProposal.hours, 3)
})

test('old proposalSaved marker migrates to a recoverable snapshot instead of losing the option', () => {
  const state = loadDemoState(profiles)
  const data = state.profileDataById['inactive-recent']
  delete data.preferences.savedProposal
  data.preferences.proposalSaved = true
  data.preferences.hours = 5
  saveDemoState(state)
  assert.equal(loadDemoState(profiles).profileDataById['inactive-recent'].preferences.savedProposal.hours, 5)
})

 test('HU12 enrollments and awards persist separately by profile; reset restores only that profile', () => {
  const state = loadDemoState(profiles)
  state.profileDataById['inactive-recent'].incentiveEnrollments = { 'demo-centro-three': '2026-09-30T19:00:00Z' }
  state.profileDataById['inactive-31-60'].incentiveEnrollments = { independent: '2026-09-30T19:00:00Z' }
  saveDemoState(state)
  const loaded = loadDemoState(profiles)
  assert.deepEqual(loaded.profileDataById['inactive-recent'].incentiveEnrollments, state.profileDataById['inactive-recent'].incentiveEnrollments)
  assert.deepEqual(loaded.profileDataById['inactive-recent'].incentiveAwards, state.profileDataById['inactive-recent'].incentiveAwards)
  loaded.profileDataById['inactive-recent'] = initialProfileData(profiles[0])
  saveDemoState(loaded)
  const reset = loadDemoState(profiles)
  assert.deepEqual(reset.profileDataById['inactive-recent'].incentiveEnrollments, {})
  assert.deepEqual(reset.profileDataById['inactive-31-60'].incentiveEnrollments, { independent: '2026-09-30T19:00:00Z' })
})

test('HU13 cases, selection and help request persist per profile and reset independently', () => {
  const state = loadDemoState(profiles)
  const data = state.profileDataById['inactive-recent']
  const id = data.support.cases[0].id
  data.support.selectedCaseId = id
  data.support.cases[0].status = 'in-review'
  data.support.requests[id] = '2026-09-30T19:00:00Z'
  saveDemoState(state)
  const loaded = loadDemoState(profiles)
  assert.deepEqual(loaded.profileDataById['inactive-recent'].support, data.support)
  assert.deepEqual(loaded.profileDataById['inactive-31-60'].support.requests, {})
  const other = loaded.profileDataById['inactive-31-60'].support
  loaded.profileDataById['inactive-recent'] = initialProfileData(profiles[0])
  saveDemoState(loaded)
  const reset = loadDemoState(profiles)
  assert.deepEqual(reset.profileDataById['inactive-recent'].support.requests, {})
  assert.equal(reset.profileDataById['inactive-recent'].support.selectedCaseId, null)
  assert.equal(reset.profileDataById['inactive-recent'].support.cases[0].status, 'pending')
  assert.deepEqual(reset.profileDataById['inactive-31-60'].support, other)
})

test('HU13 old data initializes support; unknown cases, statuses and malformed requests are discarded', () => {
  const state = loadDemoState(profiles)
  const data = state.profileDataById['inactive-recent']
  delete data.support
  saveDemoState(state)
  const old = loadDemoState(profiles)
  const support = old.profileDataById['inactive-recent'].support
  assert.equal(support.cases.length, 2)
  const known = support.cases[0].id
  support.cases[0].status = 'toString'
  support.cases.push({ id: 'foreign', status: 'resolved' })
  support.selectedCaseId = 'foreign'
  support.requests = { foreign: '2026-09-30T19:00:00Z', [known]: 'bad-date' }
  saveDemoState(old)
  const restored = loadDemoState(profiles).profileDataById['inactive-recent'].support
  assert.equal(restored.cases.length, 2)
  assert.equal(restored.cases[0].status, 'pending')
  assert.equal(restored.selectedCaseId, null)
  assert.deepEqual(restored.requests, {})
})

test('HU14 saved collection, reference and confirmed connection survive reload per profile', async () => {
  const { saveProposal } = await import('../src/domain/proposals.ts')
  const state = loadDemoState(profiles)
  const data = state.profileDataById['inactive-recent']
  data.preferences = { ...initialProfileData(profiles[0]).preferences, preferredContactDate: '2099-10-04' }
  data.preferences = saveProposal(data.preferences, new Date('2026-09-30T19:00:00Z'), 'saved-one')
  data.preferences = saveProposal({ ...data.preferences, hours: 3 }, new Date('2026-09-30T19:00:00Z'), 'saved-two')
  data.connection.connectedAt = '2026-09-30T19:00:00Z'
  saveDemoState(state)
  const restored = loadDemoState(profiles)
  assert.deepEqual(restored.profileDataById['inactive-recent'].preferences.savedProposals, data.preferences.savedProposals)
  assert.equal(restored.profileDataById['inactive-recent'].preferences.preferredContactDate, '2099-10-04')
  assert.equal(restored.profileDataById['inactive-recent'].connection.connectedAt, data.connection.connectedAt)
  assert.equal(restored.profileDataById['inactive-31-60'].connection.connectedAt, null)
})

test('HU15 reminders and simulated execution persist per profile; legacy or corrupt reminders stay off', async () => {
  const { saveProposal } = await import('../src/domain/proposals.ts')
  const { scheduleReminder, executeReminder } = await import('../src/domain/reminders.ts')
  const state = loadDemoState(profiles)
  const data = state.profileDataById['inactive-recent']
  data.preferences = initialProfileData(profiles[0]).preferences
  const reference = new Date('2026-09-30T19:00:00Z')
  data.preferences = saveProposal(data.preferences, reference, 'one')
  data.preferences = scheduleReminder(data.preferences, 'one', '2026-10-01', '08:30', reference)
  saveDemoState(state)
  const loaded = loadDemoState(profiles)
  assert.deepEqual(loaded.profileDataById['inactive-recent'].preferences.savedProposals[0].reminder, data.preferences.savedProposals[0].reminder)
  assert.deepEqual(loaded.profileDataById['inactive-31-60'].preferences.savedProposals, [])
  const current = loaded.profileDataById['inactive-recent']
  current.preferences = executeReminder(current.preferences, 'one', new Date('2026-10-01T13:30:00Z'))
  saveDemoState(loaded)
  assert.equal(loadDemoState(profiles).profileDataById['inactive-recent'].preferences.savedProposals[0].reminder.status, 'executed')
  current.preferences.savedProposals[0].reminder = { scheduledAt: 'bad', status: 'scheduled', executedAt: null }
  saveDemoState(loaded)
  assert.equal(loadDemoState(profiles).profileDataById['inactive-recent'].preferences.savedProposals[0].reminder, null)
  delete current.preferences.savedProposals[0].reminder
  saveDemoState(loaded)
  assert.equal(loadDemoState(profiles).profileDataById['inactive-recent'].preferences.savedProposals[0].reminder, null)
  loaded.profileDataById['inactive-recent'] = initialProfileData(profiles[0])
  saveDemoState(loaded)
  assert.deepEqual(loadDemoState(profiles).profileDataById['inactive-recent'].preferences.savedProposals, [])
})

test('HU16 intervention, simulated deliveries and feedback persist independently; reset removes return tracking', async () => {
  const { startIntervention, addDemoDelivery, recordReturnFeedback, getReturnResult } = await import('../src/domain/returnTracking.ts')
  const state = loadDemoState(profiles)
  const initial = initialProfileData(profiles[0])
  const reference = new Date('2026-09-30T19:00:00Z')
  initial.returnTracking = startIntervention(initial.returnTracking, reference)
  const returned = addDemoDelivery(initial, 'completed', reference, 'demo-return')
  returned.returnTracking = recordReturnFeedback(returned.returnTracking, returned.deliveryHistory, 'problem')
  state.profileDataById['inactive-recent'] = returned
  saveDemoState(state)
  const loaded = loadDemoState(profiles)
  const data = loaded.profileDataById['inactive-recent']
  assert.deepEqual(data.returnTracking, returned.returnTracking)
  assert.equal(getReturnResult(data.deliveryHistory, data.returnTracking).deliveryId, 'demo-return')
  assert.equal(loaded.profileDataById['inactive-31-60'].returnTracking.interventionStartedAt, null)
  loaded.profileDataById['inactive-recent'] = initialProfileData(profiles[0])
  saveDemoState(loaded)
  assert.equal(loadDemoState(profiles).profileDataById['inactive-recent'].returnTracking.interventionStartedAt, null)
  delete loaded.profileDataById['inactive-recent'].returnTracking
  saveDemoState(loaded)
  assert.equal(loadDemoState(profiles).profileDataById['inactive-recent'].returnTracking.interventionStartedAt, null)
})
