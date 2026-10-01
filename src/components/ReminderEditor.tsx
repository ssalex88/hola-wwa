import { useState } from 'react'
import type { SavedProposal } from '../domain/proposals'
import { reminderError } from '../domain/reminders'
import { dateInLima } from '../domain/demoDates'
import { DEMO_REFERENCE_DATE } from '../services/demoClock'

export const reminderLabel = (instant: string) => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(new Date(instant)) + ' · Hora de Lima (UTC−5)'
const localTime = (instant: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant))

export function ReminderEditor({ saved, onSchedule, onCancel, requested = false }: { saved: SavedProposal; onSchedule: (date: string, time: string) => void; onCancel: () => void; requested?: boolean }) {
  const reminder = saved.reminder
  const [enabled, setEnabled] = useState(requested || reminder?.status === 'scheduled')
  const [date, setDate] = useState(reminder ? dateInLima(new Date(reminder.scheduledAt)) : '')
  const [time, setTime] = useState(reminder ? localTime(reminder.scheduledAt) : '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const prefix = `reminder-${saved.id}`
  return <fieldset className="proposal-reminder">
    <legend>Recordatorio para esta propuesta</legend>
    <p>Para revisar esta opción de {saved.hours} h en {saved.zone}. No se envía una notificación real.</p>
    {reminder && <p role="status">{reminder.status === 'scheduled' ? 'Recordatorio programado (simulado)' : 'Recordatorio ejecutado en la demo'}: revisar {saved.zone}, {saved.hours} h, el {reminderLabel(reminder.scheduledAt)}.{reminder.status === 'executed' && ' No se envió una notificación real.'}</p>}
    <label className="reminder-toggle"><input type="checkbox" checked={enabled} onChange={event => {
      const checked = event.target.checked
      setEnabled(checked); setError(''); setNotice('')
      if (!checked) { onCancel(); setDate(''); setTime(''); setNotice('Recordatorio desactivado.') }
    }} />Quiero un recordatorio</label>
    {enabled && <form noValidate onSubmit={event => {
      event.preventDefault()
      const invalid = reminderError(date, time, DEMO_REFERENCE_DATE)
      if (invalid) { setError(invalid); return }
      onSchedule(date, time); setError(''); setNotice('Recordatorio guardado en la demo. No se enviará una notificación real.')
    }}>
      <label htmlFor={`${prefix}-date`}>Fecha · Lima<input id={`${prefix}-date`} type="date" min={dateInLima(DEMO_REFERENCE_DATE)} value={date} aria-invalid={Boolean(error)} aria-describedby={`${prefix}-hint`} onChange={event => { setDate(event.target.value); setError(''); setNotice('') }} /></label>
      <label htmlFor={`${prefix}-time`}>Hora · Lima (UTC−5)<input id={`${prefix}-time`} type="time" value={time} aria-invalid={Boolean(error)} aria-describedby={`${prefix}-hint`} onChange={event => { setTime(event.target.value); setError(''); setNotice('') }} /></label>
      <p id={`${prefix}-hint`}>Fecha y hora futuras, en Lima. No se programa nada hasta guardar.</p>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="need-action-button">{reminder ? 'Guardar cambios del recordatorio' : 'Guardar recordatorio'}</button>
    </form>}
    {(enabled || reminder) && <button type="button" className="need-cancel" onClick={() => { onCancel(); setEnabled(false); setDate(''); setTime(''); setError(''); setNotice('Recordatorio cancelado.') }}>Cancelar recordatorio</button>}
    {notice && <p role="status">{notice}</p>}
  </fieldset>
}
