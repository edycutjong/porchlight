import './testenv-server-mock.js'
import './server.js' // starts app.listen(0) at import; helper captured the Server
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

const server = (globalThis as Record<string, unknown>).__porchServer as Server
const base = (): string => `http://127.0.0.1:${(server.address() as AddressInfo).port}`

const post = (path: string, body: unknown, cookie?: string) =>
  fetch(`${base()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })

before(async () => {
  await new Promise((r) => setTimeout(r, 150)) // let the ephemeral bind complete
})
after(() => {
  server.unref()
  server.close()
})

test('GET /api/state returns the board, roster and open departures', async () => {
  const r = await fetch(`${base()}/api/state`)
  const j = (await r.json()) as {
    mode: string
    board: unknown
    roster: unknown[]
    openDepartures: unknown[]
    curated: unknown[]
    liveAvailable: boolean
  }
  assert.equal(j.mode, 'MOCK')
  assert.ok(j.board && Array.isArray(j.roster))
  assert.ok(Array.isArray(j.openDepartures))
  assert.ok(Array.isArray(j.curated))
  // With no Builder API key there is no live path, and the UI must be told so.
  assert.equal(j.liveAvailable, false)
})

test('the demo baseline is the pinned fixture, not an empty or ad-hoc DB', async () => {
  const j = (await (await fetch(`${base()}/api/state`)).json()) as {
    roster: unknown[]
    openDepartures: { id: string; verbatimQuote: string }[]
  }
  // Every cached verdict is keyed by a departure id from demoSeed.json. If the server
  // ever stops serving that fixture, the whole captured cache silently orphans.
  assert.ok(j.roster.length > 0, 'roster must come from the pinned seed')
  assert.ok(j.openDepartures.length > 0, 'seed must carry open departures')
  assert.ok(j.openDepartures.every((d) => d.id && d.verbatimQuote))
})

// --- the R5 guarantee -------------------------------------------------------
// mockMatch() is a keyword classifier — precisely what Porchlight claims to beat.
// A deployment without credentials must refuse to answer rather than quietly serve it.
test('with no Mind credentials the live paths refuse rather than fall back to keywords', async () => {
  const live = await post('/api/change/live', { departureId: 'x', text: 'the interviews are back' })
  assert.equal(live.status, 503)
  const liveErr = (await live.json()) as { error: string }
  assert.match(liveErr.error, /never answers with the keyword mock/i)

  const cancel = await post('/api/cancel', { memberId: 'x', message: 'the interviews are gone' })
  assert.equal(cancel.status, 503)
  assert.match(((await cancel.json()) as { error: string }).error, /live Mind/i)
})

test('POST /api/change rejects an unknown curated key', async () => {
  const r = await post('/api/change', { key: 'not-a-real-change' })
  assert.equal(r.status, 400)
  assert.match(((await r.json()) as { error: string }).error, /unknown change/)
})

test('POST /api/change rejects a missing key rather than defaulting to empty', async () => {
  const r = await post('/api/change', {})
  assert.equal(r.status, 400)
})

// --- per-visitor isolation --------------------------------------------------
test('two visitors get independent demo state', async () => {
  const a = await fetch(`${base()}/api/state`)
  const b = await fetch(`${base()}/api/state`)
  const cookieA = a.headers.get('set-cookie')
  const cookieB = b.headers.get('set-cookie')
  assert.ok(cookieA && cookieB, 'each new visitor is issued a session cookie')
  assert.notEqual(cookieA, cookieB, 'sessions must not be shared between visitors')
})

test('a returning visitor keeps their session cookie', async () => {
  const first = await fetch(`${base()}/api/state`)
  const sid = first.headers.get('set-cookie')!.split(';')[0]
  const second = await fetch(`${base()}/api/state`, { headers: { cookie: sid } })
  // A recognised cookie is reused, so no new one is minted.
  assert.equal(second.headers.get('set-cookie'), null)
})

test('a malformed session cookie is replaced, not trusted', async () => {
  const r = await fetch(`${base()}/api/state`, { headers: { cookie: 'porchlight_sid=../../etc/passwd' } })
  assert.equal(r.status, 200)
  assert.ok(r.headers.get('set-cookie'), 'a fresh well-formed sid is issued')
})

test('POST /api/reset clears this visitor and answers ok', async () => {
  const first = await fetch(`${base()}/api/state`)
  const sid = first.headers.get('set-cookie')!.split(';')[0]
  const r = await post('/api/reset', {}, sid)
  assert.equal(r.status, 200)
  assert.deepEqual(await r.json(), { ok: true })
})

test('GET /healthz reports the mode and the exact running version', async () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  const r = await fetch(`${base()}/healthz`)
  assert.equal(r.status, 200)
  // The footer shows this, so it has to be the build that is actually running —
  // not a best-effort lookup against the GitHub releases API.
  assert.deepEqual(await r.json(), { ok: true, mode: 'MOCK', version: pkg.version })
})

test('GET /api/state carries the same version the footer renders', async () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  const j = (await (await fetch(`${base()}/api/state`)).json()) as { version: string }
  assert.equal(j.version, pkg.version)
})
