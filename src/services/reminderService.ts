import { scheduleReminder, cancelReminder, executeReminder } from '../domain/reminders.ts'
import type { DemoPreferences } from './demoStorage.ts'
import { DEMO_REFERENCE_DATE } from './demoClock.ts'

export const reminderService = {
  schedule: (state: DemoPreferences, id: string, date: string, time: string) => scheduleReminder(state, id, date, time, DEMO_REFERENCE_DATE),
  cancel: (state: DemoPreferences, id: string) => cancelReminder(state, id),
  simulateExecution: (state: DemoPreferences, id: string) => {
    const reminder = state.savedProposals.find(item => item.id === id)?.reminder
    // Advance only this simulated execution to the chosen instant; keep the demo reference fixed.
    return reminder ? executeReminder(state, id, new Date(reminder.scheduledAt)) : state
  },
}
