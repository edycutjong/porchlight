import { load, save, member, id, type Departure } from '../db.js'
import { interviewOnCancel } from '../minds.js'

/**
 * A member cancels -> the Mind runs a warm exit interview and files a structured
 * return-condition. This is the MEMORY behavior: the reason is captured, per-member,
 * with the member's own words, and persists for months.
 */
export async function processCancellation(memberId: string, cancelMessage?: string): Promise<Departure> {
  const db = load()
  const m = member(db, memberId)
  if (!m) throw new Error(`unknown member ${memberId}`)
  if (cancelMessage) m.cancelMessage = cancelMessage
  m.status = 'cancelled'

  const cond = await interviewOnCancel(m)
  const departure: Departure = {
    id: id(),
    memberId,
    cancelledAt: new Date().toISOString(),
    reasonCategory: cond.reasonCategory,
    detail: cond.detail,
    verbatimQuote: cond.verbatimQuote,
    doNotContact: cond.doNotContact,
    status: 'open',
  }
  db.departures.push(departure)
  save(db)
  return departure
}
