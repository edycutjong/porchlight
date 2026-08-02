import { reset, save, load, id, type Departure, type ReasonCategory } from './db.js'

// Deterministic seed: a membership with a real churn history. Maya is left ACTIVE so
// she can cancel live in the demo. One content_pivot quote is intentionally worded so
// keyword search would MISS it (no "deep-dive" phrase) — the live Mind still resolves it.

const TIER_MRR: Record<string, number> = { Supporter: 500, Member: 1000, VIP: 2500 }

interface Seed { name: string; tier: keyof typeof TIER_MRR; reason: ReasonCategory; msg: string; dnc?: boolean }

const CANCELLED: Seed[] = [
  { name: 'Arjun', tier: 'VIP', reason: 'content_pivot', msg: "the show pivoted away from the deep-dive interviews and it's all shorts now" },
  { name: 'Bea', tier: 'Member', reason: 'content_pivot', msg: 'you stopped doing the long-form lore videos i subscribed for' },
  { name: 'Cai', tier: 'VIP', reason: 'content_pivot', msg: 'the long chatty sit-downs with guests were the whole reason i was here, now it is quick clips' },
  { name: 'Dre', tier: 'Member', reason: 'content_pivot', msg: 'not what i signed up for since the format changed' },
  { name: 'Efi', tier: 'Supporter', reason: 'content_pivot', msg: "miss the old deep dives — and please don't message me again", dnc: true },
  { name: 'Fen', tier: 'Member', reason: 'content_pivot', msg: 'the deep-dive interviews were everything, and they are gone' },
  { name: 'Gus', tier: 'VIP', reason: 'price', msg: 'too expensive for what it is now' },
  { name: 'Hana', tier: 'VIP', reason: 'price', msg: "can't afford $25 a month anymore" },
  { name: 'Ivo', tier: 'Member', reason: 'price', msg: 'the price is just too much money' },
  { name: 'Joy', tier: 'Supporter', reason: 'price', msg: 'cost cutting, sorry' },
  { name: 'Kit', tier: 'Member', reason: 'drama', msg: 'the community got toxic and the mods did nothing' },
  { name: 'Lux', tier: 'Supporter', reason: 'drama', msg: 'too much drama in the discord' },
  { name: 'Mira', tier: 'Member', reason: 'drama', msg: "constant arguments, i'm out" },
  { name: 'Nio', tier: 'Member', reason: 'inactivity', msg: 'you stopped posting, nothing new for weeks' },
  { name: 'Ola', tier: 'Supporter', reason: 'inactivity', msg: "channel's gone quiet, feels dead" },
  { name: 'Pia', tier: 'Member', reason: 'life', msg: 'money is tight right now, had to cut subscriptions' },
  { name: 'Rex', tier: 'Supporter', reason: 'life', msg: 'lost my job, need to trim the budget' },
  { name: 'Sol', tier: 'Member', reason: 'quality', msg: 'quality has really declined, feels low-effort' },
]

const ACTIVE_FILLERS = ['Uma', 'Vik', 'Wren', 'Xan', 'Yara', 'Zed', 'Ada', 'Ben', 'Cleo', 'Dax',
  'Esme', 'Finn', 'Gia', 'Hugo', 'Isla', 'Jax', 'Kya', 'Leo', 'Nova', 'Otis', 'Remy']
const FILLER_TIERS: (keyof typeof TIER_MRR)[] = ['Supporter', 'Member', 'VIP']

export function seed(): void {
  reset()
  const db = load()
  const now = Date.now()
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString()

  // Maya — the live-demo canceller — starts active.
  db.members.push({ id: id(), name: 'Maya', tier: 'VIP', mrrCents: TIER_MRR.VIP, status: 'active', joinedAt: daysAgo(400) })

  // Active fillers (make the base look like a real membership).
  ACTIVE_FILLERS.forEach((name, i) => {
    const tier = FILLER_TIERS[i % 3]
    db.members.push({ id: id(), name, tier, mrrCents: TIER_MRR[tier], status: 'active', joinedAt: daysAgo(30 + i * 5) })
  })

  // Historical cancellations, each with a filed return-condition.
  CANCELLED.forEach((s, i) => {
    const memberId = id()
    db.members.push({ id: memberId, name: s.name, tier: s.tier, mrrCents: TIER_MRR[s.tier], status: 'cancelled', joinedAt: daysAgo(300 - i), cancelMessage: s.msg })
    const dep: Departure = {
      id: id(), memberId, cancelledAt: daysAgo(42 - i),
      reasonCategory: s.reason, detail: `Left over ${s.reason.replace('_', ' ')}`,
      verbatimQuote: s.msg, doNotContact: !!s.dnc, status: 'open',
    }
    db.departures.push(dep)
  })

  save(db)
  const cp = db.departures.filter((d) => d.reasonCategory === 'content_pivot').length
  console.log(`seeded: ${db.members.length} members, ${db.departures.length} departures ` +
    `(${cp} content_pivot = ${Math.round((cp / db.departures.length) * 100)}%), Maya active for live cancel.`)
}

// Auto-run only when invoked directly (`tsx src/seed.ts`), not when imported by demo.ts.
export function maybeAutorun(argv1: string | undefined): void {
  if (argv1?.endsWith('seed.ts')) seed()
}
maybeAutorun(process.argv[1])
