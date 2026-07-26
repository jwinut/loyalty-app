# Public-Launch Readiness Checklist

Seeded from the **Pre-launch checklist** section of
[`docs/audits/operational-2026-05-13.md`](audits/operational-2026-05-13.md)
and updated as Bundle A + B + C audit fixes land. Walk this once
before the public switch flips; revisit after every audit lens (the
next one is due ~90 days after the first public traffic).

Legend:
- `[x]` — landed and verified in repo / live
- `[~]` — partially landed (repo half done; an out-of-repo step remains)
- `[ ]` — open, with the audit finding ID it closes when ticked

## Operational baseline

- [x] **Graceful shutdown** on SIGTERM/SIGINT (CRIT-3) — wired in
  `backend-rust/src/main.rs` via
  `axum::serve(...).with_graceful_shutdown(...)`, with a bounded grace
  period that fits under `docker compose --timeout 30`.
- [x] **Automated Postgres backups** (CRIT-1) — a systemd timer on
  evergreen (`scripts/evergreen/`), encrypting with `age` to
  `/srv/backups/loyalty`. Replaces the old GitHub Actions + S3 workflow,
  which required cloud storage and had never actually produced a backup
  (its environment-scoped secrets read empty, so it skipped nightly while
  reporting success). Restore drill in
  [`docs/restore-runbook.md`](restore-runbook.md). **TODO before public
  launch**: run `scripts/evergreen/install.sh` on evergreen and *actually
  run the restore drill once.*
- [x] **Failure-alert path** (CRIT-2) — `cargo-audit`, `Verify Staging`,
  and `deploy.yml` now file GitHub issues on red instead of relying on
  someone refreshing the Actions tab.
- [x] **Container resource limits** in `docker-compose.prod.yml`
  (HIGH-2) — conservative starting values for backend / postgres /
  redis; revisit after the first capacity test (still open below).
- [x] **`Verify Staging` on-failure log capture** (HIGH-1) — 14-day
  artifact uploads on failure so the next deploy attempt isn't a
  blind retry.
- [x] **Rollback runbook** ([`docs/rollback-runbook.md`](rollback-runbook.md),
  HIGH-3) — covers SHA lookup, redeploy command, migration-forward-only
  constraint, when to combine with DB restore, approval contingency.
- [x] **Cloudflare tunnel runbook**
  ([`docs/cloudflare-tunnel-runbook.md`](cloudflare-tunnel-runbook.md),
  HIGH-6) — tunnel ID, systemd unit, restart command, health probe,
  what to do during a Cloudflare incident.
- [x] **JSON-line logs in non-development environments** (MED-2) —
  `tracing_subscriber::fmt::layer().json()` gates on
  `state.is_production()`/non-dev; dev still gets human-readable
  output.
- [x] **Request-ID propagation** (MED-3) — `tower_http::request_id`
  with `MakeRequestUuid` + `SetRequestIdLayer` + `PropagateRequestIdLayer`;
  ID is woven into the trace span and echoed as `x-request-id` on
  responses for support tickets.
- [x] **Internal healthcheck binary hits `/api/health`** (MED-1) —
  `backend-rust/src/bin/healthcheck.rs::HEALTHCHECK_PATH = "/api/health"`,
  regression-locked by a unit test in the same file.
- [x] **Migration-rewrite runbook**
  ([`docs/migration-rewrite-runbook.md`](migration-rewrite-runbook.md),
  MED-4) — when rewriting is legitimate, schema-diff pre-flight,
  staging verification, `REBRIDGED_MIGRATIONS` step.
- [x] **JWT-rotation impact documented**
  ([`docs/secrets-runbook.md` — "Impact on active sessions"](secrets-runbook.md#impact-on-active-sessions),
  MED-5) — per-secret session impact table, low-traffic-hour
  recommendation, dual-key-rotation noted as future work.
- [x] **Production-approval checklist**
  ([`docs/production-approval-checklist.md`](production-approval-checklist.md),
  MED-6) — link this from the GitHub Environment description for
  `production`.
- [x] **Login rate-limit verified** (LOW-2) — `RedisRateLimiter::strict()`
  is applied to the entire `auth::routes()` subtree
  (`backend-rust/src/routes/mod.rs::create_router`), which covers
  `/api/auth/login`, `/register`, `/forgot-password`, `/reset-password`
  and `/reset-password/request`. Limiter is in-process only when
  Redis is single-instance; Redis-distributed via `RedisRateLimiter`.
  Integration test
  (`backend-rust/tests/integration/auth_test.rs::test_login_rate_limit_returns_429`)
  pins the contract.
- [x] **booking_audit_log retention policy** (HIGH-5) — currently
  "retain indefinitely" pending legal review. Revisit before disk
  pressure (rule of thumb: when `pg_total_relation_size('booking_audit_log')`
  exceeds 20% of the data volume, partition or trim). Tracked as a
  follow-up rather than a launch blocker.

## Still open before public launch

- [ ] **Backup installed on evergreen** — run
  `sudo ./scripts/evergreen/install.sh`, set `ALERT_COMMAND` in
  `/etc/loyalty-backup.conf`, then verify with
  `systemctl start loyalty-backup.service` and confirm a dump decrypts with
  the private key. Until this runs, **there is no production backup at all**.
  Note the backups sit on the same host as the database, so this does not yet
  protect against loss of evergreen itself.

## After the first 30 days

- [~] **Runtime metrics / dashboard** (HIGH-4) — backend half **done**:
  `axum-prometheus` exposes request-rate / latency-histogram / in-flight
  metrics at `GET /metrics` (top-level, internal-only — nginx proxies
  only `/api` + `/storage`, so the endpoint is reachable on the Docker
  network for a scrape but never publicly). **Still open**: run a
  Prometheus on evergreen (scrape `backend:4001/metrics`) + a static
  Grafana dashboard, or point a hosted agent (Better Stack, Honeycomb)
  at it. There's no request-rate/error-rate/p99 *dashboard* until that
  scraper is wired.
- [ ] **`booking_audit_log` retention partitioning** (HIGH-5) —
  if disk pressure emerges, range-partition by `occurred_at` (year)
  so old partitions can be detached cheaply.
- [ ] **Re-audit lens** — run the three audit lenses again ~90 days
  after public launch. Real traffic + real users almost always
  surface findings the read-only audit missed.

## Pre-launch "go / no-go" decision

A green checkbox in **every "Still open before public launch"** row
above is the bar. Don't flip the switch with a yellow row in there.
Decisions to skip a row need a writeup in this file (and a follow-up
issue) explaining the trade-off and the watch criteria.

## Where this is linked from

- [`CLAUDE.md` §  CI/CD](../CLAUDE.md#cicd)
- [`docs/audits/operational-2026-05-13.md`](audits/operational-2026-05-13.md)
  — original pre-launch checklist source
