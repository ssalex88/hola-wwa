import type { MentorProfileService } from '../contracts/mentor.ts'
import { createDemoProfiles, type DemoProfile } from '../data/demoProfiles.ts'
import { DEMO_REFERENCE_DATE } from './demoClock.ts'
import { loadDemoState, type DemoState } from './demoStorage.ts'
import { contractProfile, profileSnapshot } from './mentorProfileSnapshot.ts'

export interface MentorProfileDependencies {
  profiles: DemoProfile[]
  referenceDate: Date
  readState: () => DemoState
}

/** Fresh reads share the existing session; consulting never resets or writes it. */
export function createMentorProfileService({ profiles, referenceDate, readState }: MentorProfileDependencies): MentorProfileService {
  const reference = new Date(referenceDate.getTime())
  if (!Number.isFinite(reference.getTime())) throw new RangeError('La referencia de la demo debe ser válida.')
  const seeds = structuredClone(profiles)
  return {
    async getProfile(profileId) {
      const seed = seeds.find(item => item.id === profileId)
      if (!seed) return { ok: false, error: { code: 'NOT_FOUND', message: 'Este perfil de demostración no existe.' } }
      try {
        const data = readState().profileDataById[profileId]
        if (!data) return { ok: false, error: { code: 'NOT_FOUND', message: 'No hay estado para este perfil de demostración.' } }
        const snapshot = profileSnapshot(seed, data, reference)
        return { ok: true, data: snapshot, revision: snapshot.revision }
      } catch {
        return { ok: false, error: { code: 'UNEXPECTED', message: 'No pudimos consultar este perfil. Vuelve a intentarlo.' } }
      }
    },
    async listProfiles() {
      try {
        const state = readState()
        const data = seeds.map(seed => contractProfile(seed, state.profileDataById[seed.id], reference))
        return { ok: true, data: structuredClone(data), revision: Math.max(0, ...Object.values(state.profileDataById).map(item => item.revision)) }
      } catch {
        return { ok: false, error: { code: 'UNEXPECTED', message: 'No pudimos consultar los perfiles. Vuelve a intentarlo.' } }
      }
    },
  }
}

const profiles = createDemoProfiles(DEMO_REFERENCE_DATE)
export const localMentorProfileService = createMentorProfileService({
  profiles, referenceDate: DEMO_REFERENCE_DATE, readState: () => loadDemoState(profiles),
})
