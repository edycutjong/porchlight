import 'dotenv/config'

export const CONFIG = {
  apiKey: process.env.MINDS_BUILDER_API_KEY ?? '',
  mindId: process.env.MIND_ID ?? '',
  port: Number(process.env.PORT ?? 5173),
  /** How long each exit-interview / win-back turn waits for the Mind's reply. */
  replyTimeoutMs: Number(process.env.MIND_REPLY_TIMEOUT_MS ?? 180_000),
  /** How long the SDK spike waits for the Mind's reply (shorter than a live turn). */
  spikeTimeoutMs: Number(process.env.MIND_SPIKE_TIMEOUT_MS ?? 60_000),
  /** MOCK when no Builder API key, or when explicitly forced. */
  get mock(): boolean {
    return !this.apiKey || process.env.PORCHLIGHT_MOCK === '1'
  },
  /**
   * Hero-cluster live mode: call the real Mind only for the win-back cluster
   * (content_pivot departures), deterministically exclude the rest. Cuts a full
   * LIVE arc from ~26 Mind calls to ~13 and protects the cognition budget for the
   * demo recording. Non-hero departures never resolve for a content change anyway,
   * so the won-back set + numbers are identical either way — no member is shown as
   * recovered without a real live decision.
   */
  get heroOnly(): boolean {
    return process.env.PORCHLIGHT_HERO_ONLY === '1'
  },
}

export const MODE = CONFIG.mock ? 'MOCK' : 'LIVE'
