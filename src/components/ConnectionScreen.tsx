import type { DemoProfile } from '../data/demoProfiles'
import type { DemoConnection } from '../domain/connection'
export function ConnectionScreen({ profile, connection, onConfirm, onDisconnect, onBack, backToProgram }: { profile: DemoProfile; connection: DemoConnection; onConfirm: () => void; onDisconnect: () => void; onBack: () => void; backToProgram: boolean }) {
  return <main className="home-content connection-screen">
    <span className="projection-data-label">Demo · Datos simulados</span>
    <h1>{connection.connectedAt ? 'Estás conectado en la demo' : 'Tú decides cuándo conectarte'}</h1>
    <p>Esta conexión es simulada. No se asignan pedidos reales.</p>
    <div className="simulator-note"><strong>No asumes un horario.</strong><span>La propuesta no es una reserva. Puedes conectarte y desconectarte cuando quieras.</span></div>
    {profile.accountStatus !== 'active' ? <p role="status">Tu cuenta simulada está bloqueada. Revisa la orientación de acceso o soporte antes de conectarte.</p> : connection.connectedAt ? <><p role="status">Conexión confirmada. Puedes desconectarte cuando quieras.</p><button type="button" className="simulator-secondary-action" onClick={onDisconnect}>Desconectarme (simulado)</button></> : <button type="button" className="simulator-primary" onClick={onConfirm}>Confirmar conexión simulada</button>}
    <button type="button" className="need-action-button" onClick={onBack}>{backToProgram ? 'Volver a mi propuesta' : 'Volver al inicio'}</button>
  </main>
}
