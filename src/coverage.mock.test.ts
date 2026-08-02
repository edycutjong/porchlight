import './testenv-mock.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reset, save, load, id } from './db.js'
import { processCancellation } from './engine/exitInterview.js'
import { applyChange, recoveredMrrCents } from './engine/triggerEngine.js'
import { matchAll } from './engine/conditionMatcher.js'
import { keywordResolves } from './keywordBaseline.js'
import * as minds from './minds.js'
import { board, dollars } from './board.js'
import { seed, maybeAutorun } from './seed.js'

function addActive(name: string, mrrCents = 2500): string {
  const db = load()
  const mid = id()
  db.members.push({ id: mid, name, tier: 'VIP', mrrCents, status: 'active', joinedAt: new Date().toISOString() })
  save(db)
  return mid
}

// --- engine/exitInterview.ts edges -----------------------------------------

test('processCancellation throws on an unknown member', async () => {
  reset()
  await assert.rejects(() => processCancellation('does-not-exist'), /unknown member does-not-exist/)
})

test('processCancellation with no cancel message -> other + empty quote (mock defaults)', async () => {
  reset()
  const mid = addActive('Quiet')
  const dep = await processCancellation(mid) // no message => classify() falls through to 'other'
  assert.equal(dep.reasonCategory, 'other')
  assert.equal(dep.verbatimQuote, '')
  assert.equal(dep.doNotContact, false)
  assert.equal(dep.detail, 'Left over other')
})

test('exit interview flags do-not-contact when the member asks to be left alone', async () => {
  reset()
  const mid = addActive('Solo')
  const dep = await processCancellation(mid, 'leave me alone, stop emailing me for good')
  assert.equal(dep.doNotContact, true)
})

// --- engine/triggerEngine.ts edges -----------------------------------------

test('a resolved departure whose member is gone is skipped (no winback, no throw)', async () => {
  reset()
  const db = load()
  // Departure references a memberId that is NOT in db.members.
  db.departures.push({
    id: id(), memberId: 'ghost', cancelledAt: new Date().toISOString(),
    reasonCategory: 'content_pivot', detail: '', verbatimQuote: 'bring back the deep-dive interviews',
    doNotContact: false, status: 'open',
  })
  save(db)
  const res = await applyChange('the deep-dive interviews are back')
  assert.equal(res.winbacks.length, 0)
  assert.equal(res.consideredOpen, 1)
})

test('recoveredMrrCents() sums only rejoined winbacks', async () => {
  reset()
  const mid = addActive('Rejoin', 1900)
  await processCancellation(mid, 'you stopped the long-form deep-dive interviews')
  assert.equal(recoveredMrrCents(), 0)
  const res = await applyChange('the deep-dive interviews are back')
  assert.equal(res.winbacks.length, 1)
  assert.equal(recoveredMrrCents(), 1900)
})

test('applyChange with a rejection predicate sends the win-back but recovers no MRR', async () => {
  reset()
  const mid = addActive('Unsure', 2500)
  await processCancellation(mid, 'you stopped the long-form deep-dive interviews')
  // confirmRejoin => false: the member is messaged but does not re-subscribe.
  const res = await applyChange('the deep-dive interviews are back', () => false)
  assert.equal(res.winbacks.length, 1)
  assert.equal(res.winbacks[0].rejoined, false)
  assert.equal(res.winbacks[0].recoveredMrrCents, 0)
  const db = load()
  assert.equal(db.departures[0].status, 'open') // not flipped to won_back
  assert.equal(db.members.find((m) => m.id === mid)!.status, 'cancelled') // not rejoined
  assert.equal(recoveredMrrCents(), 0)
})

test('an announcement matching no change keyword resolves nothing (classify -> other)', async () => {
  reset()
  const mid = addActive('Noop')
  await processCancellation(mid, 'you stopped the long-form deep-dive interviews')
  // Matches no CHANGE_KEYWORD -> classify() returns 'other' -> mockMatch short-circuits false.
  const res = await applyChange('we redesigned the website footer')
  assert.equal(res.winbacks.length, 0)
  assert.equal(load().departures[0].status, 'open')
})

test('mock win-back omits the quote clause when the verbatim quote is empty', async () => {
  reset()
  const mid = addActive('NoQuote')
  const db = load()
  db.departures.push({
    id: id(), memberId: mid, cancelledAt: new Date().toISOString(),
    reasonCategory: 'content_pivot', detail: '', verbatimQuote: '',
    doNotContact: false, status: 'open',
  })
  save(db)
  const res = await applyChange('the deep-dive interviews are back')
  assert.equal(res.winbacks.length, 1)
  assert.doesNotMatch(res.winbacks[0].message, /You told me/)
})

// --- engine/conditionMatcher.ts (hero-only mode) ----------------------------

test('hero-only mode: content_pivot runs the Mind, others are force-mocked', async () => {
  reset()
  process.env.PORCHLIGHT_HERO_ONLY = '1'
  try {
    const heroDep = {
      id: id(), memberId: 'a', cancelledAt: new Date().toISOString(),
      reasonCategory: 'content_pivot' as const, detail: '', verbatimQuote: 'deep-dive interviews',
      doNotContact: false, status: 'open' as const,
    }
    const otherDep = {
      id: id(), memberId: 'b', cancelledAt: new Date().toISOString(),
      reasonCategory: 'price' as const, detail: '', verbatimQuote: 'too expensive',
      doNotContact: false, status: 'open' as const,
    }
    const matches = await matchAll('the deep-dive interviews are back', [heroDep, otherDep])
    assert.equal(matches[0].resolved, true, 'hero cluster resolves for a content change')
    assert.equal(matches[1].resolved, false, 'non-hero is force-mocked and does not resolve')
  } finally {
    delete process.env.PORCHLIGHT_HERO_ONLY
  }
})

// --- keywordBaseline.ts -----------------------------------------------------

test('keywordResolves: overlap true, disjoint false, tokenless false', () => {
  assert.equal(keywordResolves('deep-dive interviews are back', 'the deep-dive interviews i loved'), true)
  assert.equal(keywordResolves('prices are lower now', 'the deep-dive interviews i loved'), false)
  // No salient tokens on either side -> match() returns null -> `?? []` fallback.
  assert.equal(keywordResolves('the and you our', ''), false)
})

// --- minds.ts (MOCK brain) --------------------------------------------------

test('spike() in MOCK reports six ok client-lib steps', async () => {
  const rows = await minds.spike()
  assert.equal(rows.length, 6)
  assert.ok(rows.every((r) => r.ok))
  assert.deepEqual(rows.map((r) => r.step), ['listMinds', 'getMind', 'ensureConversation', 'sendMessage', 'waitForReply', 'getHistory'])
  assert.match(rows[0].note, /MOCK/)
})

// --- board.ts ---------------------------------------------------------------

test('board() on an empty ledger: total divisor guards to 1, no reasons', () => {
  reset()
  const b = board()
  assert.equal(b.departures.total, 0)
  assert.deepEqual(b.byReason, [])
  assert.equal(b.recoveredMrrCents, 0)
  assert.equal(b.members.total, 0)
})

test('board() aggregates members, reasons, MRR, winbacks and audit', () => {
  reset()
  const db = load()
  const now = new Date().toISOString()
  const activeId = id()
  const cancelledId = id()
  const rejoinedId = id()
  db.members.push({ id: activeId, name: 'Act', tier: 'VIP', mrrCents: 2500, status: 'active', joinedAt: now })
  db.members.push({ id: cancelledId, name: 'Can', tier: 'Member', mrrCents: 1000, status: 'cancelled', joinedAt: now })
  db.members.push({ id: rejoinedId, name: 'Rej', tier: 'VIP', mrrCents: 2500, status: 'rejoined', joinedAt: now })

  const openDep = { id: id(), memberId: cancelledId, cancelledAt: now, reasonCategory: 'price' as const, detail: '', verbatimQuote: 'too dear', doNotContact: false, status: 'open' as const }
  const wonDepId = id()
  const wonDep = { id: wonDepId, memberId: rejoinedId, cancelledAt: now, reasonCategory: 'content_pivot' as const, detail: '', verbatimQuote: 'deep dives', doNotContact: false, status: 'won_back' as const }
  db.departures.push(openDep, wonDep)

  const changeId = id()
  db.changeEvents.push({ id: changeId, createdAt: now, text: 'deep-dive interviews are back' })

  // A rejoined winback the Mind caught but keywords would have missed.
  db.winbacks.push({ id: id(), memberId: rejoinedId, departureId: wonDepId, changeEventId: changeId, sentAt: now, message: 'welcome back', rejoined: true, recoveredMrrCents: 2500, keywordWouldCatch: false })
  // A winback whose member + departure ids are dangling -> nameOf '?' / reasonOf 'other',
  // and keywordWouldCatch:true so keywordRecoveredMrrCents accrues.
  db.winbacks.push({ id: id(), memberId: 'dangling-member', departureId: 'dangling-dep', changeEventId: changeId, sentAt: now, message: 'hi', rejoined: true, recoveredMrrCents: 1000, keywordWouldCatch: true })
  save(db)

  const b = board()
  assert.deepEqual(b.members, { total: 3, active: 1, cancelled: 1, rejoined: 1 })
  assert.deepEqual(b.departures, { total: 2, open: 1, wonBack: 1 })
  // byReason is sorted by count desc; both reasons appear once so pct=50 each.
  assert.equal(b.byReason.length, 2)
  assert.ok(b.byReason.every((r) => r.pct === 50))
  assert.equal(b.recoveredMrrCents, 3500)
  assert.equal(b.keywordRecoveredMrrCents, 1000)
  const dangling = b.winbacks.find((w) => w.memberName === '?')
  assert.ok(dangling, 'dangling member resolves to "?"')
  assert.equal(dangling!.reason, 'other', 'dangling departure resolves to "other"')
  assert.equal(b.audit.length, 1)
  assert.equal(b.audit[0].resolved, 2)
})

test('dollars() formats cents as USD', () => {
  assert.equal(dollars(2500), '$25.00')
  assert.equal(dollars(0), '$0.00')
})

// --- seed.ts ----------------------------------------------------------------

test('seed() writes a deterministic 40-member ledger with Maya active', () => {
  seed()
  const db = load()
  assert.equal(db.members.length, 40) // Maya + 21 active fillers + 18 cancelled
  assert.equal(db.departures.length, 18)
  const maya = db.members.find((m) => m.name === 'Maya')
  assert.ok(maya && maya.status === 'active')
  const contentPivot = db.departures.filter((d) => d.reasonCategory === 'content_pivot')
  assert.equal(contentPivot.length, 6)
  // Efi asked not to be contacted.
  const efi = db.members.find((m) => m.name === 'Efi')!
  const efiDep = db.departures.find((d) => d.memberId === efi.id)!
  assert.equal(efiDep.doNotContact, true)
})

test('maybeAutorun seeds only when invoked directly as seed.ts', () => {
  reset()
  maybeAutorun('/anywhere/src/seed.ts') // endsWith('seed.ts') -> runs seed()
  assert.equal(load().members.length, 40)
  reset()
  maybeAutorun('/anywhere/src/porchlight.test.ts') // no match -> no seed
  assert.equal(load().members.length, 0)
  maybeAutorun(undefined) // argv1?.endsWith -> undefined -> no seed
  assert.equal(load().members.length, 0)
})
