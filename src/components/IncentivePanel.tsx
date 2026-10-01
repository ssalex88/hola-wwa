import type { DemoProfile } from '../data/demoProfiles'
import type { IncentiveRecords } from '../domain/incentives'
import type { ProjectionConfiguration } from '../domain/projectionConfiguration'
import { dateInLima } from '../domain/demoDates'
import { DEMO_REFERENCE_DATE } from '../services/demoClock'
import { getDemoIncentives } from '../services/incentiveService'

export interface IncentiveContext {
  profile: DemoProfile
  records: IncentiveRecords
  onEnroll: (id: string, config: ProjectionConfiguration) => void
}
const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const dateLabel = (date: string) => date.slice(0, 10).split('-').reverse().join('/')

export function IncentivePanel({ config, context, id }: { config: ProjectionConfiguration; context: IncentiveContext; id: string }) {
  const offers = getDemoIncentives(context.profile, config, context.records)
  const today = dateInLima(DEMO_REFERENCE_DATE)
  return <section id={id} className="projection-incentives">
    <h2>Incentivos condicionados · Por separado</h2>
    <p>Campañas ficticias · Datos simulados. Publicadas solo en esta demo; no son ofertas de Rappi. No se suman al rango.</p>
    {offers.length ? offers.map((offer) => <article className="incentive-card" key={offer.id}>
      <h3>{offer.title}</h3>
      <p><strong>{offer.reward.kind === 'money' ? currency.format(offer.reward.amount) : offer.reward.description}</strong></p>
      <p className="incentive-status" role="status">{offer.status === 'obtained' ? 'Obtenido · Registro simulado' : offer.status === 'enrolled' ? 'Inscrito · Aún no obtenido' : 'Disponible · Aún no obtenido'}</p>
      <dl>
        <div><dt>Vigencia</dt><dd>{dateLabel(offer.startsOn)} al {dateLabel(offer.endsOn)}</dd></div>
        <div><dt>Zona</dt><dd>{offer.zones.join(', ')}</dd></div>
        <div><dt>Franja y vehículo</dt><dd>{offer.moments.join(', ')} · {offer.vehicles.join(', ')}</dd></div>
        <div><dt>Requisitos</dt><dd>Cuenta habilitada y al menos {offer.minimumPriorDeliveries} entrega previa. Completar {offer.requiredCompletedDeliveries} entregas durante la vigencia, en estas zonas, franjas y vehículos{offer.enrollmentRequired ? ', después de inscribirte' : ''}.</dd></div>
      </dl>
      {offer.status === 'obtained' ? <p>Confirmación de ejemplo: {dateLabel(offer.obtainedAt!)}. Este beneficio ya figura obtenido en el historial simulado; no se vuelve a conceder.</p> : offer.enrollmentRequired ? offer.status === 'enrolled' ? <p>Inscripción simulada: {dateLabel(offer.enrolledAt!)}. Inscribirte no equivale a obtener el incentivo.</p> : <><button type="button" className="need-action-button" disabled={today < offer.startsOn || today > offer.endsOn} onClick={() => context.onEnroll(offer.id, config)}>Inscribirme (simulado)</button>{today < offer.startsOn && <p>La inscripción estará disponible al comenzar la vigencia.</p>}</> : <p>No requiere inscripción. Disponible no significa obtenido.</p>}
    </article>) : <p role="status">No hay incentivos simulados compatibles con esta opción. Puedes seguir con tu propuesta o cambiar las opciones.</p>}
    <p className="field-hint">No necesitas inscribirte para seguir. La inscripción no modifica la proyección ni la prioridad de pedidos, no te conecta y no reserva horarios. Los días de pausa no conceden bonos.</p>
  </section>
}
