import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalMentorService } from '../src/services/mentor.local.ts'
import { referenceAt, unwrap } from './mentor.contract-suite.mjs'

const create = extra => createLocalMentorService({ referenceAt, storage: null, ...extra })
const introduction = 'Revisa cuánto podrías obtener según tu tiempo y zona.'

test('A-02: presentation offers calculation without starting intervention, contacts or income promises', async () => {
  const { service, getOperations } = create()
  const first = await service.getProfile('inactive-recent')
  const snapshot = unwrap(first)
  assert.equal(snapshot.mentor.text, introduction)
  assert.equal(snapshot.mentor.actions[0], 'calculate')
  assert.equal(snapshot.progress.interventionStartedAt, null)
  assert.equal(snapshot.progress.connectedAt, null)
  assert.deepEqual(snapshot.invitations, [])
  assert.deepEqual(snapshot.contributions, [])
  assert.deepEqual(await service.getProfile('inactive-recent'), first)
  assert.deepEqual(unwrap(await getOperations()).events, [])
})

test('A-02: active declared goal adapts advice through edit, archive, completion and reload per profile', async () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  const { service } = create({ storage })
  let n = 0
  const ctx = () => ({ profileId: 'inactive-recent', requestId: `presentation-${++n}` })
  let snapshot = unwrap(await service.saveGoal(ctx(), { name: 'Reparar bicicleta', targetAmount: 150, targetDate: null }))
  const goalId = snapshot.goals[0].id
  assert.ok(snapshot.mentor.text.startsWith(introduction))
  assert.ok(snapshot.mentor.text.includes('Tu meta declarada es «Reparar bicicleta».'))
  assert.equal(snapshot.mentor.actions[0], 'calculate')
  assert.equal(unwrap(await service.getProfile('inactive-31-60')).mentor.text, introduction)
  assert.deepEqual(await create({ storage }).service.getProfile('inactive-recent'), await service.getProfile('inactive-recent'))
  snapshot = unwrap(await service.saveGoal(ctx(), { goalId, name: 'Revisión de bicicleta', targetAmount: 200, targetDate: null }))
  assert.ok(snapshot.mentor.text.includes('«Revisión de bicicleta»'))
  assert.equal(snapshot.mentor.text.includes('Reparar bicicleta'), false)
  snapshot = unwrap(await service.saveContribution(ctx(), { goalId, amount: 200, contributedOn: '2026-10-01' }))
  assert.equal(snapshot.goalProgress[0].targetReached, true)
  assert.ok(snapshot.mentor.text.includes('«Revisión de bicicleta»'))
  snapshot = unwrap(await service.changeGoalStatus(ctx(), { goalId, status: 'completed' }))
  assert.equal(snapshot.mentor.text, introduction)
  unwrap(await service.changeGoalStatus(ctx(), { goalId, status: 'active' }))
  snapshot = unwrap(await service.changeGoalStatus(ctx(), { goalId, status: 'archived' }))
  assert.equal(snapshot.mentor.text, introduction)
})

test('A-02: account, pause and ineligibility states have distinct advice without reactivation pressure', async () => {
  const { service, admin } = create()
  const blocked = unwrap(await service.getProfile('blocked'))
  assert.equal(blocked.profile.accountStatus, 'blocked')
  assert.equal(blocked.eligibility.reason, 'blocked')
  assert.deepEqual(blocked.mentor.actions, ['help'])
  assert.ok(blocked.mentor.text.includes('acceso'))
  const paused = unwrap(await service.getProfile('declared-pause'))
  assert.equal(paused.pause.status, 'active')
  assert.equal(paused.contactPermission.reason, 'paused')
  assert.equal(paused.contactPermission.canShowAppInvitation, false)
  assert.ok(paused.mentor.text.includes('contactos están suspendidos'))
  assert.ok(paused.mentor.actions.includes('calculate'))
  for (const profileId of ['active', 'interruption-10', 'no-deliveries']) {
    const snapshot = unwrap(await service.getProfile(profileId))
    assert.equal(snapshot.eligibility.eligible, false)
    assert.ok(snapshot.mentor.text.includes('no cumple las condiciones'))
    assert.equal(snapshot.mentor.actions.includes('calculate'), false)
  }
  const goal = unwrap(await service.saveGoal({ profileId: 'inactive-recent', requestId: 'goal' }, { name: 'Mi meta', targetAmount: 150, targetDate: null })).goals[0]
  const pause = unwrap(await service.activatePause({ profileId: 'inactive-recent', requestId: 'pause' }, { endsAt: '2026-10-02T15:00:00.000Z', reason: null }))
  assert.equal(pause.mentor.text.includes('Mi meta'), false)
  unwrap(await admin.advanceClock({ observedAt: '2026-10-02T15:00:00.000Z' }))
  const expired = unwrap(await service.getProfile('inactive-recent'))
  assert.equal(expired.pause.status, 'expired')
  assert.ok(expired.mentor.text.startsWith(introduction))
  assert.ok(expired.mentor.text.includes(goal.name))
})

test('A-02: explicit needs preserve their actions and eligibility at start permits voluntary continuation after return', async () => {
  const { service, admin } = create()
  let n = 0
  const ctx = () => ({ profileId: 'inactive-recent', requestId: `journey-${++n}` })
  unwrap(await service.saveGoal(ctx(), { name: 'Reparar bicicleta', targetAmount: 150, targetDate: null }))
  const time = unwrap(await service.updateProgress(ctx(), { need: 'time' }))
  assert.deepEqual(time.mentor.actions, ['shorten', 'save'])
  assert.ok(time.mentor.text.includes('Reparar bicicleta'))
  unwrap(await service.updateProgress(ctx(), { need: null }))
  unwrap(await service.startProgram(ctx(), { origin: 'app' }))
  unwrap(await admin.advanceClock({ observedAt: '2026-10-01T15:01:00.000Z' }))
  const returned = unwrap(await admin.registerDelivery(ctx(), { id: 'presentation-return', status: 'completed', completedAt: '2026-10-01T15:01:00.000Z' }))
  assert.equal(returned.eligibility.eligible, false)
  assert.equal(returned.progress.eligibleAtStart, true)
  assert.ok(returned.mentor.actions.includes('calculate'))
  assert.ok(returned.mentor.text.startsWith(introduction))
})
