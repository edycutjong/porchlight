import './testenv-mock.js'
import './demo.js' // top-level await runs the full 90s arc at import (MOCK)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './db.js'

test('the demo arc seeds, interviews Maya, and wins back resolved members', () => {
  const db = load()
  const maya = db.members.find((m) => m.name === 'Maya')
  assert.ok(maya, 'Maya is seeded')
  assert.equal(maya!.status, 'rejoined', 'Maya rejoins after her reason is fixed')
  assert.ok(db.changeEvents.length >= 1)
  assert.ok(db.winbacks.length >= 1)
  assert.ok(db.winbacks.some((w) => w.rejoined && w.recoveredMrrCents > 0), 'recovered MRR accrues')
  // Efi (content_pivot + do-not-contact) must NOT be messaged.
  const efi = db.members.find((m) => m.name === 'Efi')!
  assert.ok(!db.winbacks.some((w) => w.memberId === efi.id), 'do-not-contact honored')
})
