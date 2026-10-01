import { Icon } from './Icon'
import { DEMO_REFERENCE_DATE } from '../services/demoClock'
import { dateInLima, momentInLima, nextDate } from '../domain/demoDates'
import { PROJECTION_MOMENTS, PROJECTION_VEHICLES, PROJECTION_ZONES, type ProjectionConfiguration, type ProjectionErrors } from '../domain/projectionConfiguration'

interface Props {
  config: ProjectionConfiguration
  onChange: (patch: Partial<ProjectionConfiguration>) => void
  prefix: string
  errors?: ProjectionErrors
}

export function ProjectionFields({ config, onChange, prefix, errors = {} }: Props) {
  const error = (field: keyof ProjectionConfiguration) => errors[field] && <small id={`${prefix}-${field}-error`} role="alert">{errors[field]}</small>
  const accessibility = (field: keyof ProjectionConfiguration) => ({ 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${prefix}-${field}-error` : undefined })
  return <div className="projection-form">
    <label className="projection-field" htmlFor={`${prefix}-zone`}>Zona
      <select id={`${prefix}-zone`} value={config.zone} onChange={(event) => onChange({ zone: event.target.value })} {...accessibility('zone')}>
        <option value="">Elige una zona</option>{PROJECTION_ZONES.map((zone) => <option key={zone}>{zone}</option>)}
      </select>{error('zone')}
    </label>
    <fieldset className="projection-field"><legend>¿Cuánto tiempo tienes?</legend>
      <div className="duration-options">{[1, 2, 3].map((hours) => <button key={hours} type="button" className={`duration-option ${config.hours === hours ? 'selected' : ''}`} aria-pressed={config.hours === hours} onClick={() => onChange({ hours })}>{hours} {hours === 1 ? 'hora' : 'horas'}</button>)}</div>
    </fieldset>
    <fieldset className="projection-field"><legend>¿Cuándo te gustaría salir?</legend>
      <div className="schedule-options"><label><input type="radio" name={`${prefix}-schedule`} checked={config.scheduleMode === 'now'} onChange={() => onChange({ scheduleMode: 'now', scheduledDate: null, moment: momentInLima(DEMO_REFERENCE_DATE) })} /> Ahora</label><label><input type="radio" name={`${prefix}-schedule`} checked={config.scheduleMode === 'another-day'} onChange={() => onChange({ scheduleMode: 'another-day' })} /> Otro día</label></div>
      {config.scheduleMode === 'another-day' && <label className="projection-field nested-field" htmlFor={`${prefix}-date`}>Fecha
        <input id={`${prefix}-date`} type="date" min={nextDate(dateInLima(DEMO_REFERENCE_DATE))} value={config.scheduledDate ?? ''} onChange={(event) => onChange({ scheduledDate: event.target.value || null })} {...accessibility('scheduledDate')} />{error('scheduledDate')}
      </label>}
      {config.scheduleMode === 'another-day' ? <label className="projection-field nested-field" htmlFor={prefix + '-moment'}>Franja
        <select id={prefix + '-moment'} value={config.moment} onChange={event => onChange({ moment: event.target.value })} {...accessibility('moment')}>{PROJECTION_MOMENTS.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select>{error('moment')}
      </label> : <p className="field-hint">Ahora · {config.moment}, hora de Lima.</p>}
    </fieldset>
    <p className="vehicle-prefill"><Icon name="bike" width="18" /> Vehículo: <strong>{config.vehicle}</strong></p>
    <details className="progressive-options" open={Boolean(errors.hours || errors.vehicle)}><summary>Ajustar vehículo u horas</summary>
      <label className="projection-field" htmlFor={prefix + '-vehicle'}>Vehículo
        <select id={prefix + '-vehicle'} value={config.vehicle} onChange={event => onChange({ vehicle: event.target.value })} {...accessibility('vehicle')}>{PROJECTION_VEHICLES.map(vehicle => <option key={vehicle}>{vehicle}</option>)}</select>{error('vehicle')}
      </label>
      <label className="projection-field" htmlFor={prefix + '-hours'}>Horas para esta salida<input id={prefix + '-hours'} type="number" min="1" max="12" step="any" value={config.hours || ''} onChange={event => onChange({ hours: Number(event.target.value) })} {...accessibility('hours')} /></label>{error('hours')}
    </details>
  </div>
}

export function ExpenseFields({ config, onChange, prefix, errors = {} }: Props) {
  return <section className="projection-expenses" aria-labelledby={`${prefix}-expenses-heading`}>
    <h2 id={`${prefix}-expenses-heading`}>Gastos para esta salida</h2>
    <p>Ajusta los gastos de esta salida. Solo restamos los que ingreses.</p>
    {([['expenseFuel', 'Combustible / transporte'], ['expenseMaintenance', 'Mantenimiento'], ['expenseOther', 'Otros gastos']] as const).map(([key, label]) => <div className="expense-field" key={key}><label htmlFor={`${prefix}-${key}`}>{label}<span>S/ <input id={`${prefix}-${key}`} type="number" min="0" step="0.01" value={config[key]} onChange={(event) => onChange({ [key]: Number(event.target.value) })} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${prefix}-${key}-error` : undefined} /></span></label>{errors[key] && <small id={`${prefix}-${key}-error`} role="alert">{errors[key]}</small>}</div>)}
  </section>
}
