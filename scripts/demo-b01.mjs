import { createDemoProfiles } from '../src/data/demoProfiles.ts'
import { createDemoState } from '../src/services/demoStorage.ts'
import { createMentorProfileService } from '../src/services/mentor.local.ts'

// Isolated in-memory example: does not read or change a presenter's browser data.
const referenceDate = new Date('2026-10-01T15:00:00.000Z')
const profiles = createDemoProfiles(referenceDate)
const state = createDemoState(profiles, referenceDate)
const service = createMentorProfileService({ profiles, referenceDate, readState: () => state })
const selectedId = process.argv.find(item => item.startsWith('--profile='))?.slice('--profile='.length)
if (selectedId) {
  const response = await service.getProfile(selectedId)
  process.stdout.write(JSON.stringify(response, null, 2) + '\n')
  if (!response.ok) process.exitCode = 1
} else {
  const result = await service.listProfiles()
  if (!result.ok) throw new Error(result.error.message)
  const rows = []
  for (const profile of result.data) {
    const response = await service.getProfile(profile.id)
    if (!response.ok) throw new Error(response.error.message)
    const snapshot = response.data
    rows.push({ id: profile.id, name: profile.name, vehicle: profile.vehicle, zone: profile.zoneId,
      days: snapshot.eligibility.daysInactive ?? 'Sin entregas', eligible: snapshot.eligibility.eligible,
      paused: Boolean(snapshot.pause), deliveries: snapshot.deliveries.length })
  }
  console.log('Referencia: 1 de octubre de 2026, 10:00 a. m. · America/Lima · Datos simulados')
  console.table(rows)
  console.log('Snapshot completo: npm run demo:b01 -- --profile=inactive-recent')
}
