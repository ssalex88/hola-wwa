export function dateInLima(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function isFutureDate(value: string, referenceDate: string): boolean {
  return isCalendarDate(value) && value > referenceDate
}

export function nextDate(referenceDate: string): string {
  const date = new Date(`${referenceDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function momentInLima(date: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', hourCycle: 'h23' }).format(date))
  return hour >= 6 && hour < 12 ? 'Mañana' : hour >= 12 && hour < 18 ? 'Tarde' : 'Noche'
}
