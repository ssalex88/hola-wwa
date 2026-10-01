import test from 'node:test'
import assert from 'node:assert/strict'
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
const { loadPilotCosts, savePilotCosts } = await import('../src/services/pilotService.ts')
test('HU17 operation costs persist independently per inactivity filter without writing rider profiles', () => {
  assert.deepEqual(loadPilotCosts(), { operations: '', incentives: '', support: '' })
  savePilotCosts({ operations: '50', incentives: '30', support: '20' })
  savePilotCosts({ operations: '10', incentives: '0', support: '5' }, '15–30 días')
  assert.deepEqual(loadPilotCosts(), { operations: '50', incentives: '30', support: '20' })
  assert.deepEqual(loadPilotCosts('15–30 días'), { operations: '10', incentives: '0', support: '5' })
  assert.deepEqual(loadPilotCosts('Más de 60 días'), { operations: '', incentives: '', support: '' })
  assert.equal(memory.has('vuelve-a-tu-ritmo:demo:v1'), false)
  memory.set('vuelve-a-tu-ritmo:pilot-costs:v1:all', '{bad')
  assert.deepEqual(loadPilotCosts(), { operations: '', incentives: '', support: '' })
})
