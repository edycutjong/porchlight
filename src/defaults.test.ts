import './testenv-defaults.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONFIG, MODE } from './config.js'
import { load } from './db.js'

test('config falls back to empty key/mind, default port and MOCK when unconfigured', () => {
  assert.equal(CONFIG.apiKey, '')
  assert.equal(CONFIG.mindId, '')
  assert.equal(CONFIG.port, 5173) // Number(undefined ?? 5173)
  assert.equal(CONFIG.mock, true) // !apiKey short-circuits the getter to MOCK
  assert.equal(MODE, 'MOCK')
})

test('db resolves the default .data path when PORCHLIGHT_DB is unset', () => {
  const db = load()
  assert.ok(Array.isArray(db.members) && Array.isArray(db.departures))
  assert.ok(Array.isArray(db.changeEvents) && Array.isArray(db.winbacks))
})
