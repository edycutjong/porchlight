import './testenv-server-live.js'
import './server.js'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

const server = (globalThis as Record<string, unknown>).__porchServer as Server
const base = (): string => `http://127.0.0.1:${(server.address() as AddressInfo).port}`

before(async () => {
  await new Promise((r) => setTimeout(r, 150))
})
after(() => {
  server.unref()
  server.close()
})

test('server boots in LIVE mode and serves /api/state without a Mind call', async () => {
  const r = await fetch(`${base()}/api/state`)
  const j = (await r.json()) as { mode: string }
  assert.equal(j.mode, 'LIVE')
})
