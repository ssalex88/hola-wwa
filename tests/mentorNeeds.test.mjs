import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalMentorService } from '../src/services/mentor.local.ts'
import { referenceAt, configuration, unwrap, expectError } from './mentor.contract-suite.mjs'

const create = extra => createLocalMentorService({ storage: null, referenceAt, ...extra })
const contexts = () => { let n = 0; return () => ({ profileId: 'inactive-recent', requestId: `a09-${++n}` }) }
const voluntaryState = snapshot => Object.fromEntries(['pause', 'preferences', 'invitations', 'reminders', 'savedOptions', 'cases', 'helpRequests', 'deliveries', 'goals', 'contributions', 'goalProgress'].map(key => [key, snapshot[key]]))

test('A-09: each recorded need returns its voluntary route after a projection without executing it', async () => {
  const { service, getOperations } = create(); const ctx = contexts()
  const projection = unwrap(await service.calculateProjection(ctx(), configuration))
  const before = unwrap(await service.getProfile('inactive-recent'))
  for (const [need, actions] of [
    ['savings', ['compare', 'incentives']], ['time', ['shorten', 'save']],
    ['payment-order', ['help']], ['personal-vehicle', ['pause', 'save']],
    ['other', ['continue']], ['skipped', ['continue']],
  ]) {
    const snapshot = unwrap(await service.updateProgress(ctx(), { need, step: 'decision' }))
    assert.equal(snapshot.progress.need, need)
    assert.deepEqual(snapshot.mentor.actions, actions)
    assert.deepEqual(snapshot.progress.currentProjection, projection)
    assert.equal(snapshot.progress.step, 'decision')
    assert.deepEqual(voluntaryState(snapshot), voluntaryState(before))
    for (const key of ['connectedAt', 'interventionStartedAt', 'returnedAt']) assert.equal(snapshot.progress[key], before.progress[key])
  }
  const events = unwrap(await getOperations()).events
  assert.equal(events.filter(item => item.action === 'calculateProjection').length, 1)
  assert.ok(events.every(item => ['calculateProjection', 'updateProgress'].includes(item.action)))
})

test('A-09: changing, explicitly skipping or clearing a response preserves the projection and permits continuation', async () => {
  const { service } = create(); const ctx = contexts()
  unwrap(await service.calculateProjection(ctx(), configuration))
  unwrap(await service.updateProgress(ctx(), { need: 'other', otherNeedDetail: '  Una dificultad personal  ' }))
  let snapshot = unwrap(await service.getProfile('inactive-recent'))
  assert.equal(snapshot.progress.otherNeedDetail, 'Una dificultad personal')
  snapshot = unwrap(await service.updateProgress(ctx(), { need: 'time', otherNeedDetail: '' }))
  assert.equal(snapshot.progress.otherNeedDetail, '')
  assert.deepEqual(snapshot.mentor.actions, ['shorten', 'save'])
  snapshot = unwrap(await service.updateProgress(ctx(), { need: 'skipped' }))
  assert.deepEqual(snapshot.mentor.actions, ['continue'])
  assert.ok(snapshot.mentor.text.includes('sin obligación'))
  snapshot = unwrap(await service.updateProgress(ctx(), { need: null }))
  assert.equal(snapshot.progress.need, null)
  assert.ok(snapshot.mentor.actions.includes('continue'))
  assert.equal(snapshot.progress.currentProjection.status, 'available')
  snapshot = unwrap(await service.updateProgress(ctx(), { step: 'decision' }))
  assert.equal(snapshot.progress.need, null)
})

test('A-09: responses persist per profile and exact retries never duplicate events or overwrite newer choices', async () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  const { service, getOperations } = create({ storage }); const ctx = contexts()
  const other = unwrap(await service.getProfile('inactive-31-60'))
  const request = { ...ctx(), expectedRevision: 0 }
  const input = { need: 'other', otherNeedDetail: 'Mi motivo' }
  const first = await service.updateProgress(request, input)
  unwrap(first)
  unwrap(await service.updateProgress(ctx(), { need: 'skipped', otherNeedDetail: '' }))
  const reloaded = create({ storage }).service
  assert.deepEqual(await reloaded.updateProgress(request, input), first)
  assert.equal(unwrap(await reloaded.getProfile(request.profileId)).progress.need, 'skipped')
  assert.equal(unwrap(await reloaded.getProfile(request.profileId)).progress.otherNeedDetail, '')
  assert.deepEqual(unwrap(await reloaded.getProfile('inactive-31-60')), other)
  assert.equal(unwrap(await getOperations()).events.filter(item => item.action === 'updateProgress').length, 2)
  expectError(await reloaded.updateProgress(request, { need: 'time' }), 'CONFLICT')
})

test('A-09: invalid needs or details roll back the response, step and previous advice', async () => {
  const { service } = create(); const ctx = contexts()
  const before = unwrap(await service.updateProgress(ctx(), { need: 'time' }))
  for (const input of [{ need: 'unknown' }, { need: 'other', otherNeedDetail: 'x'.repeat(281) }, { need: 'other', otherNeedDetail: null }]) {
    expectError(await service.updateProgress(ctx(), { ...input, step: 'decision' }), 'VALIDATION')
    assert.deepEqual(unwrap(await service.getProfile('inactive-recent')), before)
  }
})

test('A-09: access and pause advice retain priority over the response without removing its stored value', async () => {
  const { service } = create()
  let snapshot = unwrap(await service.updateProgress({ profileId: 'blocked', requestId: 'blocked-need' }, { need: 'savings' }))
  assert.equal(snapshot.progress.need, 'savings')
  assert.deepEqual(snapshot.mentor.actions, ['help'])
  snapshot = unwrap(await service.updateProgress({ profileId: 'declared-pause', requestId: 'paused-need' }, { need: 'time' }))
  assert.equal(snapshot.progress.need, 'time')
  assert.equal(snapshot.pause.status, 'active')
  assert.ok(snapshot.mentor.actions.includes('continue'))
  assert.equal(snapshot.contactPermission.reason, 'paused')
})
