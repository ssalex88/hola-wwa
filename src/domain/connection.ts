import type { DemoProfile } from '../data/demoProfiles.ts'
export interface DemoConnection { connectedAt: string | null }
/** Only an explicit confirmation calls this command. No delivery or contact effects. */
export function confirmDemoConnection(connection: DemoConnection, accountStatus: DemoProfile['accountStatus'], reference: Date): DemoConnection {
  if (accountStatus !== 'active' || connection.connectedAt || !Number.isFinite(reference.getTime())) return connection
  return { connectedAt: reference.toISOString() }
}
