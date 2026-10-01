import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemoProfiles } from '../src/data/demoProfiles.ts'
import { getReactivationEligibility } from '../src/domain/eligibility.ts'
import { dateInLima } from '../src/domain/demoDates.ts'
import { profileWithHistory } from '../src/services/demoProfileService.ts'

test('all eight scenarios keep their intended inactivity when the demo reference changes', () => {
  for (const instant of ['2026-09-30T02:30:00Z', '2030-01-01T02:30:00Z']) {
    const reference = new Date(instant)
    const profiles = createDemoProfiles(reference)
    const cases = { active: 4, 'interruption-10': 10, 'inactive-recent': 20, 'inactive-31-60': 45, 'inactive-over-60': 75, 'declared-pause': 28, 'no-deliveries': null, blocked: 42 }
    assert.equal(profiles.length, 8)
    assert.equal(new Set(profiles.map(p => p.id)).size, 8)
    for (const [id, days] of Object.entries(cases)) {
      const profile = profiles.find(p => p.id === id)
      assert.ok(profile.vehicle && profile.zone && profile.name)
      if (days === null) { assert.equal(profile.lastDeliveryAt, null); assert.deepEqual(profile.deliveries, []); continue }
      assert.equal(reference.getTime() - Date.parse(profile.lastDeliveryAt), days * 86400000)
      assert.equal(Math.max(...profile.deliveries.map(item => Date.parse(item.completedAt))), Date.parse(profile.lastDeliveryAt))
      assert.equal(getReactivationEligibility(profile.deliveries, reference, profile.accountStatus).eligible, days >= 15 && id !== 'blocked')
    }
    assert.ok(profiles.find(p => p.id === 'declared-pause').declaredPause.note)
    assert.equal(profiles.find(p => p.id === 'inactive-recent').declaredPause, undefined, 'inactivity does not invent a declared pause')
  }
  assert.equal(dateInLima(new Date('2030-01-01T02:30:00Z')), '2029-12-31')
})

test('presenter labels follow new deliveries without relabeling the original ten-day interruption', () => {
  const reference = new Date('2026-09-30T19:00:00Z')
  const profiles = createDemoProfiles(reference)
  const interruption = profiles.find(p => p.id === 'interruption-10')
  assert.equal(profileWithHistory(interruption, interruption.deliveries, reference).scenario, 'Interrupción de 10 días')
  for (const seed of profiles.filter(p => p.accountStatus === 'active')) {
    const timestamp = new Date(reference.getTime() + 60000)
    const history = [...seed.deliveries, { id: 'completed-after-demo', status: 'completed', completedAt: timestamp.toISOString() }]
    const snapshot = profileWithHistory(seed, history, timestamp)
    assert.match(snapshot.scenario, /^Activo · 0 días/)
    assert.equal(snapshot.lastDeliveryAt, timestamp.toISOString())
    assert.notEqual(seed.lastDeliveryAt, timestamp.toISOString(), 'updating one profile does not mutate seed data')
  }
})
