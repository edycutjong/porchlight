# Builder feedback — Minds by Animoca Brands

First-hand notes from building [Porchlight](https://github.com/edycutjong/porchlight) on the
Minds Builder API during the Creative Minds Jam (2026-07-28 → 2026-08-28).

Porchlight puts a Mind on the critical path in three places — exit interview, semantic
condition-matching, and win-back drafting — so this is written from sustained production-shaped
use, not a single hello-world call.

**Measurements below come from batch runs totalling 67 live turns** (`npm run precompute`), which
records latency per call. Environment: `@animocabrands/minds-client-lib`, Node 22, Mind on
`minimax/minimax-m3`, single Builder API key, from Asia-Pacific.

---

## 1. Reply latency is high and very wide — this is the big one

| | seconds |
|---|---|
| p50 | **29.2** |
| p95 | **182.0** |
| max | **210.3** |
| n | 67 completed turns |

A ~29s median is workable for background agent work. The **p95 at 182s is the problem**: it is
~6× the median, so latency is effectively unpredictable per call. The 210s maximum is a 180s
client timeout followed by a successful retry.

**Why it matters:** it decides what you can build. Anything user-facing and synchronous is off the
table — we could not let a visitor wait on a live turn, so Porchlight ships a pre-captured verdict
cache for its public demo and bounds the interactive path at 100s. That is a real product
compromise forced by tail latency, not by the model's quality.

**What would help, in order:** (a) a published latency SLO or even just typical/p95 guidance so
builders can design around it; (b) a streaming or partial-response option so a UI can show progress;
(c) a documented server-side timeout, so client timeouts can be set to match rather than guessed.

## 2. Transient `fetch failed` with no typed error

2 of 69 attempted turns (~3%) failed with a bare `Network error: fetch failed` and succeeded on a
later attempt. No error code, no `retryable` flag, no `Retry-After`.

Because it is untyped, a caller cannot distinguish "retry me" from "your request is malformed", so
every failure has to be treated as retryable — which is wrong for 4xx-class problems. **A typed
error surface (`code`, `retryable`, `retryAfterMs`) would be a large reliability win for very
little API change.**

## 3. Structured output has to be scraped out of prose

There is no schema/JSON mode, so getting machine-readable output means asking for JSON in the
prompt and then finding it in the reply:

```ts
// src/minds.ts — every structured call needs this
function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON object in Mind reply')
  return JSON.parse(text.slice(start, end + 1))
}
```

We then validate with Zod. It works, but it is brittle by construction — the Mind can preface JSON
with commentary, wrap it in a code fence, or emit two objects. **A `responseFormat: json_schema`
option would remove an entire class of failure** for anyone using a Mind as a component rather than
a chat partner.

## 4. Replies are HTML, and that is not obvious until it bites

`messageText` comes back with markup — `<p>`, `<br>`, and HTML entities. Anything that renders or
stores the text needs to strip it first, and naive stripping is subtly unsafe: decoding entities
*before* removing tags can reveal markup that a single-pass strip then misses.

Our `stripHtml()` decodes `&amp;` last and loops the tag-strip until stable for exactly that reason.
**Worth a line in the docs, or a `plainText` field alongside `messageText`.**

## 5. `waitForReply` needs care to avoid reading a stale reply

Correct use turned out to require passing both `afterFingerprint` (captured *before* sending) and
`sentMessageText`:

```ts
const before = await c.getLatestHistoryFingerprint(alias).catch(() => undefined)
await c.sendMessage({ alias, messageText: text })
const outcome = await c.waitForReply({ alias, timeoutMs, afterFingerprint: before, sentMessageText: text })
```

Without the fingerprint it is possible to return the *previous* turn's reply — a silent correctness
bug rather than a loud failure, and the worst kind to debug. This is the single thing we would most
like to see promoted into the quickstart, since the naive call reads as if it should just work.

## 6. Minds and Skills cannot be created programmatically

Both are console-only: a Mind is created in the UI, and Skills are authored by describing them in
natural language. That is a genuinely nice authoring experience, but it means **a project cannot
provision its own agent**, so onboarding a new user requires manual setup and the whole thing
cannot be tested end-to-end from CI.

`npm run spike` verifies 6 client-lib methods against a live Mind, but it can only ever run against
a Mind a human made first. A create/equip API — even limited, even builder-key-gated — would close
the loop.

## 7. Identical inputs give different verdicts across runs — plan for it

Re-running the same judgement weeks apart, against the same Mind and the same prompt, produced a
different answer. One member's departure —

> *"you stopped doing the long-form lore videos i subscribed for"*

— judged against *"the deep-dive interviews are back, weekly"* resolved **true** in an early run and
**false (0.60)** in our full capture, with this rationale:

> "The announcement restores long-form content but specifically as deep-dive interviews, not the
> lore videos the member subscribed for; the subject-matter mismatch means the member's core
> interest in lore is likely still unmet."

The second answer is arguably the better one — it is a genuinely sharper distinction. **This is not
a complaint about quality; it is a warning about reproducibility.** Any figure derived from a batch
of Mind judgements is a snapshot of one run, not a constant, and we had to change how we present
our own numbers once we noticed.

There is no temperature or seed parameter exposed, so a builder cannot opt into determinism even
where they want it. **A `temperature` / `seed` option — or documentation stating plainly that
verdicts are non-deterministic — would save people from publishing figures they cannot reproduce.**
For evaluation-style workloads this is the difference between a usable component and one you have
to cache to trust.

---

## What worked well

- **`ensureConversation(alias, mindId)` is the right primitive.** Per-member aliases meant memory
  partitioning was free; we never wrote a session layer for the Mind side.
- **The Soul/Brain split held up.** Auto-routing meant we never picked or tuned a model, and the
  quality was consistently good enough to be load-bearing — see below.
- **Semantic judgement genuinely delivered.** Porchlight's whole thesis is that a Mind can tell
  *"short clips replaced the long sit-down conversations"* and *"the deep-dive interviews are back,
  weekly"* are the same thing despite sharing zero keywords. Across 54 captured judgements the Mind
  resolved 14 departures — **11 of which a keyword baseline scores 0.00 on** — while refusing 35
  non-matching pairs at ≥0.90 confidence. Both halves matter: the recall is the pitch, but the
  precision is what makes it safe to actually send. That discrimination is the product.
- **`getHistory` made the audit trail trivial** — useful for a domain where "why did you message
  this person?" is a real question.

---

**Filed by:** Edy Cu · [github.com/edycutjong/porchlight](https://github.com/edycutjong/porchlight)
**Channels:** Minds Agentic Builder Chat (Telegram) · Creative Minds Jam WhatsApp track group
**Reproduce the latency numbers:** `npm run precompute` — writes per-call timings to
`src/liveCache.json` under `latency`.
