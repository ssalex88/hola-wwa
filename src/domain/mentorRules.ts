import type { ContactPermission, Eligibility, GoalProgress, MentorAdvice, ProfileSnapshot, ProjectionInput, Zone } from '../contracts/mentor.ts'
import { getPauseBand, getReactivationEligibility, getReactivationPriority } from './eligibility.ts'
import { dateInLima, isCalendarDate } from './demoDates.ts'
import { copyConfiguration, validateProjectionConfiguration } from './projectionConfiguration.ts'

export const MENTOR_ZONES: Zone[] = [
  { id: 'lima-centro', label: 'Lima Centro', simulated: true },
  { id: 'miraflores', label: 'Miraflores', simulated: true },
  { id: 'surco', label: 'Surco', simulated: true },
  { id: 'san-miguel', label: 'San Miguel', simulated: true },
  { id: 'jesus-maria', label: 'Jesús María', simulated: true },
]
export type ErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'NOT_ELIGIBLE' | 'CONTACT_BLOCKED' | 'CONFLICT' | 'UNEXPECTED'
export class MentorError extends Error {
  code: ErrorCode
  fields?: Record<string, string>
  constructor(code: ErrorCode, message: string, fields?: Record<string, string>) { super(message); this.code = code; this.fields = fields }
}
export function requireRule(condition: unknown, code: ErrorCode, message: string): asserts condition {
  if (!condition) throw new MentorError(code, message)
}
export function money(value: number, positive = false): number {
  requireRule(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER / 100, 'VALIDATION', 'Ingresa un monto válido en soles.')
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  requireRule(!positive || rounded > 0, 'VALIDATION', 'Ingresa un monto positivo.')
  return rounded
}
export function instant(value: string): string {
  requireRule(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value)), 'VALIDATION', 'Ingresa un instante ISO UTC válido.')
  const normalized = new Date(value).toISOString()
  requireRule(normalized === value || normalized.replace('.000Z', 'Z') === value, 'VALIDATION', 'La fecha u hora no existe.')
  return normalized
}
export function text(value: string, max = 200): string {
  requireRule(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, 'VALIDATION', `Ingresa un texto de entre 1 y ${max} caracteres.`)
  return value.trim()
}
export function localDate(value: string): string {
  requireRule(typeof value === 'string' && isCalendarDate(value), 'VALIDATION', 'Ingresa una fecha válida YYYY-MM-DD de Lima.')
  return value
}
export function projectionInput(input: ProjectionInput, now: string): ProjectionInput {
  requireRule(input && typeof input === 'object', 'VALIDATION', 'Falta la configuración.')
  const errors = validateProjectionConfiguration(input, dateInLima(new Date(now)))
  if (!['now', 'another-day'].includes(input.scheduleMode)) errors.scheduleMode = 'Elige un modo válido.'
  if (input.scheduleMode === 'now' && input.scheduledDate !== null) errors.scheduledDate = 'Para salir ahora, la fecha opcional debe ser null.'
  const configuration = copyConfiguration(input)
  for (const key of ['expenseFuel', 'expenseMaintenance', 'expenseOther'] as const) {
    try { configuration[key] = money(input[key]) } catch (error) {
      if (!(error instanceof MentorError) || error.code !== 'VALIDATION') throw error
      errors[key] ??= error.message
    }
  }
  if (Object.keys(errors).length) throw new MentorError('VALIDATION', 'Revisa la configuración de la salida.', errors)
  const expenseCents = Math.round(configuration.expenseFuel * 100) + Math.round(configuration.expenseMaintenance * 100) + Math.round(configuration.expenseOther * 100)
  requireRule(Number.isSafeInteger(expenseCents), 'VALIDATION', 'El total de gastos supera el monto admitido en soles.')
  return configuration
}
export function projectionGoalAssumptions(snapshot: ProfileSnapshot): string[] {
  const goal = snapshot.goals.find(item => item.status === 'active')
  if (!goal) return []
  const progress = goalProgress(snapshot).find(item => item.goalId === goal.id)!
  return [
    `Tu meta declarada es «${goal.name}». Quedan S/ ${progress.remainingAmount.toFixed(2)} según tus aportes manuales registrados.`,
    'Puedes comparar esta estimación con el monto pendiente de tu meta. La proyección no se registra como ahorro ni completa la meta; solo los aportes manuales modifican el avance.',
  ]
}
export function eligibilityFor(snapshot: ProfileSnapshot, now: string): Eligibility {
  const result = getReactivationEligibility(snapshot.deliveries, new Date(now), snapshot.profile.accountStatus)
  const daysInactive = result.daysInactive ?? null
  return {
    eligible: result.eligible, track: result.eligible ? 'reactivation' : result.reason === 'active' && daysInactive !== null && daysInactive >= 10 ? 'prevention' : 'none',
    reason: result.eligible ? 'eligible' : result.reason, daysInactive,
    pauseBand: getPauseBand(snapshot.profile.lastCompletedAt, new Date(now)), priority: getReactivationPriority(result),
  }
}
export function isPaused(snapshot: ProfileSnapshot, now: string): boolean {
  return snapshot.pause?.status === 'active' && (snapshot.pause.endsAt === null || snapshot.pause.endsAt > now)
}
export function permissionFor(snapshot: ProfileSnapshot, now: string): ContactPermission {
  const result = (reason: ContactPermission['reason']): ContactPermission => ({ canShowAppInvitation: false, canSendExternalInvitation: false, reason })
  if (isPaused(snapshot, now)) return result('paused')
  if (snapshot.invitations.some(item => item.mode === 'simulated-contact' && item.status === 'declined')) return result('rejected')
  if (snapshot.progress.interventionStartedAt) return result('flow-started')
  if (!snapshot.eligibility.eligible) return result('ineligible')
  const preferences = snapshot.preferences
  if (!preferences.allowProgramInvitations || !preferences.consentRecordedAt || (!preferences.channels.app && !preferences.channels.external)) return result('no-consent')
  // A pending app contact also prevents unsolicited external duplication.
  if (snapshot.invitations.some(item => item.mode === 'simulated-contact')) return result('already-contacted')
  return { canShowAppInvitation: preferences.channels.app, canSendExternalInvitation: preferences.channels.external, reason: 'allowed' }
}
export function goalProgress(snapshot: ProfileSnapshot): GoalProgress[] {
  return snapshot.goals.map(goal => {
    const cents = snapshot.contributions.filter(item => item.goalId === goal.id).reduce((sum, item) => sum + Math.round(item.amount * 100), 0)
    const target = Math.round(goal.targetAmount * 100)
    return { goalId: goal.id, contributedAmount: cents / 100, remainingAmount: Math.max(0, target - cents) / 100, progressPercent: Math.round(cents / target * 10000) / 100, targetReached: cents >= target }
  })
}
export function adviceFor(snapshot: ProfileSnapshot): MentorAdvice {
  if (snapshot.profile.accountStatus === 'blocked') return { text: 'Revisa la orientación de acceso y tus casos de ayuda.', actions: ['help'] }
  // A previous eligible intervention stays available after the return makes
  // current inactivity ineligible; account restrictions still take precedence.
  if (!snapshot.eligibility.eligible && !snapshot.progress.eligibleAtStart) return {
    text: snapshot.eligibility.track === 'prevention'
      ? 'Puedes revisar tus opciones de ayuda. Por ahora este perfil no cumple las condiciones del programa de regreso.'
      : 'Por ahora este perfil no cumple las condiciones del programa de regreso.',
    actions: snapshot.cases.length ? ['help'] : [],
  }
  if (snapshot.pause?.status === 'active') return { text: 'Tus contactos están suspendidos. Puedes consultar opciones por tu cuenta.', actions: ['calculate', 'help', 'continue'] }
  const goal = snapshot.goals.find(item => item.status === 'active')
  const withGoal = (advice: MentorAdvice): MentorAdvice => goal
    ? { ...advice, text: `${advice.text} Tu meta declarada es «${goal.name}».` }
    : advice
  switch (snapshot.progress.need) {
    case 'savings': return withGoal({ text: 'Compara opciones y consulta sus condiciones; los ingresos son simulados.', actions: ['compare', 'incentives'] })
    case 'time': return withGoal({ text: 'Prueba una salida más corta y guarda la opción si te conviene.', actions: ['shorten', 'save'] })
    case 'payment-order': return withGoal({ text: 'Consulta tu caso antes de decidir.', actions: ['help'] })
    case 'personal-vehicle': return withGoal({ text: 'Puedes pausar o guardar una opción para otro momento.', actions: ['pause', 'save'] })
    case 'other':
    case 'skipped': return withGoal({ text: 'Puedes continuar sin obligación, volver a las opciones o cambiar tu respuesta cuando quieras.', actions: ['continue'] })
    default: return withGoal({ text: 'Revisa cuánto podrías obtener según tu tiempo y zona.', actions: ['calculate', 'continue'] })
  }
}
