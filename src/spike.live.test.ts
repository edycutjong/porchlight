import './testenv-spike-live-ok.js'
import './spike.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const out = (globalThis as Record<string, unknown>).__spikeOut as string[]

test('spike (LIVE, all ok) reports six passing calls', () => {
  const text = out.join('\n')
  assert.match(text, /Minds SDK spike \[LIVE\]/)
  assert.match(text, /All 6 calls OK against a live Mind/)
})
