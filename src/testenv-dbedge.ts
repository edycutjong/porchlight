// Test-only env bootstrap pointing the DB at a throwaway path whose PARENT directory
// does not yet exist — so load() first sees a missing file (existsSync === false).
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.PORCHLIGHT_MOCK = '1'
process.env.PORCHLIGHT_DB = join(mkdtempSync(join(tmpdir(), 'porch-edge-')), 'nested', 'db.json')
