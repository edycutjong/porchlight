// Test-only bootstrap for the spike.ts script (MOCK). Captures console output so the
// test can assert on what the script printed, and keeps the TAP stream clean.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.PORCHLIGHT_MOCK = '1'
process.env.PORCHLIGHT_DB = join(mkdtempSync(join(tmpdir(), 'porch-spike-')), 'db.json')

const out: string[] = []
;(globalThis as Record<string, unknown>).__spikeOut = out
console.log = (...args: unknown[]): void => {
  out.push(args.map((a) => String(a)).join(' '))
}
