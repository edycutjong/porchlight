import { seed } from './seed.js'
import { load } from './db.js'
import { processCancellation } from './engine/exitInterview.js'
import { applyChange } from './engine/triggerEngine.js'
import { board, dollars } from './board.js'
import { MODE } from './config.js'

// The 90-second arc, headless. Memory -> Continuity -> Autonomous follow-up in one run.
seed()
// seed() always inserts Maya (active) as the first member.
const maya = load().members.find((m) => m.name === 'Maya')!

console.log(`\n=== Porchlight demo [${MODE}] ===\n`)

// 1) MEMORY — Maya cancels; the Mind runs an exit interview and files the reason.
const dep = await processCancellation(
  maya.id,
  'you pivoted to short clips — the long sit-down conversations i loved are gone',
)
console.log(`1) Maya cancels. Mind files return-condition:`)
console.log(`     reason = ${dep.reasonCategory}`)
console.log(`     quote  = "${dep.verbatimQuote}"\n`)

// 2) CONTINUITY — the churn board shows the compounded pattern.
const b0 = board()
const cp = b0.byReason.find((r) => r.reason === 'content_pivot')!
console.log(`2) Churn board: ${cp.count}/${b0.departures.total} departures (${cp.pct}%) left over a content pivot.\n`)

// 3) The creator fixes the reason.
const change = 'Big news — the deep-dive interviews are back, weekly.'
console.log(`3) Creator announces: "${change}"\n`)

// 4) AUTONOMOUS FOLLOW-UP — the Mind wins back only the resolved, quoting their own words.
const res = await applyChange(change)
// Every win-back references a seeded member, so the lookup always resolves.
const nameOf = (mid: string) => load().members.find((m) => m.id === mid)!.name
console.log(`4) Mind autonomously sent ${res.winbacks.length} reason-resolved win-backs:`)
for (const w of res.winbacks) console.log(`     -> ${nameOf(w.memberId)}: ${w.message}`)
if (res.skippedDoNotContact.length)
  console.log(`   honored do-not-contact (skipped): ${res.skippedDoNotContact.map((s) => s.memberName).join(', ')}`)

const b1 = board()
const edge = b1.recoveredMrrCents - b1.keywordRecoveredMrrCents
const missed = res.winbacks.filter((w) => !w.keywordWouldCatch).map((w) => nameOf(w.memberId))
console.log(`\n   Recovered MRR: ${dollars(b1.recoveredMrrCents)}/mo · rejoined: ${b1.members.rejoined} members`)
console.log(`   A keyword tool would recover only ${dollars(b1.keywordRecoveredMrrCents)}/mo.`)
console.log(`   The Mind's SEMANTIC match found ${dollars(edge)}/mo that keywords miss — ${missed.join(', ')} ` +
  `(same reason, different words).\n`)
