import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalMentorService } from '../src/services/mentor.local.ts'
import { MENTOR_STORAGE_KEY } from '../src/services/mentorStorage.ts'
import { evaluateMentorSession } from '../src/domain/mentorOperations.ts'
import { mentorContractSuite, referenceAt, configuration, unwrap, expectError } from './mentor.contract-suite.mjs'

const create = extra => createLocalMentorService({ referenceAt, storage: null, ...extra })
const memoryStorage = () => { const data = new Map(); return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } }
mentorContractSuite('local MentorService v1.0', create)

test('local: persisted entities and successful retries survive a new service instance', async () => {
  const storage = memoryStorage(); const first = create({ storage })
  const ctx = { profileId: 'inactive-recent', requestId: 'persisted' }
  const input = { name: 'Bicicleta', targetAmount: 150, targetDate: null }
  const original = await first.service.saveGoal(ctx, input)
  const goalId = unwrap(original).goals[0].id
  unwrap(await first.service.saveContribution({ ...ctx, requestId: 'amount' }, { goalId, amount: 20, contributedOn: '2026-10-01' }))
  const projection = unwrap(await first.service.calculateProjection({ ...ctx, requestId: 'project' }, configuration))
  unwrap(await first.service.saveOption({ ...ctx, requestId: 'save' }, { projectionId: projection.id }))
  const second = create({ storage, referenceAt: '2027-01-01T15:00:00.000Z' })
  assert.deepEqual(await second.service.getProfile(ctx.profileId), await first.service.getProfile(ctx.profileId))
  assert.deepEqual(await second.service.saveGoal(ctx, input), original)
  expectError(await second.service.saveGoal(ctx, { ...input, name: 'Cambio' }), 'CONFLICT')
  assert.equal(unwrap(await second.getOperations()).events.length, 4)
})

test('local: storage failures roll back writes and requestId can be retried after recovery', async () => {
  const storage = memoryStorage(); let fail = true
  const service = create({ storage: { getItem: storage.getItem, setItem: (key, value) => { if (fail) throw new Error('Quota exceeded'); storage.setItem(key, value) } } }).service
  const ctx = { profileId: 'inactive-recent', requestId: 'quota' }
  const input = { name: 'Meta', targetAmount: 50, targetDate: null }
  expectError(await service.saveGoal(ctx, input), 'UNEXPECTED')
  assert.equal(unwrap(await service.getProfile(ctx.profileId)).revision, 0)
  assert.deepEqual(unwrap(await service.getProfile(ctx.profileId)).goals, [])
  fail = false
  assert.equal(unwrap(await service.saveGoal(ctx, input)).goals.length, 1)
  expectError(await create({ storage: { getItem: () => { throw new Error('Denied') }, setItem() {} } }).service.getProfile(ctx.profileId), 'UNEXPECTED')
})

test('local: malformed persistence is rejected without trusting money or cross-profile entities', async () => {
  const storage = memoryStorage(); const local = create({ storage })
  unwrap(await local.service.saveGoal({ profileId: 'inactive-recent', requestId: 'save' }, { name: 'Meta', targetAmount: 150, targetDate: null }))
  const saved = JSON.parse(storage.getItem(MENTOR_STORAGE_KEY))
  saved.profiles['inactive-recent'].snapshot.goals[0].targetAmount = -100
  storage.setItem(MENTOR_STORAGE_KEY, JSON.stringify(saved))
  assert.deepEqual(unwrap(await create({ storage }).service.getProfile('inactive-recent')).goals, [])
  saved.profiles['inactive-recent'].snapshot.goals[0].targetAmount = 150
  saved.profiles['inactive-recent'].snapshot.goals[0].profileId = 'inactive-31-60'
  storage.setItem(MENTOR_STORAGE_KEY, JSON.stringify(saved))
  assert.deepEqual(unwrap(await create({ storage }).service.getProfile('inactive-recent')).goals, [])
})

test('local: migration preserves legacy text as metadata and rejection without inventing savings', async () => {
  const storage = memoryStorage()
  storage.setItem('unrelated', 'keep')
  const legacy = { profileDataById: { 'inactive-recent': { goals: ['Ahorrar para reparar'], preferences: { allowProgramInvitations: false }, invitationResponses: { pilot: 'not-interested' } } } }
  storage.setItem('vuelve-a-tu-ritmo:session:v3', JSON.stringify(legacy))
  const local = create({ storage })
  const snapshot = unwrap(await local.service.getProfile('inactive-recent'))
  assert.deepEqual(snapshot.goals, [])
  assert.deepEqual(snapshot.contributions, [])
  assert.equal(snapshot.contactPermission.reason, 'rejected')
  assert.deepEqual(unwrap(await local.getOperations()).legacyGoalNames['inactive-recent'], ['Ahorrar para reparar'])
  unwrap(await local.admin.resetDemo())
  assert.equal(storage.getItem('unrelated'), 'keep')
  assert.equal(storage.getItem('vuelve-a-tu-ritmo:session:v3'), JSON.stringify(legacy))
  assert.deepEqual(unwrap(await create({ storage }).service.getProfile('inactive-recent')).invitations, [])
})

test('local: pause expiry never resurrects cancelled reminders, contacts or rejection', async () => {
  const { service, admin } = create(); let n = 0
  const ctx = () => ({ profileId: 'inactive-recent', requestId: `expiry-${++n}` })
  unwrap(await service.activatePause(ctx(), { endsAt: '2026-10-02T15:00:00.000Z', reason: null }))
  unwrap(await admin.advanceClock({ observedAt: '2026-10-02T15:00:00.000Z' }))
  const snapshot = unwrap(await service.getProfile('inactive-recent'))
  assert.equal(snapshot.pause.status, 'expired')
  assert.deepEqual(snapshot.reminders, [])
  assert.deepEqual(snapshot.invitations, [])
  expectError(await admin.advanceClock({ observedAt: referenceAt }), 'VALIDATION')
})

test('local: requested followup is future-only, cancelled on start or pause, never sent automatically', async () => {
  const { service, admin } = create(); let n = 0
  const ctx = () => ({ profileId: 'inactive-recent', requestId: `followup-${++n}` })
  let snapshot = unwrap(await service.presentInvitation(ctx(), { campaignId: 'pilot', origin: 'external', mode: 'simulated-contact' }))
  const invitationId = snapshot.invitations[0].id
  expectError(await service.respondInvitation(ctx(), { invitationId, response: 'later', requestedFollowupAt: referenceAt }), 'VALIDATION')
  snapshot = unwrap(await service.respondInvitation(ctx(), { invitationId, response: 'later', requestedFollowupAt: '2026-10-02T15:00:00.000Z' }))
  assert.equal(snapshot.invitations[0].requestedFollowupAt, '2026-10-02T15:00:00.000Z')
  unwrap(await admin.advanceClock({ observedAt: '2026-10-02T16:00:00.000Z' }))
  snapshot = unwrap(await service.getProfile('inactive-recent'))
  assert.equal(snapshot.invitations.length, 1)
  assert.equal(snapshot.invitations[0].status, 'later')
  snapshot = unwrap(await service.startProgram(ctx(), { origin: 'app' }))
  assert.equal(snapshot.invitations[0].requestedFollowupAt, null)
})

test('local: prevention, priority bands and declared pause stay separate from contact consent', async () => {
  const { service } = create()
  const ten = unwrap(await service.getProfile('interruption-10'))
  assert.equal(ten.eligibility.track, 'prevention')
  assert.equal(ten.eligibility.eligible, false)
  assert.equal(ten.contactPermission.reason, 'ineligible')
  assert.equal(unwrap(await service.getProfile('inactive-31-60')).eligibility.priority, 2)
  assert.equal(unwrap(await service.getProfile('inactive-over-60')).eligibility.priority, 3)
  const paused = unwrap(await service.getProfile('declared-pause'))
  assert.equal(paused.eligibility.eligible, true)
  assert.equal(paused.contactPermission.reason, 'paused')
  unwrap(await service.startProgram({ profileId: 'declared-pause', requestId: 'voluntary-paused' }, { origin: 'app' }))
  expectError(await service.presentInvitation({ profileId: ten.profile.id, requestId: 'no-preventive-campaign' }, { campaignId: 'pilot', origin: 'external', mode: 'simulated-contact' }), 'NOT_ELIGIBLE')
})

test('local: incentive enrollment changes intent only; review re-filters expired offers', async () => {
  const { service, admin } = create(); let n = 0
  const ctx = () => ({ profileId: 'inactive-recent', requestId: `incentive-${++n}` })
  const projection = unwrap(await service.calculateProjection(ctx(), configuration))
  const incentive = projection.incentives.find(i => i.enrollmentRequired)
  assert.ok(incentive)
  let snapshot = unwrap(await service.enrollIncentive(ctx(), { projectionId: projection.id, incentiveId: incentive.id }))
  assert.equal(snapshot.progress.currentProjection.incentives.find(i => i.id === incentive.id).status, 'enrolled')
  assert.deepEqual(snapshot.progress.currentProjection.result, projection.result)
  assert.deepEqual(snapshot.contributions, [])
  assert.equal(snapshot.deliveries.length, 4)
  snapshot = unwrap(await service.saveOption(ctx(), { projectionId: projection.id }))
  const optionId = snapshot.savedOptions[0].id
  unwrap(await admin.advanceClock({ observedAt: '2026-10-20T15:00:00.000Z' }))
  const reviewed = unwrap(await service.reviewOption(ctx(), { optionId }))
  assert.deepEqual(reviewed.projection.incentives, [])
})

test('local: events exclude previews, retries and duplicate deliveries; metrics stay descriptive', async () => {
  const local = create(); const { service, admin } = local
  let n = 0; const ctx = () => ({ profileId: 'inactive-recent', requestId: `events-${++n}` })
  unwrap(await service.presentInvitation(ctx(), { campaignId: 'pilot', origin: 'external', mode: 'demo-preview' }))
  unwrap(await service.startProgram(ctx(), { origin: 'app' }))
  const request = ctx()
  unwrap(await service.calculateProjection(request, configuration))
  unwrap(await service.calculateProjection(request, configuration))
  unwrap(await service.compareProjections(ctx(), { first: configuration, second: { ...configuration, hours: 1 } }))
  unwrap(await admin.advanceClock({ observedAt: '2026-10-01T15:01:00.000Z' }))
  const delivery = { id: 'unique-return', status: 'completed', completedAt: '2026-10-01T15:01:00.000Z' }
  unwrap(await admin.registerDelivery(ctx(), delivery))
  unwrap(await admin.registerDelivery(ctx(), delivery))
  const operations = unwrap(await local.getOperations())
  assert.equal(operations.events.filter(e => e.action === 'registerDelivery').length, 1)
  const metrics = evaluateMentorSession(operations.profiles, operations.events)
  assert.equal(metrics.projectionQueries, 3)
  assert.equal(metrics.projectionUsers, 1)
  assert.equal(metrics.externalContacts, 0)
  assert.equal(metrics.returned, 1)
  assert.equal(metrics.declaredAmount, 0)
  unwrap(await admin.resetProfile('inactive-recent'))
  assert.equal(unwrap(await local.getOperations()).events.length, 0)
})

test('local: transactional comparison rolls back partial writes and validates UTC/null/date fields', async () => {
  const local = create(); const { service } = local
  const ctx = { profileId: 'inactive-recent', requestId: 'invalid-comparison' }
  expectError(await service.compareProjections(ctx, { first: configuration, second: { ...configuration, expenseOther: NaN } }), 'VALIDATION')
  assert.equal(unwrap(await service.getProfile(ctx.profileId)).revision, 0)
  assert.deepEqual(unwrap(await local.getOperations()).events, [])
  expectError(await service.activatePause({ ...ctx, requestId: 'non-utc' }, { endsAt: '2026-10-02T08:30:00-05:00', reason: null }), 'VALIDATION')
  expectError(await service.activatePause({ ...ctx, requestId: 'impossible' }, { endsAt: '2026-02-30T15:00:00.000Z', reason: null }), 'VALIDATION')
  expectError(await service.saveGoal({ ...ctx, requestId: 'empty-date' }, { name: 'Meta', targetAmount: 1, targetDate: '' }), 'VALIDATION')
  expectError(await service.saveGoal({ ...ctx, requestId: 'missing-date' }, { name: 'Meta', targetAmount: 1 }), 'VALIDATION')
})

test('local: multiple adapters see shared revisions and concurrent retries have one effect', async () => {
  const storage = memoryStorage(); const first = create({ storage }); const second = create({ storage })
  const stale = unwrap(await second.service.getProfile('inactive-recent'))
  const ctx = { profileId: 'inactive-recent', requestId: 'concurrent', expectedRevision: stale.revision }
  const input = { name: 'Meta', targetAmount: 40, targetDate: null }
  const [a, b] = await Promise.all([first.service.saveGoal(ctx, input), first.service.saveGoal(ctx, input)])
  assert.deepEqual(a, b)
  assert.deepEqual(await second.service.saveGoal(ctx, input), a)
  expectError(await second.service.activatePause({ ...ctx, requestId: 'stale-other-adapter' }, { endsAt: null, reason: null }), 'CONFLICT')
  const snapshot = unwrap(await second.service.getProfile(ctx.profileId))
  assert.equal(snapshot.goals.length, 1)
  snapshot.goals[0].name = 'Client changed copy'
  assert.equal(unwrap(await first.service.getProfile(ctx.profileId)).goals[0].name, 'Meta')
  assert.equal(unwrap(await first.getOperations()).events.length, 1)
})

test('local: rich v3 migration preserves nonmonetary state, cancelling unconsented reminders', async () => {
  const storage = memoryStorage()
  const legacyProfile = {
    goals: ['Reparar bicicleta'],
    preferences: { ...configuration, allowProgramInvitations: true, returnNeed: 'time', programStep: 'projection', savedProposals: [{ ...configuration, id: 'saved-old', referenceAt, tableVersion: 'demo-rates-v1', reminder: { scheduledAt: '2026-10-02T13:30:00.000Z', status: 'scheduled', executedAt: null } }] },
    deliveryHistory: [{ id: 'before', status: 'completed', completedAt: '2026-09-11T15:00:00.000Z' }, { id: 'after', status: 'completed', completedAt: '2026-10-01T15:01:00.000Z' }],
    returnTracking: { interventionStartedAt: referenceAt, observedAt: '2026-10-01T15:01:00.000Z', feedback: 'good' },
    connection: { connectedAt: referenceAt },
    support: { cases: [{ id: 'DEMO-inactive-recent-PAGO-01', status: 'resolved' }], requests: { 'DEMO-inactive-recent-PAGO-01': referenceAt } },
    incentiveEnrollments: { 'demo-centro-three': referenceAt },
  }
  storage.setItem('vuelve-a-tu-ritmo:session:v3', JSON.stringify({ profileDataById: { 'inactive-recent': legacyProfile } }))
  const local = create({ storage })
  const migrated = unwrap(await local.service.getProfile('inactive-recent'))
  assert.equal(migrated.progress.returnDeliveryId, 'after')
  assert.equal(migrated.progress.eligibleAtStart, true)
  assert.equal(migrated.progress.origin, null)
  assert.equal(migrated.progress.returnFeedback, 'good')
  assert.equal(migrated.progress.connectedAt, referenceAt)
  assert.equal(migrated.progress.need, 'time')
  assert.equal(migrated.savedOptions[0].id, 'saved-old')
  assert.equal(migrated.reminders[0].status, 'cancelled')
  assert.equal(migrated.preferences.remindersAllowed, false)
  assert.equal(migrated.cases[0].status, 'resolved')
  assert.equal(migrated.helpRequests.length, 1)
  assert.deepEqual(migrated.contributions, [])
  unwrap(await local.service.updateProgress({ profileId: 'inactive-recent', requestId: 'persist-migration' }, { step: 'decision' }))
  const restarted = create({ storage })
  assert.deepEqual(await restarted.service.getProfile('inactive-recent'), await local.service.getProfile('inactive-recent'))
})

test('local: earlier historical delivery corrects first return without duplicating returned people', async () => {
  const local = create(); const { service, admin } = local
  unwrap(await service.startProgram({ profileId: 'inactive-recent', requestId: 'start' }, { origin: 'app' }))
  unwrap(await admin.advanceClock({ observedAt: '2026-10-01T15:03:00.000Z' }))
  unwrap(await admin.registerDelivery({ profileId: 'inactive-recent', requestId: 'later' }, { id: 'later', status: 'completed', completedAt: '2026-10-01T15:03:00.000Z' }))
  const corrected = unwrap(await admin.registerDelivery({ profileId: 'inactive-recent', requestId: 'earlier' }, { id: 'earlier', status: 'completed', completedAt: '2026-10-01T15:01:00.000Z' }))
  assert.equal(corrected.progress.returnDeliveryId, 'earlier')
  const operations = unwrap(await local.getOperations())
  assert.equal(evaluateMentorSession(operations.profiles, operations.events).returned, 1)
})

test('local: midnight uses Lima local contribution date and previews/pause preserve all entity types on reload', async () => {
  const storage = memoryStorage(); const local = create({ referenceAt: '2026-10-02T02:00:00.000Z', storage })
  const { service, admin } = local; let n = 0
  const ctx = () => ({ profileId: 'inactive-recent', requestId: `all-${++n}` })
  const created = unwrap(await service.saveGoal(ctx(), { name: 'Meta', targetAmount: 150, targetDate: null }))
  const goalId = created.goals[0].id
  unwrap(await service.saveContribution(ctx(), { goalId, amount: 20, contributedOn: '2026-10-01' }))
  expectError(await service.saveContribution(ctx(), { goalId, amount: 20, contributedOn: '2026-10-02' }), 'VALIDATION')
  unwrap(await service.presentInvitation(ctx(), { campaignId: 'pilot', origin: 'external', mode: 'demo-preview' }))
  unwrap(await service.startProgram(ctx(), { origin: 'app' }))
  const projection = unwrap(await service.calculateProjection(ctx(), configuration))
  let snapshot = unwrap(await service.saveOption(ctx(), { projectionId: projection.id }))
  unwrap(await service.updatePreferences(ctx(), { ...snapshot.preferences, remindersAllowed: true }))
  snapshot = unwrap(await service.scheduleReminder(ctx(), { savedOptionId: snapshot.savedOptions[0].id, scheduledAt: '2026-10-02T13:30:00.000Z', explicitConsent: true }))
  unwrap(await service.requestHelp(ctx(), { caseId: snapshot.cases[0].id }))
  unwrap(await service.confirmConnection(ctx(), { explicitConsent: true }))
  unwrap(await admin.advanceClock({ observedAt: '2026-10-02T13:30:00.000Z' }))
  unwrap(await admin.executeReminder(ctx(), { reminderId: snapshot.reminders[0].id }))
  unwrap(await admin.registerDelivery(ctx(), { id: 'return', status: 'completed', completedAt: '2026-10-02T13:30:00.000Z' }))
  unwrap(await service.recordReturnFeedback(ctx(), { feedback: 'good' }))
  unwrap(await service.activatePause(ctx(), { endsAt: null, reason: 'Descanso' }))
  assert.deepEqual(await create({ storage }).service.getProfile('inactive-recent'), await service.getProfile('inactive-recent'))
  assert.deepEqual(await create({ storage }).getOperations(), await local.getOperations())
})
