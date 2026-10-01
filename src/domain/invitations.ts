import { isFutureDate } from './demoDates.ts'
import type { Eligibility } from './eligibility.ts'

export interface InvitationRecord {
  preferences: { allowProgramInvitations: boolean; preferredContactDate: string | null }
  dismissedCampaignIds: string[]
  invitationResponses: Record<string, 'later' | 'not-interested'>
  externalInvitationPresentedCampaignIds: string[]
  programStartedCampaignIds: string[]
  scheduledContactDatesByCampaign: Record<string, string>
}

export function canOpenExistingInvitation(data: InvitationRecord, campaignId: string): boolean {
  return data.preferences.allowProgramInvitations && !data.dismissedCampaignIds.includes(campaignId)
    && !data.programStartedCampaignIds.includes(campaignId) && !data.invitationResponses[campaignId]
}

export function canOfferInitialInvitation(data: InvitationRecord, campaignId: string): boolean {
  return canOpenExistingInvitation(data, campaignId) && !data.externalInvitationPresentedCampaignIds.includes(campaignId)
}

/** Presenter previews remain available without scheduling another invitation. */
export function invitationPreviewReason(eligibility: Eligibility, data: InvitationRecord, campaignId: string): string | null {
  if (!eligibility.eligible) {
    if (eligibility.reason === 'blocked') return 'La cuenta está bloqueada; corresponde mostrar orientación de acceso.'
    if (eligibility.reason === 'no-completed-delivery') return 'Este perfil no tiene entregas completadas previas.'
    if (eligibility.reason === 'active') return 'Este perfil lleva menos de 15 días sin una entrega completada.'
    return 'No se puede comprobar la elegibilidad de este perfil.'
  }
  if (!data.preferences.allowProgramInvitations) return 'Este perfil pidió no recibir invitaciones.'
  if (data.programStartedCampaignIds.includes(campaignId)) return 'Este perfil ya inició el programa.'
  if (data.invitationResponses[campaignId] === 'later') return 'Este perfil eligió más adelante; se conserva su preferencia de contacto.'
  if (data.invitationResponses[campaignId]) return 'Este perfil ya respondió a la invitación.'
  if (data.dismissedCampaignIds.includes(campaignId)) return 'Este perfil eligió ahora no durante el piloto.'
  return null
}

export function updateContactPreferences<T extends InvitationRecord>(data: T, preferences: T['preferences'], campaignId: string, referenceDate: string): T {
  if (preferences.preferredContactDate && !isFutureDate(preferences.preferredContactDate, referenceDate)) throw new RangeError('La fecha preferida debe ser futura y válida.')
  const scheduled = preferences.allowProgramInvitations ? { ...data.scheduledContactDatesByCampaign } : {}
  // Editing a preference can modify an existing contact, never generate a new one.
  if (scheduled[campaignId] && preferences.preferredContactDate !== data.preferences.preferredContactDate) {
    if (preferences.preferredContactDate) scheduled[campaignId] = preferences.preferredContactDate
    else delete scheduled[campaignId]
  }
  return { ...data, preferences: preferences.allowProgramInvitations ? preferences : { ...preferences, preferredContactDate: null }, scheduledContactDatesByCampaign: scheduled }
}

export function recordProgramStarted<T extends InvitationRecord>(data: T, campaignId: string): T {
  if (data.programStartedCampaignIds.includes(campaignId) && !data.scheduledContactDatesByCampaign[campaignId]) return data
  const scheduled = { ...data.scheduledContactDatesByCampaign }
  delete scheduled[campaignId]
  return { ...data, preferences: { ...data.preferences, preferredContactDate: null },
    programStartedCampaignIds: [...new Set([...data.programStartedCampaignIds, campaignId])], scheduledContactDatesByCampaign: scheduled }
}

export function saveHelpFollowup<T extends { requestedHelpFollowupDate: string | null }>(data: T, date: string | null, referenceDate: string): T {
  if (date !== null && !isFutureDate(date, referenceDate)) throw new RangeError('El contacto debe tener una fecha futura válida.')
  return { ...data, requestedHelpFollowupDate: date }
}

export function recordInvitationResponse<T extends InvitationRecord>(data: T, campaignId: string, response: 'later' | 'not-interested', referenceDate: string, contactDate?: string): T {
  if (contactDate && !isFutureDate(contactDate, referenceDate)) throw new RangeError('La fecha de contacto debe ser futura y válida.')
  const scheduled = response === 'not-interested' ? {} : { ...data.scheduledContactDatesByCampaign }
  delete scheduled[campaignId]
  if (response === 'later' && contactDate) scheduled[campaignId] = contactDate
  return { ...data,
    dismissedCampaignIds: [...new Set([...data.dismissedCampaignIds, campaignId])],
    invitationResponses: { ...data.invitationResponses, [campaignId]: response },
    preferences: { ...data.preferences, preferredContactDate: response === 'later' ? contactDate ?? null : null,
      allowProgramInvitations: response === 'not-interested' ? false : data.preferences.allowProgramInvitations },
    scheduledContactDatesByCampaign: scheduled,
  }
}
