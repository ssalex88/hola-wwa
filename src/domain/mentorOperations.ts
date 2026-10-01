import type { ProfileSnapshot } from '../contracts/mentor.ts'
import type { MentorEvent } from '../services/mentorStorage.ts'

/** Descriptive session counts only. They have no comparison group or causal rate. */
export function evaluateMentorSession(profiles: ProfileSnapshot[], events: MentorEvent[]) {
  const actions = (names: string[]) => events.filter(event => names.includes(event.action))
  const queryEvents = actions(['calculateProjection', 'compareProjections', 'reviewOption'])
  const started = profiles.filter(p => p.progress.interventionStartedAt !== null)
  const returned = profiles.filter(p => p.progress.returnDeliveryId !== null)
  const continuity = returned.filter(p => p.deliveries.some(d => d.status === 'completed' && Date.parse(d.completedAt) >= Date.parse(p.progress.returnedAt!) + 24 * 86400000 && Date.parse(d.completedAt) < Date.parse(p.progress.returnedAt!) + 31 * 86400000))
  return {
    profiles: profiles.length,
    eligibleNow: profiles.filter(p => p.eligibility.eligible).length,
    prevention: profiles.filter(p => p.eligibility.track === 'prevention').length,
    started: started.length,
    appEntries: started.filter(p => p.progress.origin === 'app').length,
    externalEntries: started.filter(p => p.progress.origin === 'external').length,
    projectionQueries: queryEvents.reduce((sum, event) => sum + (event.action === 'compareProjections' ? 2 : 1), 0),
    projectionUsers: new Set(queryEvents.map(event => event.profileId)).size,
    saveEvents: actions(['saveOption']).length,
    savedOptions: profiles.reduce((sum, p) => sum + p.savedOptions.length, 0),
    returned: returned.length,
    continuity: continuity.length,
    activeGoals: profiles.reduce((sum, p) => sum + p.goals.filter(g => g.status === 'active').length, 0),
    manualContributions: profiles.reduce((sum, p) => sum + p.contributions.length, 0),
    declaredAmount: Math.round(profiles.reduce((sum, p) => sum + p.contributions.reduce((total, c) => total + Math.round(c.amount * 100), 0), 0)) / 100,
    paused: profiles.filter(p => p.pause?.status === 'active').length,
    declined: profiles.filter(p => p.invitations.some(i => i.mode === 'simulated-contact' && i.status === 'declined')).length,
    externalContacts: profiles.reduce((sum, p) => sum + p.invitations.filter(i => i.origin === 'external' && i.mode === 'simulated-contact').length, 0),
    scheduledReminders: profiles.reduce((sum, p) => sum + p.reminders.filter(r => r.status === 'scheduled').length, 0),
    executedReminders: profiles.reduce((sum, p) => sum + p.reminders.filter(r => r.status === 'executed').length, 0),
    helpRequests: profiles.reduce((sum, p) => sum + p.helpRequests.length, 0),
  }
}
