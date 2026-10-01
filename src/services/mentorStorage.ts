import type { DemoClock, ProfileSnapshot, Projection, ServiceResult } from '../contracts/mentor.ts'
import { createDemoProfiles } from '../data/demoProfiles.ts'
import { createDemoSupportData } from '../data/supportCases.ts'
import { createDemoIncentiveAwards } from '../data/conditionalIncentives.ts'
import { SIMULATED_PROJECTION_RATES } from '../data/projectionRates.ts'
import { calculateProjection } from '../domain/projection.ts'
import { copyConfiguration } from '../domain/projectionConfiguration.ts'
import { getReactivationEligibility } from '../domain/eligibility.ts'
import { dateInLima } from '../domain/demoDates.ts'
import { MENTOR_ZONES, adviceFor, eligibilityFor, goalProgress, permissionFor } from '../domain/mentorRules.ts'

export const MENTOR_STORAGE_KEY = 'vuelve-a-tu-ritmo:mentor:session:v1'
export interface MentorStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface MentorEvent { id: string; profileId: string; action: string; at: string; origin: 'app' | 'external' | null }
export interface ProfileState {
  snapshot: ProfileSnapshot
  projections: Record<string, Projection>
  enrollments: Record<string, string>
  awards: Record<string, string>
  replays: Array<{ requestId: string; fingerprint: string; result: ServiceResult<unknown> }>
  legacyGoalNames: string[]
}
export interface MentorState { schemaVersion: 1; clock: DemoClock; profiles: Record<string, ProfileState>; events: MentorEvent[] }
export const clone = <T,>(value: T): T => structuredClone(value)

export function refreshSnapshot(profile: ProfileState, clock: DemoClock): ProfileSnapshot {
  const snapshot = clone(profile.snapshot)
  snapshot.clock = clone(clock)
  const completed = snapshot.deliveries.filter(item => item.status === 'completed' && item.completedAt <= clock.observedAt)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  snapshot.profile.lastCompletedAt = completed[0]?.completedAt ?? null
  if (snapshot.pause?.status === 'active' && snapshot.pause.endsAt !== null && snapshot.pause.endsAt <= clock.observedAt) snapshot.pause.status = 'expired'
  snapshot.eligibility = eligibilityFor(snapshot, clock.observedAt)
  snapshot.contactPermission = permissionFor(snapshot, clock.observedAt)
  snapshot.goalProgress = goalProgress(snapshot)
  snapshot.legacyGoalNotes = [...profile.legacyGoalNames]
  snapshot.mentor = adviceFor(snapshot)
  return snapshot
}

export function createMentorState(referenceAt: string): MentorState {
  const clock: DemoClock = { referenceAt, observedAt: referenceAt, timeZone: 'America/Lima' }
  const profiles: Record<string, ProfileState> = {}
  for (const seed of createDemoProfiles(new Date(referenceAt))) {
    const snapshot: ProfileSnapshot = {
      contractVersion: '1.0', revision: 0, clock: clone(clock),
      profile: { id: seed.id, name: seed.name, vehicle: seed.vehicle as ProfileSnapshot['profile']['vehicle'], zoneId: MENTOR_ZONES.find(zone => zone.label === seed.zone)!.id, accountStatus: seed.accountStatus, lastCompletedAt: seed.lastDeliveryAt, scenario: seed.scenario, simulated: true },
      eligibility: { eligible: false, track: 'none', reason: 'active', daysInactive: null, pauseBand: null, priority: null },
      contactPermission: { canShowAppInvitation: false, canSendExternalInvitation: false, reason: 'no-consent' },
      preferences: { allowProgramInvitations: !seed.declaredPause, channels: { app: true, external: true }, remindersAllowed: false, consentRecordedAt: referenceAt },
      goals: [], contributions: [], goalProgress: [], legacyGoalNotes: [],
      pause: seed.declaredPause ? { id: `pause-${seed.id}`, profileId: seed.id, startedAt: seed.declaredPause.declaredAt, endsAt: null, reason: seed.declaredPause.note, status: 'active' } : null,
      invitations: [], reminders: [], savedOptions: [], helpRequests: [],
      cases: createDemoSupportData(seed.id).cases.map(item => ({ ...item, profileId: seed.id, createdAt: referenceAt, updatedAt: referenceAt, simulated: true })),
      deliveries: seed.deliveries.map(item => ({ ...item, profileId: seed.id, simulated: true })),
      progress: { interventionStartedAt: null, eligibleAtStart: false, origin: null, step: 'configuration', configuration: null, currentProjection: null, comparisonConfiguration: null, need: null, otherNeedDetail: '', connectedAt: null, returnedAt: null, returnDeliveryId: null, returnFeedback: null },
      mentor: { text: '', actions: [] },
    }
    profiles[seed.id] = { snapshot, projections: {}, enrollments: {}, awards: createDemoIncentiveAwards(seed, new Date(referenceAt)), replays: [], legacyGoalNames: [] }
    profiles[seed.id].snapshot = refreshSnapshot(profiles[seed.id], clock)
  }
  return { schemaVersion: 1, clock, profiles, events: [] }
}

// Structural validation follows the seed shape; entity arrays need explicit templates.
// Reject an invalid envelope rather than importing partially corrupt monetary/contact data.
function matches(value: unknown, template: unknown): boolean {
  if (template === null) return value === null || typeof value === 'string' || typeof value === 'object' && value !== null
  if (Array.isArray(template)) return Array.isArray(value)
  if (typeof template === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.entries(template).every(([key, item]) => matches((value as Record<string, unknown>)[key], item))
  return typeof value === typeof template && (typeof value !== 'number' || Number.isFinite(value))
}
function validEnvelope(value: unknown, initial: MentorState): value is MentorState {
  if (!matches(value, { ...initial, profiles: {} })) return false
  const state = value as MentorState
  if (state.schemaVersion !== 1 || state.clock.timeZone !== 'America/Lima' || !validInstant(state.clock.referenceAt) || !validInstant(state.clock.observedAt) || state.clock.observedAt < state.clock.referenceAt) return false
  if (Object.keys(state.profiles).length !== Object.keys(initial.profiles).length) return false
  for (const [id, seed] of Object.entries(initial.profiles)) {
    const profile = state.profiles[id]
    // Eligibility is derived and changes nullable priority/days after a return.
    // Validate the stored source entities, then always recompute this field.
    if (!profile?.snapshot || !matches({ ...profile, snapshot: { ...profile.snapshot, eligibility: seed.snapshot.eligibility } }, seed) || profile.snapshot.profile.id !== id || profile.snapshot.contractVersion !== '1.0' || !Number.isInteger(profile.snapshot.revision) || profile.snapshot.revision < 0) return false
    const s = profile.snapshot
    if (!['active', 'blocked'].includes(s.profile.accountStatus) || !['Bicicleta', 'Moto', 'Auto'].includes(s.profile.vehicle) || !MENTOR_ZONES.some(zone => zone.id === s.profile.zoneId)) return false
    if (s.preferences.consentRecordedAt !== null && !validInstant(s.preferences.consentRecordedAt)) return false
    const entityLists = [s.goals, s.contributions, s.invitations, s.reminders, s.savedOptions, s.cases, s.helpRequests, s.deliveries]
    for (const list of entityLists) {
      if (list.some(item => !item || typeof item !== 'object' || typeof item.id !== 'string' || item.profileId !== id) || new Set(list.map(item => item.id)).size !== list.length) return false
    }
    if (s.goals.some(g => typeof g.name !== 'string' || !validMoney(g.targetAmount) || !['active', 'completed', 'archived'].includes(g.status) || !validInstant(g.createdAt) || !validInstant(g.updatedAt) || (g.targetDate !== null && !validDate(g.targetDate))) || s.goals.filter(g => g.status === 'active').length > 1) return false
    if (s.contributions.some(c => !validMoney(c.amount) || c.source !== 'manual' || !validDate(c.contributedOn) || c.contributedOn > dateInLima(new Date(state.clock.observedAt)) || !validInstant(c.createdAt) || !validInstant(c.updatedAt) || c.createdAt > c.updatedAt || c.updatedAt > state.clock.observedAt || !s.goals.some(g => g.id === c.goalId))) return false
    // Reload must enforce the same safe-cent aggregate as saveContribution.
    if (s.goals.some(g => !Number.isSafeInteger(s.contributions.filter(c => c.goalId === g.id).reduce((sum, c) => sum + Math.round(c.amount * 100), 0)))) return false
    if (s.deliveries.some(d => !['completed', 'cancelled'].includes(d.status) || !validInstant(d.completedAt) || d.completedAt > state.clock.observedAt || d.simulated !== true)) return false
    if (s.pause !== null && (!matches(s.pause, { id: '', profileId: '', startedAt: '', endsAt: null, reason: null, status: '' }) || s.pause.profileId !== id || !validInstant(s.pause.startedAt) || s.pause.endsAt !== null && !validInstant(s.pause.endsAt) || !['active', 'ended', 'expired'].includes(s.pause.status))) return false
    if (s.invitations.some(i => !['app', 'external'].includes(i.origin) || !['demo-preview', 'simulated-contact'].includes(i.mode) || !['pending', 'opened', 'later', 'declined', 'expired'].includes(i.status) || typeof i.campaignId !== 'string' || [i.presentedAt, i.respondedAt, i.requestedFollowupAt].some(at => at !== null && !validInstant(at)))) return false
    if (s.reminders.some(r => !validInstant(r.scheduledAt) || !validInstant(r.requestedAt) || r.executedAt !== null && !validInstant(r.executedAt) || !['scheduled', 'executed', 'cancelled', 'blocked'].includes(r.status) || r.timeZone !== 'America/Lima' || !s.savedOptions.some(o => o.id === r.savedOptionId))) return false
    if (s.savedOptions.some(o => !validConfiguration(o.configuration) || o.isReservation !== false || !validInstant(o.savedAt) || !validInstant(o.updatedAt) || !validInstant(o.referenceAt) || typeof o.projectionId !== 'string' || typeof o.tableVersion !== 'string' || o.reminderId !== null && !s.reminders.some(r => r.id === o.reminderId && r.savedOptionId === o.id))) return false
    if (s.cases.some(c => !['pending', 'in-review', 'resolved'].includes(c.status) || !['payment', 'order'].includes(c.kind) || typeof c.description !== 'string' || !validInstant(c.createdAt) || !validInstant(c.updatedAt))) return false
    if (s.helpRequests.some(r => !validInstant(r.requestedAt) || !s.cases.some(c => c.id === r.caseId))) return false
    if (!['configuration', 'projection', 'decision'].includes(s.progress.step) || [s.progress.interventionStartedAt, s.progress.connectedAt, s.progress.returnedAt].some(at => at !== null && !validInstant(at)) || ![null, 'app', 'external'].includes(s.progress.origin) || ![null, 'savings', 'time', 'payment-order', 'personal-vehicle', 'other', 'skipped'].includes(s.progress.need) || ![null, 'good', 'mixed', 'problem', 'skipped'].includes(s.progress.returnFeedback)) return false
    if (s.progress.configuration !== null && !validConfiguration(s.progress.configuration)) return false
    if (Object.values(profile.projections).some(p => !validProjection(p, id)) || s.progress.currentProjection !== null && !validProjection(s.progress.currentProjection, id)) return false
    if (Object.values(profile.enrollments).some(at => !validInstant(at)) || Object.values(profile.awards).some(at => !validInstant(at))) return false
    if (profile.replays.some(r => !r || typeof r.requestId !== 'string' || typeof r.fingerprint !== 'string' || !r.result || r.result.ok !== true || !Number.isInteger(r.result.revision))) return false
    if (profile.legacyGoalNames.some(name => typeof name !== 'string')) return false
  }
  return state.events.every(event => event && typeof event.id === 'string' && Object.hasOwn(initial.profiles, event.profileId) && typeof event.action === 'string' && validInstant(event.at) && [null, 'app', 'external'].includes(event.origin))
}
function validInstant(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value }
function validDate(value: unknown): boolean { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value }
function validMoney(value: unknown): boolean { return typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001 }
function validConfiguration(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  return MENTOR_ZONES.some(z => z.label === c.zone) && ['Bicicleta', 'Moto', 'Auto'].includes(c.vehicle as string) && ['Mañana', 'Tarde', 'Noche'].includes(c.moment as string) && typeof c.hours === 'number' && c.hours >= 1 && c.hours <= 12 && (c.scheduleMode === 'now' && c.scheduledDate === null || c.scheduleMode === 'another-day' && validDate(c.scheduledDate)) && ['expenseFuel', 'expenseMaintenance', 'expenseOther'].every(key => typeof c[key] === 'number' && Number.isFinite(c[key]) && (c[key] as number) >= 0)
}
function validProjection(value: Projection, profileId: string): boolean {
  if (!value || !validConfiguration(value.configuration) || value.simulated !== true) return false
  if (value.status === 'unavailable') return value.reason === 'missing-data' && typeof value.message === 'string'
  return value.status === 'available' && value.profileId === profileId && typeof value.id === 'string' && value.currency === 'PEN' && validInstant(value.referenceAt) && typeof value.tableVersion === 'string' && value.guaranteed === false && Array.isArray(value.assumptions) && Array.isArray(value.incentives) && value.result !== null && typeof value.result === 'object' && ['grossMin', 'grossMax', 'expenses', 'afterExpensesMin', 'afterExpensesMax', 'hourlyMin', 'hourlyMax'].every(key => Number.isFinite(value.result[key as keyof typeof value.result]))
}

export function loadMentorState(storage: MentorStorage | null, referenceAt: string): MentorState {
  const initial = createMentorState(referenceAt)
  if (!storage) return initial
  const raw = storage.getItem(MENTOR_STORAGE_KEY)
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw)
      // Validate against profiles anchored to the stored reference, not today's date.
      if (parsed && typeof parsed === 'object' && 'clock' in parsed && validInstant((parsed as MentorState).clock?.referenceAt)) {
        // Older local sessions lack the additive fields from the remote B-01 contract.
        const profiles = (parsed as MentorState).profiles
        if (profiles && typeof profiles === 'object') for (const profile of Object.values(profiles)) {
          if (!profile?.snapshot || !profile.snapshot.progress) continue
          if (!Object.hasOwn(profile.snapshot, 'legacyGoalNotes')) profile.snapshot.legacyGoalNotes = Array.isArray(profile.legacyGoalNames) ? [...profile.legacyGoalNames] : []
          if (!Object.hasOwn(profile.snapshot.progress, 'comparisonConfiguration')) profile.snapshot.progress.comparisonConfiguration = null
        }
        const seed = createMentorState((parsed as MentorState).clock.referenceAt)
        if (validEnvelope(parsed, seed)) return parsed
      }
    } catch { /* Invalid envelope: recover cleanly without reading legacy money. */ }
    return initial
  }
  // Non-destructive v3 migration: preserve text goals as metadata, never savings.
  try {
    const legacy = JSON.parse(storage.getItem('vuelve-a-tu-ritmo:session:v3') ?? 'null')
    // v3 kept observed time per profile. The new shared clock covers all observed data.
    for (const old of Object.values(legacy?.profileDataById ?? {}) as Array<{ returnTracking?: { observedAt?: string } }>) {
      const observedAt = old?.returnTracking?.observedAt
      if (validInstant(observedAt) && observedAt > initial.clock.observedAt) initial.clock.observedAt = observedAt
    }
    for (const [id, p] of Object.entries(initial.profiles)) {
      const old = legacy?.profileDataById?.[id]
      if (!old || typeof old !== 'object') continue
      p.legacyGoalNames = Array.isArray(old.goals) ? old.goals.filter((g: unknown) => typeof g === 'string') : []
      if (typeof old.preferences?.allowProgramInvitations === 'boolean') p.snapshot.preferences.allowProgramInvitations = old.preferences.allowProgramInvitations
      if (Array.isArray(old.deliveryHistory) && old.deliveryHistory.every((d: Record<string, unknown>) => d && typeof d.id === 'string' && ['completed', 'cancelled'].includes(d.status as string) && validInstant(d.completedAt) && d.completedAt <= initial.clock.observedAt) && new Set(old.deliveryHistory.map((d: { id: string }) => d.id)).size === old.deliveryHistory.length) {
        p.snapshot.deliveries = old.deliveryHistory.map((d: { id: string; status: 'completed' | 'cancelled'; completedAt: string }) => ({ ...d, profileId: id, simulated: true }))
      }
      const start = old.returnTracking?.interventionStartedAt
      if (validInstant(start) && start <= initial.clock.observedAt) {
        const atStart = getReactivationEligibility(p.snapshot.deliveries.filter(d => d.completedAt <= start), new Date(start), p.snapshot.profile.accountStatus)
        if (atStart.eligible) {
          p.snapshot.progress.interventionStartedAt = start
          p.snapshot.progress.eligibleAtStart = true
          // v3 did not persist origin; never infer app/external from unrelated data.
          const first = p.snapshot.deliveries.filter(d => d.status === 'completed' && d.completedAt > start).sort((a, b) => a.completedAt.localeCompare(b.completedAt))[0]
          if (first) { p.snapshot.progress.returnedAt = first.completedAt; p.snapshot.progress.returnDeliveryId = first.id }
          if (first && ['good', 'mixed', 'problem', 'skipped'].includes(old.returnTracking?.feedback)) p.snapshot.progress.returnFeedback = old.returnTracking.feedback
        }
      }
      if (validInstant(old.connection?.connectedAt) && old.connection.connectedAt <= initial.clock.observedAt && p.snapshot.profile.accountStatus === 'active') p.snapshot.progress.connectedAt = old.connection.connectedAt
      if (validConfiguration(old.preferences)) {
        p.snapshot.progress.configuration = copyConfiguration(old.preferences)
        p.snapshot.progress.step = old.preferences.proposalContinued === true ? 'decision' : old.preferences.programStep === 'projection' || old.preferences.programStep === 'comparison' ? 'projection' : 'configuration'
      }
      if (validConfiguration(old.preferences?.comparisonOption)) p.snapshot.progress.comparisonConfiguration = copyConfiguration(old.preferences.comparisonOption)
      if (['savings', 'time', 'payment-order', 'personal-vehicle', 'other', 'skipped'].includes(old.preferences?.returnNeed)) p.snapshot.progress.need = old.preferences.returnNeed
      if (typeof old.preferences?.otherNeedDetail === 'string') p.snapshot.progress.otherNeedDetail = old.preferences.otherNeedDetail.slice(0, 280)
      for (const item of Array.isArray(old.support?.cases) ? old.support.cases : []) {
        const supportCase = p.snapshot.cases.find(c => c.id === item?.id)
        if (supportCase && ['pending', 'in-review', 'resolved'].includes(item.status)) supportCase.status = item.status
      }
      for (const [caseId, at] of Object.entries(old.support?.requests ?? {})) if (validInstant(at) && at <= initial.clock.observedAt && p.snapshot.cases.some(c => c.id === caseId)) p.snapshot.helpRequests.push({ id: `legacy-help-${caseId}`, profileId: id, caseId, requestedAt: at, simulated: true })
      for (const [key, at] of Object.entries(old.incentiveEnrollments ?? {})) if (validInstant(at) && at <= initial.clock.observedAt) p.enrollments[key] = at
      for (const [key, at] of Object.entries(old.incentiveAwards ?? {})) if (validInstant(at) && at <= initial.clock.observedAt) p.awards[key] = at
      const options = Array.isArray(old.preferences?.savedProposals) ? old.preferences.savedProposals : []
      if (!options.length && validConfiguration(old.preferences?.savedProposal)) options.push({ ...old.preferences.savedProposal, id: 'legacy-saved', referenceAt, tableVersion: 'demo-rates-v1', reminder: null })
      for (const item of options) {
        if (!item || typeof item.id !== 'string' || !validConfiguration(item) || !validInstant(item.referenceAt) || item.referenceAt > initial.clock.observedAt || p.snapshot.savedOptions.some(o => o.id === item.id)) continue
        const configuration = copyConfiguration(item)
        configuration.expenseFuel = Math.round(configuration.expenseFuel * 100) / 100
        configuration.expenseMaintenance = Math.round(configuration.expenseMaintenance * 100) / 100
        configuration.expenseOther = Math.round(configuration.expenseOther * 100) / 100
        const result = calculateProjection(configuration, SIMULATED_PROJECTION_RATES)
        if (!result) continue
        const projectionId = `legacy-projection-${id}-${item.id}`
        p.projections[projectionId] = { status: 'available', id: projectionId, profileId: id, configuration, result, currency: 'PEN', referenceAt: item.referenceAt, tableVersion: 'demo-rates-v1', assumptions: ['Opción migrada de la demo anterior; revisa para actualizar sus condiciones.'], incentives: [], simulated: true, guaranteed: false }
        const reminder = item.reminder
        let reminderId: string | null = null
        if (reminder && validInstant(reminder.scheduledAt) && ['scheduled', 'executed'].includes(reminder.status) && (reminder.executedAt === null || validInstant(reminder.executedAt) && reminder.executedAt <= initial.clock.observedAt)) {
          reminderId = `legacy-reminder-${id}-${item.id}`
          p.snapshot.reminders.push({ id: reminderId, profileId: id, savedOptionId: item.id, scheduledAt: reminder.scheduledAt, timeZone: 'America/Lima', requestedAt: item.referenceAt,
            // v3 has no separate remindersAllowed consent. Preserve the record, cancel pending execution.
            status: reminder.status === 'executed' && reminder.executedAt !== null ? 'executed' : 'cancelled', executedAt: reminder.status === 'executed' ? reminder.executedAt : null, simulated: true })
        }
        p.snapshot.savedOptions.push({ id: item.id, profileId: id, configuration, projectionId, referenceAt: item.referenceAt, tableVersion: 'demo-rates-v1', savedAt: item.referenceAt, updatedAt: item.referenceAt, reminderId, isReservation: false })
      }
      const responses = Object.entries(old.invitationResponses ?? {}).filter(([, response]) => response === 'not-interested' || response === 'later')
      for (const [campaignId, response] of responses) p.snapshot.invitations.push({ id: `legacy-${response === 'not-interested' ? 'declined' : 'later'}-${campaignId}`, profileId: id, campaignId, origin: 'external', track: 'reactivation', mode: 'simulated-contact', status: response === 'not-interested' ? 'declined' : 'later', presentedAt: null, respondedAt: null, requestedFollowupAt: null })
      for (const campaignId of Array.isArray(old.externalInvitationPresentedCampaignIds) ? old.externalInvitationPresentedCampaignIds : []) {
        if (typeof campaignId === 'string' && !p.snapshot.invitations.some(i => i.campaignId === campaignId)) p.snapshot.invitations.push({ id: `legacy-contact-${campaignId}`, profileId: id, campaignId, origin: 'external', track: 'reactivation', mode: 'simulated-contact', status: Array.isArray(old.programStartedCampaignIds) && old.programStartedCampaignIds.includes(campaignId) ? 'opened' : 'pending', presentedAt: null, respondedAt: null, requestedFollowupAt: null })
      }
      p.snapshot = refreshSnapshot(p, initial.clock)
    }
  } catch { /* A malformed legacy session is not used. */ }
  return initial
}
