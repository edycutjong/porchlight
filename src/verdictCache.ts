import { readFileSync, existsSync } from 'node:fs'
import type { Departure, Member } from './db.js'
import type { Match } from './engine/conditionMatcher.js'
import { CONFIDENCE_THRESHOLD } from './engine/conditionMatcher.js'

/**
 * Captured REAL Mind output for the curated demo changes.
 *
 * Judging a change against every open departure takes minutes of live Mind time, which
 * no visitor will wait for. The alternative — serving MOCK verdicts — is not an option:
 * `mockMatch()` is a keyword classifier, so a mocked public demo would quietly run the
 * very thing Porchlight claims to beat, and would collapse the moment a judge probed it.
 *
 * So the curated changes are answered from verdicts the real Mind produced offline
 * (`npm run precompute`), served with their capture timestamp. Nothing here is
 * synthesised: if a verdict is missing from the cache, the change is simply unavailable.
 */

export interface CachedVerdict {
  departureId: string
  resolves: boolean
  confidence: number
  rationale: string
  keywordWouldCatch: boolean
  latencyMs: number
  capturedAt: string
}
export interface CachedDraft {
  departureId: string
  memberId: string
  message: string
  latencyMs: number
  capturedAt: string
}
export interface CachedChange { text: string; verdicts: CachedVerdict[]; drafts: CachedDraft[] }
export interface LiveCache {
  mindId: string
  changes: Record<string, CachedChange>
  latency: { samples: number[]; p50: number; p95: number; max: number; capturedAt: string }
}

const CACHE_PATH = new URL('./liveCache.json', import.meta.url).pathname

function read(): LiveCache | null {
  if (!existsSync(CACHE_PATH)) return null
  try {
    const parsed = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as LiveCache
    return parsed.changes && Object.keys(parsed.changes).length ? parsed : null
  } catch {
    return null
  }
}

let _cache: LiveCache | null | undefined
export function cache(): LiveCache | null {
  if (_cache === undefined) _cache = read()
  return _cache
}

/** The curated changes a visitor can run instantly, newest capture first. */
export function curatedChanges(): { key: string; text: string; capturedAt: string; verdicts: number }[] {
  const c = cache()
  if (!c) return []
  return Object.entries(c.changes)
    .filter(([, ch]) => ch.verdicts.length > 0)
    .map(([key, ch]) => ({
      key,
      text: ch.text,
      capturedAt: ch.verdicts[0]?.capturedAt ?? '',
      verdicts: ch.verdicts.length,
    }))
}

export const changeByKey = (key: string): CachedChange | undefined => cache()?.changes[key]

/**
 * Replay the captured verdicts as a matcher. Any departure with no captured verdict is
 * OMITTED rather than guessed — a missing verdict must never become a silent "no".
 */
export function cachedMatcher(key: string) {
  return async (_text: string, open: Departure[]): Promise<Match[]> => {
    const ch = changeByKey(key)
    if (!ch) throw new Error(`no captured verdicts for change "${key}"`)
    const out: Match[] = []
    for (const departure of open) {
      const v = ch.verdicts.find((x) => x.departureId === departure.id)
      if (!v) continue
      out.push({
        departure,
        verdict: { resolves: v.resolves, confidence: v.confidence, rationale: v.rationale },
        resolved: v.resolves && v.confidence >= CONFIDENCE_THRESHOLD,
      })
    }
    return out
  }
}

/** Replay the captured win-back message. Throws rather than inventing one. */
export function cachedDrafter(key: string) {
  return async (_text: string, d: Departure, m: Member): Promise<string> => {
    const draft = changeByKey(key)?.drafts.find((x) => x.departureId === d.id)
    if (!draft) throw new Error(`no captured win-back draft for ${m.name}`)
    return draft.message
  }
}

/** p50/p95 over every captured live Mind call — the latency benchmark. */
export function latency(): LiveCache['latency'] | null {
  return cache()?.latency ?? null
}
