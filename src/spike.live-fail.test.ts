import './testenv-spike-live-fail.js'
import './spike.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const out = (globalThis as Record<string, unknown>).__spikeOut as string[]

test('spike (LIVE) reports the failed-call count when a client-lib call errors', () => {
  const text = out.join('\n')
  assert.match(text, /Minds SDK spike \[LIVE\]/)
  assert.match(text, /call\(s\) failed — check key\/mind/)
})
