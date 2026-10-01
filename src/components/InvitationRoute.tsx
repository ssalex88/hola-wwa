import { useState } from 'react'
import type { DemoProfile } from '../data/demoProfiles'

interface InviteProps {
  profile: DemoProfile
  previewReason?: string
  canContinue?: boolean
  onViewOptions: () => void
  onExitWithoutSchedule: () => void
  onNotInterested: () => void
  onBack: () => void
}

export function InvitationRoute({ profile, previewReason, canContinue = true, onViewOptions, onExitWithoutSchedule, onNotInterested, onBack }: InviteProps) {
  const [showSchedule, setShowSchedule] = useState(false)

  return <main className="external-route">
    <div className="external-demo-label"><span /> Demo · Invitación simulada</div>
    <button type="button" className="simulator-secondary-action" onClick={onBack}>Salir de la invitación</button>
    {previewReason && <section className="invitation-example-note" aria-label="Estado de la invitación"><strong>Ejemplo visual para presentar</strong><p>{previewReason}</p><p>Ver este ejemplo no crea otra invitación ni cambia tus preferencias. Para repetir todas las decisiones, usa Reiniciar perfil en los controles de demo.</p>{canContinue && <p>Puedes abrir el programa voluntariamente con Ver opciones.</p>}</section>}
    <section className="whatsapp-preview" aria-label="Vista previa tipo WhatsApp">
      <header className="whatsapp-header"><span className="wa-avatar">R</span><span><strong>Soy Rappi</strong><small>Cuenta de demostración</small></span><span className="wa-menu" aria-hidden="true">⋮</span></header>
      <div className="whatsapp-chat">
        <span className="chat-date">HOY</span>
        <article className="message-bubble">
          <p>¡Hola, {profile.name.split(' ')[0]}! Si tienes un rato, mira cuánto podrías generar según el tiempo que tengas. Tú decides si quieres volver.</p>
          <small>10:42 <span aria-label="simulado">✓✓</span></small>
        </article>
        {!showSchedule ? <div className="invite-choice"><button type="button" className="invite-primary" disabled={!canContinue} onClick={onViewOptions}>Ver opciones</button><button type="button" disabled={Boolean(previewReason)} onClick={() => setShowSchedule(true)}>Más adelante</button><button type="button" disabled={Boolean(previewReason)} onClick={onNotInterested}>No me interesa</button></div> : <div className="invite-schedule">
          <h2>A tu ritmo</h2>
          <p>Está bien. Puedes revisar una opción cuando te convenga. No programamos otro contacto.</p>
          <button type="button" onClick={onExitWithoutSchedule}>Salir por ahora</button>
          <button type="button" onClick={() => setShowSchedule(false)}>Volver a las opciones</button>
        </div>}
      </div>
      <footer className="invite-profile-note">Demo · Perfil ficticio: {profile.name} · Datos simulados</footer>
    </section>
  </main>
}

interface InvalidProps { onBack: () => void }

export function InvalidInvitationRoute({ onBack }: InvalidProps) {
  return <main className="invalid-invite-route">
    <div className="external-demo-label"><span /> Invitación simulada</div>
    <section className="invalid-invite-card"><div className="invalid-invite-icon">!</div><h1>Este enlace no es válido</h1><p>La invitación no existe o ya no está disponible. Puedes volver al inicio de la demo.</p><button type="button" onClick={onBack}>Volver al inicio</button></section>
  </main>
}
