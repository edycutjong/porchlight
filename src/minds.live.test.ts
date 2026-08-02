import './testenv-live.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as minds from './minds.js'
import { matchAll } from './engine/conditionMatcher.js'
import { CONFIG, MODE } from './config.js'
import type { Departure, Member } from './db.js'

// ---------------------------------------------------------------------------
// LIVE integration: drive the REAL @animocabrands/minds-client-lib against a
// stubbed fetch layer. createMindsClient() captures globalThis.fetch at creation
// time (lazily, on the first op), so replacing it here exercises every LIVE code
// path in minds.ts honestly — a full HTTP round-trip per Mind call.
// ---------------------------------------------------------------------------

const stub = {
  replyText: '',
  preSendFail: false,
  noReply: false,
  spikeVariant: 0,
}

const J = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

globalThis.fetch = (async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input))
  const p = url.pathname

  // SSE event stream -> non-ok so waitForReply falls back to history polling.
  if (p === '/v1/messaging/events') return new Response('sse-down', { status: 500 })
  if (p === '/v1/messaging/conversation') return J({ alias: 'a', mindId: '' })
  if (p === '/v1/messaging/message') return J({ ok: true })
  if (p.startsWith('/v1/messaging/histories/')) {
    if (url.searchParams.get('limit') === '200') return stub.preSendFail ? J({ error: 'boom' }, 500) : J([])
    return stub.noReply ? J([]) : J([{ messageText: stub.replyText, senderType: 0, fingerprint: 'fp-1' }])
  }
  if (p.startsWith('/v1/humans/')) {
    if (stub.spikeVariant === 1) return new Response('down', { status: 500 }) // listMinds fails
    if (stub.spikeVariant === 2) return J([]) // empty mind list
    return J([{ mindId: 'mind-1', name: 'Porch' }])
  }
  // Fallthrough: /v1/minds/:id (getMind).
  return stub.spikeVariant === 1 ? J({}) : J({ email: 'mind@porch.test' })
}) as typeof fetch

const member = (over: Partial<Member> = {}): Member => ({
  id: 'm1', name: 'Maya', tier: 'VIP', mrrCents: 2500, status: 'cancelled', joinedAt: 't', ...over,
})
const departure = (over: Partial<Departure> = {}): Departure => ({
  id: 'd1', memberId: 'm1', cancelledAt: 't', reasonCategory: 'content_pivot',
  detail: '', verbatimQuote: 'the deep-dive interviews i loved', doNotContact: false, status: 'open', ...over,
})

test('config reports LIVE when a Builder API key is present', () => {
  assert.equal(CONFIG.mock, false)
  assert.equal(MODE, 'LIVE')
})

test('heroOnly getter reflects PORCHLIGHT_HERO_ONLY', () => {
  process.env.PORCHLIGHT_HERO_ONLY = '1'
  assert.equal(CONFIG.heroOnly, true)
  delete process.env.PORCHLIGHT_HERO_ONLY
  assert.equal(CONFIG.heroOnly, false)
})

test('interviewOnCancel (LIVE) parses a structured return-condition from the Mind reply', async () => {
  stub.replyText = 'Thanks for telling me. {"reasonCategory":"content_pivot","detail":"pivoted","verbatimQuote":"deep dives gone","doNotContact":false} — take care'
  const cond = await minds.interviewOnCancel(member({ cancelMessage: 'you pivoted away from deep dives' }))
  assert.equal(cond.reasonCategory, 'content_pivot')
  assert.equal(cond.verbatimQuote, 'deep dives gone')
  assert.equal(cond.doNotContact, false)
})

test('interviewOnCancel (LIVE) tolerates a missing cancel message and defaults doNotContact', async () => {
  // Reply omits doNotContact -> Zod default false. Member has no cancelMessage -> `?? ''`.
  stub.replyText = '{"reasonCategory":"other","detail":"d","verbatimQuote":"q"}'
  const cond = await minds.interviewOnCancel(member({ id: 'm2', cancelMessage: undefined }))
  assert.equal(cond.reasonCategory, 'other')
  assert.equal(cond.doNotContact, false)
})

test('interviewOnCancel (LIVE) survives a failed pre-send fingerprint probe', async () => {
  stub.preSendFail = true
  stub.replyText = '{"reasonCategory":"price","detail":"d","verbatimQuote":"too dear","doNotContact":false}'
  const cond = await minds.interviewOnCancel(member({ cancelMessage: 'too expensive' }))
  assert.equal(cond.reasonCategory, 'price')
  stub.preSendFail = false
})

test('interviewOnCancel (LIVE) throws when the reply has no JSON block', async () => {
  stub.replyText = 'no structured data here, sorry'
  await assert.rejects(() => minds.interviewOnCancel(member({ cancelMessage: 'x' })), /no JSON object in Mind reply/)
})

test('interviewOnCancel (LIVE) throws on an unbalanced brace (open, never closed)', async () => {
  // start !== -1 but end === -1 -> exercises the right side of the extractJson guard.
  stub.replyText = 'here it comes { but it never closes'
  await assert.rejects(() => minds.interviewOnCancel(member({ cancelMessage: 'x' })), /no JSON object in Mind reply/)
})

test('ask retries once and then throws when the Mind never replies within the timeout', async () => {
  stub.noReply = true // history poll returns nothing -> waitForReply times out on both attempts
  await assert.rejects(
    () => minds.interviewOnCancel(member({ cancelMessage: 'silence' })),
    /Mind reply timed out on member:/,
  )
  stub.noReply = false
})

test('doesChangeResolve (LIVE) parses the Mind verdict', async () => {
  stub.replyText = '{"resolves":true,"confidence":0.92,"rationale":"deep dives returned"}'
  const v = await minds.doesChangeResolve('the deep-dive interviews are back', departure())
  assert.equal(v.resolves, true)
  assert.equal(v.confidence, 0.92)
})

test('doesChangeResolve with forceMock short-circuits to the mock brain (no Mind call)', async () => {
  const v = await minds.doesChangeResolve('the deep-dive interviews are back', departure(), { forceMock: true })
  assert.equal(v.resolves, true)
  assert.match(v.rationale, /content_pivot/)
})

test('matchAll (LIVE) treats a low-confidence resolve as unresolved', async () => {
  stub.replyText = '{"resolves":true,"confidence":0.3,"rationale":"weak"}'
  const matches = await matchAll('the deep-dive interviews are back', [departure()])
  assert.equal(matches[0].verdict.resolves, true)
  assert.equal(matches[0].resolved, false) // confidence 0.3 < 0.6 threshold
})

test('draftWinback (LIVE) strips HTML tags and decodes entities', async () => {
  stub.replyText = '<p>Hi <b>Maya</b>,</p><p>welcome&nbsp;back &amp; &#39;yes&#39; &quot;q&quot; &lt;3 heart&gt;</p><br/>done'
  const msg = await minds.draftWinback('the deep-dive interviews are back', departure(), member())
  assert.ok(!msg.includes('<p>') && !msg.includes('<b>') && !msg.includes('</p>'), 'html tags stripped')
  assert.match(msg, /welcome back/) // &nbsp; -> space
  assert.match(msg, /back & 'yes'/) // &amp; -> & , &#39; -> '
  assert.match(msg, /"q"/) // &quot; -> "
  // Entity-decoded angle-bracket markup (&lt;3 heart&gt; -> <3 heart>) must NOT
  // survive: decoding happens before a loop-until-stable tag strip, so any markup
  // revealed by decoding (e.g. a smuggled &lt;script&gt;) is removed. Guards
  // against js/double-escaping + js/incomplete-multi-character-sanitization.
  assert.ok(!/<[^>]*>/.test(msg), 'decoded markup is fully stripped')
  assert.ok(!msg.includes('<3 heart>'), 'decoded angle-bracket sequence removed')
  assert.match(msg, /\ndone/) // <br/> -> newline
})

test('spike (LIVE) exercises six client-lib methods end-to-end', async () => {
  stub.spikeVariant = 0
  stub.replyText = 'ok'
  const rows = await minds.spike()
  assert.equal(rows.length, 6)
  assert.ok(rows.every((r) => r.ok), 'all six live calls succeed')
  assert.equal(rows[0].step, 'listMinds')
  assert.match(rows[1].note, /mind@porch.test/) // getMind returned an email
})

test('spike (LIVE) records a failed call without aborting the run', async () => {
  stub.spikeVariant = 1 // listMinds -> 500, getMind -> no email (=> "ok" fallback)
  stub.replyText = 'ok'
  const rows = await minds.spike()
  assert.equal(rows.length, 6)
  const listMinds = rows.find((r) => r.step === 'listMinds')!
  assert.equal(listMinds.ok, false)
  const getMind = rows.find((r) => r.step === 'getMind')!
  assert.equal(getMind.note, 'ok')
})

test('spike (LIVE) handles an empty mind list (no first-mind fallback)', async () => {
  stub.spikeVariant = 2 // listMinds -> [] so `mindId ||= ms[0]?.mindId` sees no element
  stub.replyText = 'ok'
  const rows = await minds.spike()
  assert.equal(rows.find((r) => r.step === 'listMinds')!.note, '0 mind(s)')
  assert.ok(rows.every((r) => r.ok))
})
