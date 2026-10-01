import test from 'node:test'
import assert from 'node:assert/strict'
import { reminderInstant, reminderError, scheduleReminder, cancelReminder, executeReminder } from '../src/domain/reminders.ts'
import { saveProposal, deleteProposal } from '../src/domain/proposals.ts'
const reference = new Date('2026-09-30T19:00:00Z') // Lima 14:00
const base = { zone: 'Lima Centro', hours: 2, moment: 'Tarde', vehicle: 'Bicicleta', scheduleMode: 'now', scheduledDate: null, expenseFuel: 0, expenseMaintenance: 0, expenseOther: 4, savedProposal: null, savedProposals: [], editingSavedProposalId: null, allowProgramInvitations: false, preferredContactDate: '2099-10-04' }

test('HU15 explicit valid date and time are interpreted in Lima, with a strict future boundary', () => {
  assert.equal(reminderInstant('2026-09-30', '14:01').toISOString(), '2026-09-30T19:01:00.000Z')
  assert.equal(reminderInstant('2026-09-30', '23:59').toISOString(), '2026-10-01T04:59:00.000Z')
  for (const [date, time] of [['', '14:01'], ['2026-10-01', ''], ['2026-02-30', '14:01'], ['2026-10-01', '24:00'], ['2026-10-01', '12:60'], ['2026-09-30', '13:59'], ['2026-09-30', '14:00'], ['2026-09-29', '23:59']]) assert.ok(reminderError(date, time, reference))
  assert.equal(reminderError('2026-09-30', '14:01', reference), null)
})
test('HU15 reminders default off, can be edited/canceled and proposal edits preserve them without contact effects', () => {
  const saved = saveProposal(base, reference, 'one')
  assert.equal(saved.savedProposals[0].reminder, null)
  assert.equal(scheduleReminder(saved, 'missing', '2026-10-01', '08:30', reference), saved)
  assert.equal(scheduleReminder(saved, 'one', '2026-09-30', '14:00', reference), saved)
  const scheduled = scheduleReminder(saved, 'one', '2026-10-01', '08:30', reference)
  assert.equal(scheduled.savedProposals[0].reminder.scheduledAt, '2026-10-01T13:30:00.000Z')
  assert.equal(scheduled.savedProposals[0].reminder.executedAt, null)
  const edited = saveProposal({ ...scheduled, hours: 3, editingSavedProposalId: 'one' }, reference, 'unused')
  assert.deepEqual(edited.savedProposals[0].reminder, scheduled.savedProposals[0].reminder)
  const changed = scheduleReminder(edited, 'one', '2026-10-02', '10:00', reference)
  assert.equal(changed.savedProposals[0].reminder.scheduledAt, '2026-10-02T15:00:00.000Z')
  assert.equal(changed.allowProgramInvitations, false)
  assert.equal(changed.preferredContactDate, base.preferredContactDate)
  const canceled = cancelReminder(changed, 'one')
  assert.equal(canceled.savedProposals[0].reminder, null)
  assert.equal(cancelReminder(canceled, 'one'), canceled)
})
test('HU15 execution is due-only and once; deleted proposals have no executable reminders', () => {
  const saved = saveProposal(base, reference, 'one')
  const scheduled = scheduleReminder(saved, 'one', '2026-10-01', '08:30', reference)
  const due = new Date('2026-10-01T13:30:00Z')
  assert.equal(executeReminder(scheduled, 'one', new Date(due.getTime() - 1)), scheduled)
  const executed = executeReminder(scheduled, 'one', due)
  assert.equal(executed.savedProposals[0].reminder.status, 'executed')
  assert.equal(executed.savedProposals[0].reminder.executedAt, due.toISOString())
  assert.equal(executeReminder(executed, 'one', new Date('2026-10-02T15:00:00Z')), executed)
  const deleted = deleteProposal(scheduled, 'one')
  assert.equal(executeReminder(deleted, 'one', due), deleted)
  assert.equal(deleted.savedProposals.length, 0)
})
