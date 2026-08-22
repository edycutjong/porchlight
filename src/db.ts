import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { sessionStore } from './session.js'

// A tiny JSON-file store — zero native deps, fully seedable, demo-reproducible.
// It MIRRORS the Mind's long-term memory for the board + audit trail; the Mind
// remains the semantic brain (interview parsing + condition matching).

export type ReasonCategory =
  | 'content_pivot' | 'price' | 'drama' | 'inactivity' | 'life' | 'quality' | 'other'

export interface Member {
  id: string
  name: string
  tier: string
  mrrCents: number
  status: 'active' | 'cancelled' | 'rejoined'
  joinedAt: string
  cancelMessage?: string
}

export interface Departure {
  id: string
  memberId: string
  cancelledAt: string
  reasonCategory: ReasonCategory
  detail: string
  verbatimQuote: string
  doNotContact: boolean
  status: 'open' | 'won_back' | 'lost'
}

export interface ChangeEvent { id: string; createdAt: string; text: string }

export interface Winback {
  id: string
  memberId: string
  departureId: string
  changeEventId: string
  sentAt: string
  message: string
  rejoined: boolean
  recoveredMrrCents: number
  skippedDoNotContact?: boolean
  /** Would a naive keyword matcher have caught this? false = only the Mind's semantic match found it. */
  keywordWouldCatch: boolean
}

export interface DB {
  members: Member[]
  departures: Departure[]
  changeEvents: ChangeEvent[]
  winbacks: Winback[]
}

const DB_PATH = resolve(process.env.PORCHLIGHT_DB ?? '.data/porchlight.json')
const EMPTY: DB = { members: [], departures: [], changeEvents: [], winbacks: [] }

export const id = (): string => randomUUID()

/** Read the seed straight off disk, ignoring any per-visitor session context. */
export function loadFile(): DB {
  if (!existsSync(DB_PATH)) return structuredClone(EMPTY)
  try {
    return { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(DB_PATH, 'utf8')) as DB }
  } catch {
    return structuredClone(EMPTY)
  }
}

export function load(): DB {
  // Inside a request on the deployed app, this resolves to that visitor's own copy
  // (see session.ts). Outside one — CLI, tests — it is the file, unchanged.
  return sessionStore.getStore()?.db ?? loadFile()
}

export function save(db: DB): void {
  const session = sessionStore.getStore()
  if (session) {
    // The engine mutates the object it was handed, so the session already holds the
    // new state; persisting to the shared file here would leak one visitor's demo
    // into everyone else's.
    session.db = db
    return
  }
  mkdirSync(dirname(DB_PATH), { recursive: true })
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

export function reset(): void {
  save(structuredClone(EMPTY))
}

// --- convenience queries -------------------------------------------------
export const member = (db: DB, id: string) => db.members.find((m) => m.id === id)
export const openDepartures = (db: DB) => db.departures.filter((d) => d.status === 'open')
