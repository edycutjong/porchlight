import './testenv-server-mock.js'
import './server.js' // starts app.listen(0) at import; helper captured the Server
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { load, save, id } from './db.js'
import { rmSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

const server = (globalThis as Record<string, unknown>).__porchServer as Server
const base = (): string => `http://127.0.0.1:${(server.address() as AddressInfo).port}`

before(async () => {
  await new Promise((r) => setTimeout(r, 150)) // let the ephemeral bind complete
})
after(() => {
  server.unref()
  server.close()
})

test('GET /api/state returns the MOCK board and roster', async () => {
  const r = await fetch(`${base()}/api/state`)
  const j = (await r.json()) as { mode: string; board: unknown; roster: unknown[] }
  assert.equal(j.mode, 'MOCK')
  assert.ok(j.board && Array.isArray(j.roster))
})

test('POST /api/cancel files a departure; unknown member -> 400', async () => {
  const mid = id()
  const db = load()
  db.members.push({ id: mid, name: 'M', tier: 'VIP', mrrCents: 2500, status: 'active', joinedAt: 't' })
  save(db)

  const ok = await fetch(`${base()}/api/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ memberId: mid, message: 'the deep-dive interviews are gone' }),
  })
  assert.equal(ok.status, 200)
  const dep = (await ok.json()) as { reasonCategory: string }
  assert.equal(dep.reasonCategory, 'content_pivot')

  const bad = await fetch(`${base()}/api/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ memberId: 'ghost' }),
  })
  assert.equal(bad.status, 400)
  const err = (await bad.json()) as { error: string }
  assert.match(err.error, /unknown member/)
})

test('POST /api/change wins back with text and defaults missing text to ""', async () => {
  const withText = await fetch(`${base()}/api/change`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'the deep-dive interviews are back' }),
  })
  assert.equal(withText.status, 200)
  const res = (await withText.json()) as { winbacks: unknown[] }
  assert.ok(res.winbacks.length >= 1)

  const noText = await fetch(`${base()}/api/change`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}), // text undefined -> String(undefined ?? '') -> ''
  })
  assert.equal(noText.status, 200)
  const res2 = (await noText.json()) as { changeEvent: { text: string } }
  assert.equal(res2.changeEvent.text, '')
})

// MUST be last: corrupts the DB path so the engine throws, exercising the 400 catch.
test('POST /api/change surfaces an engine failure as 400', async () => {
  const dbPath = resolve(process.env.PORCHLIGHT_DB!)
  rmSync(dbPath, { force: true })
  mkdirSync(dbPath, { recursive: true }) // DB path is now a directory -> save() throws EISDIR

  const r = await fetch(`${base()}/api/change`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'anything' }),
  })
  assert.equal(r.status, 400)
  const err = (await r.json()) as { error: string }
  assert.ok(err.error.length > 0)
})
