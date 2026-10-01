import { ReturnReview, type ReturnContext } from './ReturnReview'
import { ConnectionScreen } from './ConnectionScreen'
import type { DemoConnection } from '../domain/connection'
import type { SupportContext } from './SupportPanel'
import type { IncentiveContext } from './IncentivePanel'
import { useCallback, useRef, useState } from 'react'
import type { DemoProfile } from '../data/demoProfiles'
import type { DemoPreferences } from '../services/demoStorage'
import { InvitationPreferences } from './InvitationPreferences'
import { HomeMenu } from './HomeMenu'
import { Icon } from './Icon'
import { ProgramConfigurator } from './ProgramConfigurator'
import { getReturnResult } from '../domain/returnTracking'
import { SoyRappiHomeSections } from './SoyRappiHomeSections'
import { SupportScreen } from './SupportScreen'

interface Props {
  returnContext: ReturnContext
  onNewProjection: () => void
  connection: DemoConnection
  connectionOpen: boolean
  messagesOpen: boolean
  supportOpen: boolean
  onOpenSupport: () => void
  onOpenMessages: () => void
  onGoConnection: () => void
  onConfirmConnection: () => void
  onDisconnect: () => void
  support: SupportContext
  incentives: IncentiveContext
  profile: DemoProfile
  showOpportunity: boolean
  canOpenOpportunity: boolean
  simulatorOpen: boolean
  preferences: DemoPreferences
  inviteNotice: string
  onPreferencesChange: (preferences: DemoPreferences) => void
  onDismissOpportunity: () => void
  onOpenSimulator: () => void
  onCloseSimulator: () => void
}

export function HomeScreen({ returnContext, onNewProjection, connection, connectionOpen, messagesOpen, supportOpen, onOpenSupport, onOpenMessages, onGoConnection, onConfirmConnection, onDisconnect, support, incentives, profile, showOpportunity, canOpenOpportunity, simulatorOpen, preferences, inviteNotice, onPreferencesChange, onDismissOpportunity, onOpenSimulator, onCloseSimulator }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    requestAnimationFrame(() => menuButtonRef.current?.focus())
  }, [])

  return <div className="app-shell">
    <header className="topbar" id="status-heading">
      <button ref={menuButtonRef} className="menu-trigger" type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú" aria-expanded={menuOpen} aria-controls="home-menu"><Icon name="menu" /></button>
      <span className="connection-label">{connection.connectedAt ? 'Conectado · Demo' : 'Estás desconectado'}</span>
      <button className="refresh-button" type="button" disabled aria-label="Actualizar estado · No disponible en esta demo" title="No disponible en esta demo"><Icon name="refresh" /></button>
      <span className={`connection-switch ${connection.connectedAt ? 'is-connected' : ''}`} role="switch" aria-checked={Boolean(connection.connectedAt)} aria-disabled="true" aria-label="Estado de conexión"><span /></span>
    </header>
    <div id="home-menu"><HomeMenu open={menuOpen} onClose={closeMenu} profile={profile} canOpenOpportunity={canOpenOpportunity} onOpenSimulator={onOpenSimulator} onOpenMessages={onOpenMessages} onOpenSupport={onOpenSupport} /></div>
    {connectionOpen ? <ConnectionScreen profile={profile} connection={connection} onConfirm={onConfirmConnection} onDisconnect={onDisconnect} backToProgram={canOpenOpportunity} onBack={canOpenOpportunity ? onOpenSimulator : onCloseSimulator} />
      : supportOpen ? <SupportScreen profile={profile} support={support} onBack={onCloseSimulator} />
      : messagesOpen ? <main className="home-content messages-screen"><button className="simulator-back" type="button" onClick={onCloseSimulator}>← Volver al inicio</button><span className="projection-data-label">Demo · Datos simulados</span><h1>Mensajes y recordatorios</h1><InvitationPreferences preferences={preferences} onChange={onPreferencesChange} /><section className="messages-reminders"><h2>Recordatorios de tus opciones</h2><p>Son distintos de las invitaciones. Tú eliges qué opción recordar y a qué hora.</p>{preferences.savedProposals.length ? <button className="need-action-button" type="button" onClick={onOpenSimulator}>Revisar mis opciones guardadas</button> : <p>Aún no tienes opciones guardadas. Puedes pedir un recordatorio después de calcular una.</p>}</section></main>
      : simulatorOpen ? <ProgramConfigurator onGoConnection={onGoConnection} support={support} incentives={incentives} profile={profile} preferences={preferences} onChange={onPreferencesChange} onClose={onCloseSimulator} />
      : <main className="home-content clean-home soy-rappi-home">
        <div className="prototype-label">Demo · Datos simulados</div>
        <section className="welcome-section"><h1>¡Hola, {profile.name}!</h1><p>Encuentra aquí tus opciones para conectarte a Soy Rappi.</p></section>
        {showOpportunity && <section className="return-card main-opportunity" aria-labelledby="return-heading">
          <span className="return-kicker">VUELVE A TU RITMO</span>
          <h2 id="return-heading">¿Tienes un rato para repartir?</h2>
          <p>Mira cuánto podrías generar según tu zona y el tiempo que tengas. Tú decides cuándo conectarte.</p>
          <button type="button" className="return-primary" onClick={onOpenSimulator}>Calcular cuánto podría generar <Icon name="arrow" width="17" /></button>
          <button type="button" className="opportunity-dismiss" onClick={onDismissOpportunity}>Ahora no</button>
        </section>}
        {inviteNotice && <p className="invite-notice" role="status">{inviteNotice}</p>}
        <ReturnReview context={returnContext} support={support} onNewProjection={onNewProjection} onSaveOuting={onNewProjection} />
        {!showOpportunity && canOpenOpportunity && returnContext.tracking.interventionStartedAt && !getReturnResult(returnContext.deliveries, returnContext.tracking) && <section className="resume-option"><h2>Tu opción sigue aquí</h2><p>Puedes revisarla o cambiarla cuando te convenga.</p><button type="button" className="need-action-button" onClick={onOpenSimulator}>Continuar con mi opción</button></section>}
        {!showOpportunity && !returnContext.tracking.interventionStartedAt && profile.accountStatus === 'active' && <p className="home-quiet-note">{canOpenOpportunity ? 'Puedes revisar tus opciones cuando quieras desde el menú.' : profile.deliveries.length ? 'Cuando quieras organizar otra salida, revisa las opciones de Soy Rappi.' : 'Para empezar a repartir, completa los pasos de registro en Soy Rappi.'}</p>}
        {profile.accountStatus === 'blocked' && <section className="blocked-guidance"><h2>Tu cuenta necesita atención</h2><p>Revisa la ayuda de acceso o contacta al soporte de Soy Rappi por sus canales oficiales antes de volver a repartir.</p><button type="button" className="need-action-button" onClick={onOpenSupport}>Revisar ayuda de acceso</button></section>}
        <SoyRappiHomeSections />
      </main>}
  </div>
}
