import type { SupportData } from '../domain/support'
import { supportStatusLabels } from '../domain/support'

export interface SupportContext {
  data: SupportData
  onSelect: (id: string) => void
  onRequest: (id: string) => void
}
export function SupportPanel({ context, onBack, backLabel = 'Volver a la proyección' }: { context: SupportContext; onBack: () => void; backLabel?: string }) {
  const { data, onSelect, onRequest } = context
  const selected = data.cases.find(item => item.id === data.selectedCaseId)
  const requestedAt = selected ? data.requests[selected.id] : undefined
  return <section className="support-panel" aria-labelledby="support-cases-heading">
    <span className="preference-kicker">AYUDA · DATOS SIMULADOS</span>
    <h3 id="support-cases-heading">Consulta tu caso</h3>
    <p>Estos casos son ficticios. Solicitar ayuda aquí solo guarda un registro en la demo; no contacta a soporte ni garantiza una solución.</p>
    {data.cases.length ? <>
      <label htmlFor="support-case">Caso simulado de pago o pedido</label>
      <select id="support-case" value={data.selectedCaseId ?? ''} onChange={event => onSelect(event.target.value)}>
        <option value="" disabled>Elige un caso</option>
        {data.cases.map(item => <option key={item.id} value={item.id}>{item.kind === 'payment' ? 'Pago' : 'Pedido'} · {supportStatusLabels[item.status]}</option>)}
      </select>
      {selected && <div className="support-case-detail">
        <dl><div><dt>Identificador</dt><dd>{selected.id}</dd></div><div><dt>Descripción</dt><dd>{selected.description}</dd></div><div><dt>Estado del caso</dt><dd>{supportStatusLabels[selected.status]}</dd></div></dl>
        {requestedAt && <p role="status">Solicitud de ayuda simulada registrada el {new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(new Date(requestedAt))}. El estado del caso no cambió al solicitar ayuda.</p>}
        {selected.status === 'resolved' ? <p>Este caso figura resuelto en los datos de demo. Abrirlo no cambió su estado.</p> : <button type="button" className="need-action-button" disabled={Boolean(requestedAt)} onClick={() => onRequest(selected.id)}>{requestedAt ? 'Solicitud registrada (simulada)' : 'Registrar solicitud de ayuda (simulada)'}</button>}
      </div>}
    </> : <p role="status">Este perfil no tiene casos simulados de pago o pedido.</p>}
    <button type="button" className="need-action-button" onClick={onBack}>{backLabel}</button>
  </section>
}
