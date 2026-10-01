const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const base = process.env.DEMO_URL || 'http://127.0.0.1:5173'

async function main() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base + '/?operations=pilot')
    await page.getByRole('heading', { name: 'Sesión interactiva de Rappi Mentor', exact: true }).waitFor()
    // Vite source imports exercise the real browser adapter and sessionStorage.
    // No screen/navigation changes are necessary for the integration checks.
    const run = await page.evaluate(async () => {
      const { localMentorService: service, localDemoAdminService: admin } = await import('/src/services/mentor.local.ts')
      const unwrap = response => { if (!response.ok) throw new Error(JSON.stringify(response)); return response.data }
      unwrap(await admin.resetDemo())
      const seed = unwrap(await service.getProfile('inactive-recent'))
      let n = 0
      const ctx = () => ({ profileId: 'inactive-recent', requestId: `browser-${++n}` })
      const goal = unwrap(await service.saveGoal(ctx(), { name: 'Reparar bicicleta', targetAmount: 150, targetDate: null })).goals[0]
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(seed.clock.observedAt))
      unwrap(await service.saveContribution(ctx(), { goalId: goal.id, amount: 20, contributedOn: date }))
      unwrap(await service.startProgram(ctx(), { origin: 'app' }))
      const config = { zone: 'Lima Centro', hours: 2, moment: 'Tarde', vehicle: 'Bicicleta', scheduleMode: 'now', scheduledDate: null, expenseFuel: 0, expenseMaintenance: 2, expenseOther: 0 }
      const request = ctx()
      const projection = unwrap(await service.calculateProjection(request, config))
      const replay = unwrap(await service.calculateProjection(request, config))
      const saved = unwrap(await service.saveOption(ctx(), { projectionId: projection.id }))
      unwrap(await service.updatePreferences(ctx(), { ...saved.preferences, remindersAllowed: true }))
      const later = new Date(Date.parse(seed.clock.observedAt) + 3600000).toISOString()
      unwrap(await service.scheduleReminder(ctx(), { savedOptionId: saved.savedOptions[0].id, scheduledAt: later, explicitConsent: true }))
      unwrap(await service.confirmConnection(ctx(), { explicitConsent: true }))
      const next = new Date(Date.parse(seed.clock.observedAt) + 60000).toISOString()
      unwrap(await admin.advanceClock({ observedAt: next }))
      unwrap(await admin.registerDelivery(ctx(), { id: 'browser-return', status: 'completed', completedAt: next }))
      const paused = unwrap(await service.activatePause(ctx(), { endsAt: null, reason: 'Descanso' }))
      const blocked = await service.scheduleReminder(ctx(), { savedOptionId: saved.savedOptions[0].id, scheduledAt: later, explicitConsent: true })
      return { projection, replay, paused, blocked }
    })
    assert.deepEqual(run.projection, run.replay)
    assert.equal(run.paused.goalProgress[0].contributedAmount, 20)
    assert.equal(run.paused.progress.returnDeliveryId, 'browser-return')
    assert.equal(run.paused.reminders[0].status, 'cancelled')
    assert.equal(run.blocked.error.code, 'CONTACT_BLOCKED')
    await page.getByRole('button', { name: 'Actualizar sesión', exact: true }).click()
    await page.getByText('Aportes manuales declarados:', { exact: false }).waitFor()
    const table = page.getByRole('table', { name: 'Actividad de esta sesión · Datos simulados', exact: true })
    await page.waitForFunction(() => [...document.querySelectorAll('tr')].some(row => row.textContent === 'Regresos por entrega posterior1'))
    assert.equal(await table.getByRole('row').filter({ hasText: 'Regresos por entrega posterior' }).getByRole('cell').innerText(), '1')
    assert.equal(await table.getByRole('row').filter({ hasText: 'Proyecciones consultadas' }).getByRole('cell').innerText(), '1')
    await page.reload()
    await page.getByRole('table', { name: 'Actividad de esta sesión · Datos simulados', exact: true }).waitFor()
    assert.equal(await page.getByRole('table', { name: 'Actividad de esta sesión · Datos simulados', exact: true }).getByRole('row').filter({ hasText: 'Regresos por entrega posterior' }).getByRole('cell').innerText(), '1')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.setViewportSize({ width: 1280, height: 900 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.evaluate(async () => { const { localDemoAdminService } = await import('/src/services/mentor.local.ts'); await localDemoAdminService.resetDemo() })
    await page.getByRole('button', { name: 'Actualizar sesión', exact: true }).click()
    await page.waitForFunction(() => [...document.querySelectorAll('tr')].some(row => row.textContent === 'Regresos por entrega posterior0'))
    assert.deepEqual(errors, [])
    console.log('Mentor browser: contract flow, idempotency, persistence, pause, operations, reset and mobile/desktop passed.')
    await context.close()
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
