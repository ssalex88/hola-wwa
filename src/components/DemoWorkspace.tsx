import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DemoControls, type DemoControlsProps } from './DemoControls'
import { Icon } from './Icon'
import './demo-panel.css'

interface Props {
  children: ReactNode
  screenKey: string
  controls: DemoControlsProps
}

export function DemoWorkspace({ children, screenKey, controls }: Props) {
  const [controlsOpen, setControlsOpen] = useState(() => window.innerWidth > 720)
  const screenRef = useRef<HTMLDivElement>(null)
  const previousScreen = useRef(screenKey)
  useEffect(() => {
    screenRef.current?.scrollTo({ top: 0 })
    if (previousScreen.current !== screenKey && window.matchMedia('(max-width: 720px)').matches) {
      screenRef.current?.closest('.phone-stage')?.scrollIntoView({ block: 'start' })
    }
    previousScreen.current = screenKey
  }, [screenKey])

  return <div className="demo-workspace">
    <header className="workspace-header">
      <a href="./" className="workspace-brand"><span className="workspace-mark"><Icon name="bike" /></span><span>Vuelve a tu ritmo<small>Innovathon Rappi × ULima</small></span></a>
      <span className="workspace-demo-badge"><i /> Demo · Datos simulados</span>
    </header>
    <div className="workspace-layout">
      <section className="phone-stage" aria-label="Vista del repartidor">
        <div className="phone-frame">
          <div className="phone-statusbar" aria-hidden="true"><span>9:41</span><span className="phone-camera" /><span className="phone-indicators"><i /><b>▰</b></span></div>
          <div className="phone-screen" ref={screenRef}>{children}</div>
          <div className="phone-bottom" aria-hidden="true"><span /></div>
        </div>
        <p className="phone-caption">Interactúa con la app dentro del celular.</p>
      </section>
      <aside className="presenter-sidebar" aria-label="Controles del presentador">
        <details className="presenter-panel" open={controlsOpen} onToggle={event => setControlsOpen(event.currentTarget.open)}>
          <summary>Controles de demo <Icon name="chevron" width="18" /></summary>
          <DemoControls {...controls} />
          <p className="sidebar-footnote">Todo ocurre en este navegador. No se envían mensajes ni se modifican datos de Rappi.</p>
        </details>
      </aside>
    </div>
  </div>
}
