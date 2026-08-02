// Test-only bootstrap: LIVE with a preconfigured MIND_ID (so the spike keeps it instead
// of falling back to the first listed mind) and a tiny spike timeout (so waitForReply's
// timeout branch is fast to reach).
import { Buffer } from 'node:buffer'

const b64u = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url')

process.env.MINDS_BUILDER_API_KEY = `${b64u({ alg: 'none' })}.${b64u({ humanId: 'human-1' })}.sig`
process.env.MIND_ID = 'mind-preconfigured'
process.env.MIND_SPIKE_TIMEOUT_MS = '120'
delete process.env.PORCHLIGHT_MOCK
