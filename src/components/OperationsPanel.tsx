import { useEffect, useState } from 'react'
import { incrementalReturnCost, type PilotBand } from '../domain/pilotEvaluation'
import { getPilotResults, loadPilotCosts, savePilotCosts, type PilotCosts } from '../services/pilotService'
import { DEMO_REFERENCE_DATE } from '../services/demoClock'
import './operations.css'
import { MentorSessionOperations } from './MentorSessionOperations'

const percentage = (value: number | null) => value === null ? 'Sin denominador' : new Intl.NumberFormat('es-PE', { style: 'percent', maximumFractionDigits: 1 }).format(value)
const number = (value: number) => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(value)
const money = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value)
const bands: (PilotBand | 'all')[] = ['all', '15–30 días', '31–60 días', 'Más de 60 días']
export function OperationsPanel({ onBack }: { onBack: () => void }) {
  const [band, setBand] = useState<PilotBand | 'all'>('all')
  const [costs, setCosts] = useState(loadPilotCosts)
  useEffect(() => savePilotCosts(costs, band), [costs, band])
  const { intervention, comparison, participants } = getPilotResults(band)
  const values = Object.values(costs).map(value => value.trim() === '' ? NaN : Number(value))
  const cost = incrementalReturnCost(intervention, comparison, values)
  const provisional = intervention.pending14 + comparison.pending14 > 0
  const date = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(DEMO_REFERENCE_DATE)
  const rows = [
    ['Elegibles asignados', intervention.assigned, comparison.assigned],
    ['Entraron al flujo', intervention.entered, comparison.entered],
    ['Entrada por app', intervention.appEntries, comparison.appEntries],
    ['Entrada por invitación externa', intervention.externalEntries, comparison.externalEntries],
    ['Sin entrada al flujo', intervention.unanswered, comparison.unanswered],
    ['Proyecciones consultadas', intervention.projections, comparison.projections],
    ['Personas que consultaron', intervention.projectionUsers, comparison.projectionUsers],
    ['Propuestas guardadas', intervention.saves, comparison.saves],
    ['Personas que guardaron', intervention.savingUsers, comparison.savingUsers],
    ['Retornos observados', intervention.returns, comparison.returns],
  ]
  return <div className="operations-shell">
    <header className="operations-header"><div><span>VUELVE A TU RITMO · OPERACIONES</span><h1>Evaluación del piloto</h1></div><button type="button" onClick={onBack}>Volver a la demo</button></header>
    <main className="operations-content">
      <MentorSessionOperations />
      <div className="operations-demo-label">Demostración · Cohorte y resultados simulados</div>
      <p>24 participantes ficticios: 12 de intervención y 12 de comparación. Esta cohorte es independiente de los perfiles interactivos; sus acciones no se suman a estos resultados. No son resultados de Rappi.</p>
      <p className="operations-reference">Corte de datos: {date}, hora de Lima. La comparación simula personas sin exposición al programa.</p>
      <label className="operations-filter" htmlFor="pilot-band">Tramo de inactividad al asignar
        <select id="pilot-band" value={band} onChange={event => { const selected = event.target.value as PilotBand | 'all'; setBand(selected); setCosts(loadPilotCosts(selected)) }}>{bands.map(value => <option key={value} value={value}>{value === 'all' ? 'Todos los tramos' : value}</option>)}</select>
      </label>
      <section className="operations-section" aria-labelledby="pilot-usage-heading"><h2 id="pilot-usage-heading">Uso y resultados demostrativos</h2>
        <p>Las consultas y guardados cuentan eventos; también mostramos personas únicas. Los retornos incluyen entregas observadas después de la asignación, aunque la persona no haya entrado al flujo.</p>
        <table className="operations-table"><caption>Cohorte seleccionada · Datos simulados</caption><thead><tr><th scope="col">Indicador</th><th scope="col">Intervención</th><th scope="col">Comparación</th></tr></thead><tbody>{rows.map(([label, a, b]) => <tr key={label}><th scope="row">{label}</th><td>{a}</td><td>{b}</td></tr>)}</tbody></table>
      </section>
      <section className="operations-section" aria-labelledby="pilot-reactivation-heading"><h2 id="pilot-reactivation-heading">Reactivación a 14 días</h2>
        <div className="operations-metric-grid">{[{ label: 'Intervención', value: intervention }, { label: 'Comparación', value: comparison }].map(({ label, value }) => <article key={label}>
          <h3>{label}</h3><strong>{percentage(value.reactivationRate)}</strong><p>{value.returned14} retornos dentro de 14 días / {value.assigned} elegibles asignados.</p><p>{value.pending14} con ventana pendiente · {value.noReturn14Complete} con ventana completa sin retorno dentro de 14 días.</p>
        </article>)}</div>
        <p>Denominador: todos los elegibles asignados al grupo, incluidos quienes no respondieron. Numerador: al menos una entrega completada después de asignar y hasta 14 × 24 horas, inclusive. Abrir la app, guardar o conectarse no cuenta.</p>
        <p className="operations-status">{provisional ? 'Resultado provisional: hay ventanas pendientes. Pendiente no significa fracaso.' : 'Las ventanas de 14 días de esta selección están completas.'}</p>
      </section>
      <section className="operations-section" aria-labelledby="pilot-continuity-heading"><h2 id="pilot-continuity-heading">Continuidad entre los días 24 y 30</h2>
        <div className="operations-metric-grid">{[{ label: 'Intervención', value: intervention }, { label: 'Comparación', value: comparison }].map(({ label, value }) => <article key={label}>
          <h3>{label}</h3><strong>{percentage(value.continuityRate)}</strong><p>{value.continued} con entregas en esa ventana / {value.returns} que regresaron.</p><p>{value.pendingContinuity} seguimientos pendientes · {value.noContinuityComplete} ventanas completas sin continuidad.</p>
        </article>)}</div>
        <p>Continuidad: al menos una entrega completada desde 24 × 24 horas hasta antes de 31 × 24 horas después de la primera entrega de regreso. Incluye retornos tardíos, posteriores a los 14 días.</p><p>Se observa desde el regreso hasta completar el día 30. Las tasas siguen siendo provisionales mientras existan ventanas pendientes; no se clasifican como fracasos.</p>
      </section>
      <section className="operations-section" aria-labelledby="pilot-rejections-heading"><h2 id="pilot-rejections-heading">Rechazo y preferencias de contacto</h2>
        <table className="operations-table"><caption>Personas únicas · Datos simulados</caption><thead><tr><th scope="col">Respuesta</th><th scope="col">Intervención</th><th scope="col">Comparación</th></tr></thead><tbody>
          <tr><th scope="row">Rechazaron la propuesta</th><td>{intervention.rejected}</td><td>{comparison.rejected}</td></tr>
          <tr><th scope="row">Ahora no</th><td>{intervention.nowNo}</td><td>{comparison.nowNo}</td></tr>
          <tr><th scope="row">No me interesa</th><td>{intervention.notInterested}</td><td>{comparison.notInterested}</td></tr>
          <tr><th scope="row">Solicitaron no contacto</th><td>{intervention.noContact}</td><td>{comparison.noContact}</td></tr>
        </tbody></table><p>Estas categorías pueden coincidir en una persona y no deben sumarse. No responder se muestra como ausencia de entrada; no se interpreta como rechazo ni motivo de abandono.</p>
      </section>
      <section className="operations-section" aria-labelledby="pilot-cost-heading"><h2 id="pilot-cost-heading">Costo por retorno adicional · Demostrativo</h2>
        <p>Introduce los costos adicionales de la intervención para {band === 'all' ? 'todos los tramos' : `el tramo ${band}`}. Los importes se guardan por filtro. Incluye incentivos efectivamente otorgados en el ejemplo, no promesas ni importes disponibles.</p>
        <div className="operations-costs">{([['operations', 'Operación adicional'], ['incentives', 'Incentivos otorgados'], ['support', 'Soporte adicional']] as const).map(([key, label]) => <label key={key} htmlFor={`pilot-cost-${key}`}>{label} (S/)<input id={`pilot-cost-${key}`} type="number" min="0" step="0.01" value={costs[key]} placeholder="Ingresa un monto, incluso 0" aria-invalid={costs[key] !== '' && (!Number.isFinite(Number(costs[key])) || Number(costs[key]) < 0)} onChange={event => setCosts({ ...costs, [key]: event.target.value } as PilotCosts)} /></label>)}</div>
        <div className="operations-cost-result" role="status">
          <p>Diferencia observada a 14 días: <strong>{cost.difference === null ? 'Sin denominador' : `${number(cost.difference * 100)} puntos porcentuales`}</strong>.</p>
          {cost.reason === 'no-positive-difference' ? <p>No calculamos costo por retorno adicional: la diferencia es cero o negativa.</p> : cost.reason === 'no-groups' ? <p>No calculamos el costo: faltan asignados en uno de los grupos.</p> : <><p>Retornos adicionales estimados: {cost.additionalReturns === null ? '—' : number(cost.additionalReturns)}.</p>{cost.reason === 'invalid-costs' ? <p>Ingresa los tres costos no negativos, incluidos los que sean 0, para calcular.</p> : <p>Costo por retorno adicional: <strong>{money(cost.costPerAdditionalReturn!)}</strong>{provisional ? ' · Provisional' : ''}.</p>}</>}
        </div>
        <p>Retornos adicionales = (tasa de intervención − tasa de comparación) × asignados de intervención. Costo = suma de costos ingresados / retornos adicionales, solo con diferencia positiva. Es un cálculo de una cohorte ficticia, no una prueba de impacto causal.</p>
      </section>
      <section className="operations-section" aria-labelledby="pilot-participants-heading"><h2 id="pilot-participants-heading">Seguimiento por participante</h2><p>El tramo queda fijado al asignar, aunque después regrese. El corte nunca supera la cobertura de datos de la persona.</p>
        <div className="operations-participants">{participants.map(person => <article key={person.id}>
          <h3>{person.id}</h3><p>{person.group === 'intervention' ? 'Intervención' : 'Comparación'} · {person.band}</p><dl>
            <div><dt>Entrada</dt><dd>{person.origin === 'app' ? 'App' : person.origin === 'external' ? 'Invitación externa' : 'Sin entrada al flujo'}</dd></div>
            <div><dt>Regreso observado</dt><dd>{person.returnedAt ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short' }).format(new Date(person.returnedAt)) : 'Sin entrega de regreso observada'}</dd></div>
            <div><dt>Ventana de 14 días</dt><dd>{person.window14Complete ? person.returned14 ? 'Completa · Retorno dentro de 14 días' : 'Completa · Sin retorno dentro de 14 días' : person.returned14 ? 'Pendiente · Retorno ya observado' : 'Pendiente de seguimiento'}</dd></div>
            <div><dt>Continuidad</dt><dd>{person.returnedAt === null ? 'Aún no aplica: sin regreso observado' : !person.continuityComplete ? person.continued ? 'Pendiente · Continuidad ya observada' : 'Pendiente de seguimiento' : person.continued ? 'Ventana completa · Con continuidad' : 'Ventana completa · Sin continuidad'}</dd></div>
          </dl>
        </article>)}</div>
      </section>
    </main>
  </div>
}
