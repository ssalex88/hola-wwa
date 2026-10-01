import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalMentorService } from '../src/services/mentor.local.ts'
import { configuration, referenceAt, unwrap, expectError } from './mentor.contract-suite.mjs'

const create = extra => createLocalMentorService({ storage: null, referenceAt, ...extra })
const contexts = () => { let n = 0; return () => ({ profileId: 'inactive-recent', requestId: `a12-${++n}` }) }

test('A-12: help requests preserve simulated case statuses and are isolated and deduplicated', async () => {
  const { service, admin } = create(); const ctx = contexts()
  const before = unwrap(await service.getProfile('inactive-recent'))
  assert.ok(before.cases.every(item => item.simulated && ['pending', 'in-review', 'resolved'].includes(item.status)))
  const caseId = before.cases.find(item => item.status !== 'resolved').id
  const request = ctx(); const first = await service.requestHelp(request, { caseId })
  const snapshot = unwrap(first)
  assert.deepEqual(snapshot.cases, before.cases)
  assert.equal(snapshot.helpRequests.length, 1)
  assert.equal(snapshot.helpRequests[0].simulated, true)
  assert.deepEqual(await service.requestHelp(request, { caseId }), first)
  assert.equal(unwrap(await service.requestHelp(ctx(), { caseId })).helpRequests.length, 1)
  expectError(await service.requestHelp({ profileId: 'inactive-31-60', requestId: 'foreign' }, { caseId }), 'NOT_FOUND')
  unwrap(await admin.setCaseStatus(ctx(), { caseId, status: 'in-review' }))
  assert.equal(unwrap(await service.getProfile('inactive-recent')).cases.find(item => item.id === caseId).status, 'in-review')
  unwrap(await admin.setCaseStatus(ctx(), { caseId, status: 'resolved' }))
  expectError(await service.requestHelp(ctx(), { caseId }), 'CONFLICT')
})

test('A-12: followup requires eligible start and a completed delivery strictly later, within observed time', async () => {
  const { service, admin } = create(); const ctx = contexts()
  expectError(await service.recordReturnFeedback(ctx(), { feedback: 'good' }), 'CONFLICT')
  unwrap(await service.startProgram(ctx(), { origin: 'app' }))
  unwrap(await admin.registerDelivery(ctx(), { id: 'at-start', status: 'completed', completedAt: referenceAt }))
  expectError(await service.recordReturnFeedback(ctx(), { feedback: 'good' }), 'CONFLICT')
  expectError(await admin.registerDelivery(ctx(), { id: 'future', status: 'completed', completedAt: '2026-10-01T15:01:00.000Z' }), 'VALIDATION')
  unwrap(await admin.advanceClock({ observedAt: '2026-10-01T15:01:00.000Z' }))
  unwrap(await admin.registerDelivery(ctx(), { id: 'cancelled', status: 'cancelled', completedAt: '2026-10-01T15:01:00.000Z' }))
  expectError(await service.recordReturnFeedback(ctx(), { feedback: 'good' }), 'CONFLICT')
  const snapshot = unwrap(await admin.registerDelivery(ctx(), { id: 'qualifying', status: 'completed', completedAt: '2026-10-01T15:01:00.000Z' }))
  assert.equal(snapshot.progress.returnDeliveryId, 'qualifying')
  assert.equal(snapshot.progress.returnFeedback, null)
  unwrap(await service.recordReturnFeedback(ctx(), { feedback: 'skipped' }))
})

test('A-12: feedback is optional and editable; deliveries and answers never create savings or reminders', async () => {
  const { service, admin } = create(); const ctx = contexts()
  const goal = unwrap(await service.saveGoal(ctx(), { name: 'Mi meta', targetAmount: 100, targetDate: null })).goals[0]
  unwrap(await service.startProgram(ctx(), { origin: 'external' }))
  unwrap(await admin.advanceClock({ observedAt: '2026-10-01T15:01:00.000Z' }))
  const returned = unwrap(await admin.registerDelivery(ctx(), { id: 'return', status: 'completed', completedAt: '2026-10-01T15:01:00.000Z' }))
  // A new outing works while the optional answer is still null.
  unwrap(await service.calculateProjection(ctx(), { ...configuration, hours: 1 }))
  for (const feedback of ['skipped', 'good', 'mixed', 'problem']) {
    const snapshot = unwrap(await service.recordReturnFeedback(ctx(), { feedback }))
    assert.equal(snapshot.progress.returnFeedback, feedback)
    for (const key of ['contributions', 'goalProgress', 'preferences', 'reminders', 'invitations', 'cases', 'helpRequests']) assert.deepEqual(snapshot[key], returned[key])
  }
  expectError(await service.recordReturnFeedback(ctx(), { feedback: 'invalid' }), 'VALIDATION')
  const snapshot = unwrap(await service.saveContribution(ctx(), { goalId: goal.id, amount: 10, contributedOn: '2026-10-01' }))
  assert.equal(snapshot.goalProgress[0].contributedAmount, 10)
  assert.deepEqual(snapshot.reminders, [])
})

test('A-12: return, help and feedback survive reload with isolated idempotent responses', async () => {
  const data = new Map(); const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  const { service, admin } = create({ storage }); const ctx = contexts()
  const other = unwrap(await service.getProfile('inactive-31-60'))
  const caseId = unwrap(await service.getProfile('inactive-recent')).cases[0].id
  unwrap(await service.requestHelp(ctx(), { caseId }))
  unwrap(await service.startProgram(ctx(), { origin: 'app' }))
  unwrap(await admin.advanceClock({ observedAt: '2026-10-01T15:01:00.000Z' }))
  const delivery = { id: 'return', status: 'completed', completedAt: '2026-10-01T15:01:00.000Z' }
  unwrap(await admin.registerDelivery(ctx(), delivery))
  const request = ctx(); const response = await service.recordReturnFeedback(request, { feedback: 'good' })
  unwrap(response)
  const reloaded = create({ storage })
  assert.deepEqual(await reloaded.service.recordReturnFeedback(request, { feedback: 'good' }), response)
  const snapshot = unwrap(await reloaded.admin.registerDelivery(ctx(), delivery))
  assert.equal(snapshot.deliveries.filter(item => item.id === delivery.id).length, 1)
  assert.equal(snapshot.helpRequests.length, 1)
  assert.equal(snapshot.progress.returnFeedback, 'good')
  const unchanged = unwrap(await reloaded.service.getProfile(other.profile.id))
  assert.deepEqual(unchanged.deliveries, other.deliveries)
  assert.equal(unchanged.progress.returnFeedback, null)
  assert.deepEqual(unchanged.helpRequests, [])
})
