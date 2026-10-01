import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('production contract preserves the agreed signatures without a deployment dependency on docs', async () => {
  const [agreed, production] = await Promise.all([
    readFile(new URL('../docs/integracion/mentor-contract.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/contracts/mentor.ts', import.meta.url), 'utf8'),
  ])
  const normalize = source => source.replaceAll('\r\n', '\n').trim()
  assert.equal(normalize(agreed), "/** HU-00: una sola definición compartida del contrato. */\nexport type * from '../../src/contracts/mentor.ts'")
  assert.ok(production.includes('export interface MentorService'))
  assert.equal(production.includes('../../docs/'), false)
})
