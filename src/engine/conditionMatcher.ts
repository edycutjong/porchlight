import type { Departure } from '../db.js'
import { doesChangeResolve, type MatchVerdict } from '../minds.js'
import { CONFIG } from '../config.js'

export const CONFIDENCE_THRESHOLD = 0.6

export interface Match { departure: Departure; verdict: MatchVerdict; resolved: boolean }

/** The win-back cluster we run through the real Mind in hero-only mode. */
const isHero = (d: Departure): boolean => d.reasonCategory === 'content_pivot'

/**
 * Ask the Mind, for each open departure, whether a creator change semantically
 * resolves that member's reason for leaving. Judged by MEANING, not keywords —
 * this is what makes the Mind load-bearing rather than a filter.
 * In hero-only mode, non-cluster departures are resolved deterministically (they
 * never match a content change anyway) to conserve the cognition budget.
 */
export async function matchAll(changeText: string, open: Departure[]): Promise<Match[]> {
  const out: Match[] = []
  for (const departure of open) {
    const forceMock = CONFIG.heroOnly && !isHero(departure)
    const verdict = await doesChangeResolve(changeText, departure, { forceMock })
    out.push({ departure, verdict, resolved: verdict.resolves && verdict.confidence >= CONFIDENCE_THRESHOLD })
  }
  return out
}
