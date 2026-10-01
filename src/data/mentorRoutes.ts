import type { ZoneId } from '../contracts/mentor.ts'

// Fictional demo associations, not road geometry, GPS proximity or distances.
// A same-zone query represents exploring around that manually chosen zone.
export const DEMO_NEARBY_ZONES: Readonly<Record<ZoneId, readonly ZoneId[]>> = {
  'lima-centro': ['lima-centro', 'jesus-maria'],
  'jesus-maria': ['jesus-maria', 'lima-centro', 'san-miguel'],
  'san-miguel': ['san-miguel', 'jesus-maria'],
  miraflores: ['miraflores', 'surco'],
  surco: ['surco', 'miraflores'],
}

// Only these scenarios have demonstration data. Others return no matches.
// Reverse queries use the same fictional corridor in reverse order.
export const DEMO_ROUTE_ZONES: readonly (readonly ZoneId[])[] = [
  ['lima-centro', 'jesus-maria', 'miraflores', 'surco'],
  ['san-miguel', 'jesus-maria', 'miraflores'],
]
