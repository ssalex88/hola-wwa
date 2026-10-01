import type { RouteMatch, RouteQuery } from '../contracts/mentor.ts'
import { DEMO_NEARBY_ZONES, DEMO_ROUTE_ZONES } from '../data/mentorRoutes.ts'
import { MENTOR_ZONES, requireRule } from './mentorRules.ts'

export function exploreDemoRoute(query: RouteQuery): RouteMatch {
  requireRule(query && typeof query === 'object', 'VALIDATION', 'Indica origen y destino del catálogo.')
  const origin = MENTOR_ZONES.find(zone => zone.id === query.originZoneId)
  const destination = MENTOR_ZONES.find(zone => zone.id === query.destinationZoneId)
  requireRule(origin && destination, 'VALIDATION', 'Elige zonas del catálogo.')
  let ids: readonly typeof origin.id[] = []
  if (origin.id === destination.id) ids = DEMO_NEARBY_ZONES[origin.id]
  else {
    const corridor = DEMO_ROUTE_ZONES.find(zones =>
      (zones[0] === origin.id && zones.at(-1) === destination.id) ||
      (zones[0] === destination.id && zones.at(-1) === origin.id))
    if (corridor) ids = corridor[0] === origin.id ? corridor : [...corridor].reverse()
  }
  return {
    zones: [...new Set(ids)].map(id => ({ ...MENTOR_ZONES.find(zone => zone.id === id)! })),
    simulated: true,
    affectsOrderAssignment: false,
  }
}
