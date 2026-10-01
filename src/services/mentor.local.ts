import type { DemoAdminService, Incentive, MentorService, Projection, ProjectionInput, RequestContext, ServiceResult } from '../contracts/mentor.ts'
import { createDemoProfiles } from '../data/demoProfiles.ts'
import { createDemoIncentives } from '../data/conditionalIncentives.ts'
import { SIMULATED_PROJECTION_RATES } from '../data/projectionRates.ts'
import { calculateProjection as calculateRange } from '../domain/projection.ts'
import { getApplicableIncentives } from '../domain/incentives.ts'
import { dateInLima } from '../domain/demoDates.ts'
import { configurationForReview } from '../domain/proposals.ts'
import { getReturnResult } from '../domain/returnTracking.ts'
import { exploreDemoRoute } from '../domain/mentorRoutes.ts'
import { MENTOR_ZONES, MentorError, instant, isPaused, localDate, money, projectionInput, projectionGoalAssumptions, requireRule, text } from '../domain/mentorRules.ts'
import { clone, createMentorState, loadMentorState, MENTOR_STORAGE_KEY, refreshSnapshot, type MentorState, type MentorStorage, type ProfileState } from './mentorStorage.ts'

export interface LocalMentorOptions {
  referenceAt?: string
  storage?: MentorStorage | null
  createId?: () => string
}
// Deterministic serialization makes reordered object keys equivalent retries.
function canonical(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
}
function errorResult(error: unknown): ServiceResult<never> {
  if (error instanceof MentorError) return { ok: false, error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } }
  return { ok: false, error: { code: 'UNEXPECTED', message: 'No se pudo completar la acción. Conserva tus datos y vuelve a intentarlo.' } }
}
function browserStorage(): MentorStorage | null {
  if (typeof window === 'undefined') return null
  // Access errors are surfaced as UNEXPECTED, not silently committed in memory.
  return window.sessionStorage
}

/** Instantiable for contract tests and isolated sessions. No UI or navigation dependency. */
export function createLocalMentorService(options: LocalMentorOptions = {}) {
  let state: MentorState | undefined
  let storage: MentorStorage | null = null
  const id = options.createId ?? (() => crypto.randomUUID())
  function current(): MentorState {
    // Multiple adapters in the same tab share one source of truth, including revisions.
    if (state && storage && storage.getItem(MENTOR_STORAGE_KEY) !== null) state = loadMentorState(storage, state.clock.referenceAt)
    if (!state) {
      storage = options.storage === undefined ? browserStorage() : options.storage
      const legacyReference = storage?.getItem('vuelve-a-tu-ritmo:session-reference:v3')
      let referenceAt = options.referenceAt ?? new Date().toISOString()
      if (!options.referenceAt && legacyReference) {
        try { referenceAt = instant(legacyReference) } catch { /* Fresh reference for malformed legacy clock. */ }
      }
      state = loadMentorState(storage, instant(referenceAt))
    }
    return state
  }
  function commit(next: MentorState): void {
    if (storage) storage.setItem(MENTOR_STORAGE_KEY, JSON.stringify(next))
    state = next
  }
  function findProfile(s: MentorState, profileId: string): ProfileState {
    requireRule(typeof profileId === 'string' && Object.hasOwn(s.profiles, profileId), 'NOT_FOUND', 'No se encontró el perfil.')
    return s.profiles[profileId]
  }
  const snapshot = (p: ProfileState, s: MentorState) => refreshSnapshot(p, s.clock)
  async function read<T>(fn: (s: MentorState) => T): Promise<ServiceResult<T>> {
    try { const s = current(); return { ok: true, data: clone(fn(s)), revision: 0 } } catch (error) { return errorResult(error) }
  }
  async function command<T>(ctx: RequestContext, action: string, input: unknown, fn: (p: ProfileState, s: MentorState) => T): Promise<ServiceResult<T>> {
    try {
      requireRule(ctx && typeof ctx === 'object', 'VALIDATION', 'Falta el contexto de la acción.')
      text(ctx.requestId)
      const existing = current()
      const profile = findProfile(existing, ctx.profileId)
      const fingerprint = canonical({ action, input })
      const replay = profile.replays.find(r => r.requestId === ctx.requestId)
      if (replay) {
        requireRule(replay.fingerprint === fingerprint, 'CONFLICT', 'Este requestId ya se utilizó con otra acción o contenido.')
        return clone(replay.result) as ServiceResult<T>
      }
      if (ctx.expectedRevision !== undefined) requireRule(Number.isInteger(ctx.expectedRevision) && ctx.expectedRevision === profile.snapshot.revision, 'CONFLICT', 'El perfil cambió. Vuelve a consultar sus datos.')
      const draft = clone(existing)
      const p = findProfile(draft, ctx.profileId)
      p.snapshot = snapshot(p, draft)
      const before = canonical(p)
      p.snapshot.revision += 1
      const data = fn(p, draft)
      p.snapshot = snapshot(p, draft)
      const after = clone(p); after.snapshot.revision -= 1
      const changed = canonical(after) !== before
      const result: ServiceResult<T> = { ok: true, data: clone(data), revision: p.snapshot.revision }
      p.replays.push({ requestId: ctx.requestId, fingerprint, result: clone(result) })
      // Preview is stored for its response, but never counted as a contact/event.
      if ((changed || ['calculateProjection', 'compareProjections', 'reviewOption'].includes(action)) && !(action === 'presentInvitation' && (input as { mode: string }).mode === 'demo-preview')) draft.events.push({ id: id(), profileId: ctx.profileId, action, at: draft.clock.observedAt, origin: p.snapshot.progress.origin })
      commit(draft)
      return clone(result)
    } catch (error) { return errorResult(error) }
  }
  const change = (ctx: RequestContext, action: string, input: unknown, fn: (p: ProfileState, s: MentorState) => void) => command(ctx, action, input, (p, s) => { fn(p, s); return snapshot(p, s) })
  function owned<T extends { id: string }>(items: T[], key: string, label: string): T {
    const item = items.find(item => item.id === key)
    requireRule(item, 'NOT_FOUND', `No se encontró ${label} en este perfil.`)
    return item
  }
  function contactAllowed(p: ProfileState, s: MentorState, reminder = false): void {
    requireRule(!isPaused(p.snapshot, s.clock.observedAt), 'CONTACT_BLOCKED', 'Los contactos están suspendidos durante la pausa.')
    requireRule(p.snapshot.profile.accountStatus === 'active', 'CONTACT_BLOCKED', 'La cuenta no permite contactos del programa.')
    const prefs = p.snapshot.preferences
    requireRule(prefs.consentRecordedAt !== null && (!reminder || prefs.remindersAllowed), 'CONTACT_BLOCKED', 'Falta el permiso explícito para este contacto.')
    if (!reminder) requireRule(prefs.allowProgramInvitations && !p.snapshot.invitations.some(i => i.mode === 'simulated-contact' && i.status === 'declined'), 'CONTACT_BLOCKED', 'Las invitaciones están desactivadas o rechazadas.')
  }
  function cancelPending(p: ProfileState): void {
    for (const reminder of p.snapshot.reminders) if (reminder.status === 'scheduled') reminder.status = 'cancelled'
    for (const invitation of p.snapshot.invitations) invitation.requestedFollowupAt = null
  }
  function validateFuture(value: string, s: MentorState): string {
    const at = instant(value)
    requireRule(at > s.clock.observedAt, 'VALIDATION', 'Elige una fecha y hora futuras.')
    return at
  }
  function pauseInput(input: { endsAt: string | null; reason: string | null }, s: MentorState) {
    requireRule(input && typeof input === 'object', 'VALIDATION', 'Indica los datos de la pausa; usa null para los opcionales vacíos.')
    requireRule(input.endsAt !== undefined && input.reason !== undefined, 'VALIDATION', 'Los campos opcionales vacíos deben ser null.')
    return { endsAt: input.endsAt === null ? null : validateFuture(input.endsAt, s), reason: input.reason === null ? null : text(input.reason, 280) }
  }
  function compatibleIncentives(p: ProfileState, s: MentorState, configuration: ProjectionInput): Incentive[] {
    const seed = createDemoProfiles(new Date(s.clock.referenceAt)).find(seed => seed.id === p.snapshot.profile.id)!
    const profile = { ...seed, vehicle: p.snapshot.profile.vehicle, deliveries: p.snapshot.deliveries }
    return getApplicableIncentives(createDemoIncentives(new Date(s.clock.referenceAt)), profile, configuration, new Date(s.clock.observedAt), { incentiveEnrollments: p.enrollments, incentiveAwards: p.awards }).map(offer => ({
      id: offer.id, label: offer.title, amount: offer.reward.kind === 'money' ? offer.reward.amount : null, benefit: offer.reward.kind === 'benefit' ? offer.reward.description : null,
      validFrom: new Date(`${offer.startsOn}T00:00:00-05:00`).toISOString(), validUntil: new Date(`${offer.endsOn}T23:59:59.999-05:00`).toISOString(),
      zoneIds: MENTOR_ZONES.filter(z => offer.zones.includes(z.label)).map(z => z.id),
      requirements: [`${offer.requiredCompletedDeliveries} entregas completadas según las condiciones de la campaña.`, `Vehículo: ${offer.vehicles.join(', ')}.`, `Franja: ${offer.moments.join(', ')}.`],
      enrollmentRequired: offer.enrollmentRequired, status: offer.status, simulated: true, guaranteed: false,
    }))
  }
  function project(p: ProfileState, s: MentorState, input: ProjectionInput): Projection {
    const configuration = projectionInput(input, s.clock.observedAt)
    const result = calculateRange(configuration, SIMULATED_PROJECTION_RATES)
    if (!result) return { status: 'unavailable', configuration, reason: 'missing-data', message: 'No hay datos simulados para esta combinación. La consulta no reserva un turno ni te conecta.', simulated: true }
    const projection: Projection = {
      status: 'available', id: id(), profileId: p.snapshot.profile.id, configuration, result, currency: 'PEN', referenceAt: s.clock.observedAt, tableVersion: 'demo-rates-v1',
      assumptions: ['Tabla fija ficticia; no garantiza pedidos ni ingresos.', 'La zona elegida es una preferencia de simulación: no limita ni garantiza los pedidos recibidos.', 'Consultar esta estimación no reserva un turno ni conecta al repartidor.', 'Se restan únicamente los gastos ingresados para esta salida.', 'Los incentivos se presentan por separado y no se suman al rango.', ...projectionGoalAssumptions(p.snapshot)],
      incentives: compatibleIncentives(p, s, configuration), simulated: true, guaranteed: false,
    }
    p.projections[projection.id] = projection
    return projection
  }
  function availableProjection(p: ProfileState, key: string): Extract<Projection, { status: 'available' }> {
    const projection = Object.hasOwn(p.projections, key) ? p.projections[key] : undefined
    requireRule(projection?.status === 'available', 'NOT_FOUND', 'No se encontró una proyección disponible en este perfil.')
    return projection
  }
  function usable(p: ProfileState): void {
    requireRule(p.snapshot.profile.accountStatus === 'active' && (p.snapshot.eligibility.eligible || p.snapshot.progress.eligibleAtStart), 'NOT_ELIGIBLE', 'Este perfil no puede iniciar la reactivación.')
  }

  const service: MentorService = {
    async getProfile(profileId) {
      try { const s = current(); const data = snapshot(findProfile(s, profileId), s); return { ok: true, data, revision: data.revision } } catch (error) { return errorResult(error) }
    },
    listProfiles: () => read(s => Object.values(s.profiles).map(p => snapshot(p, s).profile)),
    getCatalog: () => read(() => ({ zones: clone(MENTOR_ZONES), vehicles: ['Bicicleta', 'Moto', 'Auto'] })),
    exploreRoute: query => read(() => exploreDemoRoute(query)),
    startProgram: (ctx, input) => change(ctx, 'startProgram', input, (p, s) => {
      requireRule(['app', 'external'].includes(input.origin), 'VALIDATION', 'Elige un origen válido.')
      usable(p)
      if (!p.snapshot.progress.interventionStartedAt) {
        p.snapshot.progress.interventionStartedAt = s.clock.observedAt
        p.snapshot.progress.eligibleAtStart = p.snapshot.eligibility.eligible
        p.snapshot.progress.origin = input.origin
      }
      for (const invitation of p.snapshot.invitations) invitation.requestedFollowupAt = null
    }),
    updateProgress: (ctx, input) => change(ctx, 'updateProgress', input, (p, s) => {
      if (input.step !== undefined) { requireRule(['configuration', 'projection', 'decision'].includes(input.step), 'VALIDATION', 'Paso inválido.'); p.snapshot.progress.step = input.step }
      if (input.configuration !== undefined) {
        p.snapshot.progress.configuration = projectionInput(input.configuration, s.clock.observedAt)
        p.snapshot.progress.currentProjection = null
        if (input.step === undefined) p.snapshot.progress.step = 'configuration'
      }
      if (input.need !== undefined) { requireRule(input.need === null || ['savings', 'time', 'payment-order', 'personal-vehicle', 'other', 'skipped'].includes(input.need), 'VALIDATION', 'Necesidad inválida.'); p.snapshot.progress.need = input.need }
      if (input.otherNeedDetail !== undefined) { requireRule(typeof input.otherNeedDetail === 'string' && input.otherNeedDetail.length <= 280, 'VALIDATION', 'El detalle admite hasta 280 caracteres.'); p.snapshot.progress.otherNeedDetail = input.otherNeedDetail.trim() }
    }),
    calculateProjection: (ctx, input) => command(ctx, 'calculateProjection', input, (p, s) => {
      const projection = project(p, s, input)
      p.snapshot.progress.configuration = projection.configuration
      p.snapshot.progress.currentProjection = projection
      p.snapshot.progress.step = 'projection'
      return projection
    }),
    compareProjections: (ctx, input) => command(ctx, 'compareProjections', input, (p, s) => {
      const first = project(p, s, input.first)
      const second = project(p, s, input.second)
      p.snapshot.progress.comparisonConfiguration = clone(second.configuration)
      return { first, second }
    }),
    saveOption: (ctx, input) => change(ctx, 'saveOption', input, (p, s) => {
      const projection = availableProjection(p, input.projectionId)
      const old = input.optionId === undefined ? null : owned(p.snapshot.savedOptions, input.optionId, 'la opción')
      if (old?.reminderId) { const reminder = owned(p.snapshot.reminders, old.reminderId, 'el recordatorio'); if (reminder.status === 'scheduled') reminder.status = 'cancelled' }
      const option = { id: old?.id ?? id(), profileId: ctx.profileId, configuration: clone(projection.configuration), projectionId: projection.id, referenceAt: projection.referenceAt, tableVersion: projection.tableVersion, savedAt: old?.savedAt ?? s.clock.observedAt, updatedAt: s.clock.observedAt, reminderId: null, isReservation: false as const }
      if (old) Object.assign(old, option); else p.snapshot.savedOptions.push(option)
    }),
    reviewOption: (ctx, input) => command(ctx, 'reviewOption', input, (p, s) => {
      const option = owned(p.snapshot.savedOptions, input.optionId, 'la opción')
      const projection = project(p, s, configurationForReview(option.configuration, new Date(s.clock.observedAt)))
      if (canonical(option.configuration) !== canonical(projection.configuration) && option.reminderId) {
        const reminder = owned(p.snapshot.reminders, option.reminderId, 'el recordatorio')
        if (reminder.status === 'scheduled') reminder.status = 'cancelled'
        option.reminderId = null
      }
      option.configuration = clone(projection.configuration)
      option.updatedAt = s.clock.observedAt
      if (projection.status === 'available') { option.projectionId = projection.id; option.referenceAt = projection.referenceAt; option.tableVersion = projection.tableVersion; option.updatedAt = s.clock.observedAt }
      return { option: clone(option), projection }
    }),
    deleteOption: (ctx, input) => change(ctx, 'deleteOption', input, p => {
      owned(p.snapshot.savedOptions, input.optionId, 'la opción')
      p.snapshot.savedOptions = p.snapshot.savedOptions.filter(o => o.id !== input.optionId)
      p.snapshot.reminders = p.snapshot.reminders.filter(r => r.savedOptionId !== input.optionId)
    }),
    saveGoal: (ctx, input) => change(ctx, 'saveGoal', input, (p, s) => {
      const old = input.goalId === undefined ? null : owned(p.snapshot.goals, input.goalId, 'la meta')
      const name = text(input.name)
      const targetAmount = money(input.targetAmount, true)
      const targetDate = input.targetDate === null ? null : localDate(input.targetDate)
      // An expired deadline must not prevent correcting the existing goal.
      // A newly chosen deadline still follows the existing date validation.
      requireRule(targetDate === null || targetDate === old?.targetDate || targetDate >= dateInLima(new Date(s.clock.observedAt)), 'VALIDATION', 'Un nuevo plazo de meta no puede estar en el pasado.')
      requireRule(old !== null || !p.snapshot.goals.some(g => g.status === 'active'), 'CONFLICT', 'Archiva o completa la meta activa antes de crear otra.')
      if (old) Object.assign(old, { name, targetAmount, targetDate, updatedAt: s.clock.observedAt })
      else p.snapshot.goals.push({ id: id(), profileId: ctx.profileId, name, targetAmount, targetDate, status: 'active', createdAt: s.clock.observedAt, updatedAt: s.clock.observedAt })
    }),
    changeGoalStatus: (ctx, input) => change(ctx, 'changeGoalStatus', input, (p, s) => {
      requireRule(['active', 'completed', 'archived'].includes(input.status), 'VALIDATION', 'Estado de meta inválido.')
      const goal = owned(p.snapshot.goals, input.goalId, 'la meta')
      requireRule(input.status !== 'active' || !p.snapshot.goals.some(g => g.id !== goal.id && g.status === 'active'), 'CONFLICT', 'Ya existe una meta activa.')
      goal.status = input.status; goal.updatedAt = s.clock.observedAt
    }),
    saveContribution: (ctx, input) => change(ctx, 'saveContribution', input, (p, s) => {
      owned(p.snapshot.goals, input.goalId, 'la meta')
      const amount = money(input.amount, true)
      const contributedOn = localDate(input.contributedOn)
      requireRule(contributedOn <= dateInLima(new Date(s.clock.observedAt)), 'VALIDATION', 'El aporte no puede tener fecha futura.')
      const old = input.contributionId === undefined ? null : owned(p.snapshot.contributions, input.contributionId, 'el aporte')
      requireRule(!old || old.goalId === input.goalId, 'CONFLICT', 'El aporte pertenece a otra meta.')
      const total = p.snapshot.contributions.filter(c => c.goalId === input.goalId && c.id !== old?.id).reduce((sum, c) => sum + Math.round(c.amount * 100), 0) + Math.round(amount * 100)
      requireRule(Number.isSafeInteger(total), 'VALIDATION', 'El total de aportes excede el rango admitido.')
      if (old) Object.assign(old, { amount, contributedOn, updatedAt: s.clock.observedAt })
      else p.snapshot.contributions.push({ id: id(), profileId: ctx.profileId, goalId: input.goalId, amount, contributedOn, source: 'manual', createdAt: s.clock.observedAt, updatedAt: s.clock.observedAt })
    }),
    deleteContribution: (ctx, input) => change(ctx, 'deleteContribution', input, p => {
      owned(p.snapshot.contributions, input.contributionId, 'el aporte')
      p.snapshot.contributions = p.snapshot.contributions.filter(c => c.id !== input.contributionId)
    }),
    activatePause: (ctx, input) => change(ctx, 'activatePause', input, (p, s) => {
      requireRule(!isPaused(p.snapshot, s.clock.observedAt), 'CONFLICT', 'Ya existe una pausa activa. Puedes editarla.')
      p.snapshot.pause = { id: id(), profileId: ctx.profileId, startedAt: s.clock.observedAt, status: 'active', ...pauseInput(input, s) }
      cancelPending(p)
    }),
    updatePause: (ctx, input) => change(ctx, 'updatePause', input, (p, s) => {
      requireRule(input && typeof input === 'object', 'VALIDATION', 'Indica la pausa que deseas editar.')
      requireRule(p.snapshot.pause?.id === input.pauseId, 'NOT_FOUND', 'No se encontró la pausa en este perfil.')
      requireRule(isPaused(p.snapshot, s.clock.observedAt), 'CONFLICT', 'La pausa ya terminó.')
      Object.assign(p.snapshot.pause, pauseInput(input, s))
      cancelPending(p)
    }),
    endPause: (ctx, input) => change(ctx, 'endPause', input, p => {
      requireRule(input && typeof input === 'object', 'VALIDATION', 'Indica la pausa que deseas terminar.')
      requireRule(p.snapshot.pause?.id === input.pauseId, 'NOT_FOUND', 'No se encontró la pausa en este perfil.')
      if (p.snapshot.pause.status === 'active') p.snapshot.pause.status = 'ended'
    }),
    updatePreferences: (ctx, input) => change(ctx, 'updatePreferences', input, (p, s) => {
      requireRule(input && typeof input.allowProgramInvitations === 'boolean' && typeof input.remindersAllowed === 'boolean' && input.channels && typeof input.channels.app === 'boolean' && typeof input.channels.external === 'boolean', 'VALIDATION', 'Preferencias inválidas.')
      const consentRecordedAt = input.consentRecordedAt === null ? null : instant(input.consentRecordedAt)
      requireRule(consentRecordedAt === null || consentRecordedAt <= s.clock.observedAt, 'VALIDATION', 'El consentimiento no puede estar en el futuro.')
      p.snapshot.preferences = { allowProgramInvitations: input.allowProgramInvitations, channels: clone(input.channels), remindersAllowed: input.remindersAllowed, consentRecordedAt }
      if (!input.remindersAllowed || consentRecordedAt === null) for (const reminder of p.snapshot.reminders) if (reminder.status === 'scheduled') reminder.status = 'cancelled'
      for (const invitation of p.snapshot.invitations) if (!input.allowProgramInvitations || !input.channels[invitation.origin] || consentRecordedAt === null || isPaused(p.snapshot, s.clock.observedAt)) invitation.requestedFollowupAt = null
    }),
    presentInvitation: (ctx, input) => change(ctx, 'presentInvitation', input, (p, s) => {
      const campaignId = text(input.campaignId)
      requireRule(['app', 'external'].includes(input.origin) && ['demo-preview', 'simulated-contact'].includes(input.mode), 'VALIDATION', 'Invitación inválida.')
      // Reopening a record is not authorization to generate a new contact.
      // Keep its decision visible even after rejection, pause, start or return.
      const existing = p.snapshot.invitations.find(i => i.campaignId === campaignId && i.mode === input.mode && i.origin === input.origin)
      if (existing) return
      if (input.mode === 'simulated-contact') {
        requireRule(p.snapshot.eligibility.eligible, 'NOT_ELIGIBLE', 'No hay campaña preventiva acordada ni reactivación disponible para este perfil.')
        contactAllowed(p, s)
        requireRule(!p.snapshot.progress.interventionStartedAt, 'CONTACT_BLOCKED', 'El programa ya comenzó.')
        requireRule(p.snapshot.preferences.channels[input.origin], 'CONTACT_BLOCKED', 'El canal está desactivado.')
        requireRule(!p.snapshot.invitations.some(i => i.mode === 'simulated-contact' && i.campaignId === campaignId), 'CONTACT_BLOCKED', 'La campaña ya tiene un contacto registrado.')
      }
      p.snapshot.invitations.push({ id: id(), profileId: ctx.profileId, campaignId, origin: input.origin, track: 'reactivation', mode: input.mode, status: 'pending', presentedAt: input.mode === 'simulated-contact' ? s.clock.observedAt : null, respondedAt: null, requestedFollowupAt: null })
    }),
    respondInvitation: (ctx, input) => change(ctx, 'respondInvitation', input, (p, s) => {
      const invitation = owned(p.snapshot.invitations, input.invitationId, 'la invitación')
      requireRule(['options', 'later', 'decline'].includes(input.response), 'VALIDATION', 'Respuesta inválida.')
      requireRule(input.requestedFollowupAt !== undefined, 'VALIDATION', 'Sin contacto solicitado, usa null.')
      requireRule(invitation.mode === 'simulated-contact', 'CONFLICT', 'La vista previa no registra respuestas ni preferencias.')
      requireRule(invitation.status !== 'expired', 'CONFLICT', 'Esta invitación ya no está disponible.')
      requireRule(invitation.status === 'pending', 'CONFLICT', 'La invitación ya fue respondida. Consulta su estado actual.')
      requireRule(input.response === 'later' || input.requestedFollowupAt === null, 'VALIDATION', 'Solo Más adelante admite un contacto solicitado.')
      if (input.requestedFollowupAt !== null) {
        contactAllowed(p, s)
        requireRule(p.snapshot.preferences.channels[invitation.origin] && !p.snapshot.progress.interventionStartedAt, 'CONTACT_BLOCKED', 'Este canal o flujo no permite otro contacto.')
        invitation.requestedFollowupAt = validateFuture(input.requestedFollowupAt, s)
      } else invitation.requestedFollowupAt = null
      invitation.status = input.response === 'options' ? 'opened' : input.response === 'decline' ? 'declined' : 'later'
      invitation.respondedAt = s.clock.observedAt
      if (input.response === 'decline') {
        p.snapshot.preferences.allowProgramInvitations = false
        for (const item of p.snapshot.invitations) item.requestedFollowupAt = null
      }
    }),
    scheduleReminder: (ctx, input) => change(ctx, 'scheduleReminder', input, (p, s) => {
      requireRule(input && typeof input === 'object', 'VALIDATION', 'Indica la opción, fecha y confirmación del recordatorio.')
      requireRule(input.explicitConsent === true, 'VALIDATION', 'El recordatorio requiere consentimiento explícito.')
      contactAllowed(p, s, true)
      const option = owned(p.snapshot.savedOptions, input.savedOptionId, 'la opción')
      const scheduledAt = validateFuture(input.scheduledAt, s)
      const old = input.reminderId === undefined ? null : owned(p.snapshot.reminders, input.reminderId, 'el recordatorio')
      requireRule(!old || old.savedOptionId === option.id, 'CONFLICT', 'El recordatorio pertenece a otra opción.')
      requireRule(!old || old.status === 'scheduled', 'CONFLICT', 'Crea un nuevo recordatorio para esta opción.')
      if (option.reminderId && option.reminderId !== old?.id) {
        const previous = owned(p.snapshot.reminders, option.reminderId, 'el recordatorio')
        if (previous.status === 'scheduled') previous.status = 'cancelled'
      }
      const reminder = { id: old?.id ?? id(), profileId: ctx.profileId, savedOptionId: option.id, scheduledAt, timeZone: 'America/Lima' as const, requestedAt: s.clock.observedAt, status: 'scheduled' as const, executedAt: null, simulated: true as const }
      if (old) Object.assign(old, reminder); else p.snapshot.reminders.push(reminder)
      option.reminderId = reminder.id
    }),
    cancelReminder: (ctx, input) => change(ctx, 'cancelReminder', input, p => {
      requireRule(input && typeof input === 'object', 'VALIDATION', 'Indica el recordatorio que deseas cancelar.')
      const reminder = owned(p.snapshot.reminders, input.reminderId, 'el recordatorio')
      if (reminder.status === 'scheduled') reminder.status = 'cancelled'
    }),
    requestHelp: (ctx, input) => change(ctx, 'requestHelp', input, (p, s) => {
      requireRule(input && typeof input === 'object', 'VALIDATION', 'Indica el caso para el que deseas ayuda.')
      const supportCase = owned(p.snapshot.cases, input.caseId, 'el caso')
      requireRule(supportCase.status !== 'resolved', 'CONFLICT', 'Este caso ya figura resuelto.')
      if (!p.snapshot.helpRequests.some(r => r.caseId === supportCase.id)) p.snapshot.helpRequests.push({ id: id(), profileId: ctx.profileId, caseId: supportCase.id, requestedAt: s.clock.observedAt, simulated: true })
    }),
    confirmConnection: (ctx, input) => change(ctx, 'confirmConnection', input, (p, s) => {
      requireRule(input.explicitConsent === true, 'VALIDATION', 'La conexión requiere confirmación explícita.')
      requireRule(p.snapshot.profile.accountStatus === 'active', 'NOT_ELIGIBLE', 'La cuenta está bloqueada.')
      if (p.snapshot.progress.connectedAt === null) p.snapshot.progress.connectedAt = s.clock.observedAt
    }),
    disconnect: ctx => change(ctx, 'disconnect', null, p => { p.snapshot.progress.connectedAt = null }),
    recordReturnFeedback: (ctx, input) => change(ctx, 'recordReturnFeedback', input, (p, s) => {
      const progress = p.snapshot.progress
      const result = getReturnResult(p.snapshot.deliveries, { interventionStartedAt: progress.interventionStartedAt, observedAt: s.clock.observedAt, feedback: progress.returnFeedback })
      requireRule(progress.eligibleAtStart && result && progress.returnedAt === result.returnedAt && progress.returnDeliveryId === result.deliveryId, 'CONFLICT', 'Todavía no hay una entrega de regreso.')
      requireRule(input && typeof input === 'object', 'VALIDATION', 'Indica una valoración o elige omitirla.')
      requireRule(['good', 'mixed', 'problem', 'skipped'].includes(input.feedback), 'VALIDATION', 'Valoración inválida.')
      p.snapshot.progress.returnFeedback = input.feedback
    }),
    enrollIncentive: (ctx, input) => change(ctx, 'enrollIncentive', input, (p, s) => {
      const projection = availableProjection(p, input.projectionId)
      const incentives = compatibleIncentives(p, s, projectionInput(projection.configuration, s.clock.observedAt))
      const incentive = owned(incentives, input.incentiveId, 'el incentivo')
      requireRule(incentive.enrollmentRequired, 'CONFLICT', 'Este incentivo no requiere inscripción.')
      requireRule(incentive.validFrom <= s.clock.observedAt && incentive.validUntil >= s.clock.observedAt, 'CONFLICT', 'La inscripción no está vigente.')
      if (incentive.status === 'available') p.enrollments[incentive.id] = s.clock.observedAt
      for (const saved of Object.values(p.projections)) if (saved.status === 'available') saved.incentives = compatibleIncentives(p, s, saved.configuration)
      if (p.snapshot.progress.currentProjection?.status === 'available') p.snapshot.progress.currentProjection.incentives = compatibleIncentives(p, s, p.snapshot.progress.currentProjection.configuration)
    }),
  }
  const admin: DemoAdminService = {
    async resetProfile(profileId) {
      try {
        const existing = current(); const previous = findProfile(existing, profileId)
        const draft = clone(existing)
        draft.profiles[profileId] = createMentorState(existing.clock.referenceAt).profiles[profileId]
        draft.profiles[profileId].snapshot.revision = previous.snapshot.revision + 1
        draft.events = draft.events.filter(e => e.profileId !== profileId)
        const data = snapshot(draft.profiles[profileId], draft)
        commit(draft)
        return { ok: true, data, revision: data.revision }
      } catch (error) { return errorResult(error) }
    },
    async resetDemo() {
      try {
        const existing = current(); const draft = createMentorState(existing.clock.referenceAt)
        for (const [profileId, p] of Object.entries(draft.profiles)) p.snapshot.revision = existing.profiles[profileId].snapshot.revision + 1
        const data = snapshot(draft.profiles['inactive-recent'], draft)
        commit(draft)
        return { ok: true, data, revision: data.revision }
      } catch (error) { return errorResult(error) }
    },
    registerDelivery: (ctx, input) => change(ctx, 'registerDelivery', input, (p, s) => {
      const deliveryId = text(input.id)
      const completedAt = instant(input.completedAt)
      requireRule(['completed', 'cancelled'].includes(input.status), 'VALIDATION', 'Estado de entrega inválido.')
      const existing = p.snapshot.deliveries.find(d => d.id === deliveryId)
      if (existing) { requireRule(existing.status === input.status && existing.completedAt === completedAt, 'CONFLICT', 'La entrega ya existe con otro contenido.'); return }
      requireRule(p.snapshot.profile.accountStatus === 'active', 'NOT_ELIGIBLE', 'No se registran entregas nuevas para una cuenta bloqueada.')
      requireRule(completedAt <= s.clock.observedAt, 'VALIDATION', 'Avanza primero el reloj: no se registran entregas futuras.')
      p.snapshot.deliveries.push({ id: deliveryId, profileId: ctx.profileId, status: input.status, completedAt, simulated: true })
      const progress = p.snapshot.progress
      if (progress.eligibleAtStart && progress.interventionStartedAt && input.status === 'completed' && completedAt > progress.interventionStartedAt) {
        const first = p.snapshot.deliveries.filter(d => d.status === 'completed' && d.completedAt > progress.interventionStartedAt!).sort((a, b) => a.completedAt.localeCompare(b.completedAt))[0]
        progress.returnedAt = first.completedAt; progress.returnDeliveryId = first.id
      }
    }),
    setCaseStatus: (ctx, input) => change(ctx, 'setCaseStatus', input, (p, s) => {
      requireRule(['pending', 'in-review', 'resolved'].includes(input.status), 'VALIDATION', 'Estado de soporte inválido.')
      const supportCase = owned(p.snapshot.cases, input.caseId, 'el caso')
      supportCase.status = input.status; supportCase.updatedAt = s.clock.observedAt
    }),
    executeReminder: (ctx, input) => change(ctx, 'executeReminder', input, (p, s) => {
      const reminder = owned(p.snapshot.reminders, input.reminderId, 'el recordatorio')
      if (reminder.status !== 'scheduled') return
      requireRule(reminder.scheduledAt <= s.clock.observedAt, 'VALIDATION', 'El recordatorio todavía no vence.')
      owned(p.snapshot.savedOptions, reminder.savedOptionId, 'la opción')
      try { contactAllowed(p, s, true) } catch (error) { if (error instanceof MentorError && error.code === 'CONTACT_BLOCKED') { reminder.status = 'blocked'; return } throw error }
      reminder.status = 'executed'; reminder.executedAt = s.clock.observedAt
    }),
    async advanceClock(input) {
      try {
        const observedAt = instant(input.observedAt)
        const existing = current()
        requireRule(observedAt >= existing.clock.observedAt, 'VALIDATION', 'El reloj no puede retroceder.')
        if (observedAt === existing.clock.observedAt) return { ok: true, data: clone(existing.clock), revision: Math.max(...Object.values(existing.profiles).map(p => p.snapshot.revision)) }
        const draft = clone(existing); draft.clock.observedAt = observedAt
        for (const p of Object.values(draft.profiles)) {
          p.snapshot.revision += 1
          p.snapshot = snapshot(p, draft)
          for (const invitation of p.snapshot.invitations) if (invitation.requestedFollowupAt !== null && (isPaused(p.snapshot, observedAt) || !p.snapshot.preferences.allowProgramInvitations || !p.snapshot.preferences.channels[invitation.origin] || p.snapshot.preferences.consentRecordedAt === null || p.snapshot.progress.interventionStartedAt !== null)) invitation.requestedFollowupAt = null
        }
        commit(draft)
        return { ok: true, data: clone(draft.clock), revision: Math.max(...Object.values(draft.profiles).map(p => p.snapshot.revision)) }
      } catch (error) { return errorResult(error) }
    },
  }
  // Supplemental, B-owned operations reader; does not extend/change MentorService.
  const getOperations = () => read(s => ({ clock: s.clock, profiles: Object.values(s.profiles).map(p => snapshot(p, s)), events: s.events, legacyGoalNames: Object.fromEntries(Object.entries(s.profiles).map(([key, p]) => [key, p.legacyGoalNames])) }))
  return { service, admin, getOperations }
}

const local = createLocalMentorService()
export const localMentorService: MentorService = local.service
export const localDemoAdminService: DemoAdminService = local.admin
export const getMentorOperations = local.getOperations

// Preserve the B-01 read-only adapter for existing callers and demo scripts.
export { createMentorProfileService, localMentorProfileService } from './mentor.profile.ts'
export type { MentorProfileDependencies } from './mentor.profile.ts'
