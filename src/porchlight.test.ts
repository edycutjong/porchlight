// Bootstrap MOCK + a throwaway DB before importing anything that reads config/db.
import './testenv-mock.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reset, save, load, id } from './db.js'
import { processCancellation } from './engine/exitInterview.js'
import { applyChange } from './engine/triggerEngine.js'
import { keywordResolves } from './keywordBaseline.js'

function addActive(name: string, mrrCents = 2500): string {
  const db = load()
  const mid = id()
  db.members.push({ id: mid, name, tier: 'VIP', mrrCents, status: 'active', joinedAt: new Date().toISOString() })
  save(db)
  return mid
}

test('exit interview classifies reason + keeps verbatim quote', async () => {
  reset()
  const mid = addActive('Tester')
  const dep = await processCancellation(mid, 'the show pivoted away from deep-dive interviews')
  assert.equal(dep.reasonCategory, 'content_pivot')
  assert.match(dep.verbatimQuote, /deep-dive/)
})

test('resolved reason -> autonomous win-back + recovered MRR', async () => {
  reset()
  const mid = addActive('Ada', 2500)
  await processCancellation(mid, 'you stopped doing the long-form lore videos i wanted')
  const res = await applyChange('the deep-dive interviews are back')
  assert.equal(res.winbacks.length, 1)
  assert.equal(res.winbacks[0].recoveredMrrCents, 2500)
  assert.match(res.winbacks[0].message, /long-form lore/) // quotes their own words
})

test('unrelated change does NOT win back (true negative)', async () => {
  reset()
  const mid = addActive('Ben')
  await processCancellation(mid, 'too expensive, cannot afford the price')
  const res = await applyChange('the deep-dive interviews are back')
  assert.equal(res.winbacks.length, 0)
  assert.equal(load().departures[0].status, 'open')
})

test('the Mind catches a member that keyword matching misses (semantic edge)', async () => {
  reset()
  // A departure the Mind classified as content_pivot, but whose words share ZERO
  // keywords with the announcement (this is what the live Mind resolves semantically).
  const quote = 'the long chatty sit-downs with guests were the whole reason i was here'
  const db = load()
  const mid = id()
  db.members.push({ id: mid, name: 'Cai', tier: 'VIP', mrrCents: 2500, status: 'cancelled', joinedAt: new Date().toISOString() })
  db.departures.push({ id: id(), memberId: mid, cancelledAt: new Date().toISOString(), reasonCategory: 'content_pivot', detail: '', verbatimQuote: quote, doNotContact: false, status: 'open' })
  save(db)

  const change = 'the deep-dive interviews are back'
  const res = await applyChange(change)
  assert.equal(res.winbacks.length, 1, 'Mind wins them back')
  assert.equal(keywordResolves(change, quote), false, 'a keyword tool would miss them')
  assert.equal(res.winbacks[0].keywordWouldCatch, false)
})

test('do-not-contact is honored even when the reason is resolved', async () => {
  reset()
  const mid = addActive('Cleo')
  await processCancellation(mid, "miss the deep dives but please don't message me again")
  const res = await applyChange('the deep-dive interviews are back')
  assert.equal(res.winbacks.length, 0)
  assert.equal(res.skippedDoNotContact.length, 1)
  assert.equal(load().departures[0].status, 'open')
})
