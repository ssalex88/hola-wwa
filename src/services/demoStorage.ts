import type { ReturnTracking } from '../domain/returnTracking.ts'
import { reminderInstant, type ProposalReminder } from '../domain/reminders.ts'
import type { DemoConnection } from '../domain/connection.ts'
import type { SavedProposal } from '../domain/proposals.ts'
import { createDemoSupportData } from '../data/supportCases.ts'
import { supportStatusLabels, type SupportData, type SupportStatus } from '../domain/support.ts'
import { createDemoIncentiveAwards } from '../data/conditionalIncentives.ts'
import type { DemoProfile } from '../data/demoProfiles'
import type { DeliveryRecord } from '../domain/eligibility'
import { dateInLima, isFutureDate, momentInLima } from '../domain/demoDates.ts'
import type { ProjectionConfiguration } from '../domain/projectionConfiguration.ts'
import { copyConfiguration } from '../domain/projectionConfiguration.ts'
import type { ReturnNeed } from '../domain/returnHelp.ts'
import { DEMO_REFERENCE_DATE } from './demoClock.ts'

export const DEMO_STORAGE_KEY = 'vuelve-a-tu-ritmo:session:v3'
export const PILOT_CAMPAIGN_ID = 'pilot-reactivation-v1'

export interface DemoPreferences extends ProjectionConfiguration {
  comparisonOption: ProjectionConfiguration | null
  programStep: 'configuration' | 'projection' | 'comparison'
  returnNeed: ReturnNeed | null
  otherNeedDetail: string
  savedProposals: SavedProposal[]
  editingSavedProposalId: string | null
  savedProposal: ProjectionConfiguration | null
  proposalContinued: boolean
  allowProgramInvitations: boolean
  preferredContactDate: string | null
}

export interface ProfileDemoData {
  goals: string[]
  returnTracking: ReturnTracking
  connection: DemoConnection
  support: SupportData
  incentiveEnrollments: Record<string, string>
  incentiveAwards: Record<string, string>
  deliveryHistory: DeliveryRecord[]
  preferences: DemoPreferences
  dismissedCampaignIds: string[]
  invitationResponses: Record<string, 'later' | 'not-interested'>
  externalInvitationPresentedCampaignIds: string[]
  programStartedCampaignIds: string[]
  scheduledContactDatesByCampaign: Record<string, string>
  requestedHelpFollowupDate: string | null
}

export interface DemoState {
  selectedProfileId: string
  profileDataById: Record<string, ProfileDemoData>
}

export function initialProfileData(profile: DemoProfile): ProfileDemoData {
  return {
    goals: [],
    returnTracking: { interventionStartedAt: null, observedAt: null, feedback: null },
    connection: { connectedAt: null },
    support: createDemoSupportData(profile.id),
    incentiveEnrollments: {},
    incentiveAwards: createDemoIncentiveAwards(profile, DEMO_REFERENCE_DATE),
    deliveryHistory: profile.deliveries.map((delivery) => ({ ...delivery })),
    preferences: { zone: profile.zone, hours: 2, moment: momentInLima(DEMO_REFERENCE_DATE), vehicle: profile.vehicle, scheduleMode: 'now', scheduledDate: null, expenseFuel: 0, expenseMaintenance: 0, expenseOther: 0, comparisonOption: null, programStep: 'configuration', returnNeed: null, otherNeedDetail: '', savedProposal: null, savedProposals: [], editingSavedProposalId: null, proposalContinued: false, allowProgramInvitations: !profile.declaredPause, preferredContactDate: null },
    dismissedCampaignIds: [],
    invitationResponses: {},
    externalInvitationPresentedCampaignIds: [],
    programStartedCampaignIds: [],
    scheduledContactDatesByCampaign: {},
    requestedHelpFollowupDate: null,
  }
}

function isDeliveryRecord(value: unknown): value is DeliveryRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<DeliveryRecord>
  return typeof record.id === 'string' && typeof record.completedAt === 'string' && (record.status === 'completed' || record.status === 'cancelled')
}

function parseConfiguration(value: unknown): ProjectionConfiguration | null {
  if (typeof value !== 'object' || value === null) return null
  const config = value as Partial<ProjectionConfiguration>
  if (typeof config.zone !== 'string' || typeof config.hours !== 'number' || !Number.isFinite(config.hours)
    || typeof config.moment !== 'string' || typeof config.vehicle !== 'string') return null
  return {
    zone: config.zone, hours: config.hours, moment: config.moment, vehicle: config.vehicle,
    scheduleMode: config.scheduleMode === 'another-day' ? 'another-day' : 'now',
    scheduledDate: typeof config.scheduledDate === 'string' ? config.scheduledDate : null,
    expenseFuel: typeof config.expenseFuel === 'number' && Number.isFinite(config.expenseFuel) ? config.expenseFuel : 0,
    expenseMaintenance: typeof config.expenseMaintenance === 'number' && Number.isFinite(config.expenseMaintenance) ? config.expenseMaintenance : 0,
    expenseOther: typeof config.expenseOther === 'number' && Number.isFinite(config.expenseOther) ? config.expenseOther : 0,
  }
}

function parseRecords(value: unknown, fallback: Record<string, string>): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && Number.isFinite(Date.parse(entry[1]))))
}

function parseSupport(value: unknown, fallback: SupportData): SupportData {
  if (!value || typeof value !== 'object') return fallback
  const saved = value as Partial<SupportData>
  const cases = fallback.cases.map(item => {
    const stored = Array.isArray(saved.cases) ? saved.cases.find(candidate => candidate && candidate.id === item.id) : undefined
    return stored && Object.hasOwn(supportStatusLabels, stored.status) ? { ...item, status: stored.status as SupportStatus } : item
  })
  const ids = new Set(cases.map(item => item.id))
  return { cases, selectedCaseId: typeof saved.selectedCaseId === 'string' && ids.has(saved.selectedCaseId) ? saved.selectedCaseId : null,
    requests: Object.fromEntries(Object.entries(parseRecords(saved.requests, {})).filter(([id]) => ids.has(id))) }
}

function parseReminder(value: unknown): ProposalReminder | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<ProposalReminder>
  if (typeof item.scheduledAt !== 'string' || !Number.isFinite(Date.parse(item.scheduledAt))) return null
  const instant = new Date(item.scheduledAt)
  const limaTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant)
  if (!reminderInstant(dateInLima(instant), limaTime)) return null
  if (item.status === 'scheduled') return { scheduledAt: instant.toISOString(), status: 'scheduled', executedAt: null }
  if (item.status === 'executed' && typeof item.executedAt === 'string' && Number.isFinite(Date.parse(item.executedAt)) && Date.parse(item.executedAt) >= instant.getTime()) return { scheduledAt: instant.toISOString(), status: 'executed', executedAt: new Date(item.executedAt).toISOString() }
  return null
}

function parseReturnTracking(value: unknown): ReturnTracking {
  const empty: ReturnTracking = { interventionStartedAt: null, observedAt: null, feedback: null }
  if (!value || typeof value !== 'object') return empty
  const data = value as Partial<ReturnTracking>
  const valid = (instant: unknown): instant is string => typeof instant === 'string' && Number.isFinite(Date.parse(instant))
  const interventionStartedAt = valid(data.interventionStartedAt) ? data.interventionStartedAt : null
  const observedAt = valid(data.observedAt) && (!interventionStartedAt || Date.parse(data.observedAt) >= Date.parse(interventionStartedAt)) ? data.observedAt : interventionStartedAt
  return { interventionStartedAt, observedAt, feedback: interventionStartedAt && ['good', 'mixed', 'problem', 'skipped'].includes(data.feedback as string) ? data.feedback as ReturnTracking['feedback'] : null }
}

function parseProfileData(value: unknown, fallback: ProfileDemoData): ProfileDemoData {
  if (typeof value !== 'object' || value === null) return fallback
  const data = value as Partial<ProfileDemoData>
  const preferences = (data.preferences && typeof data.preferences === 'object' ? data.preferences : fallback.preferences) as Partial<DemoPreferences> & { proposalSaved?: boolean }
  const comparisonOption = parseConfiguration(preferences.comparisonOption)
  const savedProposal = parseConfiguration(preferences.savedProposal)
    ?? (preferences.proposalSaved === true ? copyConfiguration(parseConfiguration(preferences) ?? fallback.preferences) : null)
  const savedProposals: SavedProposal[] = Array.isArray(preferences.savedProposals) ? preferences.savedProposals.flatMap((item) => {
    const config = parseConfiguration(item)
    if (!config || !item || typeof item.id !== 'string' || typeof item.referenceAt !== 'string' || !Number.isFinite(Date.parse(item.referenceAt))) return []
    return [{ ...config, id: item.id, referenceAt: item.referenceAt, tableVersion: typeof item.tableVersion === 'string' ? item.tableVersion : 'demo-rates-v1', reminder: parseReminder(item.reminder) }]
  }).filter((item, index, list) => list.findIndex(candidate => candidate.id === item.id) === index) : []
  if (!savedProposals.length && savedProposal) savedProposals.push({ ...savedProposal, id: 'legacy-saved', referenceAt: DEMO_REFERENCE_DATE.toISOString(), tableVersion: 'demo-rates-v1 (migrada)', reminder: null })
  return {
    goals: Array.isArray(data.goals) ? data.goals.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim().slice(0, 200)).slice(0, 8) : [],
    returnTracking: parseReturnTracking(data.returnTracking),
    connection: { connectedAt: typeof data.connection?.connectedAt === 'string' && Number.isFinite(Date.parse(data.connection.connectedAt)) ? data.connection.connectedAt : null },
    support: parseSupport(data.support, fallback.support),
    incentiveEnrollments: parseRecords(data.incentiveEnrollments, fallback.incentiveEnrollments),
    incentiveAwards: parseRecords(data.incentiveAwards, fallback.incentiveAwards),
    deliveryHistory: Array.isArray(data.deliveryHistory) && data.deliveryHistory.every(isDeliveryRecord)
      ? data.deliveryHistory : fallback.deliveryHistory,
    preferences: {
      zone: typeof preferences.zone === 'string' ? preferences.zone : fallback.preferences.zone,
      hours: typeof preferences.hours === 'number' && Number.isFinite(preferences.hours) ? preferences.hours : fallback.preferences.hours,
      moment: typeof preferences.moment === 'string' ? preferences.moment : fallback.preferences.moment,
      vehicle: typeof preferences.vehicle === 'string' ? preferences.vehicle : fallback.preferences.vehicle,
      scheduleMode: preferences.scheduleMode === 'another-day' ? 'another-day' : 'now',
      scheduledDate: typeof preferences.scheduledDate === 'string' ? preferences.scheduledDate : null,
      expenseFuel: typeof preferences.expenseFuel === 'number' && Number.isFinite(preferences.expenseFuel) ? preferences.expenseFuel : 0,
      expenseMaintenance: typeof preferences.expenseMaintenance === 'number' && Number.isFinite(preferences.expenseMaintenance) ? preferences.expenseMaintenance : 0,
      expenseOther: typeof preferences.expenseOther === 'number' && Number.isFinite(preferences.expenseOther) ? preferences.expenseOther : 0,
      comparisonOption,
      programStep: preferences.programStep === 'comparison' && comparisonOption ? 'comparison' : preferences.programStep === 'projection' ? 'projection' : 'configuration',
      returnNeed: ['savings', 'time', 'payment-order', 'personal-vehicle', 'other', 'skipped'].includes(preferences.returnNeed as string) ? preferences.returnNeed as DemoPreferences['returnNeed'] : null,
      otherNeedDetail: typeof preferences.otherNeedDetail === 'string' ? preferences.otherNeedDetail.slice(0, 280) : '',
      savedProposal,
      savedProposals,
      editingSavedProposalId: typeof preferences.editingSavedProposalId === 'string' && savedProposals.some(item => item.id === preferences.editingSavedProposalId) ? preferences.editingSavedProposalId : null,
      proposalContinued: preferences.proposalContinued === true,
      allowProgramInvitations: typeof preferences.allowProgramInvitations === 'boolean' ? preferences.allowProgramInvitations : fallback.preferences.allowProgramInvitations,
      preferredContactDate: typeof preferences.preferredContactDate === 'string' && isFutureDate(preferences.preferredContactDate, dateInLima(DEMO_REFERENCE_DATE)) ? preferences.preferredContactDate : null,
    },
    dismissedCampaignIds: Array.isArray(data.dismissedCampaignIds) && data.dismissedCampaignIds.every((id) => typeof id === 'string')
      ? data.dismissedCampaignIds : [],
    invitationResponses: data.invitationResponses && typeof data.invitationResponses === 'object'
      ? Object.fromEntries(Object.entries(data.invitationResponses).filter((entry): entry is [string, 'later' | 'not-interested'] => entry[1] === 'later' || entry[1] === 'not-interested'))
      : {},
    externalInvitationPresentedCampaignIds: Array.isArray(data.externalInvitationPresentedCampaignIds) && data.externalInvitationPresentedCampaignIds.every((id) => typeof id === 'string')
      ? data.externalInvitationPresentedCampaignIds : [],
    programStartedCampaignIds: Array.isArray(data.programStartedCampaignIds) && data.programStartedCampaignIds.every((id) => typeof id === 'string')
      ? data.programStartedCampaignIds : [],
    scheduledContactDatesByCampaign: data.scheduledContactDatesByCampaign && typeof data.scheduledContactDatesByCampaign === 'object'
      ? Object.fromEntries(Object.entries(data.scheduledContactDatesByCampaign).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : {},
    requestedHelpFollowupDate: typeof data.requestedHelpFollowupDate === 'string' && isFutureDate(data.requestedHelpFollowupDate, dateInLima(DEMO_REFERENCE_DATE)) ? data.requestedHelpFollowupDate : null,
  }
}

export function createDemoState(profiles: DemoProfile[]): DemoState {
  const profileDataById = Object.fromEntries(profiles.map((profile) => [profile.id, initialProfileData(profile)]))
  return { selectedProfileId: 'inactive-recent', profileDataById }
}

export function loadDemoState(profiles: DemoProfile[]): DemoState {
  const fallback = createDemoState(profiles)
  const profileDataById = fallback.profileDataById
  try {
    const raw = sessionStorage.getItem(DEMO_STORAGE_KEY)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return fallback
    const stored = parsed as Partial<DemoState> & { progressByProfile?: Record<string, { preferences?: Partial<DemoPreferences> }> }
    const savedProfiles = stored.profileDataById
    const previousIds: Record<string, string> = { 'inactive-recent': 'alex', 'inactive-31-60': 'sam', active: 'dani', 'no-deliveries': '', blocked: '' }
    for (const profile of profiles) {
      const initial = initialProfileData(profile)
      if (savedProfiles && typeof savedProfiles === 'object') {
        profileDataById[profile.id] = parseProfileData(savedProfiles[profile.id], initial)
      } else {
        const priorProgress = stored.progressByProfile?.[profile.id] ?? stored.progressByProfile?.[previousIds[profile.id]]
        if (priorProgress?.preferences) profileDataById[profile.id] = parseProfileData({ preferences: priorProgress.preferences }, initial)
      }
      const loadedData = profileDataById[profile.id]
      if (!loadedData.preferences.allowProgramInvitations) {
        loadedData.scheduledContactDatesByCampaign = {}
        loadedData.preferences.preferredContactDate = null
      }
    }
    const legacyIds: Record<string, string> = { alex: 'inactive-recent', sam: 'inactive-31-60', dani: 'active', luz: 'active' }
    const candidateId = typeof stored.selectedProfileId === 'string' ? legacyIds[stored.selectedProfileId] ?? stored.selectedProfileId : fallback.selectedProfileId
    const selectedProfileId = profiles.some((profile) => profile.id === candidateId) ? candidateId : fallback.selectedProfileId
    return { selectedProfileId, profileDataById }
  } catch {
    return fallback
  }
}

export function saveDemoState(state: DemoState): void {
  try {
    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // The visual demo remains usable if browser storage is unavailable.
  }
}
