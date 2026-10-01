import test from 'node:test'
import assert from 'node:assert/strict'
import { saveProposal, deleteProposal, configurationForReview } from '../src/domain/proposals.ts'
import { confirmDemoConnection } from '../src/domain/connection.ts'
import { createDemoProfiles } from '../src/data/demoProfiles.ts'
import { createDemoIncentives } from '../src/data/conditionalIncentives.ts'
import { getApplicableIncentives } from '../src/domain/incentives.ts'
import { calculateProjection } from '../src/domain/projection.ts'
import { SIMULATED_PROJECTION_RATES } from '../src/data/projectionRates.ts'
const reference = new Date('2026-09-30T19:00:00Z')
const base = { zone: 'Lima Centro', hours: 2, moment: 'Tarde', vehicle: 'Bicicleta', scheduleMode: 'now', scheduledDate: null, expenseFuel: 0, expenseMaintenance: 0, expenseOther: 4, savedProposal: null, savedProposals: [], editingSavedProposalId: null, allowProgramInvitations: false, preferredContactDate: '2099-10-04' }
test('HU14 independent saved proposals preserve configuration and reference, support editing and deletion without contact changes', () => {
  const first = saveProposal(base, reference, 'first')
  assert.equal(first.savedProposals[0].referenceAt, reference.toISOString())
  assert.equal(first.savedProposals[0].tableVersion, 'demo-rates-v1')
  const second = saveProposal({ ...first, hours: 3 }, reference, 'second')
  assert.equal(second.savedProposals.length, 2)
  assert.equal(second.savedProposals[0].hours, 2)
  const edited = saveProposal({ ...second, hours: 4, editingSavedProposalId: 'first' }, reference, 'unused')
  assert.equal(edited.savedProposals.length, 2)
  assert.equal(edited.savedProposals.find(item => item.id === 'first').hours, 4)
  const deleted = deleteProposal(edited, 'first')
  assert.equal(deleted.savedProposals.length, 1)
  assert.equal(deleted.savedProposal.hours, 3)
  assert.equal(deleted.allowProgramInvitations, base.allowProgramInvitations)
  assert.equal(deleted.preferredContactDate, base.preferredContactDate)
  assert.equal(deleteProposal(deleted, 'unknown'), deleted)
  assert.equal(deleteProposal(deleted, 'second').savedProposal, null)
  const invalid = { ...base, hours: 0 }
  assert.equal(saveProposal(invalid, reference, 'bad'), invalid)
})
test('HU14 reopening uses the current slot, recalculates rates and excludes expired incentives using the review date', () => {
  const saved = saveProposal(base, reference, 'saved').savedProposals[0]
  const later = new Date('2026-10-21T03:00:00Z')
  const reviewed = configurationForReview(saved, later)
  assert.equal(reviewed.moment, 'Noche')
  assert.equal(saved.moment, 'Tarde')
  assert.notDeepEqual(calculateProjection(reviewed, SIMULATED_PROJECTION_RATES), calculateProjection(saved, SIMULATED_PROJECTION_RATES))
  const profile = createDemoProfiles(reference)[0]
  const records = { incentiveEnrollments: {}, incentiveAwards: {} }
  const catalog = createDemoIncentives(reference)
  assert.ok(getApplicableIncentives(catalog, profile, saved, reference, records).length)
  assert.equal(getApplicableIncentives(catalog, profile, reviewed, later, records).length, 0)
})
test('HU14 connection requires an explicit valid confirmation and never allows blocked accounts', () => {
  const disconnected = { connectedAt: null }
  assert.equal(confirmDemoConnection(disconnected, 'blocked', reference), disconnected)
  assert.equal(confirmDemoConnection(disconnected, 'active', new Date('bad')), disconnected)
  const connected = confirmDemoConnection(disconnected, 'active', reference)
  assert.equal(connected.connectedAt, reference.toISOString())
  assert.equal(disconnected.connectedAt, null)
  assert.equal(confirmDemoConnection(connected, 'active', reference), connected)
})
