import type { DemoPreferences } from '../services/demoStorage'

export function InvitationPreferences({ preferences, onChange }: { preferences: DemoPreferences; onChange: (preferences: DemoPreferences) => void }) {
  return <section className="invitation-preferences" aria-labelledby="invite-preferences-heading">
    <h2 id="invite-preferences-heading">Invitaciones para revisar opciones</h2>
    <label className="invite-permission"><input type="checkbox" checked={preferences.allowProgramInvitations} onChange={event => onChange({ ...preferences, allowProgramInvitations: event.target.checked })} /><span><strong>¿Quieres recibir invitaciones para revisar opciones?</strong><small>Puedes desactivarlas cuando quieras.</small></span></label>
    <p>No enviamos mensajes reales en esta demo. Cambiar esta preferencia no programa un recordatorio ni repite una invitación.</p>
    {preferences.preferredContactDate && <div className="pending-contact"><p>Contacto solicitado para el {preferences.preferredContactDate.split('-').reverse().join('/')}.</p><button type="button" onClick={() => onChange({ ...preferences, preferredContactDate: null })}>Cancelar contacto pendiente</button></div>}
  </section>
}
