import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalMentorService } from '../src/services/mentor.local.ts'
import { MENTOR_STORAGE_KEY } from '../src/services/mentorStorage.ts'
import { evaluateMentorSession } from '../src/domain/mentorOperations.ts'
import { referenceAt, configuration, unwrap, expectError } from './mentor.contract-suite.mjs'

const create = extra => createLocalMentorService({ referenceAt, storage: null, ...extra })
const contexts = (profileId = 'inactive-recent') => { let n = 0; return () => ({ profileId, requestId: `a06-${++n}` }) }
const memoryStorage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } }
const noOutingEffects = snapshot => ({ connection: snapshot.progress.connectedAt, start: snapshot.progress.interventionStartedAt, eligibleStart: snapshot.progress.eligibleAtStart, returned: snapshot.progress.returnedAt, options: snapshot.savedOptions, deliveries: snapshot.deliveries, preferences: snapshot.preferences, invitations: snapshot.invitations, reminders: snapshot.reminders, contributions: snapshot.contributions })

test('A-06: zone labels and vehicle choices from the agreed catalog configure simple 1/2/3-hour outings', async () => {
  const { service } = create(); const ctx = contexts()
  const catalog = unwrap(await service.getCatalog())
  const zone = catalog.zones.find(z => z.id === 'lima-centro')
  assert.equal(zone.label, 'Lima Centro')
  assert.ok(catalog.vehicles.includes(configuration.vehicle))
  assert.ok(catalog.vehicles.includes('Auto'))
  for (const hours of [1, 2, 3]) {
    const result = unwrap(await service.calculateProjection(ctx(), { ...configuration, zone: zone.label, hours }))
    assert.equal(result.status, 'available')
    assert.equal(result.configuration.hours, hours)
    assert.equal(result.result.grossMin, 12 * hours)
    assert.equal(result.result.grossMax, 20 * hours)
  }
  catalog.zones[0].label = 'Changed by client'
  assert.equal(unwrap(await service.getCatalog()).zones[0].label, 'Lima Centro')
})

test('A-06: valid fields can be edited before calculation without reserving, connecting or querying projections', async () => {
  const { service, getOperations } = create(); const ctx = contexts()
  const baseline = unwrap(await service.getProfile('inactive-recent'))
  unwrap(await service.updateProgress(ctx(), { configuration }))
  const edited = { ...configuration, zone: 'Miraflores', hours: 3, vehicle: 'Moto', moment: 'Noche' }
  const snapshot = unwrap(await service.updateProgress(ctx(), { configuration: edited }))
  assert.deepEqual(snapshot.progress.configuration, edited)
  assert.equal(snapshot.progress.currentProjection, null)
  assert.equal(snapshot.progress.step, 'configuration')
  assert.deepEqual(noOutingEffects(snapshot), noOutingEffects(baseline))
  const operations = unwrap(await getOperations())
  assert.equal(evaluateMentorSession(operations.profiles, operations.events).projectionQueries, 0)
  assert.equal(operations.events.filter(e => e.action === 'startProgram').length, 0)
})

test('A-06: editing invalidates a previous estimate and returns to configuration unless a step is explicitly supplied', async () => {
  const { service } = create(); const ctx = contexts()
  unwrap(await service.calculateProjection(ctx(), configuration))
  unwrap(await service.updateProgress(ctx(), { step: 'decision' }))
  const edited = { ...configuration, hours: 1 }
  let snapshot = unwrap(await service.updateProgress(ctx(), { configuration: edited }))
  assert.equal(snapshot.progress.step, 'configuration')
  assert.equal(snapshot.progress.currentProjection, null)
  const recalculated = unwrap(await service.calculateProjection(ctx(), edited))
  assert.equal(recalculated.result.grossMin, 12)
  assert.equal(unwrap(await service.getProfile('inactive-recent')).progress.step, 'projection')
  snapshot = unwrap(await service.updateProgress(ctx(), { configuration, step: 'configuration' }))
  assert.equal(snapshot.progress.step, 'configuration')
})

test('A-06: validation identifies invalid choices, expenses and dates without losing the prior configuration', async () => {
  const { service } = create(); const ctx = contexts()
  unwrap(await service.updateProgress(ctx(), { configuration }))
  const before = await service.getProfile('inactive-recent')
  for (const [field, value] of [['zone', 'lima-centro'], ['vehicle', 'Camión'], ['moment', ''], ['hours', 0], ['hours', 13], ['hours', NaN], ['hours', '2'], ['expenseFuel', -1], ['expenseMaintenance', Infinity], ['expenseOther', Number.MAX_SAFE_INTEGER], ['scheduleMode', 'unknown'], ['scheduledDate', '']]) {
    const result = await service.updateProgress(ctx(), { configuration: { ...configuration, [field]: value } })
    expectError(result, 'VALIDATION')
    assert.ok(result.error.fields[field], JSON.stringify(result))
    assert.deepEqual(await service.getProfile('inactive-recent'), before)
  }
  const multiple = await service.calculateProjection(ctx(), { ...configuration, zone: '', vehicle: '', hours: -1, moment: '', expenseOther: Number.MAX_SAFE_INTEGER })
  expectError(multiple, 'VALIDATION')
  for (const key of ['zone', 'vehicle', 'hours', 'moment', 'expenseOther']) assert.ok(multiple.error.fields[key])
  assert.deepEqual(await service.getProfile('inactive-recent'), before)
})

test('A-06: valid combinations without rates return unavailable, preserve choices and do not fabricate a range', async () => {
  const storage = memoryStorage(); const { service, getOperations } = create({ storage }); const ctx = contexts()
  const baseline = unwrap(await service.getProfile('inactive-recent'))
  const input = { ...configuration, vehicle: 'Auto', hours: 3 }
  const request = ctx()
  const response = await service.calculateProjection(request, input)
  const unavailable = unwrap(response)
  assert.equal(unavailable.status, 'unavailable')
  assert.equal(unavailable.reason, 'missing-data')
  assert.deepEqual(unavailable.configuration, input)
  assert.equal(unavailable.simulated, true)
  assert.equal('result' in unavailable, false)
  assert.equal('id' in unavailable, false)
  assert.ok(unavailable.message.includes('no reserva un turno ni te conecta'))
  const snapshot = unwrap(await service.getProfile('inactive-recent'))
  assert.deepEqual(snapshot.progress.currentProjection, unavailable)
  assert.deepEqual(noOutingEffects(snapshot), noOutingEffects(baseline))
  assert.deepEqual(await create({ storage }).service.getProfile('inactive-recent'), await service.getProfile('inactive-recent'))
  assert.deepEqual(await service.calculateProjection(request, input), response)
  const operations = unwrap(await getOperations())
  assert.equal(evaluateMentorSession(operations.profiles, operations.events).projectionQueries, 1)
})

test('A-06: calculations explain and preserve the absence of reservation/connection, including saved options', async () => {
  const { service } = create(); const ctx = contexts()
  const baseline = unwrap(await service.getProfile('inactive-recent'))
  const result = unwrap(await service.calculateProjection(ctx(), configuration))
  assert.ok(result.assumptions.some(message => message.includes('no reserva un turno ni conecta')))
  assert.equal(result.guaranteed, false)
  assert.deepEqual(noOutingEffects(unwrap(await service.getProfile('inactive-recent'))), noOutingEffects(baseline))
  const saved = unwrap(await service.saveOption(ctx(), { projectionId: result.id }))
  assert.equal(saved.savedOptions[0].isReservation, false)
  assert.equal(saved.progress.connectedAt, null)
  unwrap(await service.confirmConnection(ctx(), { explicitConsent: true }))
  unwrap(await service.calculateProjection(ctx(), { ...configuration, hours: 1 }))
  assert.equal(unwrap(await service.getProfile('inactive-recent')).progress.connectedAt, referenceAt) // does not connect or disconnect
})

test('A-06: optional dates validate against Lima and distinguish now from another-day', async () => {
  const { service } = create({ referenceAt: '2026-10-02T02:00:00.000Z' }); const ctx = contexts()
  const valid = { ...configuration, scheduleMode: 'another-day', scheduledDate: '2026-10-02' }
  assert.deepEqual(unwrap(await service.updateProgress(ctx(), { configuration: valid })).progress.configuration, valid)
  for (const scheduledDate of [null, '', '2026-10-01', '2026-02-30', '2026-10-02T13:30:00.000Z']) {
    const result = await service.calculateProjection(ctx(), { ...valid, scheduledDate })
    expectError(result, 'VALIDATION')
    assert.ok(result.error.fields.scheduledDate)
  }
  const nowDate = await service.calculateProjection(ctx(), { ...configuration, scheduledDate: '2026-10-02' })
  expectError(nowDate, 'VALIDATION')
  assert.ok(nowDate.error.fields.scheduledDate)
})

test('A-06: configurations, expenses, stage and retries persist independently per profile', async () => {
  const storage = memoryStorage(); const { service } = create({ storage }); const ctx = contexts()
  const input = { ...configuration, expenseFuel: 1.126, expenseMaintenance: 0, expenseOther: 0 }
  const request = ctx()
  const original = await service.updateProgress(request, { configuration: input })
  assert.equal(unwrap(original).progress.configuration.expenseFuel, 1.13)
  assert.deepEqual(await create({ storage }).service.updateProgress(request, { configuration: input }), original)
  assert.deepEqual(await create({ storage }).service.getProfile('inactive-recent'), original)
  assert.equal(unwrap(await service.getProfile('inactive-31-60')).progress.configuration, null)
  expectError(await service.updateProgress(request, { configuration: { ...input, hours: 3 } }), 'CONFLICT')
})

test('A-06: persisted modes and optional dates cannot contradict each other; an expired scheduled option remains recoverable', async () => {
  const storage = memoryStorage(); const { service, admin } = create({ storage }); const ctx = contexts()
  const input = { ...configuration, scheduleMode: 'another-day', scheduledDate: '2026-10-02' }
  unwrap(await service.updateProgress(ctx(), { configuration: input }))
  unwrap(await admin.advanceClock({ observedAt: '2026-10-03T15:00:00.000Z' }))
  const saved = await service.getProfile('inactive-recent')
  assert.deepEqual(await create({ storage }).service.getProfile('inactive-recent'), saved)
  const expired = await service.calculateProjection(ctx(), input)
  expectError(expired, 'VALIDATION')
  assert.ok(expired.error.fields.scheduledDate)
  const valid = JSON.parse(storage.getItem(MENTOR_STORAGE_KEY))
  for (const config of [{ ...configuration, scheduledDate: '2026-10-02' }, { ...input, scheduledDate: null }]) {
    const corrupt = structuredClone(valid)
    corrupt.profiles['inactive-recent'].snapshot.progress.configuration = config
    storage.setItem(MENTOR_STORAGE_KEY, JSON.stringify(corrupt))
    assert.equal(unwrap(await create({ storage }).service.getProfile('inactive-recent')).progress.configuration, null)
  }
})
