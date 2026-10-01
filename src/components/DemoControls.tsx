import { getReturnResult, type ReturnTracking } from '../domain/returnTracking'
import type { DeliveryRecord, PauseBand } from '../domain/eligibility'
import { reminderLabel } from './ReminderEditor'
import { reminderService } from '../services/reminderService'
import { supportStatusLabels, type SupportData, type SupportStatus } from '../domain/support'
import type { DemoProfile } from '../data/demoProfiles'
import type { DemoPreferences } from '../services/demoStorage'
import { Icon } from './Icon'
import { DemoGoalsEditor } from './DemoGoalsEditor'
import { DEMO_REFERENCE_DATE } from '../services/demoClock'

const zones = ['Lima Centro', 'Miraflores', 'Surco', 'San Miguel', 'Jesús María']
const hourOptions = Array.from({ length: 12 }, (_, index) => index + 1)
const moments = ['Mañana', 'Tarde', 'Noche']

export interface DemoControlsProps {
  returnTracking: ReturnTracking
  deliveryHistory: DeliveryRecord[]
  onAddDemoDelivery: (status: 'completed' | 'cancelled') => void
  supportData: SupportData
  onSupportStatus: (id: string, status: SupportStatus) => void
  profile: DemoProfile
  profiles: DemoProfile[]
  goals: string[]
  onGoalsChange: (goals: string[]) => void
  preferences: DemoPreferences
  pauseBand: PauseBand | null
  deliveryCount: number
  resetMessage: string
  invitationHint: string
  priority: 1 | 2 | 3 | null
  canOpenProgram: boolean
  currentScreen: string
  onProfileChange: (id: string) => void
  onPreferencesChange: (preferences: DemoPreferences) => void
  onResetDemo: () => void
  isEligible: boolean
  daysInactive: number | null
  onResetProfile: () => void
  onPreviewInvitation: () => void
  onShowHome: () => void
  onOpenProgram: () => void
}

const formatDate = (date: string | Date) => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(typeof date === 'string' ? new Date(date) : date)

export function DemoControls({ returnTracking, deliveryHistory, onAddDemoDelivery, supportData, onSupportStatus, profile, profiles, goals, onGoalsChange, preferences, pauseBand, deliveryCount, resetMessage, invitationHint, priority, canOpenProgram, currentScreen, onProfileChange, onPreferencesChange, onResetProfile, onResetDemo, isEligible, daysInactive, onPreviewInvitation, onShowHome, onOpenProgram }: DemoControlsProps) {
  const returned = getReturnResult(deliveryHistory, returnTracking)
  const reminders = preferences.savedProposals.filter(item => item.reminder)

  return <section className="demo-controls" aria-labelledby="demo-controls-heading">
    <div className="demo-controls-heading"><span className="sidebar-eyebrow">PARA PRESENTAR</span><h2 id="demo-controls-heading">Prueba cada escenario</h2><p>Elige un perfil y usa los botones para ver qué ocurre en el celular.</p><p className="sidebar-reference">Referencia de esta sesión: {formatDate(DEMO_REFERENCE_DATE)} · Hora de Lima (UTC−5).</p></div>

    <div className="sidebar-profile">
      <label className="demo-control-label" htmlFor="demo-profile">Perfil de demostración</label>
      <select id="demo-profile" className="demo-profile-select" value={profile.id} onChange={event => onProfileChange(event.target.value)}>
        {profiles.map(item => <option key={item.id} value={item.id}>{item.scenario} · {item.name}</option>)}
      </select>
      <div className="sidebar-profile-summary"><span className="sidebar-avatar">{profile.initials}</span><div><strong>{profile.name}</strong><span>{profile.vehicle} · {profile.zone}</span></div></div>
      <span className={`sidebar-profile-state ${profile.accountStatus === 'blocked' ? 'blocked' : canOpenProgram ? 'available' : ''}`}>{profile.accountStatus === 'blocked' ? 'Cuenta bloqueada' : canOpenProgram ? 'Programa disponible' : 'Sin propuesta de reactivación'}</span>
      {profile.declaredPause && <div className="sidebar-declared-pause"><strong>Pausa declarada por este perfil</strong><p>“{profile.declaredPause.note}”</p><small>Declarada el {formatDate(profile.declaredPause.declaredAt)}, hora de Lima. Es una declaración simulada; no se deduce de los días sin entregas.</small><p>{preferences.allowProgramInvitations ? 'Invitaciones activadas voluntariamente en esta sesión.' : 'Invitaciones desactivadas. Puede revisar el programa voluntariamente desde el menú.'}</p></div>}
      {priority && <p className="sidebar-priority">Prioridad {priority} del piloto · {pauseBand}<small>Orienta la atención; no da prioridad de pedidos ni supone un motivo de pausa.</small></p>}
    </div>

    <section className="sidebar-section" aria-labelledby="demo-navigation-heading">
      <h2 id="demo-navigation-heading">Mostrar en el celular</h2>
      <div className="sidebar-screen-actions">
        <button type="button" className={`sidebar-action ${['home', 'demo-controls'].includes(currentScreen) ? 'selected' : ''}`} aria-pressed={['home', 'demo-controls'].includes(currentScreen)} onClick={onShowHome}><Icon name="home" /><span><strong>Ver inicio del repartidor</strong><small>Entrada desde Soy Rappi</small></span><Icon name="chevron" /></button>
        <button type="button" className={`sidebar-action ${['invitation', 'invitation-preview'].includes(currentScreen) ? 'selected' : ''}`} aria-pressed={['invitation', 'invitation-preview'].includes(currentScreen)} onClick={onPreviewInvitation} aria-label="Vista previa de invitación externa"><Icon name="chat" /><span><strong>Ver invitación externa</strong><small>Vista tipo WhatsApp · Sin envío real</small></span><Icon name="chevron" /></button>
        <button type="button" className={`sidebar-action ${currentScreen === 'program' ? 'selected' : ''}`} aria-pressed={currentScreen === 'program'} disabled={!canOpenProgram} onClick={onOpenProgram} aria-label="Abrir simulador"><Icon name="calendar" /><span><strong>Ver programa</strong><small>Continuar con la estimación</small></span><Icon name="chevron" /></button>
      </div>
      <p className="sidebar-hint">{invitationHint}</p>
    </section>

    <fieldset className="demo-delivery-controls sidebar-section">
      <legend>Simular una entrega</legend>
      <p>Una entrega completada después de entrar al programa registra el regreso.</p>
      <div className="sidebar-delivery-actions">
        <button type="button" className="sidebar-complete" disabled={profile.accountStatus !== 'active'} onClick={() => onAddDemoDelivery('completed')} aria-label="Agregar entrega completada (simulada)"><Icon name="clipboard" />Completar entrega</button>
        <button type="button" disabled={profile.accountStatus !== 'active'} onClick={() => onAddDemoDelivery('cancelled')} aria-label="Agregar entrega cancelada (simulada)">Cancelar entrega</button>
      </div>
      <p className={`sidebar-return-state ${returned ? 'returned' : ''}`} role="status"><span />{returned ? 'Reactivación registrada · Entrega completada posterior al inicio' : 'Sin reactivación registrada'}</p>
      <details className="sidebar-history"><summary>Ver historial de entregas ({deliveryCount})</summary>
        <p>{returnTracking.interventionStartedAt ? 'Inicio del programa: ' + formatDate(returnTracking.interventionStartedAt) + ', hora de Lima.' : 'Este perfil todavía no tiene un inicio de intervención registrado.'}</p>
        <ul>{[...deliveryHistory].sort((a,b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)).map(item => <li key={item.id}>{item.id} · {item.status === 'completed' ? 'Completada' : 'Cancelada'} · {formatDate(item.completedAt)}, Lima</li>)}</ul>
        <p>Cada entrega avanza un minuto la línea de tiempo simulada de este perfil.</p>
      </details>
    </fieldset>

    <div className="sidebar-advanced">
      <details className="sidebar-disclosure">
        <summary><Icon name="pin" /><span>Metas del perfil</span><span className="sidebar-count">{goals.length}</span></summary>
        <DemoGoalsEditor key={profile.id} name={profile.name.split(' ')[0]} goals={goals} onChange={onGoalsChange} />
      </details>
      <details className="sidebar-disclosure">
        <summary><Icon name="help" /><span>Cambiar estado de un caso</span></summary>
        <fieldset className="demo-support-controls"><legend>Casos simulados de soporte</legend><p>Abrir un caso o pedir ayuda no lo resuelve. Puedes cambiar su estado aquí.</p>
          {supportData.cases.length ? supportData.cases.map(item => <label key={item.id} htmlFor={'demo-case-' + item.id}><span>{item.id} · {item.description}</span><select id={'demo-case-' + item.id} value={item.status} onChange={event => onSupportStatus(item.id, event.target.value as SupportStatus)}>{Object.entries(supportStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>) : <p>Este perfil no tiene casos simulados.</p>}
        </fieldset>
      </details>
      <details className="sidebar-disclosure">
        <summary><Icon name="bell" /><span>Ejecutar un recordatorio</span><span className="sidebar-count">{reminders.length}</span></summary>
        <fieldset className="demo-reminder-controls"><legend>Recordatorios simulados</legend><p>Se ejecutan en la fecha elegida, en Hora de Lima. No envían una notificación al teléfono ni cambian la fecha global.</p>
          {reminders.length ? reminders.map(item => <article key={item.id}><strong>{item.zone} · {item.hours} h</strong><p>{reminderLabel(item.reminder!.scheduledAt)}</p>{item.reminder!.status === 'scheduled' ? <button type="button" onClick={() => onPreferencesChange(reminderService.simulateExecution(preferences, item.id))}>Simular ejecución del recordatorio</button> : <p role="status">Ejecutado en la demo · No se envió una notificación real.</p>}</article>) : <p>No hay recordatorios para este perfil.</p>}
        </fieldset>
      </details>
      <details className="sidebar-disclosure">
        <summary><Icon name="user" /><span>Ver datos y preferencias</span></summary>
        <dl className="demo-profile-facts">
          <div><dt>Identificador</dt><dd>{profile.id.toUpperCase()}</dd></div><div><dt>Nombre ficticio</dt><dd>{profile.name}</dd></div><div><dt>Vehículo</dt><dd>{profile.vehicle}</dd></div><div><dt>Zona</dt><dd>{profile.zone}</dd></div>
          <div><dt>Última entrega</dt><dd>{profile.lastDeliveryAt ? formatDate(profile.lastDeliveryAt) : 'Sin entregas previas'}</dd></div><div><dt>Días sin completar entregas</dt><dd>{daysInactive ?? (profile.lastDeliveryAt ? Math.floor((DEMO_REFERENCE_DATE.getTime() - Date.parse(profile.lastDeliveryAt)) / 86400000) : 'Sin entregas previas')}</dd></div><div><dt>Tramo desde última entrega</dt><dd>{pauseBand ?? 'Sin entregas completadas'}</dd></div><div><dt>Estado de cuenta</dt><dd>{profile.accountStatus === 'blocked' ? 'Bloqueada' : 'Habilitada'}</dd></div><div><dt>Historial guardado</dt><dd>{deliveryCount} entregas</dd></div>
        </dl>
        <fieldset className="demo-preferences"><legend>Preferencias guardadas para este perfil</legend>
          <label>Zona<select value={preferences.zone} onChange={event => onPreferencesChange({ ...preferences, zone: event.target.value })}>{zones.map(zone => <option key={zone}>{zone}</option>)}</select></label>
          <label>Tiempo<select value={preferences.hours} onChange={event => onPreferencesChange({ ...preferences, hours: Number(event.target.value) })}>{hourOptions.map(hours => <option key={hours} value={hours}>{hours} {hours === 1 ? 'hora' : 'horas'}</option>)}</select></label>
          <label>Momento<select value={preferences.moment} onChange={event => onPreferencesChange({ ...preferences, moment: event.target.value })}>{moments.map(moment => <option key={moment}>{moment}</option>)}</select></label>
        </fieldset>
      </details>
    </div>

    {!isEligible && profile.accountStatus === 'active' && profile.deliveries.length > 0 && daysInactive !== null && daysInactive < 15 && <p className="sidebar-hint eligibility-explanation">Ahora tiene {daysInactive} días desde su última entrega completada. Ya no corresponde una nueva invitación de reactivación.{returned ? ' Puede continuar preparando opciones después del regreso.' : ''} Usa Reiniciar perfil o Reiniciar demostración para repetir el caso.</p>}
    <button className="reset-demonstration" type="button" onClick={onResetDemo}><Icon name="refresh" /> Reiniciar demostración</button>
    <a className="demo-operations-link sidebar-operations" href="?operations=pilot"><Icon name="wallet" /><span>Abrir panel de Operaciones · Resultados simulados</span><Icon name="arrow" /></a>
    <div className="demo-controls-footer"><button type="button" onClick={onResetProfile}><Icon name="refresh" />Reiniciar perfil</button><span>Solo reinicia a {profile.name.split(' ')[0]}.</span></div>
    {resetMessage && <p className="demo-reset-message" role="status">{resetMessage}</p>}
  </section>
}
