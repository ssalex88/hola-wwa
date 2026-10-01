import type { ConditionalIncentive } from '../data/conditionalIncentives.ts'
import type { DemoProfile } from '../data/demoProfiles.ts'
import type { ProjectionConfiguration } from './projectionConfiguration.ts'
import { validateProjectionConfiguration } from './projectionConfiguration.ts'
import { dateInLima, isCalendarDate } from './demoDates.ts'

export interface IncentiveRecords {
  incentiveEnrollments: Record<string, string>
  incentiveAwards: Record<string, string>
}

export type ApplicableIncentive = ConditionalIncentive & { status: 'available' | 'enrolled' | 'obtained'; enrolledAt: string | null; obtainedAt: string | null }

export function getApplicableIncentives(catalog: ConditionalIncentive[], profile: DemoProfile, config: ProjectionConfiguration, reference: Date, records: IncentiveRecords): ApplicableIncentive[] {
  const today = dateInLima(reference)
  if (profile.accountStatus !== 'active' || Object.keys(validateProjectionConfiguration(config, today)).length) return []
  const selectedDate = config.scheduleMode === 'now' ? today : config.scheduledDate!
  const priorDeliveries = profile.deliveries.filter((delivery) => delivery.status === 'completed' && Number.isFinite(Date.parse(delivery.completedAt)) && Date.parse(delivery.completedAt) <= reference.getTime()).length
  return catalog.filter((offer) => offer.publication === 'published' && offer.publishedOn && isCalendarDate(offer.publishedOn) && offer.publishedOn <= today
    && isCalendarDate(offer.startsOn) && isCalendarDate(offer.endsOn) && offer.startsOn <= selectedDate && selectedDate <= offer.endsOn
    && offer.zones.includes(config.zone) && offer.vehicles.includes(profile.vehicle) && offer.vehicles.includes(config.vehicle)
    && offer.moments.includes(config.moment) && priorDeliveries >= offer.minimumPriorDeliveries)
    .map((offer) => {
      const validRecord = (value: string | undefined) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= reference.getTime()
        && dateInLima(new Date(value)) >= offer.startsOn && dateInLima(new Date(value)) <= offer.endsOn
        && dateInLima(new Date(value)) >= offer.publishedOn!
      const enrolledAt = validRecord(records.incentiveEnrollments[offer.id]) ? records.incentiveEnrollments[offer.id] : null
      const obtainedAt = validRecord(records.incentiveAwards[offer.id]) ? records.incentiveAwards[offer.id] : null
      return { ...offer, enrolledAt, obtainedAt, status: obtainedAt ? 'obtained' : offer.enrollmentRequired && enrolledAt ? 'enrolled' : 'available' }
    })
}

/** An enrollment records intent only; it never writes rewards, earnings, deliveries or priority. */
export function enrollIncentive<T extends IncentiveRecords>(records: T, catalog: ConditionalIncentive[], profile: DemoProfile, config: ProjectionConfiguration, reference: Date, incentiveId: string): T {
  const offer = getApplicableIncentives(catalog, profile, config, reference, records).find((item) => item.id === incentiveId)
  if (!offer || !offer.enrollmentRequired || offer.status !== 'available') return records
  const today = dateInLima(reference)
  // A campaign can apply to a later option while its enrollment period has not opened yet.
  if (today < offer.startsOn || today > offer.endsOn) return records
  return { ...records, incentiveEnrollments: { ...records.incentiveEnrollments, [incentiveId]: reference.toISOString() } }
}
