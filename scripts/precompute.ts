/**
 * Precompute REAL Mind verdicts for the curated demo changes, and time every call.
 *
 * Why this exists
 * ---------------
 * The public demo must never show a MOCK verdict. `mockMatch()` is a keyword
 * classifier — the exact thing Porchlight's thesis says it beats — so serving it
 * behind the product's own claim would be dishonest and self-refuting.
 *
 * But a live judgement takes ~60-90s per departure, and a change is judged against
 * every open departure. So: run the real Mind ONCE, offline, over a curated set of
 * changes, and serve those captured verdicts instantly. Every number a visitor sees
 * is a real Mind decision with a capture timestamp attached.
 *
 * The latency series recorded here is also the p50/p95 benchmark — same run, no
 * separate harness.
 *
 * Resumable: writes after every call, and skips pairs already present.
 *   npm run precompute            # fill gaps
 *   npm run precompute -- --force # re-run everything
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { load, openDepartures, member, type Departure } from '../src/db.js'
import { doesChangeResolve, draftWinback } from '../src/minds.js'
import { keywordResolves } from '../src/keywordBaseline.js'
import { CONFIG, MODE } from '../src/config.js'

const OUT = new URL('../src/liveCache.json', import.meta.url).pathname

/**
 * Curated changes. Deliberately spans three different reason clusters so the cache
 * proves *discrimination*, not just one lucky positive: a content fix must NOT win
 * back the price leavers, and vice versa.
 */
const CHANGES = [
  { key: 'deepdive', text: 'Big news — the deep-dive interviews are back, weekly.' },
  { key: 'price', text: "I've cut the membership to $3/mo — the old tier was too steep." },
  { key: 'cadence', text: "I'm posting weekly again after a long quiet stretch." },
] as const

interface CachedVerdict {
  departureId: string
  resolves: boolean
  confidence: number
  rationale: string
  keywordWouldCatch: boolean
  latencyMs: number
  capturedAt: string
}
interface CachedDraft {
  departureId: string
  memberId: string
  message: string
  latencyMs: number
  capturedAt: string
}
interface Cache {
  mindId: string
  changes: Record<string, { text: string; verdicts: CachedVerdict[]; drafts: CachedDraft[] }>
  latency: { samples: number[]; p50: number; p95: number; max: number; capturedAt: string }
}

/** Mirrors conditionMatcher.CONFIDENCE_THRESHOLD — a verdict only counts if it clears it. */
const CONFIDENCE_THRESHOLD = 0.6

const empty = (): Cache => ({
  mindId: CONFIG.mindId,
  changes: {},
  latency: { samples: [], p50: 0, p95: 0, max: 0, capturedAt: '' },
})

const pct = (sorted: number[], p: number): number =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : 0

function recomputeLatency(c: Cache): void {
  const samples = Object.values(c.changes)
    .flatMap((ch) => [...(ch.verdicts ?? []).map((v) => v.latencyMs), ...(ch.drafts ?? []).map((d) => d.latencyMs)])
    .sort((a, b) => a - b)
  c.latency = {
    samples,
    p50: pct(samples, 50),
    p95: pct(samples, 95),
    max: samples.at(-1) ?? 0,
    capturedAt: new Date().toISOString(),
  }
}

async function main(): Promise<void> {
  if (CONFIG.mock) {
    console.error(
      'REFUSING TO RUN IN MOCK MODE.\n' +
        'This script exists to capture REAL Mind verdicts; a mock run would poison the\n' +
        'cache with keyword output. Set MINDS_BUILDER_API_KEY (and unset PORCHLIGHT_MOCK).',
    )
    process.exit(1)
  }

  const force = process.argv.includes('--force')
  const cache: Cache = !force && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : empty()
  cache.mindId = CONFIG.mindId
  // Normalise every slot up front — a cache written by an older revision of this script
  // has no `drafts` key, and the latency pass walks all slots, not just the current one.
  for (const slot of Object.values(cache.changes)) {
    slot.verdicts ??= []
    slot.drafts ??= []
  }

  const open: Departure[] = openDepartures(load())
  const total = CHANGES.length * open.length
  let done = 0
  let ran = 0

  console.log(`\nPorchlight precompute [${MODE}] — ${CHANGES.length} changes x ${open.length} departures = ${total} verdicts\n`)

  for (const change of CHANGES) {
    const slot = (cache.changes[change.key] ??= { text: change.text, verdicts: [], drafts: [] })
    slot.text = change.text
    slot.drafts ??= []

    for (const d of open) {
      done++
      if (slot.verdicts.some((v) => v.departureId === d.id)) {
        continue // already captured — resumable
      }

      const label = `${done}/${total} ${change.key} · ${d.reasonCategory}`
      const started = Date.now()
      try {
        // No forceMock, ever. A failure here must surface, not silently degrade.
        const verdict = await doesChangeResolve(change.text, d)
        const latencyMs = Date.now() - started
        slot.verdicts.push({
          departureId: d.id,
          resolves: verdict.resolves,
          confidence: verdict.confidence,
          rationale: verdict.rationale,
          keywordWouldCatch: keywordResolves(change.text, d.verbatimQuote),
          latencyMs,
          capturedAt: new Date().toISOString(),
        })
        ran++
        console.log(
          `  ✓ ${label} → resolves=${verdict.resolves} conf=${verdict.confidence.toFixed(2)} ` +
            `kw=${keywordResolves(change.text, d.verbatimQuote) ? 'hit' : 'MISS'} ${(latencyMs / 1000).toFixed(1)}s`,
        )
      } catch (e) {
        console.log(`  ✗ ${label} → ${(e as Error).message} (will retry on next run)`)
      }

      recomputeLatency(cache)
      writeFileSync(OUT, JSON.stringify(cache, null, 2) + '\n') // write after every call
    }
  }

  // --- phase 2: real win-back drafts for every departure this change resolves ----
  // The cached path must serve a real Mind-written message too. Drafting live would
  // add ~7 more minute-long calls to a page load, so capture them here alongside.
  const db = load()
  for (const change of CHANGES) {
    const slot = cache.changes[change.key]
    if (!slot) continue
    const resolved = slot.verdicts.filter((v) => v.resolves && v.confidence >= CONFIDENCE_THRESHOLD)

    for (const v of resolved) {
      if (slot.drafts.some((d) => d.departureId === v.departureId)) continue
      const dep = open.find((d) => d.id === v.departureId)
      const m = dep && member(db, dep.memberId)
      if (!dep || !m) continue
      if (dep.doNotContact) continue // never draft for a member who opted out

      const started = Date.now()
      try {
        const message = await draftWinback(change.text, dep, m)
        const latencyMs = Date.now() - started
        slot.drafts.push({ departureId: dep.id, memberId: m.id, message, latencyMs, capturedAt: new Date().toISOString() })
        console.log(`  ✓ draft ${change.key} → ${m.name} (${(latencyMs / 1000).toFixed(1)}s)`)
      } catch (e) {
        console.log(`  ✗ draft ${change.key} → ${m.name}: ${(e as Error).message} (will retry)`)
      }
      recomputeLatency(cache)
      writeFileSync(OUT, JSON.stringify(cache, null, 2) + '\n')
    }
  }

  const { p50, p95, max, samples } = cache.latency
  const verdicts = Object.values(cache.changes).reduce((s, c) => s + c.verdicts.length, 0)
  const drafts = Object.values(cache.changes).reduce((s, c) => s + c.drafts.length, 0)

  console.log(`\nCaptured ${ran} new verdict(s) this run.`)
  console.log(`Cache: ${verdicts}/${total} verdicts · ${drafts} win-back drafts · all REAL Mind output.`)
  console.log(`Mind latency over ${samples.length} live calls — p50 ${(p50 / 1000).toFixed(1)}s · p95 ${(p95 / 1000).toFixed(1)}s · max ${(max / 1000).toFixed(1)}s`)
  console.log(`Wrote ${OUT}\n`)
  if (verdicts < total) {
    console.log('Incomplete — re-run `npm run precompute` to fill the gaps.\n')
    process.exit(2)
  }
}

await main()
