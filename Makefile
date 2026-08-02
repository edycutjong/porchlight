.PHONY: help install dev demo test typecheck ci e2e lighthouse security-scan

help:
	@echo "Porchlight — make targets"
	@echo "  install        npm ci"
	@echo "  dev            run the dashboard with watch"
	@echo "  demo           full arc, headless (MOCK offline)"
	@echo "  test           unit tests (node:test)"
	@echo "  typecheck      strict tsc --noEmit"
	@echo "  ci             audit + typecheck + test"
	@echo "  e2e            Playwright E2E (demo mode)"
	@echo "  lighthouse     Lighthouse CI audit"
	@echo "  security-scan  npm audit + license check"

install:
	npm ci

dev:
	npm run dev

demo:
	npm run demo

test:
	npm test

typecheck:
	npm run typecheck

ci:
	npm run ci

# ── Advanced Testing & Security ─────────────────────────────
e2e:
	@echo "🎭 Running Playwright E2E tests (demo mode)..."
	npx playwright test

lighthouse:
	@echo "🔦 Running Lighthouse CI audit..."
	npx lhci autorun

security-scan:
	@echo "=== NPM AUDIT ==="
	npm audit --audit-level=high || true
	@echo ""
	@echo "=== LICENSE CHECK ==="
	npx license-checker --production --failOn "GPL-3.0;AGPL-3.0" --summary || true
