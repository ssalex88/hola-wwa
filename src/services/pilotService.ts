import { createPilotCohort } from '../data/pilotCohort.ts'
import { evaluatePilot, type PilotBand } from '../domain/pilotEvaluation.ts'
import { DEMO_REFERENCE_DATE } from './demoClock.ts'
export const PILOT_COHORT = createPilotCohort(DEMO_REFERENCE_DATE)
export const getPilotResults = (band: PilotBand | 'all') => evaluatePilot(PILOT_COHORT, DEMO_REFERENCE_DATE, band)
export interface PilotCosts { operations: string; incentives: string; support: string }
const COST_KEY = 'vuelve-a-tu-ritmo:pilot-costs:v1'
export function loadPilotCosts(band: PilotBand | 'all' = 'all'): PilotCosts {
  const fallback = { operations: '', incentives: '', support: '' }
  try {
    const data = JSON.parse(localStorage.getItem(`${COST_KEY}:${band}`) ?? 'null')
    return data && typeof data === 'object' ? Object.fromEntries(Object.keys(fallback).map(key => [key, typeof data[key] === 'string' ? data[key] : ''])) as unknown as PilotCosts : fallback
  } catch { return fallback }
}
export function savePilotCosts(costs: PilotCosts, band: PilotBand | 'all' = 'all') {
  try { localStorage.setItem(`${COST_KEY}:${band}`,  JSON.stringify(costs)) } catch { /* Panel remains usable without storage. */ }
}
