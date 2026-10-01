import type { DemoProfile } from '../data/demoProfiles'
import { SupportPanel, type SupportContext } from './SupportPanel'

export function SupportScreen({ profile, support, onBack }: { profile: DemoProfile; support: SupportContext; onBack: () => void }) {
  return <main className="home-content messages-screen support-screen">
    <span className="projection-data-label">Demo · Datos simulados</span>
    <h1>Ayuda y soporte</h1>
    {profile.accountStatus === 'blocked' && <section className="support-access-guidance">
      <h2>Ayuda con el acceso a tu cuenta</h2>
      <p>Para revisar el bloqueo, utiliza la ayuda de acceso de Soy Rappi o sus canales oficiales de soporte. Esta demo no tramita desbloqueos.</p>
    </section>}
    <SupportPanel context={support} onBack={onBack} backLabel="Volver al inicio" />
  </main>
}
