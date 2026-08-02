# Contributing

Thanks for your interest in improving Porchlight! 🏮

## Getting Started
1. Fork the repo and branch from `main`: `git checkout -b feat/your-feature`
2. Install dependencies: `npm ci`
3. (Optional) Copy the env template: `cp .env.example .env` — without a key, Porchlight runs in MOCK mode.
4. Run the dashboard: `npm run start:demo` (seeds a fresh ledger, then serves at http://localhost:5173)
5. Run the full arc headless: `npm run demo`

## Before You Open a PR
- `npm run ci` passes (audit, strict typecheck, unit tests).
- `npm run e2e` passes (Playwright, demo mode — no key needed).
- Add or update tests for any behavior change.
- Keep commits conventional (`feat:`, `fix:`, `docs:`, `chore:`).

## Architecture Notes
- The Mind (`@animocabrands/minds-client-lib`) is the engine — memory, semantic
  condition-matching, and native-channel outreach are load-bearing. `src/minds.ts`
  holds both the LIVE client and the deterministic MOCK brain behind one interface.
- The JSON store (`src/db.ts`) mirrors the Mind's memory for the board and audit;
  the Mind remains the semantic brain.

## Reporting Bugs / Requesting Features
Open an issue using the provided templates. Include repro steps, expected vs.
actual behavior, and environment details.
