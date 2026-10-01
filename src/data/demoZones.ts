import type { Zone } from '../contracts/mentor.ts'

/** Identificadores estables para adaptar las zonas existentes al contrato compartido. */
export const DEMO_ZONES: readonly Zone[] = [
  { id: 'lima-centro', label: 'Lima Centro', simulated: true },
  { id: 'miraflores', label: 'Miraflores', simulated: true },
  { id: 'surco', label: 'Surco', simulated: true },
  { id: 'san-miguel', label: 'San Miguel', simulated: true },
  { id: 'jesus-maria', label: 'Jesús María', simulated: true },
]
