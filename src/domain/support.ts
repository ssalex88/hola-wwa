export type SupportStatus = 'pending' | 'in-review' | 'resolved'
export interface SupportCase {
  id: string
  kind: 'payment' | 'order'
  description: string
  status: SupportStatus
}
export interface SupportData {
  cases: SupportCase[]
  selectedCaseId: string | null
  requests: Record<string, string>
}
export const supportStatusLabels: Record<SupportStatus, string> = {
  pending: 'Pendiente', 'in-review': 'En revisión', resolved: 'Resuelto',
}
export function selectSupportCase(data: SupportData, id: string): SupportData {
  return data.cases.some(item => item.id === id) ? { ...data, selectedCaseId: id } : data
}
export function requestSupport(data: SupportData, id: string, reference: Date): SupportData {
  const item = data.cases.find(item => item.id === id)
  if (!item || item.status === 'resolved' || data.requests[id] || !Number.isFinite(reference.getTime())) return data
  return { ...data, requests: { ...data.requests, [id]: reference.toISOString() } }
}
/** Only presenter controls call this command; opening or requesting never changes status. */
export function setDemoSupportStatus(data: SupportData, id: string, status: SupportStatus): SupportData {
  if (!Object.hasOwn(supportStatusLabels, status) || !data.cases.some(item => item.id === id)) return data
  return { ...data, cases: data.cases.map(item => item.id === id ? { ...item, status } : item) }
}
