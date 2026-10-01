import assert from 'node:assert/strict'
import test from 'node:test'
import { dateInLima, isFutureDate, momentInLima, nextDate } from '../src/domain/demoDates.ts'
import { copyConfiguration, validateProjectionConfiguration } from '../src/domain/projectionConfiguration.ts'
import { calculateProjection } from '../src/domain/projection.ts'
import { SIMULATED_PROJECTION_RATES } from '../src/data/projectionRates.ts'
import { canOfferInitialInvitation, canOpenExistingInvitation, invitationPreviewReason, recordInvitationResponse, recordProgramStarted, updateContactPreferences } from '../src/domain/invitations.ts'
import { parseAppRoute } from '../src/services/demoRoutes.ts'

const today = '2026-09-30'
const campaign = 'pilot'
const option = { zone: 'Lima Centro', hours: 2, moment: 'Tarde', vehicle: 'Bicicleta', scheduleMode: 'another-day', scheduledDate: '2026-10-01', expenseFuel: 3, expenseMaintenance: 1.25, expenseOther: .75 }
const invitation = () => ({ preferences: { allowProgramInvitations: true, preferredContactDate: null }, dismissedCampaignIds: [], invitationResponses: {}, externalInvitationPresentedCampaignIds: [], programStartedCampaignIds: [], scheduledContactDatesByCampaign: {} })

test('presenter previews distinguish reopening from opt-out, start, dismissal and ineligibility without mutating contact records', () => {
  const eligible = { eligible: true, daysInactive: 20, lastCompletedAt: '2026-09-10T19:00:00.000Z' }
  const pending = { ...invitation(), externalInvitationPresentedCampaignIds: [campaign] }
  assert.equal(invitationPreviewReason(eligible, pending, campaign), null)
  assert.equal(canOfferInitialInvitation(pending, campaign), false)
  const records = [
    recordProgramStarted(invitation(), campaign),
    recordInvitationResponse(invitation(), campaign, 'not-interested', today),
    recordInvitationResponse(invitation(), campaign, 'later', today, '2026-10-02'),
    { ...invitation(), dismissedCampaignIds: [campaign] },
  ]
  for (const record of records) {
    const before = structuredClone(record)
    assert.equal(typeof invitationPreviewReason(eligible, record, campaign), 'string')
    assert.deepEqual(record, before)
    assert.equal(canOfferInitialInvitation(record, campaign), false)
  }
  for (const reason of ['active', 'blocked', 'no-completed-delivery', 'invalid-date']) assert.equal(typeof invitationPreviewReason({ eligible: false, reason }, invitation(), campaign), 'string')
})

test('calendar validation rejects missing, past, same-day and impossible dates', () => {
  for (const date of [null, '', '2026-09-29', today, '2026-02-30', '2026-13-01', 'foo', '2026-99-99']) {
    assert.ok(validateProjectionConfiguration({ ...option, scheduledDate: date }, today).scheduledDate)
  }
  assert.deepEqual(validateProjectionConfiguration(option, today), {})
  assert.equal(isFutureDate('2028-02-29', today), true)
})

test('all mandatory choices, invalid duration and negative or nonfinite costs are rejected', () => {
  for (const field of ['zone', 'vehicle', 'moment']) assert.ok(validateProjectionConfiguration({ ...option, [field]: '' }, today)[field])
  for (const hours of [0, -1, 13, NaN, Infinity]) assert.ok(validateProjectionConfiguration({ ...option, hours }, today).hours)
  for (const expenseFuel of [-1, NaN, Infinity]) assert.ok(validateProjectionConfiguration({ ...option, expenseFuel }, today).expenseFuel)
  assert.equal(calculateProjection({ ...option, expenseOther: -5 }, SIMULATED_PROJECTION_RATES), null)
})

test('Lima date and now-slot are consistent across timezone and midnight boundaries', () => {
  assert.equal(dateInLima(new Date('2026-10-01T02:00:00Z')), today)
  assert.equal(momentInLima(new Date('2026-09-30T15:00:00Z')), 'Mañana')
  assert.equal(momentInLima(new Date('2026-09-30T19:00:00Z')), 'Tarde')
  assert.equal(momentInLima(new Date('2026-10-01T01:00:00Z')), 'Noche')
  assert.equal(nextDate('2026-12-31'), '2027-01-01')
})

test('gross range scales by duration and only entered outing expenses are subtracted', () => {
  const result = calculateProjection(option, SIMULATED_PROJECTION_RATES)
  assert.deepEqual(result, { grossMin: 24, grossMax: 40, expenses: 5, afterExpensesMin: 19, afterExpensesMax: 35, hourlyMin: 12, hourlyMax: 20 })
  assert.deepEqual(calculateProjection(option, SIMULATED_PROJECTION_RATES), result)
  assert.equal(calculateProjection({ ...option, hours: 3 }, SIMULATED_PROJECTION_RATES).grossMin, 36)
  assert.equal(calculateProjection({ ...option, expenseFuel: 100 }, SIMULATED_PROJECTION_RATES).afterExpensesMin, -78)
})

test('absent combinations never get a fabricated fallback range', () => {
  assert.equal(calculateProjection({ ...option, vehicle: 'Auto' }, SIMULATED_PROJECTION_RATES), null)
  assert.equal(calculateProjection({ ...option, zone: 'Zona sin datos' }, SIMULATED_PROJECTION_RATES), null)
})

test('proposal copies preserve timing and independent costs, excluding invitation preferences', () => {
  const current = { ...option, allowProgramInvitations: false, comparisonOption: null }
  const alternative = copyConfiguration(current)
  alternative.scheduledDate = '2026-10-05'
  alternative.expenseFuel = 20
  assert.equal(current.scheduledDate, '2026-10-01')
  assert.equal(current.expenseFuel, 3)
  assert.equal('allowProgramInvitations' in alternative, false)
  assert.equal(calculateProjection(current, SIMULATED_PROJECTION_RATES).expenses, 5)
  assert.equal(calculateProjection(alternative, SIMULATED_PROJECTION_RATES).expenses, 22)
})

test('an unanswered invitation suppresses new attempts, but its existing link can be reopened', () => {
  const record = invitation()
  assert.equal(canOfferInitialInvitation(record, campaign), true)
  record.externalInvitationPresentedCampaignIds.push(campaign)
  assert.equal(canOfferInitialInvitation(record, campaign), false)
  assert.equal(canOpenExistingInvitation(record, campaign), true)
})

test('later without a date creates no followup and clears an earlier one', () => {
  const initial = { ...invitation(), scheduledContactDatesByCampaign: { [campaign]: '2026-10-09' } }
  const result = recordInvitationResponse(initial, campaign, 'later', today)
  assert.deepEqual(result.scheduledContactDatesByCampaign, {})
  assert.equal(result.preferences.preferredContactDate, null)
  assert.equal(canOfferInitialInvitation(result, campaign), false)
})

test('only an explicit valid future date creates a simulated followup', () => {
  assert.throws(() => recordInvitationResponse(invitation(), campaign, 'later', today, today), RangeError)
  assert.throws(() => recordInvitationResponse(invitation(), campaign, 'later', today, '2026-13-01'), RangeError)
  assert.deepEqual(recordInvitationResponse(invitation(), campaign, 'later', today, '2026-10-02').scheduledContactDatesByCampaign, { [campaign]: '2026-10-02' })
})

test('not interested cancels pending contacts and suppresses both channels', () => {
  const initial = { ...invitation(), scheduledContactDatesByCampaign: { pilot: '2026-10-02', other: '2026-10-04' } }
  const result = recordInvitationResponse(initial, campaign, 'not-interested', today)
  assert.equal(result.preferences.allowProgramInvitations, false)
  assert.deepEqual(result.scheduledContactDatesByCampaign, {})
  assert.equal(canOfferInitialInvitation(result, campaign), false)
  assert.equal(canOpenExistingInvitation(result, campaign), false)
})

test('starting through any route cancels campaign followup and never creates another initial invite', () => {
  const record = recordProgramStarted({ ...invitation(), scheduledContactDatesByCampaign: { pilot: '2026-10-02' } }, campaign)
  assert.deepEqual(record.scheduledContactDatesByCampaign, {})
  assert.equal(canOfferInitialInvitation(record, campaign), false)
  assert.equal(recordProgramStarted(record, campaign), record)
})

test('now-no dismissal suppresses external generation without scheduling a contact', () => {
  const record = { ...invitation(), dismissedCampaignIds: [campaign] }
  assert.equal(canOfferInitialInvitation(record, campaign), false)
  assert.deepEqual(record.scheduledContactDatesByCampaign, {})
})

test('voluntary preferences update or cancel an existing followup, but never create one', () => {
  const initial = invitation()
  const dateOnly = updateContactPreferences(initial, { ...initial.preferences, preferredContactDate: '2026-10-02' }, campaign, today)
  assert.deepEqual(dateOnly.scheduledContactDatesByCampaign, {})
  const scheduled = recordInvitationResponse(initial, campaign, 'later', today, '2026-10-02')
  const updated = updateContactPreferences(scheduled, { ...scheduled.preferences, preferredContactDate: '2026-10-03' }, campaign, today)
  assert.deepEqual(updated.scheduledContactDatesByCampaign, { [campaign]: '2026-10-03' })
  const cancelled = updateContactPreferences(updated, { ...updated.preferences, preferredContactDate: null }, campaign, today)
  assert.deepEqual(cancelled.scheduledContactDatesByCampaign, {})
  const optedOut = updateContactPreferences(updated, { ...updated.preferences, allowProgramInvitations: false }, campaign, today)
  assert.deepEqual(optedOut.scheduledContactDatesByCampaign, {})
})

test('external and direct program links resolve the same simulated identity; malformed tokens are rejected', () => {
  const profiles = [{ id: 'inactive-recent' }]
  assert.deepEqual(parseAppRoute('?invite=pilot-demo-inactive-recent', profiles), { kind: 'invitation', profileId: 'inactive-recent' })
  assert.deepEqual(parseAppRoute('?program=inactive-recent', profiles), { kind: 'program', profileId: 'inactive-recent' })
  assert.deepEqual(parseAppRoute('?invite=invalid', profiles), { kind: 'invalid-invitation' })
})
