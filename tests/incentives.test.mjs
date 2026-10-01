import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemoIncentives, createDemoIncentiveAwards } from '../src/data/conditionalIncentives.ts'
import { createDemoProfiles } from '../src/data/demoProfiles.ts'
import { getApplicableIncentives, enrollIncentive } from '../src/domain/incentives.ts'

const reference = new Date('2026-09-30T19:00:00Z')
const catalog = createDemoIncentives(reference)
const profiles = createDemoProfiles(reference)
const profile = profiles.find(p => p.id === 'inactive-recent')
const config = { zone: 'Lima Centro', vehicle: 'Bicicleta', moment: 'Tarde', hours: 2, scheduleMode: 'now', scheduledDate: null, expenseFuel: 0, expenseMaintenance: 0, expenseOther: 0 }
const records = { incentiveEnrollments: {}, incentiveAwards: createDemoIncentiveAwards(profile, reference) }
const query = (p = profile, c = config, r = records, offers = catalog) => getApplicableIncentives(offers, p, c, reference, r)

test('HU12 only published compatible campaigns in the chosen validity period are shown', () => {
  assert.deepEqual(query().map(o => o.id), ['demo-centro-three', 'demo-bike-review'])
  assert.equal(query(profile, { ...config, zone: 'Surco' }).length, 0)
  assert.equal(query(profile, { ...config, vehicle: 'Auto' }).length, 0)
  assert.equal(query(profile, { ...config, scheduleMode: 'another-day', scheduledDate: '2026-11-01' }).length, 0)
  assert.equal(query(profile, { ...config, hours: 0 }).length, 0)
  assert.equal(query(profile, config, records, catalog.map(o => ({ ...o, publishedOn: '2026-10-01' }))).length, 0)
  const marco = profiles.find(p => p.id === 'inactive-31-60')
  assert.deepEqual(query(marco, { ...config, zone: 'Miraflores', vehicle: 'Moto' }).map(o => o.id), ['demo-miraflores-four'])
  assert.equal(query(profile, { ...config, zone: 'Miraflores', vehicle: 'Moto' }).length, 0, 'changing simulation vehicle cannot override actual profile compatibility')
})

test('HU12 blocked, empty and future-only histories cannot qualify; inactivity awards no bonus', () => {
  assert.equal(query({ ...profile, accountStatus: 'blocked' }).length, 0)
  assert.equal(query({ ...profile, deliveries: [] }).length, 0)
  assert.equal(query({ ...profile, deliveries: [{ id: 'future', status: 'completed', completedAt: '2027-01-01T12:00:00Z' }] }).length, 0)
  const old = { ...profile, lastDeliveryAt: '2020-01-01T12:00:00Z', deliveries: [{ id: 'old', status: 'completed', completedAt: '2020-01-01T12:00:00Z' }] }
  assert.deepEqual(query(old).map(o => o.reward), query().map(o => o.reward))
})

test('HU12 enrollment is idempotent intent only and does not award, connect, change estimates or deliveries', () => {
  const original = { ...records, config, connected: false, priority: 0, deliveries: profile.deliveries }
  const enrolled = enrollIncentive(original, catalog, profile, config, reference, 'demo-centro-three')
  assert.equal(query(profile, config, enrolled)[0].status, 'enrolled')
  assert.equal(query()[0].status, 'available')
  assert.equal(query()[1].status, 'obtained')
  assert.deepEqual({ ...enrolled, incentiveEnrollments: {} }, original)
  assert.equal(enrollIncentive(enrolled, catalog, profile, config, reference, 'demo-centro-three'), enrolled)
  assert.equal(enrollIncentive(original, catalog, profile, config, reference, 'demo-draft'), original)
  assert.equal(enrollIncentive(original, catalog, profile, config, reference, 'demo-bike-review'), original)
  assert.equal(query(profile, config, { incentiveEnrollments: {}, incentiveAwards: { 'demo-centro-three': '2027-01-01T00:00:00Z' } })[0].status, 'available')
})
