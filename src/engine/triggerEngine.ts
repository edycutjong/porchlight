import { load, save, member, openDepartures, id, type ChangeEvent, type Winback, type Member, type Departure } from '../db.js'
import { draftWinback } from '../minds.js'
import { matchAll, type Match } from './conditionMatcher.js'
import { keywordResolves } from '../keywordBaseline.js'

export interface ChangeResult {
  changeEvent: ChangeEvent
  winbacks: Winback[]
  skippedDoNotContact: { memberName: string; reason: string }[]
  consideredOpen: number
}

/**
 * The creator announces what changed. AUTONOMOUS FOLLOW-UP: unprompted, the Mind
 * matches the change against every open return-condition and messages only the
 * members whose reason is now resolved — quoting their own words. Do-not-contact
 * is always honored.
 */
/**
 * Where the semantic judgement and the win-back wording come from. Defaults to live
 * Mind calls. The deployed demo swaps in verdicts the real Mind produced earlier
 * (see verdictCache.ts) so a visitor is not made to wait minutes — same code path,
 * same data shape, and never a mock.
 */
export interface ChangeDeps {
  match?: (text: string, open: Departure[]) => Promise<Match[]>
  draft?: (text: string, departure: Departure, member: Member) => Promise<string>
}

export async function applyChange(
  text: string,
  // Whether a messaged member actually re-subscribed. Defaults to the demo model where
  // a reason-resolved win-back converts; production passes a predicate backed by a real
  // re-subscribe webhook so recovered MRR only flips on a confirmed rejoin.
  confirmRejoin: (member: Member, departure: Departure) => boolean = () => true,
  deps: ChangeDeps = {},
): Promise<ChangeResult> {
  const match = deps.match ?? matchAll
  const draft = deps.draft ?? draftWinback

  const db = load()
  const changeEvent: ChangeEvent = { id: id(), createdAt: new Date().toISOString(), text }
  db.changeEvents.push(changeEvent)

  const open = openDepartures(db)
  const matches = await match(text, open)

  const winbacks: Winback[] = []
  const skipped: { memberName: string; reason: string }[] = []

  for (const { departure, resolved } of matches) {
    if (!resolved) continue
    const m = member(db, departure.memberId)
    if (!m) continue

    if (departure.doNotContact) {
      skipped.push({ memberName: m.name, reason: departure.reasonCategory })
      continue
    }

    const message = await draft(text, departure, m)
    const rejoined = confirmRejoin(m, departure)
    const wb: Winback = {
      id: id(),
      memberId: m.id,
      departureId: departure.id,
      changeEventId: changeEvent.id,
      sentAt: new Date().toISOString(),
      message,
      rejoined,
      recoveredMrrCents: rejoined ? m.mrrCents : 0,
      keywordWouldCatch: keywordResolves(text, departure.verbatimQuote),
    }
    winbacks.push(wb)
    db.winbacks.push(wb)
    departure.status = rejoined ? 'won_back' : 'open'
    if (rejoined) m.status = 'rejoined'
  }

  save(db)
  return { changeEvent, winbacks, skippedDoNotContact: skipped, consideredOpen: open.length }
}

export function recoveredMrrCents(): number {
  return load().winbacks.filter((w) => w.rejoined).reduce((s, w) => s + w.recoveredMrrCents, 0)
}
