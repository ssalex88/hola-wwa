import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalMentorService } from '../src/services/mentor.local.ts'
import { evaluateMentorSession } from '../src/domain/mentorOperations.ts'
import { referenceAt, configuration, unwrap, expectError } from './mentor.contract-suite.mjs'

const create = extra => createLocalMentorService({ referenceAt, storage: null, ...extra })
const external = { campaignId: 'pilot-reactivation-v1', origin: 'external', mode: 'simulated-contact' }
const memoryStorage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } }
const contexts = (profileId = 'inactive-recent') => { let n = 0; return () => ({ profileId, requestId: `a03-${++n}` }) }

test('A-03: Ver opciones and internal entry use one profile and one intervention', async () => {
  const { service, getOperations } = create(); const ctx = contexts()
  const goal = unwrap(await service.saveGoal(ctx(), { name: 'Reparar bicicleta', targetAmount: 150, targetDate: null })).goals[0]
  const presented = unwrap(await service.presentInvitation(ctx(), external))
  const invitation = presented.invitations[0]
  assert.equal(invitation.status, 'pending')
  assert.equal(invitation.profileId, goal.profileId)
  assert.equal(invitation.origin, 'external')
  assert.equal(invitation.mode, 'simulated-contact')
  assert.equal(invitation.presentedAt, referenceAt)
  assert.equal(invitation.respondedAt, null)
  assert.equal(presented.profile.simulated, true)
  assert.equal(presented.progress.interventionStartedAt, null)
  const opened = unwrap(await service.respondInvitation(ctx(), { invitationId: invitation.id, response: 'options', requestedFollowupAt: null }))
  assert.equal(opened.invitations[0].status, 'opened')
  assert.equal(opened.invitations[0].respondedAt, referenceAt)
  assert.equal(opened.progress.interventionStartedAt, null)
  const started = unwrap(await service.startProgram(ctx(), { origin: 'external' }))
  assert.equal(started.profile.id, 'inactive-recent')
  assert.equal(started.progress.eligibleAtStart, true)
  assert.equal(started.progress.origin, 'external')
  const projection = unwrap(await service.calculateProjection(ctx(), configuration))
  const saved = unwrap(await service.saveOption(ctx(), { projectionId: projection.id }))
  assert.deepEqual(saved.goals, [goal])
  assert.deepEqual(unwrap(await service.getProfile('inactive-recent')).savedOptions, saved.savedOptions)
  const internal = unwrap(await service.startProgram(ctx(), { origin: 'app' }))
  assert.equal(internal.progress.interventionStartedAt, started.progress.interventionStartedAt)
  assert.equal(internal.progress.origin, 'external')
  const operations = unwrap(await getOperations())
  const metrics = evaluateMentorSession(operations.profiles, operations.events)
  assert.equal(metrics.started, 1)
  assert.equal(metrics.externalEntries, 1)
  assert.equal(metrics.externalContacts, 1)
  assert.deepEqual(unwrap(await service.getProfile('inactive-31-60')).goals, [])
})

test('A-03: Más adelante without time persists the decision without creating contact or reminder', async () => {
  const storage = memoryStorage(); const { service } = create({ storage }); const ctx = contexts()
  const before = unwrap(await service.presentInvitation(ctx(), external))
  const invitationId = before.invitations[0].id
  const later = unwrap(await service.respondInvitation(ctx(), { invitationId, response: 'later', requestedFollowupAt: null }))
  assert.equal(later.invitations[0].status, 'later')
  assert.equal(later.invitations[0].respondedAt, referenceAt)
  assert.equal(later.invitations[0].requestedFollowupAt, null)
  assert.equal(later.progress.interventionStartedAt, null)
  assert.deepEqual(later.preferences, before.preferences)
  assert.deepEqual(later.reminders, [])
  assert.deepEqual(await create({ storage }).service.getProfile('inactive-recent'), await service.getProfile('inactive-recent'))
  const reopened = unwrap(await service.presentInvitation(ctx(), external))
  assert.equal(reopened.invitations.length, 1)
  assert.equal(reopened.invitations[0].id, invitationId)
  assert.equal(reopened.invitations[0].status, 'later')
  expectError(await service.respondInvitation(ctx(), { invitationId, response: 'options', requestedFollowupAt: null }), 'CONFLICT')
})

test('A-03: No recibir estas invitaciones cancels followups across channels without disabling voluntary use or reminders', async () => {
  const { service, getOperations } = create(); const ctx = contexts()
  let snapshot = unwrap(await service.getProfile('inactive-recent'))
  unwrap(await service.updatePreferences(ctx(), { ...snapshot.preferences, remindersAllowed: true }))
  const other = unwrap(await service.presentInvitation(ctx(), { ...external, campaignId: 'existing-other-campaign', origin: 'app' }))
  unwrap(await service.respondInvitation(ctx(), { invitationId: other.invitations[0].id, response: 'later', requestedFollowupAt: '2026-10-02T13:30:00.000Z' }))
  snapshot = unwrap(await service.presentInvitation(ctx(), external))
  const invitationId = snapshot.invitations.find(i => i.campaignId === external.campaignId).id
  const request = ctx()
  const response = { invitationId, response: 'decline', requestedFollowupAt: null }
  const declinedResult = await service.respondInvitation(request, response)
  const declined = unwrap(declinedResult)
  assert.equal(declined.invitations.find(i => i.id === invitationId).status, 'declined')
  assert.equal(declined.preferences.allowProgramInvitations, false)
  assert.equal(declined.preferences.remindersAllowed, true)
  assert.equal(declined.contactPermission.reason, 'rejected')
  assert.ok(declined.invitations.every(i => i.requestedFollowupAt === null))
  assert.deepEqual(await service.respondInvitation(request, response), declinedResult)
  const reopened = unwrap(await service.presentInvitation(ctx(), external))
  assert.deepEqual(reopened.invitations, declined.invitations)
  expectError(await service.presentInvitation(ctx(), { ...external, campaignId: 'new-contact' }), 'CONTACT_BLOCKED')
  expectError(await service.presentInvitation(ctx(), { ...external, campaignId: 'new-app-contact', origin: 'app' }), 'CONTACT_BLOCKED')
  assert.equal(unwrap(await service.getProfile('inactive-31-60')).preferences.allowProgramInvitations, true)
  unwrap(await service.startProgram(ctx(), { origin: 'app' }))
  const operations = unwrap(await getOperations())
  assert.equal(evaluateMentorSession(operations.profiles, operations.events).declined, 1)
  assert.equal(operations.events.filter(e => e.action === 'respondInvitation').length, 2)
})

test('A-03: reopening after pause, start and return never creates another contact', async () => {
  const { service, admin, getOperations } = create(); const ctx = contexts()
  const original = unwrap(await service.presentInvitation(ctx(), external)).invitations[0]
  const paused = unwrap(await service.activatePause(ctx(), { endsAt: null, reason: null }))
  const reopened = unwrap(await service.presentInvitation(ctx(), external))
  assert.deepEqual(reopened.invitations, [original])
  assert.deepEqual(reopened.pause, paused.pause)
  expectError(await service.presentInvitation(ctx(), { ...external, campaignId: 'new-while-paused' }), 'CONTACT_BLOCKED')
  unwrap(await service.respondInvitation(ctx(), { invitationId: original.id, response: 'options', requestedFollowupAt: null }))
  unwrap(await service.startProgram(ctx(), { origin: 'external' }))
  unwrap(await admin.advanceClock({ observedAt: '2026-10-01T15:01:00.000Z' }))
  unwrap(await admin.registerDelivery(ctx(), { id: 'a03-return', status: 'completed', completedAt: '2026-10-01T15:01:00.000Z' }))
  const returned = unwrap(await service.presentInvitation(ctx(), external))
  assert.equal(returned.eligibility.eligible, false)
  assert.equal(returned.invitations.length, 1)
  assert.equal(returned.invitations[0].status, 'opened')
  const operations = unwrap(await getOperations())
  assert.equal(operations.events.filter(e => e.action === 'presentInvitation').length, 1)
})

test('A-03: preview is available for every demo profile without contact, response, preference or intervention effects', async () => {
  const { service, getOperations } = create()
  for (const profile of unwrap(await service.listProfiles())) {
    const ctx = contexts(profile.id)
    const before = unwrap(await service.getProfile(profile.id))
    const input = { ...external, mode: 'demo-preview' }
    const presented = unwrap(await service.presentInvitation(ctx(), input))
    const preview = presented.invitations[0]
    assert.equal(preview.mode, 'demo-preview')
    assert.equal(preview.track, 'reactivation') // fictional example, not a preventive campaign
    assert.equal(preview.presentedAt, null)
    assert.equal(preview.respondedAt, null)
    assert.equal(preview.requestedFollowupAt, null)
    assert.deepEqual(presented.preferences, before.preferences)
    assert.deepEqual(presented.progress, before.progress)
    assert.deepEqual(presented.contactPermission, before.contactPermission)
    assert.deepEqual(presented.deliveries, before.deliveries)
    const reopened = unwrap(await service.presentInvitation(ctx(), input))
    assert.deepEqual(reopened.invitations, [preview])
    expectError(await service.respondInvitation(ctx(), { invitationId: preview.id, response: 'decline', requestedFollowupAt: null }), 'CONFLICT')
    if (before.eligibility.eligible && before.contactPermission.reason === 'allowed') {
      const contact = unwrap(await service.presentInvitation(ctx(), external))
      assert.equal(contact.invitations.length, 2)
      assert.equal(contact.invitations[1].mode, 'simulated-contact')
    }
  }
  const operations = unwrap(await getOperations())
  assert.equal(operations.events.filter(e => e.action === 'presentInvitation').length, 3)
  assert.equal(evaluateMentorSession(operations.profiles, operations.events).externalContacts, 3)
})

test('A-03: response and contact retries survive reload and conflict with changed contents', async () => {
  const storage = memoryStorage(); const { service } = create({ storage })
  const contactCtx = { profileId: 'inactive-recent', requestId: 'contact', expectedRevision: 0 }
  const contactResult = await service.presentInvitation(contactCtx, external)
  const invitationId = unwrap(contactResult).invitations[0].id
  const ctx = { profileId: 'inactive-recent', requestId: 'response', expectedRevision: contactResult.revision }
  const input = { invitationId, response: 'later', requestedFollowupAt: null }
  const response = await service.respondInvitation(ctx, input)
  unwrap(response)
  const restarted = create({ storage })
  assert.deepEqual(await restarted.service.presentInvitation(contactCtx, external), contactResult)
  assert.deepEqual(await restarted.service.respondInvitation(ctx, input), response)
  expectError(await restarted.service.respondInvitation(ctx, { ...input, response: 'decline' }), 'CONFLICT')
  expectError(await restarted.service.presentInvitation(contactCtx, { ...external, mode: 'demo-preview' }), 'CONFLICT')
  const snapshot = unwrap(await restarted.service.getProfile('inactive-recent'))
  assert.equal(snapshot.invitations.length, 1)
  assert.equal(snapshot.invitations[0].status, 'later')
})

test('A-03: invalid, foreign and already answered invitations never partially mutate the profile', async () => {
  const { service } = create(); const ctx = contexts()
  const pending = unwrap(await service.presentInvitation(ctx(), external))
  const invitationId = pending.invitations[0].id
  expectError(await service.respondInvitation({ profileId: 'inactive-31-60', requestId: 'foreign' }, { invitationId, response: 'decline', requestedFollowupAt: null }), 'NOT_FOUND')
  expectError(await service.presentInvitation({ profileId: 'missing', requestId: 'unknown' }, external), 'NOT_FOUND')
  expectError(await service.respondInvitation(ctx(), { invitationId, response: 'unknown', requestedFollowupAt: null }), 'VALIDATION')
  expectError(await service.respondInvitation(ctx(), { invitationId, response: 'options', requestedFollowupAt: '2026-10-02T15:00:00.000Z' }), 'VALIDATION')
  expectError(await service.respondInvitation(ctx(), { invitationId, response: 'later', requestedFollowupAt: '' }), 'VALIDATION')
  assert.deepEqual(unwrap(await service.getProfile('inactive-recent')), pending)
  unwrap(await service.respondInvitation(ctx(), { invitationId, response: 'options', requestedFollowupAt: null }))
  const answered = await service.getProfile('inactive-recent')
  expectError(await service.respondInvitation(ctx(), { invitationId, response: 'decline', requestedFollowupAt: null }), 'CONFLICT')
  assert.deepEqual(await service.getProfile('inactive-recent'), answered)
})

test('A-03: v3 migration distinguishes pending, later, declined and opened without inventing timestamps', async () => {
  const storage = memoryStorage()
  storage.setItem('vuelve-a-tu-ritmo:session:v3', JSON.stringify({ profileDataById: {
    'inactive-recent': { invitationResponses: { [external.campaignId]: 'later' }, externalInvitationPresentedCampaignIds: [external.campaignId] },
    'inactive-31-60': { externalInvitationPresentedCampaignIds: [external.campaignId] },
    'inactive-over-60': { externalInvitationPresentedCampaignIds: [external.campaignId], programStartedCampaignIds: [external.campaignId] },
    'declared-pause': { invitationResponses: { [external.campaignId]: 'not-interested' } },
  } }))
  const { service } = create({ storage })
  for (const [profileId, status] of [['inactive-recent', 'later'], ['inactive-31-60', 'pending'], ['inactive-over-60', 'opened'], ['declared-pause', 'declined']]) {
    const snapshot = unwrap(await service.getProfile(profileId))
    assert.equal(snapshot.invitations.length, 1)
    assert.equal(snapshot.invitations[0].status, status)
    assert.equal(snapshot.invitations[0].presentedAt, null)
    assert.equal(snapshot.invitations[0].respondedAt, null)
    assert.equal(snapshot.invitations[0].requestedFollowupAt, null)
    const reopened = unwrap(await service.presentInvitation({ profileId, requestId: 'migrated-reopen' }, external))
    assert.deepEqual(reopened.invitations, snapshot.invitations)
  }
  const reloaded = create({ storage })
  assert.deepEqual(await reloaded.service.getProfile('inactive-recent'), await service.getProfile('inactive-recent'))
})
