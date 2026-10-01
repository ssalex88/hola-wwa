import { saveProposal } from '../domain/proposals.ts'
import type { DemoPreferences } from './demoStorage.ts'
import { DEMO_REFERENCE_DATE } from './demoClock.ts'
export const saveDemoProposal = (preferences: DemoPreferences) => saveProposal(preferences, DEMO_REFERENCE_DATE, crypto.randomUUID())
