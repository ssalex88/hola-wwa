import { Icon } from './Icon'

/** Familiar home sections from the reference; their actions are outside the demo. */
export function SoyRappiHomeSections() {
  return <div className="soy-rappi-home-sections">
    <section className="earnings-banner" aria-labelledby="home-earnings-heading">
      <div className="earnings-art" aria-hidden="true"><span className="confetti one" /><span className="confetti two" /><span className="confetti three" /><span className="bill">S/</span></div>
      <div className="earnings-copy"><h2 id="home-earnings-heading">Tus ganancias, a un vistazo</h2><p>Este acceso no está disponible en la demo.</p><button type="button" disabled>Ver ganancias <Icon name="arrow" width="15" /></button></div>
    </section>

    <section className="registration-section" aria-labelledby="home-registration-heading">
      <h2 id="home-registration-heading"><Icon name="clipboard" width="18" /> Tu registro</h2>
      <div className="registration-grid">
        <button type="button" className="registration-card" disabled aria-label="Cuenta bancaria · No disponible en esta demo"><span className="registration-art bank"><Icon name="wallet" /></span><strong>Cuenta bancaria</strong><small>Solo visual</small></button>
        <button type="button" className="registration-card" disabled aria-label="Mochila · No disponible en esta demo"><span className="registration-art bag">▰</span><strong>Mochila</strong><small>Solo visual</small></button>
        <button type="button" className="registration-card" disabled aria-label="Tarjeta de compras · No disponible en esta demo"><span className="registration-art card"><Icon name="card" /></span><strong>Tarjeta de compras</strong><small>Solo visual</small></button>
      </div>
    </section>

    <section className="informative-section" aria-labelledby="home-videos-heading">
      <h2 id="home-videos-heading">Videos informativos</h2>
      <button type="button" className="video-card" disabled aria-label="Conoce las entregas de Turbo · Video no disponible en esta demo"><span className="video-thumbnail" aria-hidden="true"><span className="video-tag">⚡ Tienda turbo</span><span className="play-symbol">▶</span></span><strong>Conoce las entregas de Turbo</strong><small>No disponible en esta demo</small></button>
    </section>

    <section className="learn-section" aria-labelledby="home-learn-heading">
      <h2 id="home-learn-heading">Conoce más sobre Rappi</h2>
      <div className="learn-grid">
        <button type="button" className="learn-card" disabled aria-label="Novedades en los estados · No disponible en esta demo"><span className="learn-art bike" aria-hidden="true"><Icon name="bike" /></span><strong>Novedades en los estados</strong><small>No disponible en esta demo</small></button>
        <button type="button" className="learn-card" disabled aria-label="Beneficios por repartir · No disponible en esta demo"><span className="learn-art gift" aria-hidden="true"><Icon name="gift" /></span><strong>Beneficios por repartir</strong><small>No disponible en esta demo</small></button>
      </div>
    </section>
  </div>
}
