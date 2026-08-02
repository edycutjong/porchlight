import './testenv-spike-mock.js'
import './spike.js' // top-level await runs spike() in MOCK at import
import { test } from 'node:test'
import assert from 'node:assert/strict'

const out = (globalThis as Record<string, unknown>).__spikeOut as string[]

test('spike (MOCK) prints the six client-lib steps and live-mode guidance', () => {
  const text = out.join('\n')
  assert.match(text, /Minds SDK spike \[MOCK\]/)
  assert.match(text, /listMinds/)
  assert.match(text, /getHistory/)
  assert.match(text, /MOCK mode \(no Builder API key\)/)
  assert.match(text, /hellominds\.ai/)
})
