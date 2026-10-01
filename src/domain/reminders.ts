import { isCalendarDate } from './demoDates.ts'
import type { ProposalState } from './proposals.ts'

export interface ProposalReminder {
  scheduledAt: string
  status: 'scheduled' | 'executed'
  executedAt: string | null
}
/** Inputs are local Lima time, never the browser's timezone. */
export function reminderInstant(date: string, time: string): Date | null {
  if (!isCalendarDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  const instant = new Date(`${date}T${time}:00-05:00`)
  return Number.isFinite(instant.getTime()) ? instant : null
}
export function reminderError(date: string, time: string, reference: Date): string | null {
  const instant = reminderInstant(date, time)
  if (!instant) return 'Elige una fecha y una hora válidas en Lima.'
  if (!Number.isFinite(reference.getTime()) || instant.getTime() <= reference.getTime()) return 'Elige una fecha y hora futuras en Lima.'
  return null
}
export function scheduleReminder<T extends ProposalState>(state: T, id: string, date: string, time: string, reference: Date): T {
  if (reminderError(date, time, reference) || !state.savedProposals.some(item => item.id === id)) return state
  const reminder: ProposalReminder = { scheduledAt: reminderInstant(date, time)!.toISOString(), status: 'scheduled', executedAt: null }
  return { ...state, savedProposals: state.savedProposals.map(item => item.id === id ? { ...item, reminder } : item) }
}
export function cancelReminder<T extends ProposalState>(state: T, id: string): T {
  if (!state.savedProposals.some(item => item.id === id && item.reminder)) return state
  return { ...state, savedProposals: state.savedProposals.map(item => item.id === id ? { ...item, reminder: null } : item) }
}
/** Presenter-only execution; no notification, timer or outgoing message. */
export function executeReminder<T extends ProposalState>(state: T, id: string, reference: Date): T {
  const reminder = state.savedProposals.find(item => item.id === id)?.reminder
  if (!reminder || reminder.status !== 'scheduled' || !Number.isFinite(Date.parse(reminder.scheduledAt)) || !Number.isFinite(reference.getTime()) || reference.getTime() < Date.parse(reminder.scheduledAt)) return state
  return { ...state, savedProposals: state.savedProposals.map(item => item.id === id ? { ...item, reminder: { ...reminder, status: 'executed', executedAt: reference.toISOString() } } : item) }
}
