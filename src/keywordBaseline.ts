// The "dumb tool" strawman: what a non-Mind win-back product would do — match the
// creator's announcement to a member's parting words by shared keywords. It only
// catches departures whose wording literally overlaps the announcement, so it MISSES
// every member who described the same reason in different words. The gap between this
// and the Mind's semantic match is the proof that the Mind is load-bearing.

const STOP = new Set([
  'the', 'and', 'are', 'was', 'were', 'you', 'your', 'for', 'that', 'this', 'with', 'have',
  'has', 'had', 'not', 'but', 'now', 'all', 'its', "it's", 'been', 'back', 'big', 'news',
  'just', 'about', 'from', 'they', 'them', 'our', 'out', 'get', 'got', 'weekly', 'more',
])

const tokens = (s: string): string[] =>
  (s.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []).filter((w) => !STOP.has(w))

/** True iff the parting quote and the announcement share at least one salient keyword. */
export function keywordResolves(changeText: string, verbatimQuote: string): boolean {
  const a = new Set(tokens(changeText))
  return tokens(verbatimQuote).some((w) => a.has(w))
}
