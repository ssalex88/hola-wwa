import type { ProposalReminder } from './reminders.ts'
import { copyConfiguration, validateProjectionConfiguration, type ProjectionConfiguration } from './projectionConfiguration.ts'
import { dateInLima, momentInLima } from './demoDates.ts'

export interface SavedProposal extends ProjectionConfiguration {
  id: string
  referenceAt: string
  tableVersion: string
  reminder: ProposalReminder | null
}
export interface ProposalState extends ProjectionConfiguration {
  savedProposal: ProjectionConfiguration | null
  savedProposals: SavedProposal[]
  editingSavedProposalId: string | null
}
export function configurationForReview(config: ProjectionConfiguration, reference: Date): ProjectionConfiguration {
  return config.scheduleMode === 'now' ? { ...copyConfiguration(config), moment: momentInLima(reference), scheduledDate: null } : copyConfiguration(config)
}
export function saveProposal<T extends ProposalState>(state: T, reference: Date, newId: string): T {
  if (!Number.isFinite(reference.getTime()) || Object.keys(validateProjectionConfiguration(state, dateInLima(reference))).length) return state
  const id = state.editingSavedProposalId && state.savedProposals.some(item => item.id === state.editingSavedProposalId) ? state.editingSavedProposalId : newId
  const saved: SavedProposal = { ...copyConfiguration(state), id, referenceAt: reference.toISOString(), tableVersion: 'demo-rates-v1', reminder: state.savedProposals.find(item => item.id === id)?.reminder ?? null }
  return { ...state, savedProposal: copyConfiguration(saved), savedProposals: [...state.savedProposals.filter(item => item.id !== id), saved], editingSavedProposalId: null }
}
export function deleteProposal<T extends ProposalState>(state: T, id: string): T {
  const savedProposals = state.savedProposals.filter(item => item.id !== id)
  if (savedProposals.length === state.savedProposals.length) return state
  const last = savedProposals.at(-1)
  return { ...state, savedProposals, savedProposal: last ? copyConfiguration(last) : null, editingSavedProposalId: state.editingSavedProposalId === id ? null : state.editingSavedProposalId }
}
