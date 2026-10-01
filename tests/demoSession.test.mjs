import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemoProfiles } from '../src/data/demoProfiles.ts'
import { getReactivationEligibility } from '../src/domain/eligibility.ts'
import { addDemoDelivery } from '../src/domain/returnTracking.ts'

const local = new Map()
const session = new Map([['vuelve-a-tu-ritmo:session-reference:v3', '2026-09-30T19:00:00.000Z']])
const adapter = memory => ({ getItem: key => memory.get(key) ?? null, setItem: (key,value) => memory.set(key,value), removeItem: key => memory.delete(key) })
globalThis.localStorage = adapter(local)
globalThis.sessionStorage = adapter(session)
const { DEMO_REFERENCE_DATE } = await import('../src/services/demoClock.ts')
const { saveDemoState, DEMO_STORAGE_KEY } = await import('../src/services/demoStorage.ts')
const { startDemoSession, resetDemoSession } = await import('../src/services/demoSession.ts')
const profiles = createDemoProfiles(DEMO_REFERENCE_DATE)

test('root bootstrap restores eligibility after deliveries and ignores retired data without deleting unrelated keys', () => {
  let state = startDemoSession(profiles, { kind: 'home' })
  state.profileDataById['inactive-recent'] = addDemoDelivery(state.profileDataById['inactive-recent'], 'completed', DEMO_REFERENCE_DATE, 'completed-demo')
  state.profileDataById['inactive-recent'].preferences.allowProgramInvitations = false
  saveDemoState(state)
  local.set('another-app:key', 'keep me')
  session.set('another-app:session', 'keep too')
  local.set('vuelve-a-tu-ritmo:demo:v1', JSON.stringify(state))
  state = startDemoSession(profiles, { kind: 'home' })
  assert.equal(state.selectedProfileId, 'inactive-recent')
  assert.equal(state.profileDataById['inactive-recent'].preferences.allowProgramInvitations, true)
  assert.equal(getReactivationEligibility(state.profileDataById['inactive-recent'].deliveryHistory, DEMO_REFERENCE_DATE).daysInactive, 20)
  assert.equal(local.get('another-app:key'), 'keep me')
  assert.equal(session.get('another-app:session'), 'keep too')
  assert.equal(local.has('vuelve-a-tu-ritmo:demo:v1'), false)
})

test('program resume preserves session progress; direct external entry prepares a fresh eligible profile', () => {
  const state = startDemoSession(profiles, { kind: 'home' })
  const data = state.profileDataById['inactive-31-60']
  data.preferences.hours = 3
  data.preferences.otherNeedDetail = 'Necesito organizarme'
  data.dismissedCampaignIds = ['pilot-reactivation-v1']
  saveDemoState(state)
  const resumed = startDemoSession(profiles, { kind: 'program', profileId: 'inactive-31-60' })
  assert.equal(resumed.profileDataById['inactive-31-60'].preferences.hours, 3)
  assert.deepEqual(resumed.profileDataById['inactive-31-60'].dismissedCampaignIds, data.dismissedCampaignIds)
  const external = startDemoSession(profiles, { kind: 'invitation', profileId: 'inactive-31-60' })
  assert.equal(external.selectedProfileId, 'inactive-31-60')
  assert.equal(external.profileDataById['inactive-31-60'].preferences.hours, 2)
  assert.deepEqual(external.profileDataById['inactive-31-60'].dismissedCampaignIds, [])
  assert.equal(getReactivationEligibility(external.profileDataById['inactive-31-60'].deliveryHistory, DEMO_REFERENCE_DATE).eligible, true)
})

test('complete reset removes all profiles progress, plans, reminders, contacts and pilot costs', () => {
  const state = startDemoSession(profiles, { kind: 'home' })
  for (const data of Object.values(state.profileDataById)) {
    data.preferences.savedProposals = [{ id: 'saved', reminder: { status: 'scheduled' } }]
    data.goals = ['Organizar una salida corta']
    data.preferences.allowProgramInvitations = false
    data.invitationResponses = { campaign: 'not-interested' }
    data.returnTracking.interventionStartedAt = DEMO_REFERENCE_DATE.toISOString()
    data.support.requests = { case: DEMO_REFERENCE_DATE.toISOString() }
  }
  saveDemoState(state)
  local.set('vuelve-a-tu-ritmo:pilot-costs:v1:all', '{"operations":"50"}')
  const clean = resetDemoSession(profiles)
  for (const [id, data] of Object.entries(clean.profileDataById)) {
    assert.deepEqual(data.goals, [])
    assert.deepEqual(data.preferences.savedProposals, [])
    assert.deepEqual(data.invitationResponses, {})
    assert.deepEqual(data.support.requests, {})
    assert.equal(data.returnTracking.interventionStartedAt, null)
    assert.equal(data.preferences.allowProgramInvitations, !profiles.find(profile => profile.id === id).declaredPause)
  }
  assert.equal(local.has('vuelve-a-tu-ritmo:pilot-costs:v1:all'), false)
  assert.equal(JSON.parse(session.get(DEMO_STORAGE_KEY)).selectedProfileId, 'inactive-recent')
})
