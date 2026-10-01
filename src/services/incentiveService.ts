import { createDemoIncentives } from '../data/conditionalIncentives.ts'
import { getApplicableIncentives } from '../domain/incentives.ts'
import type { IncentiveRecords } from '../domain/incentives.ts'
import type { DemoProfile } from '../data/demoProfiles.ts'
import type { ProjectionConfiguration } from '../domain/projectionConfiguration.ts'
import { DEMO_REFERENCE_DATE } from './demoClock.ts'

export const DEMO_INCENTIVE_CATALOG = createDemoIncentives(DEMO_REFERENCE_DATE)

export function getDemoIncentives(profile: DemoProfile, config: ProjectionConfiguration, records: IncentiveRecords) {
  return getApplicableIncentives(DEMO_INCENTIVE_CATALOG, profile, config, DEMO_REFERENCE_DATE, records)
}
