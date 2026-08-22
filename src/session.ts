import { AsyncLocalStorage } from 'node:async_hooks'
import type { DB } from './db.js'

/**
 * Per-visitor state for the public demo.
 *
 * Locally, Porchlight is single-tenant: `db.load()`/`db.save()` read and write one
 * JSON file. Deployed, that would mean the first visitor to announce a change
 * permanently rewrites the churn board for everyone after them.
 *
 * So each visitor gets their own in-memory copy of the seed, held in AsyncLocalStorage
 * for the duration of the request. `db.load()`/`db.save()` consult this store first and
 * fall back to the file when there is no session context — which is exactly what the
 * CLI (`npm run demo`, `npm run seed`) and all 51 unit tests do, so their behaviour is
 * unchanged.
 */
export const sessionStore = new AsyncLocalStorage<{ db: DB }>()

interface Entry { db: DB; touched: number }

const SESSIONS = new Map<string, Entry>()
const TTL_MS = 60 * 60 * 1000 // an hour of inactivity
const MAX_SESSIONS = 500 // hard ceiling so a crawler cannot exhaust memory

/** Drop expired sessions, then the oldest ones if we are still over the ceiling. */
function evict(): void {
  const now = Date.now()
  for (const [key, entry] of SESSIONS) {
    if (now - entry.touched > TTL_MS) SESSIONS.delete(key)
  }
  if (SESSIONS.size <= MAX_SESSIONS) return
  const oldestFirst = [...SESSIONS.entries()].sort((a, b) => a[1].touched - b[1].touched)
  for (const [key] of oldestFirst.slice(0, SESSIONS.size - MAX_SESSIONS)) SESSIONS.delete(key)
}

/** Fetch this visitor's DB, cloning a fresh copy of the seed on first contact. */
export function sessionDb(sid: string, seed: () => DB): DB {
  evict()
  const existing = SESSIONS.get(sid)
  if (existing) {
    existing.touched = Date.now()
    return existing.db
  }
  const db = structuredClone(seed())
  SESSIONS.set(sid, { db, touched: Date.now() })
  return db
}

/** Throw away this visitor's changes and start again from the seed. */
export function resetSession(sid: string): void {
  SESSIONS.delete(sid)
}

export const sessionCount = (): number => SESSIONS.size
