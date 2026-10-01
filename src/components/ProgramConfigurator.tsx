import { JourneySteps } from './JourneySteps'
import { getDemoProjection } from '../services/projectionService'
import { SavedProposals } from './SavedProposals'
import { saveDemoProposal } from '../services/proposalService'
import type { SupportContext } from './SupportPanel'
import type { IncentiveContext } from './IncentivePanel'
import { useEffect, useState } from 'react'
import type { DemoProfile } from '../data/demoProfiles'
import { copyConfiguration, validateProjectionConfiguration, type ProjectionConfiguration } from '../domain/projectionConfiguration'
import { dateInLima, momentInLima } from '../domain/demoDates'
import { DEMO_REFERENCE_DATE } from '../services/demoClock'
import type { DemoPreferences } from '../services/demoStorage'
import { ProjectionFields, ExpenseFields } from './ProjectionFields'
import { ProjectionSummary } from './ProjectionSummary'
import { NeedHelpFlow } from './NeedHelpFlow'

interface Props {
  onGoConnection: () => void
  support: SupportContext
  incentives: IncentiveContext
  profile: DemoProfile
  preferences: DemoPreferences
  onChange: (preferences: DemoPreferences) => void
  onClose: () => void
}

export function ProgramConfigurator({ onGoConnection, support, incentives, preferences, onChange, onClose }: Props) {
  const [showErrors, setShowErrors] = useState(false)
  const [notice, setNotice] = useState('')
  const today = dateInLima(DEMO_REFERENCE_DATE)
  const referenceMoment = momentInLima(DEMO_REFERENCE_DATE)
  const errors = validateProjectionConfiguration(preferences, today)
  const alternative = preferences.comparisonOption
  const alternativeErrors = alternative ? validateProjectionConfiguration(alternative, today) : {}
  const step = preferences.programStep
  const journeyStep = step === 'configuration' ? 1 : preferences.proposalContinued && step === 'projection' ? 3 : 2
  useEffect(() => { document.querySelector('.phone-screen')?.scrollTo({ top: 0 }) }, [step, journeyStep])

  // Legacy preferences may have an arbitrary slot for "now"; normalize both options.
  useEffect(() => {
    const mainNeedsSlot = preferences.scheduleMode === 'now' && preferences.moment !== referenceMoment
    const altNeedsSlot = alternative?.scheduleMode === 'now' && alternative.moment !== referenceMoment
    if (mainNeedsSlot || altNeedsSlot) onChange({ ...preferences,
      ...(mainNeedsSlot ? { moment: referenceMoment, scheduledDate: null } : {}),
      comparisonOption: altNeedsSlot && alternative ? { ...alternative, moment: referenceMoment, scheduledDate: null } : alternative,
    })
  }, [preferences, alternative, referenceMoment, onChange])

  function updateCurrent(patch: Partial<ProjectionConfiguration>) {
    const changesProposal = Object.entries(patch).some(([key, value]) => key in preferences && preferences[key as keyof DemoPreferences] !== value)
    onChange({ ...preferences, ...patch, ...(changesProposal ? { proposalContinued: false } : {}) })
    setNotice('')
  }

  function updateAlternative(patch: Partial<ProjectionConfiguration>) {
    if (!alternative) return
    onChange({ ...preferences, comparisonOption: { ...alternative, ...patch } })
    setNotice('')
  }

  function calculate() {
    setShowErrors(true)
    if (Object.keys(errors).length === 0) onChange({ ...preferences, programStep: 'projection' })
  }

  function compare() {
    onChange({ ...preferences, comparisonOption: alternative ?? copyConfiguration(preferences), programStep: 'comparison' })
    setNotice('')
  }

  function chooseAlternative() {
    if (!alternative || Object.keys(alternativeErrors).length) return
    onChange({ ...preferences, ...copyConfiguration(alternative), comparisonOption: copyConfiguration(preferences), programStep: 'projection', proposalContinued: false })
    setNotice('Elegiste esta alternativa como tu propuesta actual. No reservamos un turno ni te conectamos.')
  }

  return <main className="home-content simulator-destination">
    <button type="button" className="simulator-back" onClick={onClose}>← Volver al inicio</button>
    <span className="projection-data-label">Demo · Datos simulados</span>
    <JourneySteps step={journeyStep} />
    <h1>{journeyStep === 1 ? 'Tu tiempo y zona' : journeyStep === 3 ? 'Tú decides' : step === 'comparison' ? 'Compara tus opciones' : 'Tu estimación'}</h1>
    {notice && <p className="invite-notice" role="status">{notice}</p>}

    {step === 'configuration' && <>
      <SavedProposals preferences={preferences} onChange={onChange} incentives={incentives} />
      <form onSubmit={(event) => { event.preventDefault(); calculate() }} noValidate>
        <ProjectionFields config={preferences} onChange={updateCurrent} prefix="current" errors={showErrors ? errors : {}} />
        <button type="submit" className="simulator-primary">Calcular estimación</button>
        <p className="configuration-autonomy">Consultar una opción no reserva un turno ni te obliga a conectarte.</p>
        {preferences.editingSavedProposalId && <button type="button" className="need-action-button" disabled={Object.keys(errors).length > 0} onClick={() => { onChange({ ...saveDemoProposal(preferences), programStep: 'projection' }); setNotice('Cambios guardados. La propuesta no es una reserva.') }}>Guardar cambios de propuesta</button>}
      </form>
    </>}

    {step === 'projection' && <>
      {journeyStep === 2 && <ProjectionSummary incentives={incentives} config={preferences} errors={errors} incentivesId="current-incentive-info" />}
      {journeyStep === 2 && <details className="expense-editor"><summary>Ajustar gastos de esta salida</summary><ExpenseFields config={preferences} onChange={updateCurrent} prefix="current" errors={errors} /></details>}
      {journeyStep === 2 && <div className="projection-actions"><button type="button" className="simulator-primary" onClick={compare}>{alternative ? 'Comparar opciones' : 'Comparar otra opción'}</button><button type="button" className="simulator-secondary-action" onClick={() => { onChange({ ...preferences, programStep: 'configuration' }); setShowErrors(false) }}>Cambiar opciones</button></div>}
      {Object.keys(errors).length === 0 && getDemoProjection(preferences) && <NeedHelpFlow onGoConnection={onGoConnection} support={support} incentives={incentives} preferences={preferences} onChange={onChange} onClose={onClose} onCompare={compare} />}
    </>}

    {step === 'comparison' && alternative && <section className="comparison-section" aria-label="Comparación de dos configuraciones">
      <p>Puedes editar las dos opciones. Elige según tu tiempo, zona y gastos; tú decides cuál te conviene.</p>
      <div className="comparison-grid">
        <article className="comparison-card" aria-labelledby="current-option-heading">
          <h2 id="current-option-heading">Propuesta actual</h2>
          <ProjectionSummary incentives={incentives} config={preferences} errors={errors} compact incentivesId="current-comparison-incentives" />
          <details className="option-editor"><summary>Editar propuesta actual</summary><ProjectionFields config={preferences} onChange={updateCurrent} prefix="current" errors={errors} /><ExpenseFields config={preferences} onChange={updateCurrent} prefix="current" errors={errors} /></details>
          <button type="button" className="comparison-select" disabled={Object.keys(errors).length > 0} onClick={() => { onChange({ ...preferences, programStep: 'projection' }); setNotice('Conservaste tu propuesta actual.') }}>Conservar propuesta actual</button>
        </article>
        <article className="comparison-card" aria-labelledby="alternative-option-heading">
          <h2 id="alternative-option-heading">Otra opción</h2>
          <ProjectionSummary incentives={incentives} config={alternative} errors={alternativeErrors} compact incentivesId="alternative-comparison-incentives" />
          <details className="option-editor"><summary>Editar otra opción</summary><ProjectionFields config={alternative} onChange={updateAlternative} prefix="alternative" errors={alternativeErrors} /><ExpenseFields config={alternative} onChange={updateAlternative} prefix="alternative" errors={alternativeErrors} /></details>
          <button type="button" className="comparison-select" disabled={Object.keys(alternativeErrors).length > 0} onClick={chooseAlternative}>Elegir esta alternativa</button>
        </article>
      </div>
      <button type="button" className="simulator-secondary-action" onClick={() => onChange({ ...preferences, comparisonOption: null, programStep: 'projection' })}>Quitar segunda opción</button>
    </section>}


  </main>
}
