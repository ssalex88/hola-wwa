import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalMentorService } from '../src/services/mentor.local.ts'
import { evaluateMentorSession } from '../src/domain/mentorOperations.ts'
import { referenceAt, configuration, unwrap, expectError } from './mentor.contract-suite.mjs'

const create = extra => createLocalMentorService({ referenceAt, storage: null, ...extra })
const memoryStorage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } }
const contexts = (profileId = 'inactive-recent') => { let n = 0; return () => ({ profileId, requestId: `a04-${++n}` }) }
const input = { name: 'Reparar mi bicicleta', targetAmount: 150, targetDate: null }
const unrelated = snapshot => ({
  profile: snapshot.profile, clock: snapshot.clock, eligibility: snapshot.eligibility,
  preferences: snapshot.preferences, contactPermission: snapshot.contactPermission,
  invitations: snapshot.invitations, reminders: snapshot.reminders, savedOptions: snapshot.savedOptions,
  progress: snapshot.progress, pause: snapshot.pause, cases: snapshot.cases,
  helpRequests: snapshot.helpRequests, deliveries: snapshot.deliveries, contributions: snapshot.contributions,
})

test('A-04: registration stores a trimmed name, positive rounded PEN amount and optional Lima date', async () => {
  const { service } = create(); const ctx = contexts()
  let snapshot = unwrap(await service.saveGoal(ctx(), { name: '  Reparar mi bicicleta  ', targetAmount: 150.126, targetDate: null }))
  const goal = snapshot.goals[0]
  assert.equal(goal.name, input.name)
  assert.equal(goal.targetAmount, 150.13)
  assert.equal(goal.targetDate, null)
  assert.equal(goal.status, 'active')
  assert.equal(goal.profileId, 'inactive-recent')
  assert.equal(goal.createdAt, referenceAt)
  assert.equal(goal.updatedAt, referenceAt)
  assert.equal(snapshot.goalProgress[0].contributedAmount, 0)
  assert.equal(snapshot.goalProgress[0].remainingAmount, 150.13)
  snapshot = unwrap(await service.saveGoal(ctx(), { ...input, goalId: goal.id, targetAmount: 0.01, targetDate: '2026-10-02' }))
  assert.equal(snapshot.goals[0].targetAmount, 0.01)
  assert.equal(snapshot.goals[0].targetDate, '2026-10-02')
  snapshot = unwrap(await service.saveGoal(ctx(), { ...input, goalId: goal.id, targetDate: null }))
  assert.equal(snapshot.goals[0].targetDate, null)
})

test('A-04: invalid name, amount and date never partially write or consume the retry key', async () => {
  const { service } = create(); const ctx = contexts()
  const before = await service.getProfile('inactive-recent')
  for (const name of ['', '  ', 'a'.repeat(201), null, undefined]) expectError(await service.saveGoal(ctx(), { ...input, name }), 'VALIDATION')
  for (const targetAmount of [0, -1, 0.001, NaN, Infinity, '150', null, undefined]) expectError(await service.saveGoal(ctx(), { ...input, targetAmount }), 'VALIDATION')
  for (const targetDate of ['', undefined, '2026-02-30', '2026-09-30', '2026-10-02T13:30:00.000Z']) expectError(await service.saveGoal(ctx(), { ...input, targetDate }), 'VALIDATION')
  assert.deepEqual(await service.getProfile('inactive-recent'), before)
  const request = ctx()
  expectError(await service.saveGoal(request, { ...input, targetAmount: 0 }), 'VALIDATION')
  assert.equal(unwrap(await service.saveGoal(request, input)).goals.length, 1)
})

test('A-04: editing preserves identity and history; archived/completed goals are explicitly managed', async () => {
  const { service, admin } = create(); const ctx = contexts()
  const original = unwrap(await service.saveGoal(ctx(), input)).goals[0]
  unwrap(await admin.advanceClock({ observedAt: '2026-10-02T15:00:00.000Z' }))
  let snapshot = unwrap(await service.saveGoal(ctx(), { goalId: original.id, name: 'Revisión de bicicleta', targetAmount: 200, targetDate: '2026-10-03' }))
  assert.equal(snapshot.goals.length, 1)
  assert.equal(snapshot.goals[0].id, original.id)
  assert.equal(snapshot.goals[0].createdAt, original.createdAt)
  assert.equal(snapshot.goals[0].updatedAt, '2026-10-02T15:00:00.000Z')
  snapshot = unwrap(await service.changeGoalStatus(ctx(), { goalId: original.id, status: 'completed' }))
  assert.equal(snapshot.goals[0].status, 'completed')
  assert.equal(snapshot.goalProgress[0].contributedAmount, 0)
  assert.equal(snapshot.goalProgress[0].targetReached, false) // status is not a financial contribution
  snapshot = unwrap(await service.saveGoal(ctx(), { ...input, goalId: original.id, name: 'Meta completada corregida' }))
  assert.equal(snapshot.goals[0].status, 'completed')
  snapshot = unwrap(await service.changeGoalStatus(ctx(), { goalId: original.id, status: 'archived' }))
  assert.equal(snapshot.goals[0].status, 'archived')
  assert.equal(snapshot.goals[0].id, original.id)
  expectError(await service.changeGoalStatus(ctx(), { goalId: original.id, status: 'deleted' }), 'VALIDATION')
})

test('A-04: a single active goal is enforced on creation and reactivation, including simultaneous calls', async () => {
  const { service, getOperations } = create(); const ctx = contexts()
  const [first, second] = await Promise.all([service.saveGoal(ctx(), input), service.saveGoal(ctx(), { ...input, name: 'Otra meta' })])
  const goalId = unwrap(first).goals[0].id
  expectError(second, 'CONFLICT')
  unwrap(await service.changeGoalStatus(ctx(), { goalId, status: 'archived' }))
  const next = unwrap(await service.saveGoal(ctx(), { ...input, name: 'Otra meta' }))
  const nextId = next.goals.find(g => g.status === 'active').id
  expectError(await service.changeGoalStatus(ctx(), { goalId, status: 'active' }), 'CONFLICT')
  assert.equal(unwrap(await service.getProfile('inactive-recent')).goals.filter(g => g.status === 'active').length, 1)
  unwrap(await service.changeGoalStatus(ctx(), { goalId: nextId, status: 'completed' }))
  const restored = unwrap(await service.changeGoalStatus(ctx(), { goalId, status: 'active' }))
  assert.equal(restored.goals.filter(g => g.status === 'active').length, 1)
  assert.equal(restored.goals.find(g => g.id === goalId).status, 'active')
  const operations = unwrap(await getOperations())
  assert.equal(evaluateMentorSession(operations.profiles, operations.events).activeGoals, 1)
})

test('A-04: an expired deadline can be kept when editing, cleared or replaced by a valid new deadline', async () => {
  const { service, admin } = create(); const ctx = contexts()
  const goal = unwrap(await service.saveGoal(ctx(), { ...input, targetDate: '2026-10-02' })).goals[0]
  unwrap(await admin.advanceClock({ observedAt: '2026-10-03T15:00:00.000Z' }))
  let snapshot = unwrap(await service.saveGoal(ctx(), { ...input, goalId: goal.id, name: 'Nombre corregido', targetAmount: 175, targetDate: goal.targetDate }))
  assert.equal(snapshot.goals[0].targetDate, '2026-10-02')
  assert.equal(snapshot.goals[0].targetAmount, 175)
  unwrap(await service.changeGoalStatus(ctx(), { goalId: goal.id, status: 'archived' }))
  snapshot = unwrap(await service.saveGoal(ctx(), { ...input, goalId: goal.id, targetDate: goal.targetDate }))
  assert.equal(snapshot.goals[0].status, 'archived')
  const before = await service.getProfile('inactive-recent')
  expectError(await service.saveGoal(ctx(), { ...input, goalId: goal.id, targetDate: '2026-10-01' }), 'VALIDATION')
  assert.deepEqual(await service.getProfile('inactive-recent'), before)
  snapshot = unwrap(await service.saveGoal(ctx(), { ...input, goalId: goal.id, targetDate: null }))
  assert.equal(snapshot.goals[0].targetDate, null)
  snapshot = unwrap(await service.saveGoal(ctx(), { ...input, goalId: goal.id, targetDate: '2026-10-04' }))
  assert.equal(snapshot.goals[0].targetDate, '2026-10-04')
})

test('A-04: optional goal does not gate app or external program, calculation, options or connection', async () => {
  for (const origin of ['app', 'external']) {
    const { service } = create(); const ctx = contexts()
    if (origin === 'external') {
      const invitation = unwrap(await service.presentInvitation(ctx(), { campaignId: 'pilot-reactivation-v1', origin, mode: 'simulated-contact' })).invitations[0]
      unwrap(await service.respondInvitation(ctx(), { invitationId: invitation.id, response: 'options', requestedFollowupAt: null }))
    }
    unwrap(await service.startProgram(ctx(), { origin }))
    const projection = unwrap(await service.calculateProjection(ctx(), configuration))
    unwrap(await service.saveOption(ctx(), { projectionId: projection.id }))
    const connected = unwrap(await service.confirmConnection(ctx(), { explicitConsent: true }))
    assert.deepEqual(connected.goals, [])
    assert.deepEqual(connected.goalProgress, [])
    assert.deepEqual(connected.contributions, [])
    assert.equal(connected.progress.origin, origin)
    assert.equal(connected.progress.connectedAt, referenceAt)
  }
})

test('A-04: goal lifecycle creates no consent, invitations, followups, reminders, intervention or automatic amounts', async () => {
  const { service, getOperations } = create(); const ctx = contexts()
  let baseline = unwrap(await service.getProfile('inactive-recent'))
  // Existing opt-out must remain opted out after the optional financial goal.
  unwrap(await service.updatePreferences(ctx(), { ...baseline.preferences, allowProgramInvitations: false, consentRecordedAt: null }))
  baseline = unwrap(await service.getProfile('inactive-recent'))
  let snapshot = unwrap(await service.saveGoal(ctx(), input))
  assert.deepEqual(unrelated(snapshot), unrelated(baseline))
  const goalId = snapshot.goals[0].id
  for (const status of ['completed', 'archived', 'active']) {
    snapshot = unwrap(await service.changeGoalStatus(ctx(), { goalId, status }))
    assert.deepEqual(unrelated(snapshot), unrelated(baseline))
  }
  snapshot = unwrap(await service.saveGoal(ctx(), { ...input, goalId, name: 'Meta editada', targetAmount: 200 }))
  assert.deepEqual(unrelated(snapshot), unrelated(baseline))
  const operations = unwrap(await getOperations())
  assert.equal(evaluateMentorSession(operations.profiles, operations.events).externalContacts, 0)
  assert.equal(evaluateMentorSession(operations.profiles, operations.events).declaredAmount, 0)
  assert.equal(operations.events.filter(e => ['presentInvitation', 'scheduleReminder', 'startProgram'].includes(e.action)).length, 0)
})

test('A-04: goals preserve already scheduled reminders and invitation followups without executing them', async () => {
  const { service } = create(); const ctx = contexts()
  let snapshot = unwrap(await service.getProfile('inactive-recent'))
  unwrap(await service.updatePreferences(ctx(), { ...snapshot.preferences, remindersAllowed: true }))
  const invitation = unwrap(await service.presentInvitation(ctx(), { campaignId: 'pilot-reactivation-v1', origin: 'external', mode: 'simulated-contact' })).invitations[0]
  unwrap(await service.respondInvitation(ctx(), { invitationId: invitation.id, response: 'later', requestedFollowupAt: '2026-10-02T13:30:00.000Z' }))
  const projection = unwrap(await service.calculateProjection(ctx(), configuration))
  const option = unwrap(await service.saveOption(ctx(), { projectionId: projection.id })).savedOptions[0]
  unwrap(await service.scheduleReminder(ctx(), { savedOptionId: option.id, scheduledAt: '2026-10-02T13:30:00.000Z', explicitConsent: true }))
  const baseline = unwrap(await service.getProfile('inactive-recent'))
  snapshot = unwrap(await service.saveGoal(ctx(), input))
  assert.deepEqual(unrelated(snapshot), unrelated(baseline))
  snapshot = unwrap(await service.changeGoalStatus(ctx(), { goalId: snapshot.goals[0].id, status: 'completed' }))
  assert.deepEqual(unrelated(snapshot), unrelated(baseline))
  assert.equal(snapshot.reminders[0].status, 'scheduled')
  assert.equal(snapshot.reminders[0].executedAt, null)
})

test('A-04: identity, status, optional deadline, replay and profile isolation survive reload', async () => {
  const storage = memoryStorage(); const { service } = create({ storage }); const ctx = contexts()
  const creation = ctx()
  const original = await service.saveGoal(creation, input)
  const goalId = unwrap(original).goals[0].id
  unwrap(await service.saveGoal(ctx(), { ...input, goalId, name: 'Meta editada', targetDate: '2026-10-02' }))
  const completed = await service.changeGoalStatus(ctx(), { goalId, status: 'completed' })
  unwrap(completed)
  const restarted = create({ storage })
  assert.deepEqual(await restarted.service.getProfile('inactive-recent'), completed)
  assert.deepEqual(await restarted.service.saveGoal(creation, input), original)
  assert.equal(unwrap(await restarted.service.getProfile('inactive-recent')).goals[0].status, 'completed')
  expectError(await restarted.service.saveGoal({ profileId: 'inactive-31-60', requestId: 'foreign-edit' }, { ...input, goalId }), 'NOT_FOUND')
  expectError(await restarted.service.changeGoalStatus({ profileId: 'inactive-31-60', requestId: 'foreign-status' }, { goalId, status: 'archived' }), 'NOT_FOUND')
  assert.deepEqual(unwrap(await restarted.service.getProfile('inactive-31-60')).goals, [])
})
