import express from 'express'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CONFIG, MODE } from './config.js'
import { board } from './board.js'
import { readFileSync } from 'node:fs'
import { load, openDepartures, member, type DB } from './db.js'
import { sessionStore, sessionDb, resetSession } from './session.js'
import { processCancellation } from './engine/exitInterview.js'
import { applyChange } from './engine/triggerEngine.js'
import { doesChangeResolve } from './minds.js'
import { keywordResolves } from './keywordBaseline.js'
import { CONFIDENCE_THRESHOLD } from './engine/conditionMatcher.js'
import { curatedChanges, changeByKey, cachedMatcher, cachedDrafter, latency } from './verdictCache.js'

const app = express()
app.use(express.json())
app.disable('x-powered-by')
app.use(express.static(join(dirname(fileURLToPath(import.meta.url)), '..', 'public')))

// --- per-visitor state ------------------------------------------------------
// Every request runs inside its own copy of the seed so one visitor announcing a
// change cannot rewrite the board for everyone else. See session.ts.
const SID_COOKIE = 'porchlight_sid'

/**
 * The demo baseline is a PINNED fixture, not the local `.data/` scratch file.
 * Every captured verdict in liveCache.json is keyed by a departure id from this exact
 * snapshot — regenerating the seed would orphan the whole cache — so it ships with the
 * app and is committed alongside it.
 */
const DEMO_SEED: DB = JSON.parse(readFileSync(new URL('./demoSeed.json', import.meta.url), 'utf8'))
const seedDb = (): DB => DEMO_SEED

function sidOf(req: express.Request, res: express.Response): string {
  const raw = req.headers.cookie ?? ''
  const found = raw.split(';').map((c) => c.trim().split('=')).find(([k]) => k === SID_COOKIE)?.[1]
  if (found && /^[0-9a-f-]{36}$/i.test(found)) return found
  const sid = randomUUID()
  res.setHeader('Set-Cookie', `${SID_COOKIE}=${sid}; Path=/; Max-Age=3600; SameSite=Lax; HttpOnly`)
  return sid
}

app.use((req, res, next) => {
  const db = sessionDb(sidOf(req, res), seedDb)
  sessionStore.run({ db }, next)
})

// --- rate limiting for the one path that spends real Mind time ---------------
const HITS = new Map<string, number[]>()
const LIVE_WINDOW_MS = 15 * 60 * 1000
const LIVE_MAX = 3

/** Longest a visitor is asked to wait on a live Mind turn before we give up on it. */
const WEB_DEADLINE_MS = 100_000

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`no reply within ${Math.round(ms / 1000)}s`)), ms).unref(),
    ),
  ])
}

function overLiveLimit(ip: string): boolean {
  const now = Date.now()
  const recent = (HITS.get(ip) ?? []).filter((t) => now - t < LIVE_WINDOW_MS)
  if (recent.length >= LIVE_MAX) {
    HITS.set(ip, recent)
    return true
  }
  recent.push(now)
  HITS.set(ip, recent)
  return false
}

// --- read -------------------------------------------------------------------
app.get('/api/state', (req, res) => {
  const db = load()
  res.json({
    mode: MODE,
    mindId: CONFIG.mindId || null,
    board: board(),
    roster: db.members,
    openDepartures: openDepartures(db).map((d) => ({
      id: d.id,
      memberId: d.memberId,
      memberName: member(db, d.memberId)?.name ?? '?',
      reasonCategory: d.reasonCategory,
      verbatimQuote: d.verbatimQuote,
      doNotContact: d.doNotContact,
    })),
    curated: curatedChanges(),
    latency: latency(),
    liveAvailable: !CONFIG.mock,
  })
})

app.post('/api/reset', (req, res) => {
  resetSession(sidOf(req, res))
  res.json({ ok: true })
})

// --- curated change: replay REAL captured Mind verdicts, instantly -----------
app.post('/api/change', async (req, res) => {
  const key = String(req.body?.key ?? '')
  const cached = changeByKey(key)
  if (!cached) {
    res.status(400).json({ error: `unknown change "${key}"` })
    return
  }
  try {
    const result = await applyChange(cached.text, () => true, {
      match: cachedMatcher(key),
      draft: cachedDrafter(key),
    })
    res.json({
      ...result,
      source: 'captured-live',
      capturedAt: cached.verdicts[0]?.capturedAt ?? null,
      board: board(),
    })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// --- custom change: ONE genuinely live Mind call -----------------------------
// Deliberately scoped to a single member the visitor picks. Judging a free-text
// change against all 18 open departures would be ~18 live calls and several minutes.
app.post('/api/change/live', async (req, res) => {
  if (CONFIG.mock) {
    res.status(503).json({
      error:
        'No Mind credentials on this deployment, so there is no live path. ' +
        'This app never answers with the keyword mock — that is the thing Porchlight exists to beat.',
    })
    return
  }
  const ip = String(req.headers['fly-client-ip'] ?? req.ip ?? 'unknown')
  if (overLiveLimit(ip)) {
    res.status(429).json({ error: `Live Mind calls are limited to ${LIVE_MAX} per 15 minutes. Try a curated change — those are real captured verdicts.` })
    return
  }

  const text = String(req.body?.text ?? '').trim()
  const departureId = String(req.body?.departureId ?? '')
  if (!text || text.length > 400) {
    res.status(400).json({ error: 'Describe the change in 1-400 characters.' })
    return
  }

  const db = load()
  const departure = openDepartures(db).find((d) => d.id === departureId)
  if (!departure) {
    res.status(400).json({ error: 'unknown departure' })
    return
  }

  const started = Date.now()
  try {
    // The SDK's own retry can stretch a slow turn past three minutes (measured p95 is
    // well above the p50). Nobody waits that long at a web page, so the request is
    // bounded here and the visitor is told plainly to try again.
    const verdict = await withDeadline(doesChangeResolve(text, departure), WEB_DEADLINE_MS)
    res.json({
      source: 'live',
      ranAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      memberName: member(db, departure.memberId)?.name ?? '?',
      verbatimQuote: departure.verbatimQuote,
      reasonCategory: departure.reasonCategory,
      verdict,
      resolved: verdict.resolves && verdict.confidence >= CONFIDENCE_THRESHOLD,
      keywordWouldCatch: keywordResolves(text, departure.verbatimQuote),
      threshold: CONFIDENCE_THRESHOLD,
    })
  } catch (e) {
    res.status(504).json({
      error: `The Mind did not answer in time (${(e as Error).message}). This is a real live call against a real agent — sometimes it is slow. Try again, or use a curated change for an instant captured verdict.`,
    })
  }
})

// --- cancellation (live exit interview) --------------------------------------
// Also a real Mind call, so it shares the same budget as the live matcher.
app.post('/api/cancel', async (req, res) => {
  if (CONFIG.mock) {
    res.status(503).json({ error: 'No Mind credentials on this deployment — the exit interview needs a live Mind.' })
    return
  }
  const ip = String(req.headers['fly-client-ip'] ?? req.ip ?? 'unknown')
  if (overLiveLimit(ip)) {
    res.status(429).json({ error: `Live Mind calls are limited to ${LIVE_MAX} per 15 minutes.` })
    return
  }
  const message = String(req.body?.message ?? '')
  if (message.length > 400) {
    res.status(400).json({ error: 'Keep the parting message under 400 characters.' })
    return
  }
  try {
    const departure = await processCancellation(String(req.body.memberId), message)
    res.json({ ...departure, source: 'live', board: board() })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

app.get('/healthz', (_req, res) => res.json({ ok: true, mode: MODE }))

app.listen(CONFIG.port, () => {
  console.log(`Porchlight [${MODE}] — http://localhost:${CONFIG.port}`)
  console.log(`  curated changes: ${curatedChanges().length} (captured real Mind verdicts)`)
  if (CONFIG.mock) console.log('  (MOCK mode — set MINDS_BUILDER_API_KEY to drive a real Mind)')
})
