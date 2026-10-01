import { startDemoSession, resetDemoSession } from './services/demoSession'
import { DemoWorkspace } from './components/DemoWorkspace'
import { OperationsPanel } from './components/OperationsPanel'
import { getReturnResult, recordReturnFeedback, type ReturnFeedback } from './domain/returnTracking'
import { returnService, evaluationReference } from './services/returnService'
import { confirmDemoConnection } from './domain/connection'
import { supportService } from './services/supportService'
import type { SupportData, SupportStatus } from './domain/support'
import { enrollIncentive } from './domain/incentives'
import type { ProjectionConfiguration } from './domain/projectionConfiguration'
import { DEMO_INCENTIVE_CATALOG } from './services/incentiveService'
import { useEffect, useState } from 'react'
import { HomeScreen } from './components/HomeScreen'
import { InvitationRoute, InvalidInvitationRoute } from './components/InvitationRoute'
import { createDemoProfiles } from './data/demoProfiles'
import { getPauseBand, getReactivationEligibility, getReactivationPriority } from './domain/eligibility'
import { DEMO_REFERENCE_DATE } from './services/demoClock'
import { initialProfileData, PILOT_CAMPAIGN_ID, saveDemoState, type DemoPreferences } from './services/demoStorage'
import { parseAppRoute, routeHref, type AppRoute } from './services/demoRoutes'
import { dateInLima } from './domain/demoDates'
import { profileWithHistory } from './services/demoProfileService'
import { canOfferInitialInvitation, canOpenExistingInvitation, invitationPreviewReason, recordInvitationResponse, recordProgramStarted, updateContactPreferences } from './domain/invitations'

const profiles = createDemoProfiles(DEMO_REFERENCE_DATE)
const initialRoute = parseAppRoute(window.location.search, profiles)

export function App() {
  const [route, setRoute] = useState<AppRoute>(initialRoute)
  const [state, setState] = useState(() => startDemoSession(profiles, initialRoute))
  const [resetMessage, setResetMessage] = useState('')
  const [inviteNotice, setInviteNotice] = useState('')
  const seedProfile = profiles.find((item) => item.id === (route.kind === 'invitation' || route.kind === 'invitation-preview' || route.kind === 'program' || route.kind === 'connection' ? route.profileId : state.selectedProfileId)) ?? profiles[0]
  const savedData = state.profileDataById[seedProfile.id] ?? initialProfileData(seedProfile)
  const reference = evaluationReference(savedData)
  const profile = profileWithHistory(seedProfile, savedData.deliveryHistory, reference)
  const returnResult = getReturnResult(savedData.deliveryHistory, savedData.returnTracking)
  const eligibility = getReactivationEligibility(profile.deliveries, reference, profile.accountStatus)
  const canUseProgram = profile.accountStatus === 'active' && (eligibility.eligible || Boolean(returnResult))
  const pauseBand = getPauseBand(profile.lastDeliveryAt, reference)
  const canOfferInvitation = eligibility.eligible && canOfferInitialInvitation(savedData, PILOT_CAMPAIGN_ID)
  const previewReason = invitationPreviewReason(eligibility, savedData, PILOT_CAMPAIGN_ID)
  const priority = getReactivationPriority(eligibility)
  const invalidRoute = route.kind === 'invalid-invitation'
    || (route.kind === 'program' && !canUseProgram)
    || (route.kind === 'invitation' && (!eligibility.eligible || !canOpenExistingInvitation(savedData, PILOT_CAMPAIGN_ID)))

  useEffect(() => saveDemoState(state), [state])
  useEffect(() => {
    if ((route.kind !== 'invitation' && route.kind !== 'program') || invalidRoute) return
    setState((current) => {
      const profileData = current.profileDataById[profile.id] ?? initialProfileData(seedProfile)
      const updated = route.kind === 'program' ? returnService.start(recordProgramStarted(profileData, PILOT_CAMPAIGN_ID))
        : profileData.externalInvitationPresentedCampaignIds.includes(PILOT_CAMPAIGN_ID) ? profileData
        : { ...profileData, externalInvitationPresentedCampaignIds: [...profileData.externalInvitationPresentedCampaignIds, PILOT_CAMPAIGN_ID] }
      if (updated === profileData && current.selectedProfileId === profile.id) return current
      return {
        ...current,
        selectedProfileId: profile.id,
        profileDataById: {
          ...current.profileDataById,
          [profile.id]: updated,
        },
      }
    })
  }, [route, invalidRoute, profile.id, seedProfile])
  useEffect(() => {
    const onPopState = () => setRoute(parseAppRoute(window.location.search, profiles))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(nextRoute: AppRoute, replace = false) {
    const url = routeHref(nextRoute, window.location.pathname)
    if (replace) window.history.replaceState({}, '', url)
    else window.history.pushState({}, '', url)
    setRoute(nextRoute)
  }

  function changeProfile(id: string) {
    if (!profiles.some((item) => item.id === id)) return
    setState((current) => ({ ...current, selectedProfileId: id }))
    setResetMessage('')
    setInviteNotice('')
    navigate({ kind: 'home' })
  }

  function changePreferences(preferences: DemoPreferences) {
    setState((current) => ({
      ...current,
      profileDataById: {
        ...current.profileDataById,
        [profile.id]: updateContactPreferences(current.profileDataById[profile.id], preferences, PILOT_CAMPAIGN_ID, dateInLima(DEMO_REFERENCE_DATE)),
      },
    }))
    setResetMessage('')
  }

  function changeGoals(goals: string[]) {
    setState(current => ({ ...current, profileDataById: { ...current.profileDataById, [profile.id]: { ...current.profileDataById[profile.id], goals } } }))
    setResetMessage('')
  }

  function enroll(id: string, config: ProjectionConfiguration) {
    setState((current) => {
      const data = current.profileDataById[profile.id]
      const updated = enrollIncentive(data, DEMO_INCENTIVE_CATALOG, { ...seedProfile, deliveries: data.deliveryHistory }, config, DEMO_REFERENCE_DATE, id)
      if (updated === data) return current
      return { ...current, profileDataById: { ...current.profileDataById, [profile.id]: updated } }
    })
  }

  function updateSupport(command: (data: SupportData) => SupportData) {
    setState(current => {
      const data = current.profileDataById[profile.id]
      const support = command(data.support)
      if (support === data.support) return current
      return { ...current, profileDataById: { ...current.profileDataById, [profile.id]: { ...data, support } } }
    })
  }

  function changeSupportStatus(id: string, status: SupportStatus) {
    updateSupport(data => supportService.setDemoStatus(data, id, status))
  }

  function confirmConnection() {
    setState(current => {
      const data = current.profileDataById[profile.id]
      const connection = confirmDemoConnection(data.connection, profile.accountStatus, DEMO_REFERENCE_DATE)
      return connection === data.connection ? current : { ...current, profileDataById: { ...current.profileDataById, [profile.id]: { ...data, connection } } }
    })
  }

  function disconnect() {
    setState(current => ({ ...current, profileDataById: { ...current.profileDataById, [profile.id]: { ...current.profileDataById[profile.id], connection: { connectedAt: null } } } }))
  }

  function addDelivery(status: 'completed' | 'cancelled') {
    if (profile.accountStatus !== 'active') return
    setState(current => ({ ...current, profileDataById: { ...current.profileDataById, [profile.id]: returnService.addDelivery(current.profileDataById[profile.id], status) } }))
    navigate({ kind: 'home' })
  }

  function saveReturnFeedback(feedback: ReturnFeedback) {
    setState(current => {
      const data = current.profileDataById[profile.id]
      const returnTracking = recordReturnFeedback(data.returnTracking, data.deliveryHistory, feedback)
      return returnTracking === data.returnTracking ? current : { ...current, profileDataById: { ...current.profileDataById, [profile.id]: { ...data, returnTracking } } }
    })
  }

  function newProjection() {
    if (!canUseProgram) return
    changePreferences({ ...savedData.preferences, programStep: 'configuration', proposalContinued: false, returnNeed: null, editingSavedProposalId: null })
    openProgram(profile.id)
  }

  function resetDemonstration() {
    setState(resetDemoSession(profiles))
    setResetMessage('Demostración reiniciada. Camila vuelve a tener 20 días sin completar una entrega.')
    setInviteNotice('')
    navigate({ kind: 'home' }, true)
  }

  function resetProfile() {
    setState((current) => ({
      ...current,
      profileDataById: { ...current.profileDataById, [profile.id]: initialProfileData(seedProfile) },
    }))
    setResetMessage(`Datos de ${profile.name} reiniciados.`)
  }

  function addCampaignDismissal(profileId: string) {
    setState((current) => {
      const profileData = current.profileDataById[profileId] ?? initialProfileData(profiles.find((item) => item.id === profileId)!)
      return {
        ...current,
        selectedProfileId: profileId,
        profileDataById: {
          ...current.profileDataById,
          [profileId]: { ...profileData, dismissedCampaignIds: [...new Set([...profileData.dismissedCampaignIds, PILOT_CAMPAIGN_ID])] },
        },
      }
    })
  }

  function dismissOpportunity() {
    addCampaignDismissal(profile.id)
  }

  function respondToInvitation(response: 'later' | 'not-interested', contactDate?: string) {
    setState((current) => {
      const profileData = current.profileDataById[profile.id] ?? initialProfileData(seedProfile)
      return {
        ...current,
        selectedProfileId: profile.id,
        profileDataById: {
          ...current.profileDataById,
          [profile.id]: recordInvitationResponse(profileData, PILOT_CAMPAIGN_ID, response, dateInLima(DEMO_REFERENCE_DATE), contactDate),
        },
      }
    })
    setInviteNotice(response === 'later'
      ? contactDate ? `Contacto simulado guardado para el ${contactDate}. No se enviará un mensaje real.` : 'Listo. No programamos ningún contacto.'
      : 'Listo. Guardamos que no deseas recibir nuevas invitaciones del programa.')
    navigate({ kind: 'home' }, true)
  }

  function openInvitation(profileId: string) {
    if (!profiles.some((item) => item.id === profileId)) return
    const candidate = profiles.find((item) => item.id === profileId)!
    const candidateData = state.profileDataById[profileId] ?? initialProfileData(candidate)
    const candidateEligibility = getReactivationEligibility(candidateData.deliveryHistory, evaluationReference(candidateData), candidate.accountStatus)
    const reason = invitationPreviewReason(candidateEligibility, candidateData, PILOT_CAMPAIGN_ID)
    setState((current) => ({ ...current, selectedProfileId: profileId }))
    setInviteNotice('')
    navigate({ kind: reason ? 'invitation-preview' : 'invitation', profileId })
  }

  function openProgram(profileId = profile.id) {
    const candidate = profiles.find((item) => item.id === profileId)
    if (!candidate) return
    const candidateData = state.profileDataById[profileId] ?? initialProfileData(candidate)
    if (candidate.accountStatus !== 'active' || (!getReactivationEligibility(candidateData.deliveryHistory, evaluationReference(candidateData), candidate.accountStatus).eligible && !getReturnResult(candidateData.deliveryHistory, candidateData.returnTracking))) return
    setState((current) => {
      const profileData = current.profileDataById[profileId] ?? initialProfileData(candidate)
      return {
        ...current,
        selectedProfileId: profileId,
        profileDataById: {
          ...current.profileDataById,
          [profileId]: returnService.start(recordProgramStarted(profileData, PILOT_CAMPAIGN_ID)),
        },
      }
    })
    navigate({ kind: 'program', profileId })
  }

  function returnHome() {
    navigate({ kind: 'home' })
  }

  if (route.kind === 'operations') return <OperationsPanel onBack={returnHome} />

  const controls = {
    returnTracking: savedData.returnTracking,
    deliveryHistory: savedData.deliveryHistory,
    onAddDemoDelivery: addDelivery,
    supportData: savedData.support,
    onSupportStatus: changeSupportStatus,
    profile,
    profiles: profiles.map(seed => { const data = state.profileDataById[seed.id]; return profileWithHistory(seed, data.deliveryHistory, evaluationReference(data)) }),
    goals: savedData.goals,
    onGoalsChange: changeGoals,
    preferences: savedData.preferences,
    pauseBand,
    deliveryCount: savedData.deliveryHistory.length,
    resetMessage,
    invitationHint: previewReason ?? (savedData.externalInvitationPresentedCampaignIds.includes(PILOT_CAMPAIGN_ID) ? 'Puedes reabrir la invitación existente sin generar otro contacto.' : 'Invitación disponible para este perfil. No se envían mensajes reales.'),
    priority,
    canOpenProgram: canUseProgram,
    currentScreen: route.kind,
    onProfileChange: changeProfile,
    onPreferencesChange: changePreferences,
    onResetProfile: resetProfile,
    onResetDemo: resetDemonstration,
    isEligible: eligibility.eligible,
    daysInactive: eligibility.daysInactive ?? null,
    onPreviewInvitation: () => openInvitation(profile.id),
    onShowHome: returnHome,
    onOpenProgram: () => openProgram(profile.id),
  }
  const riderScreen = invalidRoute ? <InvalidInvitationRoute onBack={returnHome} />
    : route.kind === 'invitation' || route.kind === 'invitation-preview' ? <InvitationRoute key={profile.id + route.kind} previewReason={route.kind === 'invitation-preview' ? previewReason ?? 'Esta es una vista de ejemplo, sin registrar contactos.' : undefined} canContinue={canUseProgram} profile={profile} onBack={returnHome} onViewOptions={() => openProgram(profile.id)} onExitWithoutSchedule={() => respondToInvitation('later')} onNotInterested={() => respondToInvitation('not-interested')} />
    : <HomeScreen
    returnContext={{ tracking: savedData.returnTracking, deliveries: savedData.deliveryHistory, onFeedback: saveReturnFeedback }}
    onNewProjection={newProjection}
    connection={savedData.connection}
    connectionOpen={route.kind === 'connection'}
    messagesOpen={route.kind === 'messages'}
    supportOpen={route.kind === 'support'}
    onOpenSupport={() => navigate({ kind: 'support' })}
    onOpenMessages={() => navigate({ kind: 'messages' })}
    onGoConnection={() => navigate({ kind: 'connection', profileId: profile.id })}
    onConfirmConnection={confirmConnection}
    onDisconnect={disconnect}
    support={{ data: savedData.support, onSelect: id => updateSupport(data => supportService.select(data, id)), onRequest: id => updateSupport(data => supportService.request(data, id)) }}
    incentives={{ profile, records: savedData, onEnroll: enroll }}
    profile={profile}
    showOpportunity={canOfferInvitation}
    canOpenOpportunity={canUseProgram}
    simulatorOpen={route.kind === 'program'}
    preferences={savedData.preferences}
    inviteNotice={inviteNotice}
    onPreferencesChange={changePreferences}
    onDismissOpportunity={dismissOpportunity}
    onOpenSimulator={() => openProgram(profile.id)}
    onCloseSimulator={returnHome}
  />
  return <DemoWorkspace screenKey={route.kind + ':' + profile.id} controls={controls}>{riderScreen}</DemoWorkspace>
}
