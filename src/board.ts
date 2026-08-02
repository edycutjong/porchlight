import { load, type ReasonCategory } from './db.js'

export interface Board {
  members: { total: number; active: number; cancelled: number; rejoined: number }
  departures: { total: number; open: number; wonBack: number }
  byReason: { reason: ReasonCategory; count: number; open: number; pct: number }[]
  recoveredMrrCents: number
  /** MRR a naive keyword tool would have recovered — the rest is the Mind's semantic edge. */
  keywordRecoveredMrrCents: number
  winbacks: {
    memberName: string
    reason: ReasonCategory
    message: string
    rejoined: boolean
    recoveredMrrCents: number
    keywordWouldCatch: boolean
  }[]
  audit: { at: string; change: string; resolved: number }[]
}

/** The churn-intelligence board — the CONTINUITY view that compounds over time. */
export function board(): Board {
  const db = load()
  const total = db.departures.length || 1
  const reasons = new Map<ReasonCategory, { count: number; open: number }>()
  for (const d of db.departures) {
    const r = reasons.get(d.reasonCategory) ?? { count: 0, open: 0 }
    r.count++
    if (d.status === 'open') r.open++
    reasons.set(d.reasonCategory, r)
  }
  const byReason = [...reasons.entries()]
    .map(([reason, v]) => ({ reason, count: v.count, open: v.open, pct: Math.round((v.count / total) * 100) }))
    .sort((a, b) => b.count - a.count)

  const nameOf = (id: string) => db.members.find((m) => m.id === id)?.name ?? '?'
  const reasonOf = (id: string) => db.departures.find((d) => d.id === id)?.reasonCategory ?? 'other'

  return {
    members: {
      total: db.members.length,
      active: db.members.filter((m) => m.status === 'active').length,
      cancelled: db.members.filter((m) => m.status === 'cancelled').length,
      rejoined: db.members.filter((m) => m.status === 'rejoined').length,
    },
    departures: {
      total: db.departures.length,
      open: db.departures.filter((d) => d.status === 'open').length,
      wonBack: db.departures.filter((d) => d.status === 'won_back').length,
    },
    byReason,
    recoveredMrrCents: db.winbacks.filter((w) => w.rejoined).reduce((s, w) => s + w.recoveredMrrCents, 0),
    keywordRecoveredMrrCents: db.winbacks
      .filter((w) => w.rejoined && w.keywordWouldCatch)
      .reduce((s, w) => s + w.recoveredMrrCents, 0),
    winbacks: db.winbacks.map((w) => ({
      memberName: nameOf(w.memberId),
      reason: reasonOf(w.departureId),
      message: w.message,
      rejoined: w.rejoined,
      recoveredMrrCents: w.recoveredMrrCents,
      keywordWouldCatch: w.keywordWouldCatch,
    })),
    audit: db.changeEvents.map((c) => ({
      at: c.createdAt,
      change: c.text,
      resolved: db.winbacks.filter((w) => w.changeEventId === c.id && w.rejoined).length,
    })),
  }
}

export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`
