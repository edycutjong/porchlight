<div align="center">
  <a href="https://porchlight.edycu.dev"><img src="docs/icon-animated.svg" alt="Porchlight logo — a porch lantern left on" width="144"></a>

  <h1>Porchlight 🏮</h1>
  <p><em>An exit-interview Mind that remembers <b>why</b> each member left — and autonomously wins them back the moment their reason is actually fixed</em></p>

  <a href="https://porchlight.edycu.dev"><img src="docs/readme-hero-animated.svg" alt="Porchlight — remembers why members leave, wins them back when it's fixed" width="100%"></a>

  <br/>

  [![Live site](https://img.shields.io/badge/Live_site-porchlight.edycu.dev-69D38A?style=for-the-badge&labelColor=0F1220&logo=github&logoColor=white)](https://porchlight.edycu.dev)
  [![Demo video](https://img.shields.io/badge/▶_Demo-Watch_2_min-FF0000?style=for-the-badge&labelColor=0F1220&logo=youtube&logoColor=white)](https://youtu.be/1J-86tHxsYM)
  [![Pitch Deck](https://img.shields.io/badge/Pitch_Deck-View-ffcf6b?style=for-the-badge&labelColor=0F1220)](https://porchlight.edycu.dev/pitch-deck/)
  [![Powered by Minds by Animoca Brands](https://img.shields.io/badge/Powered_by-Minds_by_Animoca_Brands-ff9f1c?style=for-the-badge&labelColor=0F1220)](https://hellominds.ai)
  [![Creative Minds Jam](https://img.shields.io/badge/Creative_Minds_Jam-%231-6C5CE7?style=for-the-badge&labelColor=0F1220)](https://dorahacks.io/hackathon/creativeminds)
  [![Track](https://img.shields.io/badge/Track-Audience_Growth_%26_Community-ffcf6b?style=for-the-badge&labelColor=0F1220)](https://dorahacks.io/hackathon/creativeminds)
  [![Minds Builder Hub](https://img.shields.io/badge/Minds-Builder_Hub-69D38A?style=for-the-badge&labelColor=0F1220)](https://build.hellominds.ai)

  <br/>

  ![Minds SDK](https://img.shields.io/badge/Minds_SDK-7_methods-ff9f1c?style=flat)
  ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
  ![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=flat&logo=node.js&logoColor=white)
  ![Express](https://img.shields.io/badge/Express-server-000000?style=flat&logo=express&logoColor=white)
  ![zod](https://img.shields.io/badge/zod-schemas-3E67B1?style=flat&logo=zod&logoColor=white)
  ![Playwright](https://img.shields.io/badge/Playwright-e2e-2EAD33?style=flat&logo=playwright&logoColor=white)
  ![Tests](https://img.shields.io/badge/tests-51_passing-69D38A?style=flat)
  ![Coverage](https://img.shields.io/badge/coverage-100%25-2ea44f?style=flat)
  ![License](https://img.shields.io/badge/license-MIT-2ea44f?style=flat)
  [![CI/CD Pipeline](https://github.com/edycutjong/porchlight/actions/workflows/ci.yml/badge.svg)](https://github.com/edycutjong/porchlight/actions/workflows/ci.yml)
  [![CodeQL](https://github.com/edycutjong/porchlight/actions/workflows/codeql.yml/badge.svg)](https://github.com/edycutjong/porchlight/actions/workflows/codeql.yml)
  [![Release](https://img.shields.io/github/v/release/edycutjong/porchlight?sort=semver)](https://github.com/edycutjong/porchlight/releases)

</div>

### 🤝 Sponsor

Porchlight is built on **[Minds by Animoca Brands](https://hellominds.ai)** — the sponsor platform for the Creative Minds Jam. The Minds agent is the **engine**, not a wrapper: per-member long-term memory, semantic reasoning, and native-channel outreach all come from the Mind via [`@animocabrands/minds-client-lib`](https://build.hellominds.ai). Builder console: [build.hellominds.ai](https://build.hellominds.ai).

Track: *Audience growth & community engagement*.

---

## ⚠️ The problem
For any membership creator, **churn is the direct revenue wound.** When a member cancels, the *reason* vanishes — nobody records it. And when the creator later fixes the very thing that drove people away (resumes a series, drops the price, ends the drama), the people who left for exactly that reason are never told. Today's "win-back" is a generic *"we miss you"* blast that ignores why each person actually left.

## 🏮 What Porchlight does
1. **Exit interview (memory).** A member cancels → the Mind runs a short, warm interview and files a structured **return-condition** per member — the reason, in *their own words*.
2. **Churn board (continuity).** Every departure compounds into a live board: *"33% left over the pivot away from deep-dives."*
3. **Conditional win-back (autonomous follow-up).** The creator announces what changed → the Mind **semantically matches** it against every stored reason and, unprompted, messages **only** the members whose reason is now resolved — **quoting their own words** from weeks ago. Do-not-contact is always honored. Recovered MRR is tracked.

## 🧠 Why the Mind is the product (not a wrapper)
- The **exit interview** is an adaptive conversation, not a form.
- **Condition matching** is *semantic judgement* — "the pivot to short clips" is resolved by "deep-dives are back" even with **zero shared keywords**. That is the Mind reasoning, not a filter.
- The **win-back** recalls the member's *own words* from months earlier — the Mind's long-term memory.
- Remove the Mind and there is neither the memory nor the trigger. A stateless tool can send "we miss you"; it cannot know *this* person left for *that* reason and that reason is now fixed.

Uses `@animocabrands/minds-client-lib` across 7 methods: `listMinds`, `getMind`, `ensureConversation`, `sendMessage`, `waitForReply`, `getHistory`, `getLatestHistoryFingerprint`.

## ⚡ Run it

```bash
npm install
npm run demo  # the full arc, headless (works offline in MOCK mode)
npm start     # dashboard at http://localhost:5173  (npm run seed first for data)
npm test      # 51 tests (interview parse, win-back, semantic edge, do-not-contact, live SDK, edges)
```

### Offline by default, real Mind when you want it
With no API key, Porchlight runs in **MOCK mode** so the whole flow is demoable offline. To drive a real Mind:

1. Create a Mind at [hellominds.ai](https://hellominds.ai).
2. Author the **Porchlight** Skill by describing it to your Mind:
   > *"When I forward a cancellation, run a short warm exit interview and reply with a JSON return-condition `{reasonCategory, detail, verbatimQuote, doNotContact}`. Later, when I tell you something changed, tell me which past cancellers that resolves and draft a personal win-back quoting their own words."*
3. Create a Builder API key in the [Builder console](https://build.hellominds.ai).
4. `export MINDS_BUILDER_API_KEY=…` (optionally `MIND_ID=…`), then `npm run spike`.

## 🏗️ Architecture
```mermaid
flowchart TD
    subgraph client["🖥️ Browser — our own UI"]
        SF["Mock membership storefront<br/>(cancel / rejoin)"]
        DASH["Dashboard<br/>churn board · recovered-MRR · audit trail"]
    end

    subgraph backend["⚙️ Porchlight backend — Node/TS · Express"]
        SRV["server.ts<br/>REST API · serves /public"]
        subgraph engine["engine/"]
            EI["exitInterview.ts<br/>drives Mind chat, parses condition"]
            CM["conditionMatcher.ts<br/>semantic: does change resolve reason?"]
            TE["triggerEngine.ts<br/>match open conditions → win back resolved"]
        end
        MW["minds.ts<br/>client-lib wrapper (+ MOCK mode)"]
        DB[("db.ts — SQLite<br/>members · departures{condition, quote, do_not_contact}<br/>events · winbacks")]
    end

    subgraph minds["🧠 Minds platform · @animocabrands/minds-client-lib"]
        MIND["Pre-configured Mind<br/>long-term memory · semantic reasoning · Skill"]
        CH["Native channel<br/>Telegram / email"]
    end

    SF -- "cancel event" --> SRV
    SRV --> EI
    EI -- "ensureConversation · sendMessage · waitForReply" --> MW
    MW <--> MIND
    MIND <--> CH
    EI -- "structured return-condition + verbatim quote" --> DB

    SRV -- "creator posts 'what changed'" --> TE
    TE --> CM
    CM -- "semantic judgment" --> MW
    TE -- "resolved & not do-not-contact" --> MW
    MW -- "win-back quoting member's own words" --> MIND
    TE -- "recovered MRR" --> DB

    DB --> SRV
    MW -- "getHistory audit · getLatestHistoryFingerprint" --> SRV
    SRV --> DASH
```
- `src/minds.ts` — the Minds integration (LIVE client-lib + MOCK brain).
- `src/engine/` — exit interview, condition matcher, trigger engine.
- `src/board.ts` — the churn-intelligence board. `src/server.ts` + `public/` — dashboard.

Node 22+ · TypeScript · Express · zod. A JSON store mirrors the Mind's memory for the board and audit trail; the Mind remains the semantic brain.

## 🧪 Testing & CI

A production-grade harness runs on every push and PR — a **6-stage GitHub Actions pipeline** (`ci.yml`): Quality → Security → Build & Smoke → E2E → Performance → Deploy Gate. Releases run in a dedicated `release.yml` workflow (see below).

```bash
npm run ci          # audit + strict typecheck + unit tests
npm test            # 51 unit tests (node:test)
npm run test:coverage  # 100% lines / branches / functions on every source file
npm run e2e         # Playwright E2E against the live dashboard (demo mode, no key)
npm run lighthouse  # Lighthouse CI (performance / a11y / SEO)
make security-scan  # npm audit + license check
```

### Automatic semantic versioning

Version numbers are never bumped by hand. On every push to `main`, the `release.yml` workflow runs **[semantic-release](https://github.com/semantic-release/semantic-release)**: it reads the [Conventional Commits](https://www.conventionalcommits.org/) since the last tag, computes the next [SemVer](https://semver.org/), then — with no manual release PR — writes `CHANGELOG.md`, bumps `package.json`, tags the commit, and publishes a GitHub Release automatically.

| Commit prefix | Release |
|---|---|
| `fix:` | patch — `0.1.0 → 0.1.1` |
| `feat:` | minor — `0.1.0 → 0.2.0` |
| `feat!:` / `BREAKING CHANGE:` footer | major — `0.1.0 → 1.0.0` |
| `chore:` `docs:` `test:` `ci:` `refactor:` | no release |

Commit conventionally and the version takes care of itself.

| Layer | Tool | Status |
|---|---|---|
| Code Quality | TypeScript **strict** (`tsc --noEmit`) | ✅ |
| Unit Testing | `node:test` — core Mind flow + engine, DB, server, live-SDK & edge cases | ✅ (51 · 100% coverage) |
| E2E Testing | Playwright — demo-mode smoke, win-back flow, responsive | ✅ (3 specs × 2 browsers) |
| Security (SAST) | CodeQL | ✅ |
| Security (SCA) | Dependabot + `npm audit` | ✅ |
| Secret Scanning | TruffleHog (CI) | ✅ |
| Performance | Lighthouse CI | ✅ (advisory) |
| Versioning | semantic-release (Conventional Commits → SemVer) | ✅ |

## 📄 License
[MIT](LICENSE) © 2026 Edy Cu

## 🙏 Acknowledgments
Built for the **Creative Minds Jam** (Minds by Animoca Brands). Thank you to the Minds team for the `@animocabrands/minds-client-lib` builder surface.
