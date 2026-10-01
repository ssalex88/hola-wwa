/** Contrato compartido HU-00. B-01 implementa las consultas; las demás acciones se incorporan por entrega. */
import type { ProjectionConfiguration } from '../domain/projectionConfiguration'
import type { ProjectionResult } from '../domain/projection'
import type { DeliveryRecord, PauseBand } from '../domain/eligibility'
import type { SupportCase } from '../domain/support'
import type { ReturnNeed } from '../domain/returnHelp'
import type { ReturnFeedback } from '../domain/returnTracking'

export type ProfileId = string
export type Instant = string // ISO 8601 UTC: 2026-10-01T15:00:00.000Z
export type LocalDate = string // YYYY-MM-DD en America/Lima
export type MoneyPEN = number // soles, máximo dos decimales; nunca texto con S/
export type EntryOrigin = 'app' | 'external'
export type Vehicle = 'Bicicleta' | 'Moto' | 'Auto'
export type ZoneId = 'lima-centro' | 'miraflores' | 'surco' | 'san-miguel' | 'jesus-maria'

export interface RequestContext {
  profileId: ProfileId
  requestId: string // A lo crea por intención; repetirlo no repite una escritura/evento
  expectedRevision?: number // control de escrituras sobre una versión anterior
}

export interface DemoClock { referenceAt: Instant; observedAt: Instant; timeZone: 'America/Lima' }
export interface Profile {
  id: ProfileId; name: string; vehicle: Vehicle; zoneId: ZoneId
  accountStatus: 'active' | 'blocked'; lastCompletedAt: Instant | null
  scenario: string; simulated: true
}
export interface Zone { id: ZoneId; label: string; simulated: true }
export interface RouteQuery { originZoneId: ZoneId; destinationZoneId: ZoneId }
export interface RouteMatch { zones: Zone[]; simulated: true; affectsOrderAssignment: false }

export interface Goal {
  id: string; profileId: ProfileId; name: string; targetAmount: MoneyPEN
  targetDate: LocalDate | null; status: 'active' | 'completed' | 'archived'
  createdAt: Instant; updatedAt: Instant
}
export interface Contribution {
  id: string; profileId: ProfileId; goalId: string; amount: MoneyPEN
  contributedOn: LocalDate; createdAt: Instant; updatedAt: Instant; source: 'manual'
}
export interface GoalProgress {
  goalId: string; contributedAmount: MoneyPEN; remainingAmount: MoneyPEN
  progressPercent: number; targetReached: boolean
}
export interface Pause {
  id: string; profileId: ProfileId; startedAt: Instant; endsAt: Instant | null
  reason: string | null; status: 'active' | 'ended' | 'expired'
}
export interface ContactPreferences {
  allowProgramInvitations: boolean
  channels: { app: boolean; external: boolean }
  remindersAllowed: boolean // permiso distinto de invitaciones; no crea recordatorios
  consentRecordedAt: Instant | null
  preferredContactDate?: LocalDate | null // Fecha legada; no equivale a un recordatorio solicitado.
}
export interface Eligibility {
  eligible: boolean
  track: 'reactivation' | 'prevention' | 'none'
  reason: 'eligible' | 'active' | 'blocked' | 'no-completed-delivery' | 'invalid-date'
  daysInactive: number | null; pauseBand: PauseBand | null; priority: 1 | 2 | 3 | null
}
export interface ContactPermission {
  canShowAppInvitation: boolean; canSendExternalInvitation: boolean
  reason: 'allowed' | 'no-consent' | 'paused' | 'ineligible' | 'rejected' | 'already-contacted' | 'flow-started'
}

// Mantiene los campos actuales: zone/hours/moment/vehicle/scheduleMode/scheduledDate
// y expenseFuel/expenseMaintenance/expenseOther. zone contiene la etiqueta del catálogo.
export type ProjectionInput = ProjectionConfiguration
export interface Incentive {
  id: string; label: string; amount: MoneyPEN | null; benefit: string | null
  validFrom: Instant; validUntil: Instant; zoneIds: ZoneId[]; requirements: string[]
  enrollmentRequired: boolean; status: 'available' | 'enrolled' | 'obtained'
  simulated: true; guaranteed: false
}
export type Projection =
  | { status: 'available'; id: string; profileId: ProfileId; configuration: ProjectionInput
      result: ProjectionResult; currency: 'PEN'; referenceAt: Instant; tableVersion: string
      assumptions: string[]; incentives: Incentive[]; simulated: true; guaranteed: false }
  | { status: 'unavailable'; configuration: ProjectionInput; reason: 'missing-data'; message: string; simulated: true }
export interface SavedOption {
  id: string; profileId: ProfileId; configuration: ProjectionInput
  projectionId: string; referenceAt: Instant; tableVersion: string
  savedAt: Instant | null; updatedAt: Instant | null; reminderId: string | null; isReservation: false
}
export interface Invitation {
  id: string; profileId: ProfileId; campaignId: string; origin: EntryOrigin
  track: 'prevention' | 'reactivation'; mode: 'demo-preview' | 'simulated-contact'
  status: 'pending' | 'opened' | 'later' | 'declined' | 'expired'
  presentedAt: Instant | null; respondedAt: Instant | null; requestedFollowupAt: Instant | null
}
export interface Reminder {
  id: string; profileId: ProfileId; savedOptionId: string; scheduledAt: Instant
  timeZone: 'America/Lima'; requestedAt: Instant | null
  status: 'scheduled' | 'executed' | 'cancelled' | 'blocked'
  executedAt: Instant | null; simulated: true
}
export interface Case extends SupportCase {
  profileId: ProfileId; createdAt: Instant | null; updatedAt: Instant | null; simulated: true
}
export interface HelpRequest { id: string; profileId: ProfileId; caseId: string; requestedAt: Instant; simulated: true }
export interface Delivery extends DeliveryRecord { profileId: ProfileId; simulated: true }
export interface ProgramProgress {
  interventionStartedAt: Instant | null; eligibleAtStart: boolean
  origin: EntryOrigin | null; step: 'configuration' | 'projection' | 'decision'
  configuration: ProjectionInput | null; currentProjection: Projection | null
  comparisonConfiguration: ProjectionInput | null
  need: ReturnNeed | null; otherNeedDetail: string
  connectedAt: Instant | null; returnedAt: Instant | null; returnDeliveryId: string | null
  returnFeedback: ReturnFeedback | null
}
export interface MentorAdvice {
  text: string; actions: Array<'calculate' | 'compare' | 'incentives' | 'shorten' | 'save' | 'help' | 'pause' | 'continue'>
}
export interface ProfileSnapshot {
  contractVersion: '1.0'; revision: number; clock: DemoClock; profile: Profile
  eligibility: Eligibility; contactPermission: ContactPermission; preferences: ContactPreferences
  goals: Goal[]; contributions: Contribution[]; goalProgress: GoalProgress[]
  pause: Pause | null; invitations: Invitation[]; reminders: Reminder[]
  savedOptions: SavedOption[]; cases: Case[]; helpRequests: HelpRequest[]
  deliveries: Delivery[]; progress: ProgramProgress; mentor: MentorAdvice
  legacyGoalNotes: string[] // Objetivos anteriores de texto: no son metas monetarias ni aportes.
}

export type ServiceResult<T> =
  | { ok: true; data: T; revision: number }
  | { ok: false; error: { code: 'VALIDATION' | 'NOT_FOUND' | 'NOT_ELIGIBLE' | 'CONTACT_BLOCKED' | 'CONFLICT' | 'UNEXPECTED'; message: string; fields?: Record<string,string> } }
export type SnapshotResult = Promise<ServiceResult<ProfileSnapshot>>

/** Consultas implementadas en B-01; las otras acciones se incorporan por entrega. */
export type MentorProfileService = Pick<MentorService, 'getProfile' | 'listProfiles'>

/** El simulado de A y el motor de B implementan exactamente esta interfaz. */
export interface MentorService {
  getProfile(profileId: ProfileId): SnapshotResult
  listProfiles(): Promise<ServiceResult<Profile[]>>
  getCatalog(): Promise<ServiceResult<{ zones: Zone[]; vehicles: Vehicle[] }>>
  exploreRoute(query: RouteQuery): Promise<ServiceResult<RouteMatch>>
  startProgram(ctx: RequestContext, input: { origin: EntryOrigin }): SnapshotResult
  updateProgress(ctx: RequestContext, input: { step?: ProgramProgress['step']; configuration?: ProjectionInput; need?: ReturnNeed | null; otherNeedDetail?: string }): SnapshotResult
  calculateProjection(ctx: RequestContext, input: ProjectionInput): Promise<ServiceResult<Projection>>
  compareProjections(ctx: RequestContext, input: { first: ProjectionInput; second: ProjectionInput }): Promise<ServiceResult<{ first: Projection; second: Projection }>>
  saveOption(ctx: RequestContext, input: { projectionId: string; optionId?: string }): SnapshotResult
  reviewOption(ctx: RequestContext, input: { optionId: string }): Promise<ServiceResult<{ option: SavedOption; projection: Projection }>>
  deleteOption(ctx: RequestContext, input: { optionId: string }): SnapshotResult
  saveGoal(ctx: RequestContext, input: { goalId?: string; name: string; targetAmount: MoneyPEN; targetDate: LocalDate | null }): SnapshotResult
  changeGoalStatus(ctx: RequestContext, input: { goalId: string; status: Goal['status'] }): SnapshotResult
  saveContribution(ctx: RequestContext, input: { contributionId?: string; goalId: string; amount: MoneyPEN; contributedOn: LocalDate }): SnapshotResult
  deleteContribution(ctx: RequestContext, input: { contributionId: string }): SnapshotResult
  activatePause(ctx: RequestContext, input: { endsAt: Instant | null; reason: string | null }): SnapshotResult
  updatePause(ctx: RequestContext, input: { pauseId: string; endsAt: Instant | null; reason: string | null }): SnapshotResult
  endPause(ctx: RequestContext, input: { pauseId: string }): SnapshotResult
  updatePreferences(ctx: RequestContext, input: ContactPreferences): SnapshotResult
  presentInvitation(ctx: RequestContext, input: { campaignId: string; origin: EntryOrigin; mode: Invitation['mode'] }): SnapshotResult
  respondInvitation(ctx: RequestContext, input: { invitationId: string; response: 'options' | 'later' | 'decline'; requestedFollowupAt: Instant | null }): SnapshotResult
  scheduleReminder(ctx: RequestContext, input: { savedOptionId: string; reminderId?: string; scheduledAt: Instant; explicitConsent: true }): SnapshotResult
  cancelReminder(ctx: RequestContext, input: { reminderId: string }): SnapshotResult
  requestHelp(ctx: RequestContext, input: { caseId: string }): SnapshotResult
  confirmConnection(ctx: RequestContext, input: { explicitConsent: true }): SnapshotResult
  disconnect(ctx: RequestContext): SnapshotResult
  recordReturnFeedback(ctx: RequestContext, input: { feedback: ReturnFeedback }): SnapshotResult
  enrollIncentive(ctx: RequestContext, input: { incentiveId: string; projectionId: string }): SnapshotResult
}

/** Solo lo usa B desde sus controles; las pantallas del repartidor no registran entregas. */
export interface DemoAdminService {
  resetProfile(profileId: ProfileId): SnapshotResult
  resetDemo(): SnapshotResult // devuelve Camila; restaura también los otros perfiles
  registerDelivery(ctx: RequestContext, input: { id: string; status: Delivery['status']; completedAt: Instant }): SnapshotResult
  setCaseStatus(ctx: RequestContext, input: { caseId: string; status: Case['status'] }): SnapshotResult
  executeReminder(ctx: RequestContext, input: { reminderId: string }): SnapshotResult
  advanceClock(input: { observedAt: Instant }): Promise<ServiceResult<DemoClock>>
}
