import { ReminderEditor } from './ReminderEditor'
import { reminderService } from '../services/reminderService'
import type { DemoPreferences } from '../services/demoStorage'
import type { IncentiveContext } from './IncentivePanel'
import { configurationForReview, deleteProposal } from '../domain/proposals'
import { validateProjectionConfiguration } from '../domain/projectionConfiguration'
import { dateInLima } from '../domain/demoDates'
import { DEMO_REFERENCE_DATE } from '../services/demoClock'
import { ProjectionSummary } from './ProjectionSummary'

export function SavedProposals({ preferences, onChange, incentives, requestedReminderId }: { preferences: DemoPreferences; onChange: (value: DemoPreferences) => void; incentives: IncentiveContext; requestedReminderId?: string | null }) {
  if (!preferences.savedProposals.length) return null
  return <section className="saved-proposals" aria-label="Propuestas guardadas">
    <h2>Opciones guardadas</h2>
    <p>Guardar no reserva un turno. Al consultar una opción revisamos su estimación y los incentivos.</p>
    {preferences.savedProposals.map((saved, index) => {
      const config = configurationForReview(saved, DEMO_REFERENCE_DATE)
      const errors = validateProjectionConfiguration(config, dateInLima(DEMO_REFERENCE_DATE))
      const recover = (edit: boolean) => onChange({ ...preferences, ...config, programStep: edit || Object.keys(errors).length ? 'configuration' : 'projection', editingSavedProposalId: edit ? saved.id : null, proposalContinued: false })
      return <details key={saved.id} className="need-saved-proposal" open={requestedReminderId === saved.id ? true : undefined}>
        <summary>{preferences.savedProposals.length === 1 ? 'Opción guardada para este perfil' : `Opción guardada ${index + 1} · ${saved.zone} · ${saved.hours} h`}</summary>
        <p>Guardada el {new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(new Date(saved.referenceAt))}. No es una reserva.</p>
        <ProjectionSummary config={config} errors={errors} incentives={incentives} compact incentivesId={`saved-proposal-incentives-${saved.id}`} />
        <button type="button" className="need-action-button" onClick={() => recover(false)}>{Object.keys(errors).length ? 'Editar y recuperar esta opción' : 'Recuperar opción guardada'}</button>
        <button type="button" className="need-action-button" onClick={() => recover(true)}>Editar propuesta guardada</button>
        <ReminderEditor saved={saved} requested={requestedReminderId === saved.id} onSchedule={(date, time) => onChange(reminderService.schedule(preferences, saved.id, date, time))} onCancel={() => onChange(reminderService.cancel(preferences, saved.id))} />
        <button type="button" className="need-cancel" onClick={() => onChange(deleteProposal(preferences, saved.id))}>Eliminar opción guardada</button>
      </details>
    })}
  </section>
}
