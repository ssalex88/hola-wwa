import { useRef, useState } from 'react'
import { SavedProposals } from './SavedProposals'
import { saveDemoProposal } from '../services/proposalService'
import { SupportPanel, type SupportContext } from './SupportPanel'
import type { IncentiveContext } from './IncentivePanel'
import { getNeedActions, type ReturnNeed } from '../domain/returnHelp'
import type { DemoPreferences } from '../services/demoStorage'
import { Icon } from './Icon'
import { getDemoProjection } from '../services/projectionService'
import { money } from './ProjectionSummary'

interface Props {
  onGoConnection: () => void
  support: SupportContext
  incentives: IncentiveContext
  preferences: DemoPreferences
  onChange: (preferences: DemoPreferences) => void
  onCompare: () => void
  onClose: () => void
}

const needs: { id: ReturnNeed; label: string; hint: string; icon: 'wallet' | 'clock' | 'help' | 'power' | 'chat' }[] = [
  { id: 'savings', label: 'No me sale a cuenta', hint: 'Comparar opciones y sus gastos', icon: 'wallet' },
  { id: 'time', label: 'Tengo poco tiempo', hint: 'Probar una salida más corta', icon: 'clock' },
  { id: 'payment-order', label: 'Tuve un problema con un pago o pedido', hint: 'Revisar un caso y pedir ayuda', icon: 'help' },
  { id: 'personal-vehicle', label: 'Por ahora no puedo', hint: 'Salir o pedir un recordatorio', icon: 'power' },
  { id: 'other', label: 'Otro motivo', hint: 'Contarnos algo, solo si quieres', icon: 'chat' },
]

export function NeedHelpFlow({ onGoConnection, support, incentives, preferences, onChange, onCompare, onClose }: Props) {
  const [supportOpen, setSupportOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [requestedReminderId, setRequestedReminderId] = useState<string | null>(null)
  const [choosingNeed, setChoosingNeed] = useState(false)
  const guidanceRef = useRef<HTMLDivElement>(null)
  const choicesRef = useRef<HTMLDivElement>(null)
  const need = preferences.returnNeed
  const selectedNeed = needs.find(item => item.id === need)
  const showChoices = choosingNeed || !selectedNeed
  const actions = need ? getNeedActions(need) : []
  const projection = need === 'time' ? getDemoProjection(preferences) : null
  const chooseNeed = (value: ReturnNeed) => {
    onChange({ ...preferences, returnNeed: value, proposalContinued: false })
    setChoosingNeed(false)
    setSupportOpen(false)
    setNotice('')
    requestAnimationFrame(() => {
      const guidance = guidanceRef.current
      guidance?.focus({ preventScroll: true })
      const screen = guidance?.closest<HTMLElement>('.phone-screen')
      const help = guidance?.closest<HTMLElement>('.barrier-help')
      if (screen && help && guidance) {
        const target = help.offsetHeight <= screen.clientHeight - 24 ? help : guidance
        screen.scrollBy({ top: target.getBoundingClientRect().top - screen.getBoundingClientRect().top - 12 })
      }
    })
  }
  const save = (remind = false) => {
    const updated = saveDemoProposal(preferences)
    onChange(updated)
    setNotice('Opción guardada. No reservamos un turno ni te conectamos.')
    if (remind) {
      const id = updated.savedProposals.at(-1)?.id ?? null
      setRequestedReminderId(id)
      requestAnimationFrame(() => document.querySelector('.proposal-reminder')?.scrollIntoView({ block: 'center' }))
    }
  }
  const saved = <SavedProposals preferences={preferences} onChange={onChange} incentives={incentives} requestedReminderId={requestedReminderId} />
  const continueWithProposal = (skip = false) => onChange({ ...preferences, returnNeed: skip ? 'skipped' : need, proposalContinued: true })

  if (preferences.proposalContinued) return <section className="need-help proposal-final" aria-labelledby="continued-proposal-heading">
    <h2 id="continued-proposal-heading">Tu opción está lista</h2>
    <p>{preferences.zone} · {preferences.hours} h · {preferences.vehicle}<br />{preferences.scheduleMode === 'now' ? 'Ahora' : preferences.scheduledDate?.split('-').reverse().join('/')} · {preferences.moment}</p>
    <div className="simulator-note"><strong>Tú eliges cuándo conectarte.</strong><span>Consultar o guardar no reserva un turno ni compromete un horario.</span></div>
    <div className="proposal-decisions" role="group" aria-label="Qué hacer con tu opción">
      <button type="button" className="simulator-primary" onClick={onGoConnection}>Ir a conectarme</button>
      <button type="button" className="need-action-button" onClick={() => save()}>Guardar opción</button>
      <button type="button" className="need-cancel" onClick={onClose}>Ahora no</button>
    </div>
    {notice && <p className="need-inline-notice" role="status">{notice}</p>}
    {saved}
    <button type="button" className="need-change" onClick={() => onChange({ ...preferences, proposalContinued: false })}>Revisar mi estimación</button>
  </section>

  return <section className="need-help barrier-help" aria-labelledby="need-help-heading">
    {showChoices && <div className="barrier-heading"><span className="barrier-heading-icon" aria-hidden="true"><Icon name="chat" /></span><span className="preference-kicker">UNA AYUDA A TU MEDIDA <span>Opcional</span></span></div>}
    <h2 id="need-help-heading">¿Hay algo que te dificulte volver?</h2>
    {showChoices && <p>Elige una opción y mira qué puedes hacer. Tú decides si quieres contarnos.</p>}
    <button type="button" className="need-skip" onClick={() => continueWithProposal(true)}>Omitir y continuar <Icon name="arrow" width="15" /></button>
    {showChoices ? <div ref={choicesRef} className="need-choices" role="group" aria-label="Qué te dificulta volver">
      {needs.map(item => <button type="button" key={item.id} data-need-id={item.id} aria-label={item.label} aria-pressed={need === item.id} className={need === item.id ? 'selected' : ''} onClick={() => chooseNeed(item.id)}><span className="need-choice-icon" aria-hidden="true"><Icon name={item.icon} /></span><span className="need-choice-copy"><strong>{item.label}</strong><small>{item.hint}</small></span><Icon name="chevron" width="16" /></button>)}
      {selectedNeed && <button className="need-keep-answer" type="button" onClick={() => { setChoosingNeed(false); requestAnimationFrame(() => guidanceRef.current?.focus()) }}>Mantener mi respuesta</button>}
    </div> : <div className="need-selected-answer"><span className="need-choice-icon" aria-hidden="true"><Icon name={selectedNeed.icon} /></span><span aria-live="polite"><small>Tu respuesta</small><strong>{selectedNeed.label}</strong></span><button type="button" onClick={() => { setChoosingNeed(true); requestAnimationFrame(() => choicesRef.current?.querySelector<HTMLButtonElement>(`[data-need-id="${need}"]`)?.focus()) }}>Cambiar respuesta</button></div>}
    {!showChoices && selectedNeed && <div ref={guidanceRef} className="need-guidance" tabIndex={-1} aria-labelledby="need-guidance-heading">
      {actions.some(action => action.action === 'compare') && <div className="need-recommendation">
        <h3 id="need-guidance-heading">Veamos otra opción</h3><p>Cambia la zona, el momento o la duración. Compara lo que queda después de tus gastos.</p>
        <button type="button" className="need-action-button need-help-primary" onClick={onCompare}>Comparar alternativas <Icon name="arrow" width="16" /></button>
        <button type="button" className="need-action-button" onClick={() => { const panel = document.getElementById('current-incentive-info'); if (panel instanceof HTMLDetailsElement) panel.open = true; panel?.scrollIntoView({ block: 'start' }) }}><Icon name="gift" width="17" />Consultar incentivos elegibles</button>
      </div>}
      {actions.some(action => action.action === 'adjust-time') && <div className="need-recommendation">
        <h3 id="need-guidance-heading">Probemos una salida más corta</h3><p>Ajusta el tiempo y revisa si esta opción te conviene.</p>
        <button type="button" className="need-action-button need-help-primary" disabled={preferences.hours === 1} onClick={() => onChange({ ...preferences, hours: 1 })}><Icon name="clock" width="17" />Reducir a 1 hora</button>
        <details className="need-more-time"><summary>Elegir otra duración</summary><label className="need-duration" htmlFor="need-duration">¿Cuánto tiempo tienes?<select id="need-duration" value={preferences.hours} onChange={event => onChange({ ...preferences, hours: Number(event.target.value) })}>{[...new Set([1, 2, 3, preferences.hours])].sort((a,b) => a-b).map(hours => <option key={hours} value={hours}>{hours} {hours === 1 ? 'hora' : 'horas'}</option>)}</select></label></details>
        {projection && <div className="need-time-result" role="status"><span>{preferences.hours} {preferences.hours === 1 ? 'hora' : 'horas'} · {preferences.zone}</span><small>Después de los gastos ingresados</small><strong>{money.format(projection.afterExpensesMin)} – {money.format(projection.afterExpensesMax)}</strong><small>Datos simulados · Puede haber otros costos. Sin garantía de ingresos.</small></div>}
        {actions.some(action => action.action === 'save') && <button type="button" className="need-action-button" onClick={() => save()}><Icon name="calendar" width="17" />Guardar opción</button>}
      </div>}
      {actions.some(action => action.action === 'support') && <div className="need-recommendation">
        <h3 id="need-guidance-heading">Revisa tu caso antes de decidir</h3><p>Puedes consultar su estado y registrar una solicitud de ayuda simulada. Pedir ayuda no lo marca como resuelto.</p>
        <button type="button" className="need-action-button need-help-primary" onClick={() => { if (!support.data.selectedCaseId && support.data.cases[0]) support.onSelect(support.data.cases[0].id); setSupportOpen(true) }}><Icon name="help" width="17" />Abrir ayuda de pago o pedido</button>
        {supportOpen && <SupportPanel context={support} onBack={() => setSupportOpen(false)} backLabel="Volver a mi estimación" />}
      </div>}
      {actions.some(action => action.action === 'schedule') && <div className="need-recommendation">
        <h3 id="need-guidance-heading">Vuelve cuando te convenga</h3><p>Puedes dejarlo aquí y volver otro día.</p>
        <button type="button" className="need-action-button need-help-primary" onClick={onClose}>Salir por ahora <Icon name="arrow" width="16" /></button>
        <button type="button" className="need-action-button" onClick={() => save(true)}><Icon name="bell" width="17" />Recordármelo</button>
        <p className="field-hint">Si lo pides, guardamos esta opción para que elijas fecha y hora. No se programa nada hasta confirmar.</p>
      </div>}
      {need === 'other' && <div className="need-recommendation"><h3 id="need-guidance-heading">Te leemos, si quieres</h3><p>No hace falta dar detalles para seguir con tu opción.</p><label className="other-need">Cuéntanos si quieres (opcional)<textarea value={preferences.otherNeedDetail} maxLength={280} onChange={event => onChange({ ...preferences, otherNeedDetail: event.target.value })} /></label></div>}
      <button type="button" className="need-continue" onClick={() => continueWithProposal()}>Continuar con mi opción <Icon name="arrow" width="16" /></button>
    </div>}
    {notice && <p className="need-inline-notice" role="status">{notice}</p>}
    {saved}
  </section>
}
