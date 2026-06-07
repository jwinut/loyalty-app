# Ops & CI Scripts

Helper scripts for building, validating, deploying, and maintaining the
Loyalty App. The app runs as containers (Rust/Axum backend, React/nginx
frontend, Postgres, Redis); production is deployed to **evergreen** from CI
over SSH-through-cloudflared. Day-to-day local dev uses `docker compose`
directly (see the repo `CLAUDE.md` quick reference) — these scripts cover the
less-frequent ops and CI tasks.

Most scripts accept `--help` and use safe defaults (`set -euo pipefail`,
colored output, non-zero exit on failure).

## Build & deploy

| Script | Purpose |
|--------|---------|
| `build-production.sh` | Build the backend + frontend Docker images locally. |
| `deploy-config.sh` | Shared config (image names, hosts) sourced by the deploy scripts. |
| `deploy-from-ghcr.sh` | Pull pre-built GHCR images for a given SHA and roll the stack. |
| `rollback-deployment.sh` | Redeploy a previous SHA. See `docs/rollback-runbook.md`. |
| `backup-production.sh` | Create a production data backup (DB + Redis + uploads). |

## Database

| Script | Purpose |
|--------|---------|
| `migration-rollback-safety.sh` | Pre-flight checks before a migration rollback. |

Migrations themselves live in `backend-rust/migrations/` and are applied
automatically at backend startup via `sqlx::migrate!()` — there is no separate
"run migrations" step.

## CI / quality gates

| Script | Purpose |
|--------|---------|
| `lint-quality-gate.sh` | Aggregate lint/format/typecheck gate. |
| `security-audit.sh` | Dependency / security audit helper. |
| `validate-environment.sh` | Validate required env vars and tooling. |
| `validate-test-integrity.sh` | Guard against skipped/faked tests. |
| `validate-workflow.sh` | Lint the GitHub Actions workflow YAML. |
| `migrate-ci-pipeline.sh` | One-off helper used when reshaping the CI pipeline. |

## Git hooks

| Script | Purpose |
|--------|---------|
| `install-hooks.sh` | Install the repo's git hooks. |
| `hooks/pre-commit` | Pre-commit checks. |
| `hooks/pre-push` | Pre-push checks. |

Hooks run automatically once installed — never bypass them with `--no-verify`
(see `CLAUDE.md`).

## Ops

| Script | Purpose |
|--------|---------|
| `reset-rate-limits.sh` | Clear OAuth/API rate-limit counters in Redis. |
| `metrics/actions-metrics.js` | Pull GitHub Actions run metrics. |
