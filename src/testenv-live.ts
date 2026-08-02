// Test-only env bootstrap for LIVE mode. Imported FIRST so config.ts reads a present
// Builder API key (=> CONFIG.mock === false) before it evaluates. The key is a
// syntactically valid three-segment token whose middle segment base64url-decodes to a
// humanId, which the client-lib parses for listMinds(). MIND_ID is intentionally empty
// so the spike exercises the `mindId ||= ms[0]?.mindId` fallback.
import { Buffer } from 'node:buffer'

const b64u = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url')

process.env.MINDS_BUILDER_API_KEY = `${b64u({ alg: 'none' })}.${b64u({ humanId: 'human-1' })}.sig`
process.env.MIND_ID = ''
// Short reply timeout so the ask() retry-on-timeout path is fast to exercise. Replies are
// served instantly by the fetch stub, so this only bounds the deliberate-timeout test.
process.env.MIND_REPLY_TIMEOUT_MS = '120'
