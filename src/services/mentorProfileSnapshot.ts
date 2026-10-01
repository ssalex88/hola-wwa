import type { ContactPermission, Eligibility, Profile, ProfileSnapshot, Projection, Vehicle } from '../contracts/mentor.ts'
import type { DemoProfile } from '../data/demoProfiles.ts'
import { DEMO_ZONES } from '../data/demoZones.ts'
import { createDemoIncentives } from '../data/conditionalIncentives.ts'
import { SIMULATED_PROJECTION_RATES } from '../data/projectionRates.ts'
import { getPauseBand, getReactivationEligibility, getReactivationPriority } from '../domain/eligibility.ts'
import { canOfferInitialInvitation } from '../domain/invitations.ts'
import { getApplicableIncentives } from '../domain/incentives.ts'
import { calculateProjection } from '../domain/projection.ts'
import { copyConfiguration, validateProjectionConfiguration } from '../domain/projectionConfiguration.ts'
import { dateInLima } from '../domain/demoDates.ts'
import { getReturnResult } from '../domain/returnTracking.ts'
import { profileWithHistory } from './demoProfileService.ts'
import { PILOT_CAMPAIGN_ID, type ProfileDemoData } from './demoStorage.ts'

export function observedReference(data: ProfileDemoData, reference: Date): Date {
  const observed = Date.parse(data.returnTracking.observedAt ?? '')
  return new Date(Math.max(reference.getTime(), Number.isFinite(observed) ? observed : 0))
}

export function contractProfile(seed: DemoProfile, data: ProfileDemoData, reference: Date): Profile {
  const profile = profileWithHistory(seed, data.deliveryHistory, observedReference(data, reference))
  const zone = DEMO_ZONES.find(item => item.label === profile.zone)
  if (!zone || !['Bicicleta', 'Moto', 'Auto'].includes(profile.vehicle)) throw new Error('Perfil de demo fuera del catálogo.')
  return { id: profile.id, name: profile.name, vehicle: profile.vehicle as Vehicle, zoneId: zone.id,
    accountStatus: profile.accountStatus, lastCompletedAt: profile.lastDeliveryAt, scenario: profile.scenario, simulated: true }
}

/** Maps existing demo state without registering any new event, invitation or intervention. */
export function profileSnapshot(seed: DemoProfile, data: ProfileDemoData, reference: Date): ProfileSnapshot {
  const observed = observedReference(data, reference)
  const profile = profileWithHistory(seed, data.deliveryHistory, observed)
  const status = getReactivationEligibility(data.deliveryHistory, observed, profile.accountStatus)
  const historyStatus = getReactivationEligibility(data.deliveryHistory, observed)
  const daysInactive = historyStatus.daysInactive ?? null
  const eligibility: Eligibility = {
    eligible: status.eligible, reason: status.eligible ? 'eligible' : status.reason,
    track: status.eligible ? 'reactivation' : status.reason === 'active' && daysInactive !== null && daysInactive >= 7 ? 'prevention' : 'none',
    daysInactive, pauseBand: getPauseBand(profile.lastDeliveryAt, observed), priority: getReactivationPriority(status),
  }
  const pause: ProfileSnapshot['pause'] = profile.declaredPause ? {
    id: `seed-pause-${profile.id}`, profileId: profile.id, startedAt: profile.declaredPause.declaredAt,
    endsAt: null, reason: profile.declaredPause.note, status: 'active',
  } : null
  const preferences: ProfileSnapshot['preferences'] = {
    allowProgramInvitations: data.preferences.allowProgramInvitations,
    channels: { ...data.preferences.channels }, remindersAllowed: data.preferences.remindersAllowed,
    consentRecordedAt: data.preferences.consentRecordedAt, preferredContactDate: data.preferences.preferredContactDate,
  }
  const consent = Date.parse(preferences.consentRecordedAt ?? '')
  let reason: ContactPermission['reason'] = 'allowed'
  if (!status.eligible) reason = 'ineligible'
  else if (pause) reason = 'paused'
  else if (Object.values(data.invitationResponses).includes('not-interested')) reason = 'rejected'
  else if (!preferences.allowProgramInvitations || !Number.isFinite(consent) || consent > observed.getTime()) reason = 'no-consent'
  else if (data.programStartedCampaignIds.includes(PILOT_CAMPAIGN_ID)) reason = 'flow-started'
  else if (!canOfferInitialInvitation(data, PILOT_CAMPAIGN_ID)) reason = 'already-contacted'
  const contactPermission: ContactPermission = {
    canShowAppInvitation: reason === 'allowed' && preferences.channels.app,
    canSendExternalInvitation: reason === 'allowed' && preferences.channels.external,
    reason,
  }

  const configuration = copyConfiguration(data.preferences)
  let currentProjection: Projection | null = null
  if (data.preferences.programStep !== 'configuration' && !Object.keys(validateProjectionConfiguration(configuration, dateInLima(reference))).length) {
    const result = calculateProjection(configuration, SIMULATED_PROJECTION_RATES)
    currentProjection = result ? {
      status: 'available', id: `state-projection-${profile.id}`, profileId: profile.id, configuration, result,
      currency: 'PEN', referenceAt: reference.toISOString(), tableVersion: 'demo-rates-v1', simulated: true, guaranteed: false,
      assumptions: ['Tabla simulada por zona, franja y vehículo, multiplicada por las horas indicadas.', 'Solo se restan los gastos ingresados; no se consideran todos los costos.', 'No se garantizan pedidos ni ingresos.'],
      incentives: getApplicableIncentives(createDemoIncentives(reference), profile, configuration, reference, data).map(item => ({
        id: item.id, label: item.title, amount: item.reward.kind === 'money' ? item.reward.amount : null,
        benefit: item.reward.kind === 'benefit' ? item.reward.description : null,
        validFrom: new Date(`${item.startsOn}T00:00:00-05:00`).toISOString(),
        validUntil: new Date(`${item.endsOn}T23:59:59.999-05:00`).toISOString(),
        zoneIds: DEMO_ZONES.filter(zone => item.zones.includes(zone.label)).map(zone => zone.id),
        requirements: [`${item.requiredCompletedDeliveries} entregas completadas`, `Vehículos: ${item.vehicles.join(', ')}`, `Franjas: ${item.moments.join(', ')}`],
        enrollmentRequired: item.enrollmentRequired, status: item.status, simulated: true, guaranteed: false,
      })),
    } : { status: 'unavailable', configuration, reason: 'missing-data', message: 'No hay datos simulados para esta combinación.', simulated: true }
  }

  const returned = getReturnResult(data.deliveryHistory, data.returnTracking)
  const start = Date.parse(data.returnTracking.interventionStartedAt ?? '')
  const eligibleAtStart = Number.isFinite(start) && getReactivationEligibility(
    data.deliveryHistory.filter(item => Date.parse(item.completedAt) <= start), new Date(start), profile.accountStatus,
  ).eligible
  const campaigns = new Set([...data.externalInvitationPresentedCampaignIds, ...Object.keys(data.invitationResponses), ...Object.keys(data.scheduledContactDatesByCampaign)])
  const snapshot: ProfileSnapshot = {
    contractVersion: '1.0', revision: data.revision,
    clock: { referenceAt: reference.toISOString(), observedAt: observed.toISOString(), timeZone: 'America/Lima' },
    profile: contractProfile(seed, data, reference), eligibility, contactPermission, preferences,
    goals: [], contributions: [], goalProgress: [], legacyGoalNotes: [...data.goals], pause,
    invitations: [...campaigns].map(campaignId => ({
      id: `state-invitation-${profile.id}-${campaignId}`, profileId: profile.id, campaignId, origin: 'external',
      track: 'reactivation', mode: 'simulated-contact',
      status: data.invitationResponses[campaignId] === 'not-interested' ? 'declined' : data.invitationResponses[campaignId] === 'later' ? 'later' : data.programStartedCampaignIds.includes(campaignId) ? 'opened' : 'pending',
      presentedAt: null, respondedAt: null, requestedFollowupAt: null,
    })),
    savedOptions: data.preferences.savedProposals.map(item => ({
      id: item.id, profileId: profile.id, configuration: copyConfiguration(item), projectionId: `saved-projection-${item.id}`,
      referenceAt: item.referenceAt, tableVersion: item.tableVersion, savedAt: null, updatedAt: null,
      reminderId: item.reminder ? `state-reminder-${item.id}` : null, isReservation: false,
    })),
    reminders: data.preferences.savedProposals.flatMap(item => item.reminder ? [{
      id: `state-reminder-${item.id}`, profileId: profile.id, savedOptionId: item.id, scheduledAt: item.reminder.scheduledAt,
      timeZone: 'America/Lima' as const, requestedAt: null, status: item.reminder.status, executedAt: item.reminder.executedAt, simulated: true as const,
    }] : []),
    cases: data.support.cases.map(item => ({ ...item, profileId: profile.id, createdAt: null, updatedAt: null, simulated: true })),
    helpRequests: Object.entries(data.support.requests).map(([caseId, requestedAt]) => ({ id: `state-help-${caseId}`, profileId: profile.id, caseId, requestedAt, simulated: true })),
    deliveries: data.deliveryHistory.map(item => ({ ...item, profileId: profile.id, simulated: true })),
    progress: {
      interventionStartedAt: data.returnTracking.interventionStartedAt, eligibleAtStart, origin: null,
      step: data.preferences.proposalContinued ? 'decision' : data.preferences.programStep === 'configuration' ? 'configuration' : 'projection',
      configuration, currentProjection, comparisonConfiguration: data.preferences.comparisonOption ? copyConfiguration(data.preferences.comparisonOption) : null,
      need: data.preferences.returnNeed, otherNeedDetail: data.preferences.otherNeedDetail,
      connectedAt: data.connection.connectedAt, returnedAt: eligibleAtStart ? returned?.returnedAt ?? null : null,
      returnDeliveryId: eligibleAtStart ? returned?.deliveryId ?? null : null, returnFeedback: data.returnTracking.feedback,
    },
    mentor: { text: 'Revisa cuánto podrías obtener según tu tiempo y zona.', actions: [] },
  }
  return structuredClone(snapshot)
}
