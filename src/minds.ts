import { z } from 'zod'
import { createMindsClient } from '@animocabrands/minds-client-lib'
import { CONFIG } from './config.js'
import type { Departure, Member, ReasonCategory } from './db.js'

// ---------------------------------------------------------------------------
// The Minds integration surface. The Mind is LOAD-BEARING in three places:
//   1. interviewOnCancel  — adaptive exit interview -> structured return-condition (MEMORY)
//   2. doesChangeResolve  — semantic judgement: does "<change>" resolve this reason? (REASONING)
//   3. draftWinback       — personal win-back quoting the member's own words     (RECALL)
// LIVE mode drives a pre-configured Mind via @animocabrands/minds-client-lib.
// MOCK mode simulates the Mind so the whole product is buildable/demoable offline.
// ---------------------------------------------------------------------------

export interface ReturnCondition {
  reasonCategory: ReasonCategory
  detail: string
  verbatimQuote: string
  doNotContact: boolean
}
export interface MatchVerdict { resolves: boolean; confidence: number; rationale: string }

const CONDITION_SCHEMA = z.object({
  reasonCategory: z.enum(['content_pivot', 'price', 'drama', 'inactivity', 'life', 'quality', 'other']),
  detail: z.string(),
  verbatimQuote: z.string(),
  doNotContact: z.boolean().default(false),
})
const VERDICT_SCHEMA = z.object({
  resolves: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
})

// --- LIVE client (memoized) -------------------------------------------------
// The client-lib makes no network call at import and only matters in LIVE mode; it is
// memoized so a single Mind client is reused across turns.
let _client: any = null
function client(): any {
  if (_client) return _client
  _client = createMindsClient({ builderApiKey: CONFIG.apiKey })
  return _client
}

/** One round-trip: send a message on an alias and wait for the Mind's reply (one retry on timeout). */
async function ask(alias: string, text: string): Promise<string> {
  const c = await client()
  await c.ensureConversation(alias, CONFIG.mindId)
  for (let attempt = 1; ; attempt++) {
    const before = await c.getLatestHistoryFingerprint(alias).catch(() => undefined)
    await c.sendMessage({ alias, messageText: text })
    const outcome = await c.waitForReply({ alias, timeoutMs: CONFIG.replyTimeoutMs, afterFingerprint: before, sentMessageText: text })
    // waitForReply always resolves to an outcome, and a returned reply always carries a
    // non-empty messageText (the client-lib's isReplyEvent guarantees it).
    if (!outcome.timedOut) return String(outcome.reply.messageText)
    if (attempt >= 2) throw new Error(`Mind reply timed out on ${alias}`)
  }
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON object in Mind reply')
  return JSON.parse(text.slice(start, end + 1))
}

/** Minds wrap replies in HTML (e.g. `<p>ok</p>`). Strip tags + decode entities for plain-text display. */
function stripHtml(text: string): string {
  // Decode entities FIRST (with &amp; decoded LAST so we never double-unescape,
  // e.g. "&amp;lt;" -> "&lt;" not "<"), then strip tags. Because decoding can
  // reveal markup (e.g. "&lt;script&gt;" -> "<script>"), the tag-strip runs in a
  // loop until stable so no injected markup can survive in the plain-text output.
  let out = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
  let previous: string
  do {
    previous = out
    out = out.replace(/<[^>]*>/g, '')
  } while (out !== previous)
  return out.trim()
}

const alias = (memberId: string) => `member:${memberId}`

// --- public ops -------------------------------------------------------------

export async function interviewOnCancel(m: Member): Promise<ReturnCondition> {
  if (CONFIG.mock) return mockInterview(m)
  const reply = await ask(
    alias(m.id),
    `A member just cancelled their membership. Their parting message: "${m.cancelMessage ?? ''}".\n` +
      `Run a warm, brief exit interview in your own voice, then output a JSON block with keys ` +
      `reasonCategory (one of content_pivot|price|drama|inactivity|life|quality|other), detail, ` +
      `verbatimQuote (their own words), doNotContact (true if they asked not to be contacted again).`,
  )
  return CONDITION_SCHEMA.parse(extractJson(reply))
}

export async function doesChangeResolve(changeText: string, d: Departure, opts?: { forceMock?: boolean }): Promise<MatchVerdict> {
  if (CONFIG.mock || opts?.forceMock) return mockMatch(changeText, d)
  const reply = await ask(
    alias(d.memberId),
    `This member left for reason "${d.reasonCategory}" — they said: "${d.verbatimQuote}".\n` +
      `The creator just announced: "${changeText}".\n` +
      `Does that announcement genuinely resolve THIS member's reason for leaving? ` +
      `Judge by meaning, not keywords. Output JSON {resolves:boolean, confidence:0..1, rationale:string}.`,
  )
  return VERDICT_SCHEMA.parse(extractJson(reply))
}

export async function draftWinback(changeText: string, d: Departure, m: Member): Promise<string> {
  if (CONFIG.mock) return mockWinback(changeText, d, m)
  return stripHtml(await ask(
    alias(d.memberId),
    `Write a short, warm, personal win-back message to ${m.name}. They left because: "${d.verbatimQuote}". ` +
      `The reason is now resolved: "${changeText}". Quote their own words back to them so it feels remembered. ` +
      `No hard sell. Output only the message text.`,
  ))
}

/** SDK spike: exercises 6 distinct client-lib methods end-to-end. */
export async function spike(): Promise<{ step: string; ok: boolean; note: string }[]> {
  if (CONFIG.mock) {
    return [
      ['listMinds', 'MOCK — set MINDS_BUILDER_API_KEY to run live'],
      ['getMind', 'MOCK'],
      ['ensureConversation', 'MOCK'],
      ['sendMessage', 'MOCK'],
      ['waitForReply', 'MOCK'],
      ['getHistory', 'MOCK'],
    ].map(([step, note]) => ({ step, ok: true, note }))
  }
  const c = await client()
  const out: { step: string; ok: boolean; note: string }[] = []
  const record = async (step: string, fn: () => Promise<string>) => {
    try { out.push({ step, ok: true, note: await fn() }) }
    catch (e) { out.push({ step, ok: false, note: (e as Error).message }) }
  }
  let mindId = CONFIG.mindId
  await record('listMinds', async () => { const ms = await c.listMinds(); mindId ||= ms[0]?.mindId; return `${ms.length} mind(s)` })
  await record('getMind', async () => { const d = await c.getMind(mindId); return d.email ?? 'ok' })
  const a = 'spike:porchlight'
  await record('ensureConversation', async () => { await c.ensureConversation(a, mindId); return a })
  await record('sendMessage', async () => { await c.sendMessage({ alias: a, messageText: 'Porchlight SDK spike — reply "ok".' }); return 'sent' })
  await record('waitForReply', async () => { const o = await c.waitForReply({ alias: a, timeoutMs: CONFIG.spikeTimeoutMs }); return o.timedOut ? 'timed out' : 'reply' })
  await record('getHistory', async () => { const h = await c.getHistory(a, { limit: 5 }); return `${h.length} rows` })
  return out
}

// ---------------------------------------------------------------------------
// MOCK brain — deterministic stand-in for the Mind (offline dev + demo).
// LIVE mode replaces every one of these with real Mind reasoning.
// ---------------------------------------------------------------------------
const INTERVIEW_KEYWORDS: [ReasonCategory, RegExp][] = [
  ['content_pivot', /pivot|deep[- ]?dive|used to|not what i signed|shorts|different (kind of )?content|miss the|changed the show|long[- ]?form/i],
  ['price', /expensive|price|cost|afford|too much money|\$\d/i],
  ['drama', /toxic|drama|mods?|fight|argument|community got|hostile/i],
  ['inactivity', /inactive|stopped posting|no new|gone quiet|dead|nothing new/i],
  ['life', /money is tight|lost my job|budget|tightening|personal|moving|life got/i],
  ['quality', /quality|low[- ]?effort|phoning it in|declined|lazy/i],
]
const CHANGE_KEYWORDS: [ReasonCategory, RegExp][] = [
  ['content_pivot', /deep[- ]?dive|long[- ]?form|interviews? are back|lore|back to the old|returning to/i],
  ['price', /lower|cheaper|discount|price drop|reduced|new lower tier/i],
  ['drama', /new mod|cleaned up|banned|settled|calmer|community reset/i],
  ['inactivity', /posting again|back to weekly|new series|regular (uploads|schedule)/i],
  ['quality', /raising (the )?quality|higher quality|stepping (it )?up|better production/i],
]
const classify = (text: string, table: [ReasonCategory, RegExp][]): ReasonCategory => {
  for (const [cat, re] of table) if (re.test(text)) return cat
  return 'other'
}

function mockInterview(m: Member): ReturnCondition {
  const msg = m.cancelMessage ?? ''
  const cat = classify(msg, INTERVIEW_KEYWORDS)
  const dnc = /don'?t (contact|message|email)|leave me alone|stop (contacting|emailing)/i.test(msg)
  return { reasonCategory: cat, detail: `Left over ${cat.replace('_', ' ')}`, verbatimQuote: msg, doNotContact: dnc }
}
function mockMatch(changeText: string, d: Departure): MatchVerdict {
  const cat = classify(changeText, CHANGE_KEYWORDS)
  const resolves = cat !== 'other' && cat === d.reasonCategory
  return {
    resolves,
    confidence: resolves ? 0.86 : 0.1,
    rationale: resolves
      ? `Change addresses the "${cat}" reason this member gave.`
      : `Change does not address this member's "${d.reasonCategory}" reason.`,
  }
}
function mockWinback(changeText: string, d: Departure, m: Member): string {
  const quote = d.verbatimQuote ? ` You told me: "${d.verbatimQuote.trim()}".` : ''
  return `Hi ${m.name} — you left a while back, and I remembered why.${quote} ` +
    `That's exactly what just changed: ${changeText} I'd love to have you back — no pressure, just wanted you to know.`
}
