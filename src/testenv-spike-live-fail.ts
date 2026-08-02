// Test-only bootstrap for spike.ts (LIVE, one call fails). listMinds -> 500 so the spike
// records a failed step, exercising the "N call(s) failed" branch of the script.
import { Buffer } from 'node:buffer'

const b64u = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url')

process.env.MINDS_BUILDER_API_KEY = `${b64u({ alg: 'none' })}.${b64u({ humanId: 'human-1' })}.sig`
process.env.MIND_ID = ''
delete process.env.PORCHLIGHT_MOCK

const out: string[] = []
;(globalThis as Record<string, unknown>).__spikeOut = out
console.log = (...args: unknown[]): void => {
  out.push(args.map((a) => String(a)).join(' '))
}

const J = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
  const p = new URL(String(input)).pathname
  if (p === '/v1/messaging/events') return new Response('sse-down', { status: 500 })
  if (p === '/v1/messaging/conversation') return J({ alias: 'a', mindId: '' })
  if (p === '/v1/messaging/message') return J({ ok: true })
  if (p.startsWith('/v1/messaging/histories/')) return J([{ messageText: 'reply', senderType: 0, fingerprint: 'f' }])
  if (p.startsWith('/v1/humans/')) return new Response('humans-down', { status: 500 }) // listMinds fails
  return J({ email: 'mind@porch.test' })
}) as typeof fetch
