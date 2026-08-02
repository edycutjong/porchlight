// Test-only bootstrap for server.ts in LIVE mode. Only /api/state is exercised (it makes
// no Mind call), so no fetch stub is needed — this just proves the LIVE listen branch.
import { Server } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Buffer } from 'node:buffer'

const b64u = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url')

process.env.MINDS_BUILDER_API_KEY = `${b64u({ alg: 'none' })}.${b64u({ humanId: 'human-1' })}.sig`
process.env.MIND_ID = 'mind-1'
process.env.PORT = '0'
process.env.PORCHLIGHT_DB = join(mkdtempSync(join(tmpdir(), 'porch-srvlive-')), 'db.json')
delete process.env.PORCHLIGHT_MOCK

const origListen = Server.prototype.listen
Server.prototype.listen = function (this: Server, ...args: unknown[]): Server {
  ;(globalThis as Record<string, unknown>).__porchServer = this
  return (origListen as (...a: unknown[]) => Server).apply(this, args)
}
