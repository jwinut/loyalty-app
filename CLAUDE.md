# CLAUDE.md — Project Conventions

Rules for contributors (human and AI). Operational details (ports, deploy
paths, container names) live in `docker-compose.*.yml` and the GitHub
Actions workflows, not here.

## Hard rules

1. **`docker compose` with a space** — never `docker-compose`.
2. **Never bypass git hooks** — no `--no-verify` on commit or push.
3. **Never auto-merge PRs** — human review is mandatory. `gh pr merge`
   only after explicit approval; no `--auto`.
4. **Never bypass, skip, or fake tests** — no `test.skip`, no
   `expect(true).toBe(true)`, no `if (env.SKIP) return`. If a test is
   genuinely broken, fix or delete it; don't fake green.
5. **Never touch the database directly** — go through the backend API.
   If the endpoint doesn't exist yet, create it first.

## Architecture

```
loyalty-app/
├── backend-rust/    # Rust 1.93 / Axum API (production backend)
├── frontend/        # React / TypeScript SPA
├── scripts/         # Ops and metrics helpers
├── tests/           # Playwright E2E
└── docker-compose.* # Environment-specific overrides
```

**Trunk-based.** `main` is the only long-lived branch. Feature branches
→ PR → squash-merge to `main` → CI builds GHCR images → staging deploys
automatically → production deploys after manual approval.

**Tier system (nights-based):** Bronze 0+ · Silver 1+ · Gold 10+ ·
Platinum 20+ nights. Tiers are computed from `total_nights`, not
`current_points`.

## Database

- Migrations live in `backend-rust/migrations/` and are applied
  automatically at backend startup via `sqlx::migrate!()`. Backed by
  the embedded migrator (no Prisma).
- Compile-time `sqlx::query!()` / `sqlx::query_as!()` macros, validated
  in CI against the offline cache in `backend-rust/.sqlx/`. Regenerate
  with `backend-rust/scripts/regen-sqlx-cache.sh` (boots a throwaway
  Postgres, applies all migrations, runs `cargo sqlx prepare --workspace
  -- --tests`, tears the container down). Commit the resulting
  `.sqlx/*.json` files.
- Migrations are idempotent by convention (`ADD COLUMN IF NOT EXISTS`,
  `DO`-block constraint guards, `CREATE INDEX IF NOT EXISTS`) so a
  partial application during a failed deploy doesn't wedge the next
  attempt.
- Migration *rewrites* (e.g., canonical reconciliations) need an entry
  in `REBRIDGED_MIGRATIONS` (`backend-rust/src/db/migrations.rs`)
  because sqlx tracks a source checksum and refuses to proceed when
  the file changes. Full procedure (when it's safe, schema-diff
  pre-flight, two-piece review, staging verification) lives in
  [`docs/migration-rewrite-runbook.md`](docs/migration-rewrite-runbook.md).
- Use stored procedures (e.g., `award_points`,
  `recalculate_user_tier_by_nights`) instead of raw `UPDATE`s for
  tier-affecting operations.

## Backend (Rust)

Toolchain pinned in `backend-rust/rust-toolchain.toml`. `cd backend-rust`
picks it up via rustup.

```bash
cd backend-rust
cargo build              # debug
cargo build --release    # release
cargo test               # all tests
cargo test <name>        # single test by name filter
cargo test --test lib integration::coupon_test  # one integration module (harness: tests/lib.rs)
cargo clippy --all-targets --all-features -- -D warnings
cargo fmt --all -- --check
cargo sqlx prepare --check
```

Patterns:
- `AppState::new(pool, redis, config)` constructs application state;
  use the `.db()` / `.redis()` / `.config()` accessors, not direct
  field access.
- Routes follow `routes().with_state(state)` and mount under `/api/...`
  in `src/routes/mod.rs`.
- Auth via JWT in HttpOnly refresh cookie (Phase 3 — JSON-body refresh
  has been removed).

## Frontend

TypeScript error pattern at boundaries:

```ts
catch (error) {
  if (error instanceof Error) console.log(error.message);
  else console.log('Unknown error:', String(error));
}
```

```bash
cd frontend
npm run lint && npm run typecheck && npm run test
npx vitest run src/path/to/File.test.tsx   # single test file
```

## Root scripts & E2E

The root `package.json` orchestrates both halves:

```bash
npm run quality:check    # lint + typecheck + test-integrity + backend tests (what pre-push runs)
npm run dev              # backend (cargo run) + frontend (vite) concurrently
npm run test:e2e         # Playwright with the local E2E_* port env vars pre-set
```

Playwright is configured at the root (`playwright.config.ts`, tests in
`tests/`) with two projects: `api` (`*.api.spec.ts`, request-context only,
sequential) and `browser` (`*.browser.spec.ts`, Desktop Chrome). Run one
file locally:

```bash
npx playwright test tests/health.api.spec.ts --project=api
```

`BACKEND_URL` / `FRONTEND_URL` env vars override the target. The suite
assumes CI manages the Docker containers — locally, point it at an
already-running stack.

## API routes

Before wiring a new frontend call:
1. Find the handler in `backend-rust/src/routes/`.
2. Check its mount path in `backend-rust/src/routes/mod.rs`.
3. Construct `/api/{mount}/{route}`.
4. Hit it with `curl` first to confirm shape.
5. Regenerate the typed client instead of hand-writing fetch calls:
   `cd frontend && npm run generate:api` pulls `/api/openapi.json`
   (defined in `backend-rust/src/openapi.rs`) into
   `frontend/src/api/generated/`.

## CI/CD

Workflows fire on push to `main`:
- `ci-test.yml` — frontend lint + frontend unit tests (Prepare Workspace
  + Lint Frontend + Frontend Unit Tests).
- `ci-build-e2e.yml` (named **CI Build & Deploy**) — Lint Backend (Rust) →
  parallel (Test Backend Unit, Test Backend Integration, Build Backend
  Release) → Build & Push to GHCR → **Regression & Smoke (API)** +
  Deploy to Staging (inline, on push to `main` only) → Verify Staging
  health check. The deploy gate is the **API regression/smoke suite**
  (`regression-api`, the Playwright `api` project — `*.api.spec.ts`),
  which uses Playwright's request context with **no browser**, so it has
  no `cdn.playwright.dev` dependency and is reliable enough to block
  deploys.
- `e2e.yml` (**Browser E2E**) — the full browser suite (Playwright
  `browser` project — `*.browser.spec.ts`), run inside the
  `mcr.microsoft.com/playwright` container so browsers are pre-baked (no
  CDN download). It triggers via `workflow_run` after CI Build & Deploy
  (and nightly / on demand) and **does NOT gate deployment** — a flaky
  browser/CDN issue must never block shipping. Treat a red Browser E2E
  as a signal to investigate, not a deploy blocker.
- `trivy.yml` — Filesystem scan on push; backend/frontend image scans
  triggered by `workflow_run` from `ci-build-e2e.yml` (`CI Build &
  Deploy`; pulls images from GHCR instead of rebuilding).

Production deploys live in `deploy.yml`, `workflow_run`-triggered after
CI Build & Deploy + CI Tests succeed for the commit, and gated by the
`production` GitHub environment, which has a **required reviewer** — the
deploy pauses for manual approval before it runs (walk
[`docs/production-approval-checklist.md`](docs/production-approval-checklist.md)
before approving). Manage the approver list in Settings → Environments →
`production`.

Public-launch readiness — the state of every audit follow-up tied to
flipping the public switch — is tracked in
[`docs/public-launch-readiness.md`](docs/public-launch-readiness.md).

Conventional commit prefixes: `feat:`, `fix:`, `improve:`, `refactor:`,
`test:`, `docs:`, `chore:`.

## Security

- Never log sensitive data (passwords, tokens, API keys).
- Validate input on every boundary; sanitize user-controlled content
  (XSS); parameterized queries / sqlx macros (SQL injection); sanitize
  user-controlled values before embedding in log output (log injection).
- Production secrets in GitHub Actions secrets. Templates live in
  `.env.example` / `.env.production.example`. Real `.env*` files are
  never committed.

## Quick reference

```bash
# Local dev
docker compose up -d

# Git workflow
git checkout -b feat/my-feature
git commit -m "feat: description"   # hooks run automatically
git push -u origin feat/my-feature
gh pr create --base main
# ...human reviews...
gh pr merge <PR> --squash --delete-branch   # only after explicit approval
```

## Agent skills

### Issue tracker

Issues live in GitHub Issues (thehfhotel/loyalty-app) via the `gh` CLI; external PRs are NOT a triage/request surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical defaults (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), created on first use. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` (lazy-created by /grill-with-docs) + `docs/adr/`. See `docs/agents/domain.md`.
