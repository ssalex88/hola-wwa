import { useEffect, useState } from 'react'
import type { DemoAdminService, MentorService, ProfileSnapshot, ServiceResult } from '../contracts/mentor'
import { localDemoAdminService, localMentorService } from '../services/mentor.local'

/** B-owned component: A connects it in the container, never in rider screens. */
export function MentorAdminControls({ profileId, service = localMentorService, admin = localDemoAdminService, onSnapshot }: {
  profileId: string; service?: MentorService; admin?: DemoAdminService; onSnapshot?: (snapshot: ProfileSnapshot) => void
}) {
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [observedAt, setObservedAt] = useState('')
  useEffect(() => { let active = true; setSnapshot(null); setNotice(''); void service.getProfile(profileId).then(result => { if (active && result.ok) { setSnapshot(result.data); setObservedAt(result.data.clock.observedAt) } else if (active && !result.ok) setNotice(result.error.message) }); return () => { active = false } }, [profileId, service])
  async function run(action: () => Promise<ServiceResult<unknown>>) {
    setBusy(true)
    try {
      const result = await action()
      if (!result.ok) { setNotice(result.error.message); return }
      const updated = await service.getProfile(profileId)
      if (updated.ok) { setSnapshot(updated.data); setObservedAt(updated.data.clock.observedAt); onSnapshot?.(updated.data); setNotice('Acción simulada completada.') } else setNotice(updated.error.message)
    } catch { setNotice('No se pudo completar la acción. Vuelve a intentarlo.') } finally { setBusy(false) }
  }
  const context = () => ({ profileId, requestId: crypto.randomUUID(), expectedRevision: snapshot?.revision })
  return <section className="operations-section" aria-labelledby="mentor-admin-heading">
    <h2 id="mentor-admin-heading">Controles de Rappi Mentor</h2>
    <p>Solo para el presentador · Ningún pedido, contacto o pago es real.</p>
    <p>{snapshot?.profile.name ?? 'Consultando perfil…'} · Revisión {snapshot?.revision ?? '—'}</p>
    <fieldset disabled={busy || !snapshot}><legend>Reloj y entregas simuladas</legend>
      <label>Instante observado ISO UTC<input value={observedAt} onChange={event => setObservedAt(event.target.value)} placeholder="2026-10-01T15:01:00.000Z" /></label>
      <button type="button" onClick={() => void run(() => admin.advanceClock({ observedAt }))}>Avanzar reloj</button>
      <button type="button" onClick={() => void run(async () => {
        const at = new Date(Date.parse(snapshot!.clock.observedAt) + 60000).toISOString()
        const clock = await admin.advanceClock({ observedAt: at })
        if (!clock.ok) return clock
        // advanceClock changes revisions: obtain a fresh context for the delivery.
        return admin.registerDelivery({ profileId, requestId: crypto.randomUUID() }, { id: crypto.randomUUID(), status: 'completed', completedAt: at })
      })}>Completar entrega simulada</button>
      {snapshot?.reminders.filter(r => r.status === 'scheduled').map(reminder => <button type="button" key={reminder.id} onClick={() => void run(() => admin.executeReminder(context(), { reminderId: reminder.id }))}>Ejecutar recordatorio {new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(new Date(reminder.scheduledAt))}</button>)}
      {snapshot?.cases.map(item => <label key={item.id}>{item.description}<select value={item.status} onChange={event => { const status = event.target.value as typeof item.status; void run(() => admin.setCaseStatus(context(), { caseId: item.id, status })) }}><option value="pending">Pendiente</option><option value="in-review">En revisión</option><option value="resolved">Resuelto</option></select></label>)}
      <button type="button" onClick={() => void run(() => admin.resetProfile(profileId))}>Reiniciar este perfil</button>
      <button type="button" onClick={() => void run(() => admin.resetDemo())}>Reiniciar todos los perfiles</button>
    </fieldset>
    <p role="status">{notice}</p>
  </section>
}
