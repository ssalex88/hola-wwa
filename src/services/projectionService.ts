import { SIMULATED_PROJECTION_RATES } from '../data/projectionRates'
import { calculateProjection } from '../domain/projection'
import type { ProjectionConfiguration } from '../domain/projectionConfiguration'

/** Local data adapter; an API can replace this without changing the formula or screens. */
export function getDemoProjection(config: ProjectionConfiguration) {
  return calculateProjection(config, SIMULATED_PROJECTION_RATES)
}
