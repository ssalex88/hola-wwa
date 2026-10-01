import { IncentivePanel, type IncentiveContext } from './IncentivePanel'
import type { ProjectionConfiguration, ProjectionErrors } from '../domain/projectionConfiguration'
import { getDemoProjection } from '../services/projectionService'

export const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 })

export function ProjectionSummary({ config, errors = {}, compact = false, incentives, incentivesId = 'projection-incentives' }: { config: ProjectionConfiguration; incentives: IncentiveContext; errors?: ProjectionErrors; compact?: boolean; incentivesId?: string }) {
  const result = getDemoProjection(config)
  const summaryClass = compact ? 'projection-summary compact' : 'projection-summary'
  const when = config.scheduleMode === 'now' ? 'Ahora' : config.scheduledDate ? `El ${config.scheduledDate.split('-').reverse().join('/')}` : 'Fecha por elegir'
  return <div className={summaryClass}>
    <span className="comparison-label">Datos simulados · Sin garantía de pedidos ni ingresos</span>
    <p className="option-summary">{config.zone || 'Zona por elegir'} · {when} · {config.moment || 'Franja por elegir'} · {config.hours || '—'} h · {config.vehicle || 'Vehículo por elegir'}</p>
    {Object.keys(errors).length > 0 ? <p className="projection-empty" role="status">Revisa los campos indicados para consultar esta opción.</p> : result ? <>
      <dl className="projection-breakdown">
        <div><dt>Ingresos estimados</dt><dd>{money.format(result.grossMin)} – {money.format(result.grossMax)}</dd></div>
        <div><dt>Gastos considerados</dt><dd>{money.format(result.expenses)}</dd></div>
        <div className="after-expenses"><dt>Después de los gastos ingresados</dt><dd>{money.format(result.afterExpensesMin)} – {money.format(result.afterExpensesMax)}</dd></div>
      </dl>
      <p className="field-hint">Puede haber otros costos no incluidos. No se garantizan pedidos ni ingresos.</p>
      <details className="projection-assumptions"><summary>Cómo calculamos esto</summary><ul>
        <li>Tabla de demostración v1: {money.format(result.hourlyMin)} – {money.format(result.hourlyMax)} por hora para {config.zone}, {config.moment.toLowerCase()} y {config.vehicle.toLowerCase()}.</li>
        <li>Multiplicamos ese rango por {config.hours} horas y restamos {money.format(result.expenses)} de gastos ingresados para toda la salida.</li>
        <li>La tabla no distingue días de la semana ni considera demanda, clima o pedidos en tiempo real.</li>
        <li>El rango es un ejemplo para evaluar opciones; no es una predicción de Rappi.</li>
      </ul></details>
    </> : <section className="projection-empty" role="status"><h2>Sin estimación para esta combinación</h2><p>No hay datos simulados de {config.vehicle} en {config.zone}, {config.moment.toLowerCase()}. Cambia las opciones para consultar otro rango.</p></section>}
    <details className="incentives-complement" id={incentivesId}><summary>Incentivos como complemento</summary><IncentivePanel config={config} context={incentives} id={incentivesId + '-content'} /></details>
  </div>
}
