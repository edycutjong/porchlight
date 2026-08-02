import './testenv-spike-configured.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as minds from './minds.js'

const J = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// History always empty -> spike's waitForReply times out ('timed out') and getHistory sees 0 rows.
globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
  const p = new URL(String(input)).pathname
  if (p === '/v1/messaging/events') return new Response('sse-down', { status: 500 })
  if (p === '/v1/messaging/conversation') return J({ alias: 'a', mindId: '' })
  if (p === '/v1/messaging/message') return J({ ok: true })
  if (p.startsWith('/v1/messaging/histories/')) return J([])
  if (p.startsWith('/v1/humans/')) return J([{ mindId: 'first-listed', name: 'Other' }])
  return J({ email: 'mind@porch.test' }) // getMind
}) as typeof fetch

test('spike keeps a preconfigured MIND_ID and reports a reply timeout gracefully', async () => {
  const rows = await minds.spike()
  assert.equal(rows.length, 6)
  assert.ok(rows.every((r) => r.ok), 'every step still resolves ok')
  assert.equal(rows.find((r) => r.step === 'waitForReply')!.note, 'timed out')
  assert.equal(rows.find((r) => r.step === 'getHistory')!.note, '0 rows')
})
