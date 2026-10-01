import type { DemoProfile } from '../data/demoProfiles.ts'
import type { AppRoute } from './demoRoutes.ts'
import { createDemoState, DEMO_STORAGE_KEY, loadDemoState, saveDemoState } from './demoStorage.ts'

/** These keys belong only to the prototype. Never clear the browser's entire storage. */
const retiredKeys = ['vuelve-a-tu-ritmo:demo:v1', 'vuelve-a-tu-ritmo:demo:v2', 'vuelve-a-tu-ritmo:demo-reference:v1']
const costKeys = ['all', '15–30 días', '31–60 días', 'Más de 60 días'].map(band => `vuelve-a-tu-ritmo:pilot-costs:v1:${band}`)

export function resetDemoSession(profiles: DemoProfile[]) {
  for (const key of [...retiredKeys, ...costKeys]) {
    try { localStorage.removeItem(key) } catch { /* Storage can be unavailable. */ }
  }
  try { sessionStorage.removeItem(DEMO_STORAGE_KEY) } catch { /* In-memory use still works. */ }
  const state = createDemoState(profiles)
  saveDemoState(state)
  return state
}

/** Called only on document startup. SPA route changes do not restart the scenario. */
export function startDemoSession(profiles: DemoProfile[], route: AppRoute) {
  const cleanEntry = route.kind === 'home' || route.kind === 'demo-controls' || route.kind === 'invitation'
  const state = cleanEntry ? resetDemoSession(profiles) : loadDemoState(profiles)
  if ('profileId' in route && profiles.some(profile => profile.id === route.profileId)) state.selectedProfileId = route.profileId
  saveDemoState(state)
  return state
}
