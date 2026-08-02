// Test-only env bootstrap. Imported FIRST (before ./db, ./config, ./minds) so that
// MOCK mode + a throwaway DB are in place before those modules read their env at load.
// Static-import side effects run in source order, which lets the real modules be
// imported statically (dynamic `await import()` mis-maps under tsx's coverage).
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.PORCHLIGHT_MOCK = '1'
process.env.PORCHLIGHT_DB = join(mkdtempSync(join(tmpdir(), 'porch-mock-')), 'db.json')
