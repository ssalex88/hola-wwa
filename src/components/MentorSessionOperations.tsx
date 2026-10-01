import { useEffect, useState } from 'react'
import { evaluateMentorSession } from '../domain/mentorOperations'
import { getMentorOperations } from '../services/mentor.local'

export function MentorSessionOperations({ load = getMentorOperations }: { load?: typeof getMentorOperations }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof load>> | null>(null)
  const [loading, setLoading] = useState(false)
  async function refresh() { setLoading(true); try { setResult(await load()) } finally { setLoading(false) } }
  useEffect(() => { let active = true; void load().then(value => { if (active) setResult(value) }); return () => { active = false } }, [load])
  const metrics = result?.ok ? evaluateMentorSession(result.data.profiles, result.data.events) : null
  const rows = metrics ? [
    ['Perfiles elegibles ahora', metrics.eligibleNow], ['Perfiles en prevención', metrics.prevention],
    ['Intervenciones iniciadas', metrics.started], ['Entradas por app', metrics.appEntries], ['Entradas externas', metrics.externalEntries],
    ['Proyecciones consultadas', metrics.projectionQueries], ['Personas que consultaron', metrics.projectionUsers],
    ['Eventos de guardado', metrics.saveEvents], ['Opciones guardadas actuales', metrics.savedOptions],
    ['Regresos por entrega posterior', metrics.returned], ['Continuidad entre días 24 y 30', metrics.continuity],
    ['Metas activas', metrics.activeGoals], ['Aportes manuales actuales', metrics.manualContributions],
    ['Perfiles en pausa', metrics.paused], ['Perfiles que rechazaron invitaciones', metrics.declined],
    ['Contactos externos simulados', metrics.externalContacts], ['Recordatorios pendientes', metrics.scheduledReminders],
    ['Recordatorios ejecutados', metrics.executedReminders], ['Solicitudes de ayuda', metrics.helpRequests],
  ] : []
  return <section className="operations-section" aria-labelledby="mentor-session-heading">
    <h2 id="mentor-session-heading">Sesión interactiva de Rappi Mentor</h2>
    <p>Datos del motor local: independientes de los 24 participantes de la cohorte ficticia. Las pantallas anteriores se conectarán a este servicio al integrar. Estos conteos describen la sesión y no prueban impacto.</p>
    <button type="button" disabled={loading} onClick={() => void refresh()}>{loading ? 'Actualizando…' : 'Actualizar sesión'}</button>
    <div role="status">{result === null ? 'Consultando sesión…' : !result.ok ? result.error.message : null}</div>
    {metrics && result?.ok && <>
      <p>Corte: {new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(new Date(result.data.clock.observedAt))}, hora de Lima. {metrics.profiles} perfiles simulados.</p>
      <table className="operations-table"><caption>Actividad de esta sesión · Datos simulados</caption><thead><tr><th scope="col">Indicador</th><th scope="col">Cantidad</th></tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table>
      <p>Aportes manuales declarados: {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(metrics.declaredAmount)}. No son pagos ni ingresos verificados. Las proyecciones y entregas no generan aportes.</p>
      <p>Las vistas previas y reintentos con el mismo requestId no cuentan como contactos ni eventos nuevos. Reiniciar un perfil elimina sus datos y eventos de sesión.</p>
    </>}
  </section>
}
