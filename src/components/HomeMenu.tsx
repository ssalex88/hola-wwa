import { useEffect, useRef } from 'react'
import type { DemoProfile } from '../data/demoProfiles'
import { Icon } from './Icon'

interface Props {
  open: boolean
  onClose: () => void
  profile: DemoProfile
  canOpenOpportunity: boolean
  onOpenSimulator: () => void
  onOpenMessages: () => void
  onOpenSupport: () => void
}

export function HomeMenu({ open, onClose, profile, canOpenOpportunity, onOpenSimulator, onOpenMessages, onOpenSupport }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  function goToStatus() {
    onClose()
    requestAnimationFrame(() => document.getElementById('status-heading')?.scrollIntoView({ behavior: 'smooth' }))
  }

  return <div className="menu-layer">
    <button className="menu-backdrop" type="button" onClick={onClose} aria-label="Cerrar menú" />
    <aside className="menu-drawer" role="dialog" aria-modal="true" aria-label="Menú de Soy Rappi">
      <div className="menu-top"><button ref={closeRef} className="menu-close" type="button" onClick={onClose} aria-label="Cerrar menú"><Icon name="close" /></button><span>Menú</span><Icon name="help" width="20" height="20" /></div>
      <div className="menu-profile"><span className="menu-avatar">{profile.initials}</span><div><strong>{profile.name}</strong><small>Perfil de demostración</small></div></div>
      <button className="menu-current" type="button" onClick={goToStatus}><Icon name="power" width="18" height="18" /><strong>Estado Actual</strong><Icon name="chevron" width="17" height="17" /></button>
      <div className="menu-scroll-content">
        {canOpenOpportunity && <button className="menu-program-entry" type="button" onClick={() => { onClose(); onOpenSimulator() }}><span><strong>Vuelve a tu ritmo</strong><small>Ver estimación cuando quieras</small></span><Icon name="chevron" width="18" height="18" /></button>}
        <button className="menu-item" type="button" onClick={() => { onClose(); onOpenMessages() }}><Icon name="bell" /><span><strong>Mensajes y recordatorios</strong><small>Tú eliges qué recibir</small></span><Icon name="chevron" width="18" /></button>
        <div className="menu-group"><h2>Pedidos</h2><MenuItem icon="gift" label="Campeonato" /><MenuItem icon="refresh" label="Devoluciones" /></div>
        <div className="menu-group"><h2>Finanzas</h2><MenuItem icon="wallet" label="Ganancias" /><MenuItem icon="gift" label="Incentivos" /></div>
        <div className="menu-group"><h2>Ayuda</h2><button className="menu-item" type="button" aria-label="Ayuda y soporte" onClick={() => { onClose(); onOpenSupport() }}><Icon name="help" /><span><strong>Ayuda y soporte</strong><small>Casos y solicitudes simulados</small></span><Icon name="chevron" width="18" /></button></div>
        <div className="menu-group"><h2>Acerca de Soy Rappi</h2><MenuItem icon="calendar" label="Reservas" /></div>
        <p className="menu-footnote">Demo · Datos simulados</p>
      </div>
    </aside>
  </div>
}

function MenuItem({ icon, label }: { icon: 'gift' | 'refresh' | 'wallet' | 'calendar'; label: string }) {
  return <button className="menu-item" type="button" disabled><Icon name={icon} width="21" height="21" /><span><strong>{label}</strong><small>No disponible en esta demo</small></span><Icon name="chevron" width="18" height="18" /></button>
}
