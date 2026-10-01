import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalMentorService } from '../src/services/mentor.local.ts'
import { configuration, referenceAt, unwrap, expectError } from './mentor.contract-suite.mjs'

const create = extra => createLocalMentorService({ storage: null, referenceAt, ...extra })
const contexts = () => { let n = 0; return () => ({ profileId: 'inactive-recent', requestId: `a08-${++n}` }) }

test('A-08: expense adjustments preserve gross estimates, round soles and allow a negative net result', async () => {
  const { service } = create(); const ctx = contexts()
  const first = unwrap(await service.calculateProjection(ctx(), configuration))
  const adjusted = unwrap(await service.calculateProjection(ctx(), { ...configuration, expenseFuel: 0.105, expenseMaintenance: 50, expenseOther: 0.205 }))
  assert.equal(adjusted.configuration.expenseFuel, 0.11)
  assert.equal(adjusted.configuration.expenseOther, 0.21)
  assert.equal(adjusted.result.expenses, 50.32)
  assert.equal(adjusted.result.grossMin, first.result.grossMin)
  assert.equal(adjusted.result.grossMax, first.result.grossMax)
  assert.equal(adjusted.result.afterExpensesMin, -26.32)
  assert.equal(adjusted.result.afterExpensesMax, -10.32)
  assert.equal(adjusted.currency, 'PEN')
  assert.equal(adjusted.guaranteed, false)
})

test('A-08: comparison is independent, permits a missing alternative and rolls back invalid second inputs', async () => {
  const { service, getOperations } = create(); const ctx = contexts()
  const compared = unwrap(await service.compareProjections(ctx(), { first: configuration, second: { ...configuration, hours: 1, expenseMaintenance: 5 } }))
  assert.deepEqual([compared.first.result.afterExpensesMin, compared.second.result.afterExpensesMin], [22, 7])
  assert.notEqual(compared.first.id, compared.second.id)
  assert.equal('winner' in compared, false)
  assert.equal(unwrap(await service.getProfile('inactive-recent')).progress.currentProjection, null)
  const mixed = unwrap(await service.compareProjections(ctx(), { first: configuration, second: { ...configuration, vehicle: 'Auto' } }))
  assert.equal(mixed.first.status, 'available')
  assert.equal(mixed.second.status, 'unavailable')
  assert.equal('result' in mixed.second, false)
  const before = unwrap(await getOperations())
  expectError(await service.compareProjections(ctx(), { first: configuration, second: { ...configuration, expenseOther: -1 } }), 'VALIDATION')
  assert.deepEqual(unwrap(await getOperations()), before)
})

test('A-08: active goal context reflects manual balance without creating savings in calculation or comparison', async () => {
  const { service } = create(); const ctx = contexts()
  const saved = unwrap(await service.saveGoal(ctx(), { name: 'Mi bicicleta', targetAmount: 100, targetDate: null }))
  const goalId = saved.goals[0].id
  unwrap(await service.saveContribution(ctx(), { goalId, amount: 25.5, contributedOn: '2026-10-01' }))
  const before = unwrap(await service.getProfile('inactive-recent'))
  const projection = unwrap(await service.calculateProjection(ctx(), configuration))
  assert.ok(projection.assumptions.some(text => text.includes('Mi bicicleta') && text.includes('S/ 74.50')))
  assert.ok(projection.assumptions.some(text => text.includes('no se registra como ahorro')))
  const compared = unwrap(await service.compareProjections(ctx(), { first: configuration, second: { ...configuration, hours: 3 } }))
  for (const result of [compared.first, compared.second]) assert.ok(result.assumptions.some(text => text.includes('S/ 74.50')))
  const after = unwrap(await service.getProfile('inactive-recent'))
  for (const key of ['goals', 'contributions', 'goalProgress', 'preferences', 'deliveries', 'savedOptions']) assert.deepEqual(after[key], before[key])
  assert.equal(after.progress.connectedAt, null)
  assert.equal(after.progress.interventionStartedAt, null)
  unwrap(await service.changeGoalStatus(ctx(), { goalId, status: 'archived' }))
  assert.ok(!unwrap(await service.calculateProjection(ctx(), configuration)).assumptions.some(text => text.includes('Mi bicicleta')))
})

test('A-08: incentives carry separate conditions and UTC validity and never inflate the estimated range', async () => {
  const { service, admin } = create(); const ctx = contexts()
  const projection = unwrap(await service.calculateProjection(ctx(), configuration))
  assert.ok(projection.incentives.length > 0)
  const offer = projection.incentives.find(item => item.id === 'demo-centro-three')
  assert.equal(offer.amount, 6)
  assert.equal(offer.benefit, null)
  assert.deepEqual(offer.zoneIds, ['lima-centro'])
  assert.ok(offer.requirements.some(text => text.includes('3 entregas')))
  assert.equal(offer.validFrom, '2026-09-29T05:00:00.000Z')
  assert.equal(offer.validUntil, '2026-10-09T04:59:59.999Z')
  assert.equal(offer.enrollmentRequired, true)
  assert.ok(projection.incentives.every(item => item.simulated && item.guaranteed === false))
  assert.deepEqual([projection.result.grossMin, projection.result.grossMax], [24, 40])
  unwrap(await service.enrollIncentive(ctx(), { incentiveId: offer.id, projectionId: projection.id }))
  const enrolled = unwrap(await service.calculateProjection(ctx(), configuration))
  assert.deepEqual(enrolled.result, projection.result)
  assert.equal(enrolled.incentives.find(item => item.id === offer.id).status, 'enrolled')
  unwrap(await admin.advanceClock({ observedAt: '2026-10-09T05:00:00.000Z' }))
  assert.ok(!unwrap(await service.calculateProjection(ctx(), configuration)).incentives.some(item => item.id === offer.id))
})

test('A-08: summed expenses cannot overflow the monetary range, and failed calculations preserve state', async () => {
  const { service, getOperations } = create(); const ctx = contexts()
  const before = unwrap(await getOperations())
  expectError(await service.calculateProjection(ctx(), { ...configuration, expenseFuel: 60_000_000_000_000, expenseMaintenance: 60_000_000_000_000 }), 'VALIDATION')
  assert.deepEqual(unwrap(await getOperations()), before)
})

test('A-08: projections and retry responses survive reload and storage failure produces an agreed error', async () => {
  const data = new Map(); let fail = false
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (fail) throw new Error('quota'); data.set(key, value) } }
  const { service } = create({ storage }); const ctx = contexts()
  const request = ctx()
  const result = await service.calculateProjection(request, configuration)
  unwrap(result)
  const reloaded = create({ storage }).service
  assert.deepEqual(await reloaded.calculateProjection(request, configuration), result)
  assert.deepEqual(unwrap(await reloaded.getProfile(request.profileId)).progress.currentProjection, result.data)
  assert.equal(unwrap(await reloaded.getProfile('inactive-31-60')).progress.currentProjection, null)
  fail = true
  expectError(await service.calculateProjection(ctx(), configuration), 'UNEXPECTED')
  assert.deepEqual(unwrap(await reloaded.getProfile(request.profileId)).progress.currentProjection, result.data)
})
