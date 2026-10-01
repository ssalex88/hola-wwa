import { useState } from 'react'
import { getReturnResult, type ReturnFeedback, type ReturnTracking } from '../domain/returnTracking'
import type { DeliveryRecord } from '../domain/eligibility'
import { SupportPanel, type SupportContext } from './SupportPanel'
export interface ReturnContext {
  tracking: ReturnTracking
  deliveries: DeliveryRecord[]
  onFeedback: (feedback: ReturnFeedback) => void
}
export function ReturnReview({ context, support, onNewProjection, onSaveOuting }: { context: ReturnContext; support: SupportContext; onNewProjection: () => void; onSaveOuting: () => void }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const result = getReturnResult(context.deliveries, context.tracking)
  if (!result) return null
  const feedback = context.tracking.feedback
  const when = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(new Date(result.returnedAt))
  return <section className="return-review" aria-labelledby="return-review-heading">
    <span className="preference-kicker">TU REGRESO · DATOS SIMULADOS</span>
    <h2 id="return-review-heading">Volviste a completar una entrega</h2>
    <p>Completaste una entrega el {when}, hora de Lima.</p>
    <p>Llevas {result.completedSinceStart} {result.completedSinceStart === 1 ? 'entrega completada' : 'entregas completadas'} desde ese inicio. Tú decides si quieres continuar, sin comprometer horarios.</p>
    <h3>¿Cómo te fue al volver?</h3>
    <p>Responder es opcional. Puedes omitirlo o cambiar tu respuesta.</p>
    {feedback ? <><p role="status">{feedback === 'good' ? 'Me fue bien' : feedback === 'mixed' ? 'Más o menos' : feedback === 'problem' ? 'Tuve un problema' : 'Omitiste la pregunta'}</p><button type="button" className="need-change" onClick={() => context.onFeedback('skipped')}>Omitir mi respuesta</button></> : null}
    <div className="need-choices" role="group" aria-label="Cómo te fue al volver">
      <button type="button" onClick={() => context.onFeedback('good')}>Me fue bien</button>
      <button type="button" onClick={() => context.onFeedback('mixed')}>Más o menos</button>
      <button type="button" onClick={() => context.onFeedback('problem')}>Tuve un problema</button>
      {!feedback && <button type="button" className="need-skip" onClick={() => context.onFeedback('skipped')}>Omitir esta pregunta</button>}
    </div>
    {feedback === 'problem' && <div className="return-problem-help"><p>Puedes revisar un caso de pago o pedido en la ayuda simulada. Para otros problemas, consulta Ayuda o Soporte en la app oficial Soy Rappi. Esta demo no contacta a soporte ni garantiza una solución.</p><button type="button" className="need-action-button" aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)}>Ver ayuda para mi regreso</button>{helpOpen && <SupportPanel context={support} onBack={() => setHelpOpen(false)} backLabel="Volver a mi regreso" />}</div>}
    <div className="proposal-decisions"><button type="button" className="simulator-primary" onClick={onNewProjection}>Consultar una nueva proyección</button><button type="button" className="need-action-button" onClick={onSaveOuting}>Preparar otra salida para guardar</button></div>
    <p className="field-hint">Estas acciones no te conectan ni crean reservas o recordatorios. Guardar y solicitar un recordatorio siguen siendo decisiones tuyas.</p>
  </section>
}
