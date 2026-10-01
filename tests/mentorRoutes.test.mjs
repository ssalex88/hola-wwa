import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalMentorService } from '../src/services/mentor.local.ts'
import { referenceAt, configuration, unwrap, expectError } from './mentor.contract-suite.mjs'

const create = extra => createLocalMentorService({ referenceAt, storage: null, ...extra })
const route = (originZoneId, destinationZoneId = originZoneId) => ({ originZoneId, destinationZoneId })

test('A-07: nearby demonstration zones reuse the existing query and canonical catalog', async () => {
  const { service } = create()
  const catalog = unwrap(await service.getCatalog())
  for (const zone of catalog.zones) {
    const match = unwrap(await service.exploreRoute(route(zone.id)))
    assert.equal(match.simulated, true)
    assert.equal(match.affectsOrderAssignment, false)
    assert.equal(match.zones[0].id, zone.id)
    assert.ok(match.zones.length > 1)
    assert.equal(new Set(match.zones.map(z => z.id)).size, match.zones.length)
    assert.ok(match.zones.every(z => catalog.zones.some(item => JSON.stringify(item) === JSON.stringify(z))))
  }
  assert.deepEqual(unwrap(await service.exploreRoute(route('lima-centro'))).zones.map(z => z.id), ['lima-centro', 'jesus-maria'])
})

test('A-07: routes include fixture matches beyond endpoints and reverse without changing demo data', async () => {
  const { service } = create()
  for (const [origin, destination, expected] of [
    ['lima-centro', 'surco', ['lima-centro', 'jesus-maria', 'miraflores', 'surco']],
    ['san-miguel', 'miraflores', ['san-miguel', 'jesus-maria', 'miraflores']],
  ]) {
    const match = unwrap(await service.exploreRoute(route(origin, destination)))
    assert.deepEqual(match.zones.map(z => z.id), expected)
    match.zones[0].label = 'Edited by client'
    assert.deepEqual(unwrap(await service.exploreRoute(route(destination, origin))).zones.map(z => z.id), [...expected].reverse())
    assert.notEqual(unwrap(await service.exploreRoute(route(origin, destination))).zones[0].label, 'Edited by client')
  }
})

test('A-07: missing demo scenarios return success with no matches and manual catalog remains available', async () => {
  const { service } = create()
  assert.deepEqual(unwrap(await service.exploreRoute(route('san-miguel', 'surco'))), { zones: [], simulated: true, affectsOrderAssignment: false })
  assert.equal(unwrap(await service.getCatalog()).zones.length, 5)
})

test('A-07: malformed routes give VALIDATION rather than unexpected errors or invented matches', async () => {
  const { service } = create()
  for (const input of [null, undefined, {}, route('unknown', 'surco'), route('lima-centro', ''), route('__proto__', 'surco')]) {
    expectError(await service.exploreRoute(input), 'VALIDATION')
  }
})

test('A-07: exploration is read-only for profiles, persisted session and operations events', async () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  const { service, getOperations } = create({ storage })
  unwrap(await service.updateProgress({ profileId: 'inactive-recent', requestId: 'seed' }, { configuration }))
  const before = unwrap(await getOperations()); const persisted = [...data]
  await service.exploreRoute(route('lima-centro', 'surco'))
  await service.exploreRoute(route('miraflores'))
  await service.exploreRoute(route('san-miguel', 'surco'))
  assert.deepEqual(unwrap(await getOperations()), before)
  assert.deepEqual([...data], persisted)
})

test('A-07: selected route or manual zone persists only in the chosen profile and retries once', async () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  const { service } = create({ storage })
  const other = unwrap(await service.getProfile('inactive-31-60'))
  const before = unwrap(await service.getProfile('inactive-recent'))
  const match = unwrap(await service.exploreRoute(route('lima-centro', 'surco')))
  const selected = match.zones.find(z => z.id === 'miraflores')
  const input = { configuration: { ...configuration, zone: selected.label } }
  const ctx = { profileId: 'inactive-recent', requestId: 'selected-zone', expectedRevision: before.revision }
  const first = await service.updateProgress(ctx, input)
  const snapshot = unwrap(first)
  assert.equal(snapshot.profile.zoneId, before.profile.zoneId)
  assert.equal(snapshot.progress.connectedAt, null)
  assert.equal(snapshot.progress.interventionStartedAt, null)
  assert.deepEqual(snapshot.deliveries, before.deliveries)
  assert.deepEqual(snapshot.contributions, [])
  assert.deepEqual(await service.updateProgress(ctx, input), first)
  assert.deepEqual(unwrap(await create({ storage }).service.getProfile(ctx.profileId)).progress.configuration, input.configuration)
  assert.deepEqual(unwrap(await service.getProfile('inactive-31-60')), other)
  const projection = unwrap(await service.calculateProjection({ profileId: ctx.profileId, requestId: 'calculate-selected' }, input.configuration))
  assert.equal(projection.configuration.zone, selected.label)
  assert.ok(projection.assumptions.some(message => message.includes('no limita ni garantiza los pedidos recibidos')))
  const manual = unwrap(await service.getCatalog()).zones.find(z => z.id === 'surco')
  const manualSnapshot = unwrap(await service.updateProgress({ profileId: ctx.profileId, requestId: 'manual-zone' }, { configuration: { ...configuration, zone: manual.label } }))
  assert.equal(manualSnapshot.progress.configuration.zone, manual.label)
  assert.equal(manualSnapshot.progress.currentProjection, null)
})
