// Test-only bootstrap for server.ts in MOCK mode. Binds an ephemeral port (PORT=0) and
// patches http.Server.prototype.listen so the created server is capturable for a clean
// shutdown (server.ts does not export its Server instance).
import { Server } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.PORCHLIGHT_MOCK = '1'
process.env.PORT = '0'
process.env.PORCHLIGHT_DB = join(mkdtempSync(join(tmpdir(), 'porch-srv-')), 'db.json')

const origListen = Server.prototype.listen
Server.prototype.listen = function (this: Server, ...args: unknown[]): Server {
  ;(globalThis as Record<string, unknown>).__porchServer = this
  return (origListen as (...a: unknown[]) => Server).apply(this, args)
}
