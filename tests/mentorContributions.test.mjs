import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalMentorService } from '../src/services/mentor.local.ts'
import { MENTOR_STORAGE_KEY } from '../src/services/mentorStorage.ts'
import { evaluateMentorSession } from '../src/domain/mentorOperations.ts'
import { referenceAt, configuration, unwrap, expectError } from './mentor.contract-suite.mjs'

const create = extra => createLocalMentorService({ referenceAt, storage: null, ...extra })
const contexts = (profileId = 'inactive-recent') => { let n = 0; return () => ({ profileId, requestId: `a05-${++n}` }) }
const memoryStorage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } }
const goalInput = { name: 'Reparar mi bicicleta', targetAmount: 150, targetDate: null }

test('A-05: manual amounts and Lima dates produce objective, contributed sum and nonnegative remaining amount', async () => {
  const { service } = create(); const ctx = contexts()
  let snapshot = unwrap(await service.saveGoal(ctx(), goalInput))
  const goalId = snapshot.goals[0].id
  assert.deepEqual(snapshot.goalProgress[0], { goalId, contributedAmount: 0, remainingAmount: 150, progressPercent: 0, targetReached: false })
  snapshot = unwrap(await service.saveContribution(ctx(), { goalId, amount: 20, contributedOn: '2026-10-01' }))
  assert.equal(snapshot.contributions[0].source, 'manual')
  assert.equal(snapshot.contributions[0].profileId, snapshot.profile.id)
  assert.equal(snapshot.contributions[0].contributedOn, '2026-10-01')
  assert.deepEqual(snapshot.goalProgress[0], { goalId, contributedAmount: 20, remainingAmount: 130, progressPercent: 13.33, targetReached: false })
  snapshot = unwrap(await service.saveContribution(ctx(), { goalId, amount: 130, contributedOn: '2026-09-30' }))
  assert.deepEqual(snapshot.goalProgress[0], { goalId, contributedAmount: 150, remainingAmount: 0, progressPercent: 100, targetReached: true })
  assert.equal(snapshot.goals[0].status, 'active') // reaching a declared amount does not change status
  snapshot = unwrap(await service.saveContribution(ctx(), { goalId, amount: 25, contributedOn: '2026-10-01' }))
  assert.equal(snapshot.goalProgress[0].contributedAmount, 175)
  assert.equal(snapshot.goalProgress[0].remainingAmount, 0)
  assert.equal(snapshot.goalProgress[0].targetReached, true)
})

test('A-05: correcting amount/date preserves contribution identity and recalculates; deletion removes its amount', async () => {
  const { service, admin, getOperations } = create(); const ctx = contexts()
  const goalId = unwrap(await service.saveGoal(ctx(), goalInput)).goals[0].id
  const added = unwrap(await service.saveContribution(ctx(), { goalId, amount: 160, contributedOn: '2026-10-01' })).contributions[0]
  unwrap(await admin.advanceClock({ observedAt: '2026-10-02T15:00:00.000Z' }))
  let snapshot = unwrap(await service.saveContribution(ctx(), { goalId, contributionId: added.id, amount: 20.126, contributedOn: '2026-09-30' }))
  assert.equal(snapshot.contributions.length, 1)
  assert.equal(snapshot.contributions[0].id, added.id)
  assert.equal(snapshot.contributions[0].createdAt, added.createdAt)
  assert.equal(snapshot.contributions[0].updatedAt, '2026-10-02T15:00:00.000Z')
  assert.equal(snapshot.contributions[0].contributedOn, '2026-09-30')
  assert.equal(snapshot.contributions[0].amount, 20.13)
  assert.equal(snapshot.goalProgress[0].targetReached, false)
  assert.equal(snapshot.goalProgress[0].remainingAmount, 129.87)
  let operations = unwrap(await getOperations())
  assert.equal(evaluateMentorSession(operations.profiles, operations.events).declaredAmount, 20.13)
  assert.equal(evaluateMentorSession(operations.profiles, operations.events).manualContributions, 1)
  snapshot = unwrap(await service.deleteContribution(ctx(), { contributionId: added.id }))
  assert.deepEqual(snapshot.contributions, [])
  assert.equal(snapshot.goalProgress[0].contributedAmount, 0)
  assert.equal(snapshot.goalProgress[0].remainingAmount, 150)
  operations = unwrap(await getOperations())
  assert.equal(evaluateMentorSession(operations.profiles, operations.events).declaredAmount, 0)
})

test('A-05: edits to a goal recalculate its progress; manual completion is distinct from reaching the amount', async () => {
  const { service } = create(); const ctx = contexts()
  const goalId = unwrap(await service.saveGoal(ctx(), goalInput)).goals[0].id
  unwrap(await service.saveContribution(ctx(), { goalId, amount: 50, contributedOn: '2026-10-01' }))
  let snapshot = unwrap(await service.saveGoal(ctx(), { ...goalInput, goalId, targetAmount: 40 }))
  assert.equal(snapshot.goalProgress[0].targetReached, true)
  assert.equal(snapshot.goalProgress[0].progressPercent, 125)
  snapshot = unwrap(await service.saveGoal(ctx(), { ...goalInput, goalId, targetAmount: 100 }))
  assert.equal(snapshot.goalProgress[0].targetReached, false)
  assert.equal(snapshot.goalProgress[0].remainingAmount, 50)
  snapshot = unwrap(await service.changeGoalStatus(ctx(), { goalId, status: 'completed' }))
  assert.equal(snapshot.goals[0].status, 'completed')
  assert.equal(snapshot.goalProgress[0].targetReached, false)
  assert.equal(snapshot.goalProgress[0].contributedAmount, 50)
})

test('A-05: cent arithmetic is exact for fractional input and corrections', async () => {
  const { service } = create(); const ctx = contexts()
  const goalId = unwrap(await service.saveGoal(ctx(), { ...goalInput, targetAmount: 0.3 })).goals[0].id
  unwrap(await service.saveContribution(ctx(), { goalId, amount: 0.1, contributedOn: '2026-10-01' }))
  const sum = unwrap(await service.saveContribution(ctx(), { goalId, amount: 0.2, contributedOn: '2026-10-01' }))
  assert.equal(sum.goalProgress[0].contributedAmount, 0.3)
  assert.equal(sum.goalProgress[0].remainingAmount, 0)
  assert.equal(sum.goalProgress[0].progressPercent, 100)
  assert.equal(sum.goalProgress[0].targetReached, true)
})

test('A-05: invalid amount, date, unknown goal and unsafe total leave all state unchanged', async () => {
  const { service } = create(); const ctx = contexts()
  const goalId = unwrap(await service.saveGoal(ctx(), goalInput)).goals[0].id
  const before = await service.getProfile('inactive-recent')
  for (const amount of [0, -1, 0.001, NaN, Infinity, '20']) expectError(await service.saveContribution(ctx(), { goalId, amount, contributedOn: '2026-10-01' }), 'VALIDATION')
  for (const contributedOn of ['', '2026-02-30', '2026-10-02', '2026-10-01T15:00:00.000Z', undefined]) expectError(await service.saveContribution(ctx(), { goalId, amount: 20, contributedOn }), 'VALIDATION')
  expectError(await service.saveContribution(ctx(), { goalId: 'missing', amount: 20, contributedOn: '2026-10-01' }), 'NOT_FOUND')
  expectError(await service.deleteContribution(ctx(), { contributionId: 'missing' }), 'NOT_FOUND')
  assert.deepEqual(await service.getProfile('inactive-recent'), before)
  unwrap(await service.saveContribution(ctx(), { goalId, amount: 60000000000000, contributedOn: '2026-10-01' }))
  const large = await service.getProfile('inactive-recent')
  expectError(await service.saveContribution(ctx(), { goalId, amount: 60000000000000, contributedOn: '2026-10-01' }), 'VALIDATION')
  assert.deepEqual(await service.getProfile('inactive-recent'), large)
})

test('A-05: contribution corrections are owned by the profile and original goal', async () => {
  const { service } = create(); const ctx = contexts()
  const firstId = unwrap(await service.saveGoal(ctx(), goalInput)).goals[0].id
  const contributionId = unwrap(await service.saveContribution(ctx(), { goalId: firstId, amount: 20, contributedOn: '2026-10-01' })).contributions[0].id
  unwrap(await service.changeGoalStatus(ctx(), { goalId: firstId, status: 'archived' }))
  const secondId = unwrap(await service.saveGoal(ctx(), { ...goalInput, name: 'Otra meta' })).goals.find(g => g.status === 'active').id
  expectError(await service.saveContribution(ctx(), { goalId: secondId, contributionId, amount: 30, contributedOn: '2026-10-01' }), 'CONFLICT')
  expectError(await service.saveContribution({ profileId: 'inactive-31-60', requestId: 'foreign-edit' }, { goalId: firstId, contributionId, amount: 30, contributedOn: '2026-10-01' }), 'NOT_FOUND')
  expectError(await service.deleteContribution({ profileId: 'inactive-31-60', requestId: 'foreign-delete' }, { contributionId }), 'NOT_FOUND')
  const snapshot = unwrap(await service.getProfile('inactive-recent'))
  assert.equal(snapshot.goalProgress.find(p => p.goalId === firstId).contributedAmount, 20)
  assert.equal(snapshot.goalProgress.find(p => p.goalId === secondId).contributedAmount, 0)
  assert.deepEqual(unwrap(await service.getProfile('inactive-31-60')).contributions, [])
})

test('A-05: add/edit/delete retries, derived progress and manual source survive reload', async () => {
  const storage = memoryStorage(); const { service } = create({ storage }); const ctx = contexts()
  const goalId = unwrap(await service.saveGoal(ctx(), goalInput)).goals[0].id
  const addCtx = ctx(); const addInput = { goalId, amount: 20, contributedOn: '2026-10-01' }
  const added = await service.saveContribution(addCtx, addInput)
  const contributionId = unwrap(added).contributions[0].id
  assert.deepEqual(await create({ storage }).service.saveContribution(addCtx, addInput), added)
  const editCtx = ctx(); const editInput = { ...addInput, contributionId, amount: 25, contributedOn: '2026-09-30' }
  const edited = await service.saveContribution(editCtx, editInput)
  unwrap(edited)
  assert.deepEqual(await create({ storage }).service.saveContribution(editCtx, editInput), edited)
  assert.equal(unwrap(await create({ storage }).service.getProfile('inactive-recent')).goalProgress[0].contributedAmount, 25)
  const deleteCtx = ctx(); const deleted = await service.deleteContribution(deleteCtx, { contributionId })
  unwrap(deleted)
  assert.deepEqual(await create({ storage }).service.deleteContribution(deleteCtx, { contributionId }), deleted)
  assert.deepEqual(await create({ storage }).service.getProfile('inactive-recent'), deleted)
  expectError(await service.saveContribution(addCtx, { ...addInput, amount: 99 }), 'CONFLICT')
})

test('A-05: projection, comparison, save, incentive and return never add income to the personal record', async () => {
  const { service, admin, getOperations } = create(); const ctx = contexts()
  const goalId = unwrap(await service.saveGoal(ctx(), goalInput)).goals[0].id
  const baseline = unwrap(await service.saveContribution(ctx(), { goalId, amount: 20, contributedOn: '2026-10-01' }))
  unwrap(await service.startProgram(ctx(), { origin: 'app' }))
  const projection = unwrap(await service.calculateProjection(ctx(), configuration))
  unwrap(await service.compareProjections(ctx(), { first: configuration, second: { ...configuration, hours: 1 } }))
  unwrap(await service.saveOption(ctx(), { projectionId: projection.id }))
  const incentive = projection.incentives.find(i => i.enrollmentRequired)
  assert.ok(incentive)
  unwrap(await service.enrollIncentive(ctx(), { incentiveId: incentive.id, projectionId: projection.id }))
  unwrap(await service.confirmConnection(ctx(), { explicitConsent: true }))
  unwrap(await admin.advanceClock({ observedAt: '2026-10-01T15:01:00.000Z' }))
  const returned = unwrap(await admin.registerDelivery(ctx(), { id: 'a05-return', status: 'completed', completedAt: '2026-10-01T15:01:00.000Z' }))
  assert.equal(returned.progress.returnDeliveryId, 'a05-return')
  assert.deepEqual(returned.contributions, baseline.contributions)
  assert.deepEqual(returned.goalProgress, baseline.goalProgress)
  const operations = unwrap(await getOperations())
  assert.equal(evaluateMentorSession(operations.profiles, operations.events).declaredAmount, 20)
})

test('A-05: manual record does not activate invitations, reminders, connection or program', async () => {
  const { service } = create(); const ctx = contexts()
  const baseline = unwrap(await service.saveGoal(ctx(), goalInput))
  const goalId = baseline.goals[0].id
  const snapshot = unwrap(await service.saveContribution(ctx(), { goalId, amount: 20, contributedOn: '2026-10-01' }))
  for (const key of ['preferences', 'invitations', 'reminders', 'progress', 'deliveries', 'savedOptions']) assert.deepEqual(snapshot[key], baseline[key])
  assert.equal(snapshot.contributions[0].source, 'manual')
})

test('A-05: restored personal records reject future dates, inconsistent timestamps and unsafe monetary totals', async () => {
  const storage = memoryStorage(); const { service } = create({ storage }); const ctx = contexts()
  const goalId = unwrap(await service.saveGoal(ctx(), goalInput)).goals[0].id
  unwrap(await service.saveContribution(ctx(), { goalId, amount: 20, contributedOn: '2026-10-01' }))
  const valid = JSON.parse(storage.getItem(MENTOR_STORAGE_KEY))
  for (const mutate of [
    p => { p.snapshot.contributions[0].contributedOn = '2026-10-02' },
    p => { p.snapshot.contributions[0].updatedAt = '2026-10-02T15:00:00.000Z' },
    p => { p.snapshot.contributions[0].createdAt = '2026-10-02T15:00:00.000Z' },
    p => { p.snapshot.contributions[0].source = 'projection' },
    p => { p.snapshot.contributions[0].amount = 60000000000000; p.snapshot.contributions.push({ ...p.snapshot.contributions[0], id: 'overflow', amount: 60000000000000 }) },
  ]) {
    const corrupt = structuredClone(valid)
    mutate(corrupt.profiles['inactive-recent'])
    storage.setItem(MENTOR_STORAGE_KEY, JSON.stringify(corrupt))
    const snapshot = unwrap(await create({ storage }).service.getProfile('inactive-recent'))
    assert.deepEqual(snapshot.contributions, [])
    assert.deepEqual(snapshot.goalProgress, [])
  }
  storage.setItem(MENTOR_STORAGE_KEY, JSON.stringify(valid))
  assert.equal(unwrap(await create({ storage }).service.getProfile('inactive-recent')).goalProgress[0].contributedAmount, 20)
})
