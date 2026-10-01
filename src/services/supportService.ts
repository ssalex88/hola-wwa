import type { SupportData, SupportStatus } from '../domain/support.ts'
import { selectSupportCase, requestSupport, setDemoSupportStatus } from '../domain/support.ts'
import { DEMO_REFERENCE_DATE } from './demoClock.ts'

/** Local adapter: an API can later replace these commands. No network requests. */
export const supportService = {
  select: (data: SupportData, id: string) => selectSupportCase(data, id),
  request: (data: SupportData, id: string) => requestSupport(data, id, DEMO_REFERENCE_DATE),
  setDemoStatus: (data: SupportData, id: string, status: SupportStatus) => setDemoSupportStatus(data, id, status),
}
