import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemoSupportData } from '../src/data/supportCases.ts'
import { selectSupportCase, requestSupport, setDemoSupportStatus } from '../src/domain/support.ts'

const reference = new Date('2026-09-30T19:00:00Z')
test('HU13 opening and requesting help preserve all case statuses; repeated requests are idempotent', () => {
  const initial = createDemoSupportData('inactive-recent')
  const id = initial.cases[0].id
  const selected = selectSupportCase(initial, id)
  assert.equal(selected.selectedCaseId, id)
  assert.deepEqual(selected.cases, initial.cases)
  const requested = requestSupport(selected, id, reference)
  assert.deepEqual(requested.cases, initial.cases)
  assert.equal(requested.requests[id], reference.toISOString())
  assert.equal(requestSupport(requested, id, new Date('2026-10-01T19:00:00Z')), requested)
  assert.deepEqual(initial.requests, {})
  assert.equal(selectSupportCase(initial, 'foreign'), initial)
  assert.equal(requestSupport(initial, 'foreign', reference), initial)
  assert.equal(requestSupport(initial, id, new Date('invalid')), initial)
})
test('HU13 only demo commands change status; resolved cases cannot produce a new request', () => {
  const initial = createDemoSupportData('inactive-recent')
  const id = initial.cases[0].id
  const requested = requestSupport(initial, id, reference)
  const reviewing = setDemoSupportStatus(requested, id, 'in-review')
  assert.equal(reviewing.cases[0].status, 'in-review')
  assert.deepEqual(reviewing.requests, requested.requests)
  const resolved = setDemoSupportStatus(initial, id, 'resolved')
  assert.equal(requestSupport(resolved, id, reference), resolved)
  assert.equal(selectSupportCase(resolved, id).cases[0].status, 'resolved')
  assert.equal(setDemoSupportStatus(initial, id, 'invalid'), initial)
  assert.equal(setDemoSupportStatus(initial, id, 'toString'), initial)
  assert.equal(setDemoSupportStatus(initial, 'foreign', 'resolved'), initial)
})
