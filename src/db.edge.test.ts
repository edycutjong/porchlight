import './testenv-dbedge.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load, save, reset } from './db.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const DB = resolve(process.env.PORCHLIGHT_DB!)
const EMPTY = { members: [], departures: [], changeEvents: [], winbacks: [] }

test('load() returns an empty DB when the file does not exist', () => {
  assert.deepEqual(load(), EMPTY) // nested/ dir absent -> existsSync false
})

test('load() recovers to an empty DB on corrupt JSON (catch path)', () => {
  mkdirSync(dirname(DB), { recursive: true })
  writeFileSync(DB, '{ this is : not valid json ]]')
  assert.deepEqual(load(), EMPTY)
})

test('save() persists and load() merges over EMPTY; reset() clears', () => {
  save({
    members: [{ id: 'x', name: 'A', tier: 'VIP', mrrCents: 100, status: 'active', joinedAt: 't' }],
    departures: [], changeEvents: [], winbacks: [],
  })
  const back = load()
  assert.equal(back.members.length, 1)
  assert.equal(back.members[0].name, 'A')
  reset()
  assert.deepEqual(load(), EMPTY)
})
