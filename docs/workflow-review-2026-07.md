# GitHub Actions workflow review — 2026-07-26

52 findings from a 7-agent parallel review of all 10 workflows, cross-checked against real run history.

| # | Sev | Category | Location | Title |
|---|---|---|---|---|
| 0 | high | correctness | `ci-build-e2e.yml:726` | The documented deploy gate (regression-api) is not in deploy-staging's needs — staging ships without it |
| 1 | high | correctness | `ci-build-e2e.yml:487` | regression-api's job-level concurrency group is repo-global and unkeyed, so pending gate jobs get evicted (cancelled) |
| 2 | high | correctness | `ci-build-e2e.yml:20` | cancel-in-progress: true applies to main pushes, and the SSH staging deploy now lives inside this workflow |
| 3 | high | correctness | `deploy.yml:49` | Nothing checks the deploying SHA is main's tip — an older commit can overwrite a newer production deploy |
| 4 | high | correctness | `deploy.yml:220` | No post-deploy health verification for production — a crash-looping release reports green |
| 5 | high | correctness | `e2e.yml:47` | A red Browser E2E on main pages nobody — no notify job, while production now auto-deploys |
| 6 | high | correctness | `ci-test.yml:150` | Deploy-gating frontend workflow never runs the test-integrity guard — CLAUDE.md hard rule 4 has zero CI enforcement |
| 7 | high | security | `ci-test.yml:110` | `npm run lint` cannot fail on warnings, so the entire ESLint security ruleset is decorative in the deploy gate |
| 8 | high | correctness | `trivy.yml:136` | workflow_run checkouts have no `ref:` — filesystem scan analyzes the wrong commit and all three SARIF uploads are attributed to the wrong SHA |
| 9 | high | security | `trivy.yml:10` | No `pull_request`/`push` trigger — the filesystem CVE scan never runs pre-merge, contradicting its own header comment and CLAUDE.md |
| 10 | high | correctness | `backup-production.yml:145` | Remote `pg_dump | gzip` pipeline masks pg_dump failure — truncated backup uploads as green |
| 11 | high | correctness | `backup-production.yml:84` | Missing/rotated backup secrets produce a permanently green no-op that is indistinguishable from a successful backup |
| 12 | high | correctness | `deploy.yml:4` | A manual workflow_dispatch (or re-run) of CI Build & Deploy deploys straight to production, skipping staging entirely |
| 13 | high | correctness | `trivy.yml:12` | Three workflows couple to the literal string "CI Build & Deploy"; a rename silently disables prod deploy, all image scanning, and Browser E2E while everything stays green |
| 14 | high | security | `ci-build-e2e.yml:746` | Unpinned cloudflared from releases/latest at four call sites — the transport for staging secrets, prod secrets, and the production DB dump |
| 15 | medium | correctness | `ci-build-e2e.yml:947` | notify-verify-staging-failure fires on ANY ancestor failure and files a misleading "staging is in an undefined state" issue |
| 16 | medium | correctness | `ci-build-e2e.yml:858` | verify-staging proves only "something answers 200" — it cannot detect that the deploy was a no-op |
| 17 | medium | correctness | `ci-build-e2e.yml:375` | The mutable `latest` tag is pushed to GHCR before any test job or the regression gate has passed |
| 18 | medium | waste-speed | `ci-build-e2e.yml:322` | lint-backend is serialized ahead of every heavy Rust job, adding its full wall-clock to the deploy critical path |
| 19 | medium | correctness | `deploy.yml:242` | notify-on-failure covers neither cancelled nor skipped deploys — the two outcomes that actually happen |
| 20 | medium | correctness | `deploy.yml:54` | One-shot prerequisite check is why queue eviction is fatal — the polling pattern already exists 20 lines away in ci-build-e2e.yml |
| 21 | medium | security | `deploy.yml:103` | cloudflared pulled from releases/latest with no pinning or checksum, then used as the transport for every production secret |
| 22 | medium | security | `deploy.yml:19` | Workflow-level issues:write widens the GITHUB_TOKEN that gets shipped off-runner to evergreen |
| 23 | medium | correctness | `deploy.yml:122` | Missing/rotated production secrets are silently shipped as empty strings |
| 24 | medium | correctness | `e2e.yml:34` | Repo-wide concurrency group with cancel-in-progress:false silently evicts queued browser runs |
| 25 | medium | correctness | `e2e.yml:235` | Playwright container runs Chromium without --ipc=host — the documented cause of "Target crashed" flake |
| 26 | medium | correctness | `e2e.yml:53` | Skipped-because-upstream-failed run reports the workflow as green |
| 27 | medium | waste-speed | `e2e.yml:242` | Bare `npx playwright test` re-runs the entire api project already executed as the deploy gate |
| 28 | medium | correctness | `scorecard.yml:31` | Job-level permissions block silently drops contents:read and actions:read that scorecard-action requires |
| 29 | medium | correctness | `ci-test.yml:16` | All Dependabot PRs share one concurrency bucket with cancel-in-progress, so sibling PRs cancel each other's required check |
| 30 | medium | waste-speed | `ci-test.yml:36` | The `prepare` job adds a serial hop to the deploy critical path while both consumers already self-heal |
| 31 | medium | security | `semgrep.yml:33` | Semgrep container pinned by mutable tag while the job holds security-events: write |
| 32 | medium | waste-speed | `codeql.yml:20` | No path filters: the full 3-language matrix runs on every PR, every rebase, and every squash-merge — 9+ jobs per Dependabot bump |
| 33 | medium | correctness | `backup-production.yml:79` | No notify-on-failure job — a red nightly backup is only visible in the Actions tab |
| 34 | medium | security | `backup-production.yml:143` | DB password is interpolated into the remote command line (and never actually reaches pg_dump) |
| 35 | medium | security | `cargo-audit.yml:24` | Workflow-level `issues: write` is inherited by the `audit` job that never needs it |
| 36 | medium | security | `cargo-audit.yml:16` | Audit never runs on Cargo.lock changes, so a vulnerable dep merges and auto-deploys up to 24h before detection |
| 37 | medium | security | `cargo-audit.yml:41` | SHA pins whose trailing comment is not a version tag are invisible to Dependabot and will never receive updates |
| 38 | medium | waste-speed | `trivy.yml:27` | trivy.yml is the only workflow with neither a concurrency group nor a single timeout-minutes on any of its three jobs |
| 39 | medium | redundancy | `scorecard.yml:20` | Eight non-gating scanner jobs fire on every merge to main, with .github/workflows analyzed three times over |
| 40 | medium | correctness | `e2e.yml:32` | Nightly E2E and weekly Trivy scan `:latest`, which is published before the gate runs — so both report on an image that may never have been deployed, and the deployed image is never re-scanned |
| 41 | medium | correctness | `ci-build-e2e.yml:764` | Staging ships a GITHUB_TOKEN with no `packages` scope to evergreen, while production ships one with `packages: read` — the two deploy paths disagree |
| 42 | medium | correctness | `backup-production.yml:46` | Nightly production backup and unattended production deploys share no mutual exclusion — a migration can collide with pg_dump and stall live reads |
| 43 | low | redundancy | `ci-build-e2e.yml:605` | "Seed E2E test users" duplicates Playwright's globalSetup and can never fail |
| 44 | low | security | `e2e.yml:82` | nosemgrep suppression rests on a false invariant: `branches: [main]` does not mean the SHA came from this repo |
| 45 | low | redundancy | `e2e.yml:155` | ~70 lines of container bring-up, health-wait and user seeding duplicated verbatim from the gate job |
| 46 | low | waste-speed | `semgrep.yml:20` | Scheduled scanners re-run on every push to main with no concurrency group and no paths-ignore |
| 47 | low | correctness | `trivy.yml:127` | `scan-filesystem` lacks the upstream-success guard the two image jobs have, so it scans and uploads after failed builds |
| 48 | low | waste-speed | `codeql.yml:42` | `timeout-minutes: 120` is ~50x the observed runtime, so a hung extractor burns two runner-hours before failing |
| 49 | low | correctness | `codeql.yml:28` | `cancel-in-progress: true` on a shared main/schedule concurrency group evicts main-branch and weekly analyses |
| 50 | low | maintainability | `backup-production.yml:187` | Run summary prints a literal `${BACKUP_S3_BUCKET}` and silently reports empty fields on failure |
| 51 | low | redundancy | `ci-test.yml:112` | Four overlapping dependency-CVE mechanisms with three different cadences and only one that pages anyone |
| 52 | high | correctness | `release-please.yml:57` | Release-please PRs carry no completed check runs, so the only PR class that triggers a production deploy is the one class nothing verifies — **still open**, #377's `push:`-trigger fix was inert and has been reverted |

## HIGH severity

### 0. The documented deploy gate (regression-api) is not in deploy-staging's needs — staging ships without it

**`ci-build-e2e.yml:726`** · correctness

`deploy-staging` declares `needs: [test-backend-unit, test-backend-integration, build-and-push, wait-for-frontend-checks]` — `regression-api` is absent, so it runs *in parallel with* the deploy, not before it. This directly contradicts the comments at line 479 ("DEPLOY GATE") and lines 718-720 ("The deploy gate is `regression-api` ... plus the backend test jobs").

Proven on two real runs:
- Run 30166253220 (push main, green): Deploy to Staging 16:53:17→16:53:34, Verify Staging finished 16:53:39, but "Regression & Smoke (API)" did not finish until 16:54:04 — staging was deployed AND verified 25s before the gate produced a result.
- Run 30143612958 (push main): "Regression & Smoke (API)" was **cancelled** at 04:25:56, yet "Deploy to Staging" succeeded 04:25:45→04:26:10 and "Verify Staging" went green. Staging received a build whose API regression suite never ran.

Failure mode: a *.api.spec.ts regression (auth broken, admin endpoint 500) lands on staging every time, and the only thing stopping it reaching prod is deploy.yml reading the overall workflow conclusion after the fact — so staging and prod silently diverge, and the workflow's own comments tell reviewers the opposite.

**Fix:** Add `regression-api` to `deploy-staging`'s needs list at line 726: `needs: [test-backend-unit, test-backend-integration, build-and-push, wait-for-frontend-checks, regression-api]`.

### 1. regression-api's job-level concurrency group is repo-global and unkeyed, so pending gate jobs get evicted (cancelled)

**`ci-build-e2e.yml:487`** · correctness

`concurrency: {group: regression-api, cancel-in-progress: false}` (lines 487-489) uses a **constant** group name — not keyed by `github.ref` or `github.run_id` like the workflow-level group on line 19. GitHub allows only one *pending* entry per concurrency group: when a third job queues, the already-pending one is cancelled, not queued behind. So every burst of PR activity randomly cancels somebody's deploy gate.

Confirmed root cause of the cancelled runs: run 30143612958 (push to main) had its regression job cancelled 13s after start (04:25:43→04:25:56, log already garbage-collected: "log not found"), while six other ci-build-e2e runs were in flight in the same window (30143670941, 30143678076, 30143678466, 30143714536, 30143787943, 30143905659) — all contributing a `regression-api` job to the same global group.

Combined with the missing `needs` above, the result is: gate cancelled → whole run conclusion `cancelled` → deploy.yml skips prod → but staging already deployed. Also pure waste: the job needs no shared resource (postgres/redis are per-runner service containers, ports 5436/6381 are runner-local), so serializing it repo-wide buys nothing.

**Fix:** Key the group per ref so it can't evict other branches: `group: regression-api-${{ github.ref }}` (lines 487-489). Since there is no shared external resource, deleting the job-level `concurrency:` block entirely is also correct — the workflow-level group on line 19 already dedupes per ref.

### 2. cancel-in-progress: true applies to main pushes, and the SSH staging deploy now lives inside this workflow

**`ci-build-e2e.yml:20`** · correctness

The workflow-level `concurrency: {group: ci-build-${{ github.ref }}, cancel-in-progress: true}` was safe when deploys lived in a separate workflow. Now `deploy-staging` (lines 723-835) pipes a deploy payload over `ssh` from inside this workflow, so a second merge to main can cancel a run *while the SSH deploy is executing*.

That window is real and measurable: in run 30166253220 "Deploy to Staging" occupied 16:53:17→16:53:34 and its log shows the remote shim doing container recreation (`loyalty_backend_dev ... Up 1 second` at 16:53:32). Run 30166173509 was cancelled at 16:45:17 by a push 2.5 minutes later — the same 2-3 minute merge cadence that lands inside the deploy window.

Failure mode: run A is killed mid-`ssh`; the remote shim on evergreen has already received the payload and keeps pulling/recreating containers after the SSH channel dies. Run B (newer commit) deploys concurrently. Staging can settle on the OLDER commit with no failure signal anywhere — an out-of-order deploy that verify-staging cannot detect (see the verify-staging finding).

**Fix:** Make cancellation branch-aware on line 20: `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`. PR runs still cancel-on-push; main runs queue so a deploy is never truncated.

### 3. Nothing checks the deploying SHA is main's tip — an older commit can overwrite a newer production deploy

**`deploy.yml:49`** · correctness

check-prerequisites takes `SHA=${{ github.event.workflow_run.head_sha }}` (line 49) and deploy-production checks that ref out (line 91) and ships it as COMMIT_SHA / image tag (lines 119, 225). The only ordering control is `concurrency: group: deploy` (lines 9-11), which serializes runs but orders them by *queue arrival*, not by commit recency — and the eviction rule keeps the newest queued run, not the newest commit. Concrete failure: commits A then B land minutes apart; A's ci-build-e2e is slow (cold sccache, integration-test retry) while B's is fast. Both CI workflows go green for B first, so Deploy runs and production ends up on B. A's ci-build-e2e then completes, fires a second workflow_run, check-prerequisites sees ci-test(A)=success and ci-build-e2e(A)=success, sets ready=true, and deploy-production rolls production BACK to A — running A's older backend against a database that already has B's migrations applied. Nothing in the workflow can detect or undo this, and the run reports green. This is materially worse now that production deploys unattended: there is no human at the approval gate to notice the SHA in the summary is stale.

**Fix:** In the check-prerequisites script (after line 51), resolve main's tip and refuse to deploy anything else: `TIP=$(gh api repos/${{ github.repository }}/commits/main --jq .sha)` and add `[ "$SHA" = "$TIP" ]` to the ready=true condition on line 65, logging "superseded by $TIP" in the else branch. Costs one API call and makes late-arriving older commits fall out harmlessly.

### 4. No post-deploy health verification for production — a crash-looping release reports green

**`deploy.yml:220`** · correctness

The last step of deploy-production is `Deployment Summary` (lines 220-227), which only echoes text into $GITHUB_STEP_SUMMARY. The job succeeds as soon as the SSH pipeline (line 214) exits 0, i.e. as soon as the remote shim finishes starting containers — not when the app is actually serving. Staging is strictly better protected: ci-build-e2e.yml:846-868 has a whole `verify-staging` job polling http://loyalty-dev.saichon.com/api/health for 90s, plus SSH log capture on failure (ci-build-e2e.yml:875-903). `grep -rn 'api/health' .github/workflows/` returns zero hits for the production host. So a release that pulls fine but crash-loops on a bad migration, a missing env var, or a panic at startup produces: green deploy job, green workflow, no notify-on-failure (it is gated on `failure()`, line 242), and a summary that says 'Production Deployment Complete'. With the required reviewer removed there is nobody watching the run either.

**Fix:** Add a step after `Deploy via SSH to evergreen` (before line 220), mirroring ci-build-e2e.yml:854-868: poll `https://loyalty.saichon.com/api/health` with `curl -fsS --max-time 5` in a ~30x3s loop and `exit 1` on timeout. Keeping it in the deploy-production job (not a separate job) means the existing notify-on-failure path fires on a bad release.

### 5. A red Browser E2E on main pages nobody — no notify job, while production now auto-deploys

**`e2e.yml:47`** · correctness

e2e.yml has exactly one job and no failure handler. Every other pipeline in this repo files an issue on failure — ci-build-e2e.yml:943 (`notify-verify-staging-failure`, `issues: write`) and deploy.yml:16-18, whose comment states the rule outright: "The Actions tab is not a paging channel." Browser E2E is the only browser-level check in the whole system and it runs AFTER the images have already been pushed, staged, and (now that the production environment no longer has a required reviewer) auto-deployed to prod. So the failure mode is: a browser-only regression (broken login form, blank dashboard, dead nav) ships to production unattended, Browser E2E goes red 20 minutes later, and the only trace is a red dot on the Actions tab that no human is gated on. The old required-reviewer step used to be the human eyeball that caught this; removing it made this workflow's silence load-bearing.

**Fix:** Add a `notify-browser-e2e-failure` job modeled on ci-build-e2e.yml:943 — `needs: [browser-e2e]`, `if: failure() && github.event_name == 'workflow_run'`, job-scoped `permissions: { contents: read, issues: write }`, and a `gh issue list --search "... in:title is:open"` / create-or-comment step keyed to the tested SHA (`github.event.workflow_run.head_sha`) so repeat failures dedupe onto one issue.

### 6. Deploy-gating frontend workflow never runs the test-integrity guard — CLAUDE.md hard rule 4 has zero CI enforcement

**`ci-test.yml:150`** · correctness

CLAUDE.md hard rule 4 forbids test.skip / expect(true).toBe(true) / SKIP-env bypasses, and `npm run test:integrity` (root package.json:21 -> scripts/validate-test-integrity.sh) exists to enforce it. Grep over .github/ finds ZERO references to it: it appears only in `quality:check` (package.json:25) and `scripts/security-audit.sh:257`, neither of which any workflow invokes. The actually-installed hook, scripts/hooks/pre-push, runs only typecheck + lint + check:translations — not quality:check — so the guard runs literally nowhere. ci-test.yml:150 runs `npm run test` (vitest run) alone. Failure mode: a PR that neuters a failing frontend test with `it.skip(...)` goes green in "Frontend Unit Tests", ci-build-e2e.yml:666-707 (wait-for-frontend-checks) polls ci-test.yml, sees completed:success, deploy-staging fires, and — with the production environment's required reviewer now removed — production deploys the regression unattended. Note also that check:translations (frontend/package.json) runs in the local pre-push hook but in no workflow, so missing i18n keys ship the same way. NOTE the guard is currently a no-op even if wired in as-is: scripts/validate-test-integrity.sh increments VIOLATIONS (line 45) inside `find ... | while read` loops (lines 142, 151, 159), which run in a subshell, so the parent's counter is always 0 and line 170 always takes `exit 0`; additionally the line-142 find pattern matches *.test.ts/*.test.js/*.spec.ts/*.spec.js but NOT *.test.tsx (72 of the 81 frontend test files), and the frontend/src/__tests__ directory checked at line 159 does not exist. Wiring the script in without fixing it would install a permanently-green check — itself a hard-rule-4 violation.

**Fix:** Two-part, in order: (1) fix scripts/validate-test-integrity.sh to avoid the subshell counter loss (e.g. `while read -r file; do ...; done < <(find ...)`) and add *.test.tsx/*.spec.tsx to the find patterns; verify it exits 1 on a deliberately planted `it.skip`. (2) Then add a step to ci-test.yml's test-frontend-unit job, before `npm run test`, running `npm run test:integrity` from the repo root (it is pure bash, needs no node_modules). Optionally add `npm run check:translations` to lint-frontend so it is enforced on squash-merges, not just on the author's laptop.

### 7. `npm run lint` cannot fail on warnings, so the entire ESLint security ruleset is decorative in the deploy gate

**`ci-test.yml:110`** · security

ci-test.yml:110 runs `npm run lint`, which is `eslint . --report-unused-disable-directives && node scripts/check-design.cjs` — no `--max-warnings`. frontend/eslint.config.mjs:122 carries the comment "Security rules (temporarily downgraded to warnings for pipeline unblock)" and sets security/detect-object-injection, detect-non-literal-regexp, detect-unsafe-regex, detect-child-process, detect-eval-with-expression, detect-disable-mustache-escape (123-131), plus react/no-danger (69), no-debugger (180) and no-alert (179) all to 'warn'. ESLint exits 0 on warnings, so none of these can ever turn "Lint Frontend" red. `--report-unused-disable-directives` also defaults to warn severity, so a stale `// eslint-disable-next-line` silencing a real rule is likewise invisible. A sibling script `lint:strict` (frontend/package.json) already carries `--max-warnings 0` and is used by nothing. Failure mode: a PR adding `dangerouslySetInnerHTML={{__html: userSuppliedBio}}` emits a react/no-danger warning, `npm run lint` exits 0, CI Tests is green, ci-build-e2e.yml wait-for-frontend-checks passes, and staging + production deploy the XSS sink unattended. A committed `debugger` statement ships the same way.

**Fix:** Baseline the current warning count, then make the gate real: either add `--max-warnings 0` to the `lint` script in frontend/package.json (keeps check-design.cjs in the chain), or promote at least the security/* rules and react/no-danger, no-debugger back to 'error' in frontend/eslint.config.mjs. Do NOT simply swap ci-test.yml:110 to `npm run lint:strict` — lint:strict omits `node scripts/check-design.cjs`, so that would silently drop the design-token check.

### 8. workflow_run checkouts have no `ref:` — filesystem scan analyzes the wrong commit and all three SARIF uploads are attributed to the wrong SHA

**`trivy.yml:136`** · correctness

None of the three `actions/checkout` steps (lines 39-40, 88-89, 135-136) pass a `ref:`. On a `workflow_run` event `GITHUB_SHA`/`GITHUB_REF` resolve to the default-branch tip at trigger time, NOT `github.event.workflow_run.head_sha`. The image jobs get this right for the image tag (lines 55/104) but not for checkout; `scan-filesystem` has no tag logic at all, so it scans whatever main HEAD happens to be — a different tree than the images that were just built and deployed. e2e.yml:88 already does this correctly (`ref: ${{ github.event.workflow_run.head_sha || github.sha }}`); trivy.yml was never updated to match.

Confirmed live, not hypothetical. Runs 30166259484 (created 16:45:20Z) and 30166547479 (16:54:08Z) on 2026-07-25 are two separate Trivy runs for two separate CI Build & Deploy completions, and BOTH report `head_sha=fe0f9c6115aa...`. The code-scanning API agrees: `trivy-filesystem` analyses at 16:45:34Z and 16:54:26Z, plus `trivy-backend`/`trivy-frontend` at 16:54:30Z/16:54:32Z, are all recorded against commit `fe0f9c61` on `refs/heads/main`. Two distinct builds wrote the same (ref, category, sha) triple, so code scanning treats them as last-writer-wins. Because there is also no `concurrency:` block anywhere in this file, overlapping runs can finish out of order and an older build's scan can supersede a newer one — silently resurrecting fixed alerts or erasing new ones. Net effect: the commit an alert is pinned to is unreliable, and the dependency scan does not describe the artifact that shipped.

**Fix:** Add `with: ref: ${{ github.event.workflow_run.head_sha || github.sha }}` to the checkout at lines 39-40, 88-89 and 135-136, and pass explicit attribution to all three `github/codeql-action/upload-sarif` steps (72-76, 121-125, 147-151): `sha: ${{ github.event.workflow_run.head_sha || github.sha }}` and `ref: ${{ github.event.workflow_run.head_branch && format('refs/heads/{0}', github.event.workflow_run.head_branch) || github.ref }}`. Also add a top-level `concurrency: { group: trivy-${{ github.event.workflow_run.head_sha || github.sha }}, cancel-in-progress: false }` so per-commit scans cannot interleave.

### 9. No `pull_request`/`push` trigger — the filesystem CVE scan never runs pre-merge, contradicting its own header comment and CLAUDE.md

**`trivy.yml:10`** · security

The `on:` block (lines 10-16) declares only `workflow_run` (from CI Build & Deploy, main only) and a weekly Saturday cron. But line 6 states "Filesystem scan still runs on PRs/pushes/cron for source-level CVE coverage", and CLAUDE.md's CI/CD section states "trivy.yml — Filesystem scan on push". Neither is true. Confirmed against run history: all 20 most recent Trivy runs are `event: workflow_run` or `event: schedule`; zero `pull_request`.

The gap is total, not partial. cargo-audit.yml is cron-only (`schedule` + `workflow_dispatch`, no PR — see its lines 15-20) and semgrep.yml is `schedule` + `push: main` only. So this repo has NO pre-merge dependency-vulnerability check of any kind. Combined with `main` having no branch protection (verified: `GET /branches/main/protection` → 404 "Branch not protected") and the production environment no longer requiring a reviewer, a PR that adds a CRITICAL-CVE npm/cargo dependency merges, builds, and deploys unattended to production before Trivy ever looks at it — the first signal arrives from the post-deploy `workflow_run` scan. Additionally, `ci-build-e2e.yml:8-12` paths-ignores `.github/workflows/**`, so a workflow-only change to main produces no CI Build & Deploy run and therefore no Trivy scan at all for that commit.

Secondary: `exit-code` is not set on any of the three `trivy-action` steps (lines 64-70, 113-119, 138-145), so it defaults to `'0'` and the job is green regardless of findings — every recent run reports `success` even though commit 30161358954 ("refresh frontend nginx:alpine digest — clears 29 Trivy image CVEs") shows 29 CRITICAL/HIGH image CVEs were live at the time. The green check next to a commit carries no signal.

**Fix:** Add `pull_request: { branches: [main] }` to the `on:` block and gate the two image jobs so they don't fire on it (change lines 30 and 79 to `if: (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success') || github.event_name == 'schedule'`). For the PR path, run `scan-filesystem` with `format: 'table'`, `exit-code: '1'`, `ignore-unfixed: true` and skip the SARIF upload — that makes it a real blocking check and sidesteps the Dependabot read-only-token SARIF problem that semgrep.yml:9-11 documents. Then correct the stale comment on line 6 and the CLAUDE.md CI/CD bullet.

### 10. Remote `pg_dump | gzip` pipeline masks pg_dump failure — truncated backup uploads as green

**`backup-production.yml:145`** · correctness

The remote command sent over SSH is `"PGPASSWORD='…' docker exec -i loyalty_postgres_production pg_dump … | gzip -9"` (lines 145-147). That string is executed by the remote login shell, which has NO `pipefail` (the local `set -euo pipefail` at line 128 only governs the runner's shell). A bash pipeline's exit status is the LAST command's, i.e. gzip's. If pg_dump dies mid-dump (OOM kill, statement/lock timeout, connection reset, disk pressure on evergreen), gzip still sees a clean EOF on stdin, writes a structurally valid gzip trailer, and exits 0 — so ssh exits 0, the local pipefail sees nothing, and `age` encrypts a partial SQL file. The only integrity check is `BACKUP_SIZE -lt 1024` (line 151), which any partial dump of a real database passes trivially, and `gunzip -t` would also pass because the gzip stream itself is well-formed. Net effect: the workflow goes green, an unrestorable/silently-incomplete dump lands in S3, and the failure is discovered only during an actual restore. This is the highest-cost failure mode in the file — the sole off-host copy of production data.

**Fix:** Prefix the remote command string with `set -o pipefail; ` so the remote shell propagates pg_dump's exit code through the pipe: `"set -o pipefail; docker exec -i loyalty_postgres_production pg_dump … | gzip -9"`. Optionally also assert the decompressed dump ends with pg_dump's `-- PostgreSQL database dump complete` sentinel before uploading.

### 11. Missing/rotated backup secrets produce a permanently green no-op that is indistinguishable from a successful backup

**`backup-production.yml:84`** · correctness

`check-config` (lines 66-77) probes only 2 of the 7 required secrets (`BACKUP_S3_BUCKET`, `BACKUP_AGE_RECIPIENT`); when either is absent it emits a `::notice::` and sets `configured=false`, so `backup` is skipped at line 84 and the workflow concludes SUCCESS. Per docs/public-launch-readiness.md:83 the BACKUP_* secrets are still unwired, so this workflow is right now a green daily no-op — a run history of all-green ticks with zero backups taken. The same hole reopens permanently after launch: if `BACKUP_S3_BUCKET` is renamed or an org secret is rotated away, backups stop silently and the Actions tab stays green forever. Nothing else in the repo monitors backup freshness (scripts/backup-production.sh is a separate on-host script; no S3 age check exists). This is exactly the priority-1 'hide a failure as green' class, applied to disaster recovery.

**Fix:** Make 'not configured' an explicit, visible state rather than a silent pass: add a repo variable gate (e.g. `vars.BACKUP_ENABLED`) so that once backups are declared live, a missing secret is a hard `exit 1` instead of a skip; and extend the detection at line 72 to also require `BACKUP_S3_ACCESS_KEY_ID` / `BACKUP_S3_SECRET_ACCESS_KEY` / `BACKUP_S3_REGION` so a half-wired config fails loudly at gate time rather than after a 20-minute dump. At minimum, write the skip reason into `$GITHUB_STEP_SUMMARY` and use `::warning::` instead of `::notice::` so the run is visually distinguishable.

### 12. A manual workflow_dispatch (or re-run) of CI Build & Deploy deploys straight to production, skipping staging entirely

**`deploy.yml:4`** · correctness

Every staging job in ci-build-e2e.yml is guarded by `github.event_name == 'push'` — wait-for-frontend-checks (:670), deploy-staging (:727), verify-staging (:850). ci-build-e2e.yml also accepts `workflow_dispatch` (:16). On a dispatch run against main, those three jobs are SKIPPED, so the workflow still concludes `success`. deploy.yml (:4-7) fires on `workflow_run` for that run (head_branch == main matches the `branches: [main]` filter), and check-prerequisites (:54-71) only asks `gh run list ... --json conclusion` for ci-test.yml and ci-build-e2e.yml — a skipped job does not change a workflow's conclusion. So `TEST_STATUS=success` (from the earlier real push of that SHA) and `BUILD_STATUS=success` (the dispatch run) → `ready=true` → deploy-production runs. Net effect: hitting "Run workflow" on CI Build & Deploy pushes code to production without ever deploying to staging or verifying staging health — and with the production reviewer removed, unattended. The same holds for `gh run rerun` of a dispatch run. Nothing in the graph asserts "staging deployed and verified this SHA".

**Fix:** In deploy.yml check-prerequisites, additionally require that the ci-build-e2e run for this SHA actually deployed staging — e.g. query the job list for that run (`gh run view $RUN_ID --json jobs`) and require the `Verify Staging` job conclusion to be `success`, not `skipped`. Cheaper alternative: add `if: github.event.workflow_run.event == 'push'` to check-prerequisites so dispatch/re-run events cannot reach production.

### 13. Three workflows couple to the literal string "CI Build & Deploy"; a rename silently disables prod deploy, all image scanning, and Browser E2E while everything stays green

**`trivy.yml:12`** · correctness

deploy.yml:5, e2e.yml:22 and trivy.yml:12 each hard-code `workflows: ["CI Build & Deploy"]` / `["CI Tests", "CI Build & Deploy"]`. GitHub matches workflow_run by display name, and a non-matching name is not an error — the downstream workflow simply never fires, with no red X anywhere. The repo already carries the evidence that this rename happened once: trivy.yml:4 and :28 still say "CI Build & E2E" while the trigger on :12 says "CI Build & Deploy". Had those comments been the trigger, image scanning would have been silently dead. A future edit of `name:` on ci-build-e2e.yml:1 or ci-test.yml:1 takes out the entire production deploy path, both GHCR image CVE scans, and the browser suite at once, and the only symptom is "prod stopped updating".

**Fix:** Fix the two stale comments in trivy.yml (:4, :28) to "CI Build & Deploy", and add a comment block above `name:` in ci-build-e2e.yml:1 and ci-test.yml:1 listing the three files whose workflow_run triggers reference it verbatim. Better: pin the deploy chain to filenames instead of names where possible (deploy.yml's check-prerequisites already queries `--workflow=ci-build-e2e.yml`, i.e. by filename — the trigger is the only name-coupled part left).

### 14. Unpinned cloudflared from releases/latest at four call sites — the transport for staging secrets, prod secrets, and the production DB dump

**`ci-build-e2e.yml:746`** · security

The identical `curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64` + `sudo install` block appears at ci-build-e2e.yml:746 (staging deploy), ci-build-e2e.yml:878 (staging failure-log capture), deploy.yml:103 (production deploy), and backup-production.yml:106 (production pg_dump). Only the deploy.yml instance was previously flagged; the real blast radius is that every path carrying production credentials or production data off the runner installs an unverified, unpinned binary that acts as the SSH ProxyCommand — i.e. it is the man in the middle for JWT/DB/SMTP secrets and for the entire encrypted DB backup stream. The same four sites also duplicate the SSH-key/known_hosts bootstrap verbatim, so any hardening (pin, checksum, cosign verify) is a four-file change that will drift.

**Fix:** Extract one local composite action, e.g. `.github/actions/evergreen-ssh/action.yml`, that installs a version-pinned cloudflared (`releases/download/2026.x.y/...`) verified against a recorded sha256, then writes deploy_key/known_hosts. Replace all four inlined blocks with `uses: ./.github/actions/evergreen-ssh`. Add the cloudflared version to the Dependabot docker/github-actions sweep or a dated TODO so the pin is refreshed deliberately.

## MEDIUM severity

### 15. notify-verify-staging-failure fires on ANY ancestor failure and files a misleading "staging is in an undefined state" issue

**`ci-build-e2e.yml:947`** · correctness

`if: failure() && github.ref == 'refs/heads/main' && github.event_name == 'push'` with `needs: [verify-staging]`. A bare `failure()` in a job-level `if` is true when *any* job in the needs ancestry failed — that ancestry is verify-staging → deploy-staging → {test-backend-unit, test-backend-integration, build-and-push, wait-for-frontend-checks} → {lint-backend, build-backend-release}, i.e. the entire pipeline.

So a clippy failure in `lint-backend` on main skips deploy-staging and verify-staging entirely, yet this job still runs and files/comments an issue titled "Verify Staging failed on main" whose body asserts "the new image is up but `/api/health` is not responding" and points the reader at the rollback runbook (lines 966-977). Nothing was deployed. The signal is actively wrong, and because the job comments on the same open issue every time, a persistently red lint turns the issue into noise that gets muted — which then hides the real verify-staging failures it exists to catch.

**Fix:** Replace line 947 with an explicit result check: `if: always() && needs.verify-staging.result == 'failure' && github.ref == 'refs/heads/main' && github.event_name == 'push'`.

### 16. verify-staging proves only "something answers 200" — it cannot detect that the deploy was a no-op

**`ci-build-e2e.yml:858`** · correctness

The poll (lines 858-868) exits 0 on the first successful `curl -fsS $STAGING_HEALTH_URL`, and `/api/health` returns `{status, timestamp, version}` where version is `env!("CARGO_PKG_VERSION")` (backend-rust/src/routes/health.rs:69) — a hard-coded "0.1.0" that never changes between commits. Nothing in the job asserts the running container is `github.sha`.

Timing makes this concrete: in run 30166253220 the remote shim reported containers up at 16:53:32, Deploy to Staging ended 16:53:34, and Verify Staging passed at 16:53:36→16:53:39 — one curl, ~2s after the deploy returned. If the remote shim ever fails to actually swap images (IMAGE_TAG not propagated, a pull that silently reuses a cached tag, a partial deploy left behind by the mid-SSH cancellation described above), the previous build answers 200 and verify-staging goes green. That green is what deploy.yml's check-prerequisites reads to authorize the now-unattended production deploy, so a stale staging turns into an unreviewed prod deploy.

The single-shot success also means a container that binds the port and crashes seconds later still passes.

**Fix:** Assert the deployed revision, not just liveness. Minimal version: after the poll, add one SSH check that the running image matches — `docker inspect -f '{{.Config.Image}}' loyalty_backend_dev` must equal `ghcr.io/.../backend:${{ github.sha }}` (the SSH key + cloudflared install steps already exist in this job at lines 875-890, just move them out of the `if: failure()` guard). Better long-term: add the build SHA to the health payload and compare it.

### 17. The mutable `latest` tag is pushed to GHCR before any test job or the regression gate has passed

**`ci-build-e2e.yml:375`** · correctness

`build-and-push` declares `needs: [build-backend-release]` only (line 375, deliberate per the comment), but its metadata blocks also publish `type=raw,value=latest,enable={{is_default_branch}}` for both images (lines 416 and 441). So on every push to main, `backend:latest` and `frontend:latest` are re-pointed at the new build while `test-backend-unit`, `test-backend-integration` and `regression-api` are still running — in run 30166253220 the push completed at 16:53:07, ~1 minute before the regression suite finished.

That matters because `docker-compose.ghcr.yml` pins `image: ghcr.io/thehfhotel/loyalty-app/backend:${IMAGE_TAG:-latest}` — `latest` is the default. Any operator-run redeploy on evergreen (`docker compose ... up -d` without IMAGE_TAG, which is exactly the shape of a hurried rollback) pulls the newest *untested* image rather than the last known-good one. The immutable `type=sha` tag is unaffected and is what both deploy paths use, so only the human/emergency path is exposed.

**Fix:** Keep the SHA tag on the fast path but stop moving `latest` from an ungated job: drop `type=raw,value=latest,enable={{is_default_branch}}` from lines 416 and 441 and publish `latest` from a small job that `needs: [regression-api, test-backend-unit, test-backend-integration]` (e.g. `docker buildx imagetools create` retagging the SHA image).

### 18. lint-backend is serialized ahead of every heavy Rust job, adding its full wall-clock to the deploy critical path

**`ci-build-e2e.yml:322`** · waste-speed

`build-backend-release` (line 322), `test-backend-unit` (line 97) and `test-backend-integration` (line 154) all declare `needs: [lint-backend]`. Nothing they do requires clippy/rustfmt output — the dependency is purely fail-fast, and it costs the deploy its duration on every single green run.

Measured: run 30143612958 spent 04:12:22→04:16:51 (4m29s) in Lint Backend before Build Backend Release even started, on a pipeline that reached Deploy to Staging at 04:25:45. Run 30166253220 paid 66s. It is also duplicated compilation: `lint-backend` uses `prefix-key: "v0-rust-lint"` (line 65) on bare ubuntu, a third `target/` cache that shares nothing with `v0-rust-container` (lines 207/348) or `v0-rust-unit` (line 121), so clippy type-checks the whole workspace from its own cache while the release build does it again in parallel.

Since all three jobs are separate required signals, a clippy failure still turns the run red — the only thing the `needs` edge buys is saving runner-minutes on already-red pushes, paid for with latency on every green one.

**Fix:** Remove `needs: [lint-backend]` from `build-backend-release` (line 322) so the release build and image push start at t=0. Keep or drop it on the two test jobs as a cost preference; the run still fails if clippy fails.

### 19. notify-on-failure covers neither cancelled nor skipped deploys — the two outcomes that actually happen

**`deploy.yml:242`** · correctness

`if: failure()` (line 242) is true only when an ancestor job's conclusion is `failure`. It is false when deploy-production is `cancelled` and false when deploy-production is `skipped`. Both are the measured common cases: runs are being evicted by the `deploy` concurrency queue, and check-prerequisites frequently sets should-deploy=false so deploy-production is skipped (line 81) while the workflow still ends green. Net effect: the one paging channel in this workflow fires for approximately none of the real bad outcomes. Worse, a cancellation that lands *during* the SSH step (line 214) leaves production half-updated — images pulled, containers partially restarted — with zero notification. Separately, the job reads `needs.check-prerequisites.outputs.commit-sha` (line 252) but only declares `needs: [deploy-production]` (line 241), so when it does fire the issue body renders `Commit: ``` empty, pointing the responder at nothing.

**Fix:** Change line 241 to `needs: [check-prerequisites, deploy-production]` (fixes the empty commit and the actionlint undefined-needs at once) and replace line 242 with `if: ${{ always() && contains(fromJSON('["failure","cancelled"]'), needs.deploy-production.result) }}`. If a signal for the silent-skip case is wanted, add a second condition on `needs.check-prerequisites.outputs.should-deploy != 'true'` behind its own step.

### 20. One-shot prerequisite check is why queue eviction is fatal — the polling pattern already exists 20 lines away in ci-build-e2e.yml

**`deploy.yml:54`** · correctness

check-prerequisites makes exactly one `gh run list` call per workflow (lines 54-62) and, if the sibling workflow has not finished yet, sets ready=false and exits green (lines 68-71). Correctness therefore depends entirely on a *later* workflow_run trigger arriving and surviving — which is precisely what the `deploy` concurrency group (lines 9-11) deletes, since GitHub keeps only one pending run per group and evicts the older one. Concrete loss scenario: ci-test(X) completes -> Deploy run1 executes, sees build still running, green no-op. ci-build-e2e(X) completes -> Deploy run2 queues behind run1. Commit Y's ci-test completes -> Deploy run3 queues and evicts run2. run3 evaluates Y, whose build is still running -> green no-op. Y's build then fails. Result: X was fully green and never deployed, Y is red and never deployed, production silently sits on an older commit and every Deploy run in the sequence is green. Note also that for an in-progress run `gh run list --json conclusion` yields `""`, not null, so the `// "pending"` fallback on lines 56/62 is dead code — the sibling job at ci-build-e2e.yml:687 gets this right by selecting `status` as well as `conclusion`.

**Fix:** Make check-prerequisites poll instead of sampling once, copying the loop already proven at ci-build-e2e.yml:684-707: select `conclusion,status`, loop ~72 x 10s, exit 1 on a terminal non-success, exit 0 on `completed:success` for both workflows, and only then set ready=true. A polling run holds the concurrency slot for the whole window, so a single trigger deploys and the redundant second trigger becomes harmless rather than load-bearing.

### 21. cloudflared pulled from releases/latest with no pinning or checksum, then used as the transport for every production secret

**`deploy.yml:103`** · security

Line 103 fetches `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64` — a mutable URL — and installs it to /usr/local/bin as root with no version pin, no checksum, and no signature check. That binary is then the `ProxyCommand` on line 217, i.e. it terminates and relays the SSH connection that carries JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET, DATABASE_URL, POSTGRES_PASSWORD, the OAuth client secrets and the SMTP/IMAP credentials (lines 122-144, marshalled into the JSON on lines 151-213). Every other third-party dependency in this file is SHA-pinned (actions/checkout at line 89), so this is the one unpinned supply-chain input, and it sits on the most sensitive path. It is also an availability risk for the deploy gate: a GitHub release fetch that 404s or rate-limits fails production deploys for reasons unrelated to the code.

**Fix:** Pin an explicit tag (e.g. `.../download/2024.x.y/cloudflared-linux-amd64`) and verify it before install: `echo "<sha256>  /tmp/cloudflared" | sha256sum -c -`. The same unpinned fetch is duplicated at ci-build-e2e.yml:746 and :878, so pin them together.

### 22. Workflow-level issues:write widens the GITHUB_TOKEN that gets shipped off-runner to evergreen

**`deploy.yml:19`** · security

`issues: write` is granted at workflow scope (line 19) for the benefit of notify-on-failure — but notify-on-failure already declares its own job-level `permissions: contents: read / issues: write` (lines 244-246), so the workflow-level grant is redundant for its stated purpose. It does have a side effect: deploy-production declares no job-level permissions, so it inherits contents+actions+packages read *and* issues:write, and line 121 passes `secrets.GITHUB_TOKEN` over SSH into the JSON payload consumed by the remote shim on evergreen. A token with repo write capability now lives, however briefly, on a host outside the CI boundary. This also contradicts the least-privilege pattern the sibling workflow follows deliberately (ci-build-e2e.yml:22-26 keeps the default read-only and scopes `packages: write` to build-and-push only, at ci-build-e2e.yml:377-379).

**Fix:** Delete `issues: write` from the workflow-level block (line 19) — notify-on-failure's job-level block already covers it — and add `permissions: {contents: read, packages: read}` to deploy-production so the token handed to evergreen is registry-read only.

### 23. Missing/rotated production secrets are silently shipped as empty strings

**`deploy.yml:122`** · correctness

A `${{ secrets.X }}` that does not exist renders as an empty string and GitHub still sets the env var, so `set -euo pipefail`'s `-u` (line 146) never trips. The security-critical values on lines 122-128 (JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET, DATABASE_URL, POSTGRES_*) are interpolated straight into the jq payload on lines 156-162 with no non-empty check — note the deliberate asymmetry with SMTP/IMAP on lines 171-178, which use `${VAR:-}` / `${VAR:-587}` defaults because they are genuinely optional. So a secret that is deleted, renamed, or rotated away produces a well-formed payload with `JWT_SECRET: ""` and the remote shim writes an empty signing key into production. Chained with the missing health check (finding above), the run is green, notify-on-failure never fires, and the first signal is users failing to authenticate.

**Fix:** Before the `jq -n` call (insert after line 146) add a guard: `for v in JWT_SECRET JWT_REFRESH_SECRET SESSION_SECRET DATABASE_URL POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB; do [ -n "${!v}" ] || { echo "::error::required secret $v is empty"; exit 1; }; done`. Fails the deploy before touching production instead of after.

### 24. Repo-wide concurrency group with cancel-in-progress:false silently evicts queued browser runs

**`e2e.yml:34`** · correctness

`group: browser-e2e` (line 35) has no ref/SHA key, so every trigger — post-merge workflow_run, the 03:17 UTC cron, and manual dispatches — shares one global slot. With `cancel-in-progress: false` (line 36), GitHub queues at most one pending run and CANCELS the previously pending one when a third arrives. This job takes 15-25 min (docker pulls + `npm ci` + full suite), so on a trunk-based repo with several merges in that window the middle commits' browser runs are cancelled before they start. A cancelled run is neither pass nor fail, so it produces no alert and no red badge — the browser regression net silently has holes on exactly the busy days when it matters most. This matches the already-observed 'mystery cancelled runs are group evictions' pattern. Nothing here is actually a shared resource: each run gets its own ephemeral runner with its own postgres/redis services and its own host ports (5436/6381/4202/3201), so the serialization buys nothing.

**Fix:** Key the group per commit: `group: browser-e2e-${{ github.event.workflow_run.head_sha || github.sha }}` (keeping `cancel-in-progress: false` so a manual re-run of the same SHA still queues rather than clobbers). Runs for different commits then proceed in parallel instead of evicting each other.

### 25. Playwright container runs Chromium without --ipc=host — the documented cause of "Target crashed" flake

**`e2e.yml:235`** · correctness

The test container is started as `docker run --rm --network host ...` with no `--ipc=host` and no `--shm-size`. Docker's default `/dev/shm` is 64 MB; Chromium allocates shared memory for renderer processes there and, under the 2 parallel workers this config uses, exhausts it and crashes mid-test — surfacing as `Target page/context/browser has been closed` or `Target crashed`, which reads like a product bug or a network flake. Playwright's own Docker guidance names `--ipc=host` as required for Chromium for precisely this reason. This is the single most likely mechanical cause of the flakiness that got this suite demoted to non-gating in the first place, and it also poisons the value of the finding above: reds you can't trust are reds nobody investigates.

**Fix:** Add `--ipc=host` (and `--init`, to reap zombie browser processes) to the `docker run` on line 235, i.e. `docker run --rm --init --ipc=host --network host ...`.

### 26. Skipped-because-upstream-failed run reports the workflow as green

**`e2e.yml:53`** · correctness

`if: github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'` guards the workflow's ONLY job. When it evaluates false the job is skipped, and a run whose only job skipped concludes **success** — 'Browser E2E' shows a green check for a commit where zero browser tests executed. This is the same false-green class already measured in deploy.yml (6 of ~11 'successful' runs actually skipped the deploy job), reproduced here. It fires more often than the failure case suggests: ci-build-e2e.yml uses `cancel-in-progress: true` on `ci-build-${{ github.ref }}` (line 18-20), so rapid merges leave upstream runs with conclusion `cancelled`, which is also != 'success'. Anyone reading the Actions tab or a status badge concludes browsers were tested when nothing ran, and the green also makes the missing-notification gap above invisible.

**Fix:** Keep the guard but make the no-op auditable: add a second job with `if: always()` and `needs: [browser-e2e]` that appends to `$GITHUB_STEP_SUMMARY` either 'Browser suite executed' or 'SKIPPED — upstream CI Build & Deploy concluded ${{ github.event.workflow_run.conclusion }}', so a green run states which of the two it was.

### 27. Bare `npx playwright test` re-runs the entire api project already executed as the deploy gate

**`e2e.yml:242`** · waste-speed

With no `--project` flag, this runs all three projects defined in playwright.config.ts: `api` (13 spec files), `browser` (6) and `browser-mobile` (1). But ci-build-e2e.yml:641 already ran `npx playwright test --project=api --grep-invert "OAuth (Flow|Security) Validation"` minutes earlier as the deploy gate, against images built from the same SHA. So ~12 of 13 api spec files execute twice per commit on main, inside a container that also pays a full uncached `npm ci` — pure duplicate wall-clock against the job's 30-minute cap. The only api specs that genuinely need this workflow are the OAuth *validation* ones the gate deliberately greps out because they launch a real browser (per the comment at ci-build-e2e.yml:632-638). Worse for signal quality: a flaky api spec turns 'Browser E2E' red for a reason that has nothing to do with browsers, further training people to ignore this workflow's reds.

**Fix:** Replace the bare command on line 242 with the complement of the gate's selection, e.g. `npx playwright test --project=browser --project=browser-mobile && npx playwright test --project=api --grep "OAuth (Flow|Security) Validation"` — the browser-needing specs still run here, the already-gated api specs don't run twice.

### 28. Job-level permissions block silently drops contents:read and actions:read that scorecard-action requires

**`scorecard.yml:31`** · correctness

Job-level `permissions:` fully REPLACES the workflow-level `permissions: read-all` (line 24) — it is not additive. The analysis job (lines 31-35) declares only `security-events: write` and `id-token: write`, so the job's GITHUB_TOKEN has contents=none and actions=none. ossf/scorecard-action's own documented permission set is `security-events: write` + `id-token: write` + `contents: read` + `actions: read`, and the sibling codeql.yml:44-47 in this repo gets it right (it re-declares contents: read and actions: read at job level for exactly this reason). Failure mode: actions/checkout (line 39) authenticates its fetch with a token lacking contents:read, and the checks that read workflow-run metadata via the Actions API (Dangerous-Workflow, Token-Permissions, CI-Tests, Pinned-Dependencies) lose actions:read — they degrade to inconclusive/error results. Because publish_results is true (line 48), a silently degraded score gets pushed to the public OpenSSF API and the code-scanning dashboard, so a genuine supply-chain regression reads as 'no finding' rather than as a failure.

**Fix:** Add `contents: read` and `actions: read` to the job-level permissions block at scorecard.yml:31-35, matching the ossf/scorecard-action README and codeql.yml:44-47.

### 29. All Dependabot PRs share one concurrency bucket with cancel-in-progress, so sibling PRs cancel each other's required check

**`ci-test.yml:16`** · correctness

The concurrency group collapses to the literal string 'dependabot-ci-test' for every run where github.actor == 'dependabot[bot]', combined with `cancel-in-progress: true` (line 17). That group is NOT keyed on github.ref, so it spans all open Dependabot PRs. Dependabot opens batches (recent history: #330, #331, #334, #335 within one window), and each newly-opened or rebased PR evicts the in-flight CI Tests run of every other Dependabot PR. The victim PR is left with a `cancelled` CI Tests check — not success — which blocks merge and requires a manual UI re-run (ci-test.yml has no workflow_dispatch, so re-run from the UI is the only recovery). ci-build-e2e.yml:18-20 does NOT do this — it uses the correct per-ref `ci-build-${{ github.ref }}` — so the two workflows disagree about which run is authoritative for the same Dependabot PR. This is a concrete source of the unexplained 'cancelled' runs in the recent-run history, and it trains reviewers to treat cancelled as noise, which is exactly how a real cancellation gets waved through.

**Fix:** Key the Dependabot branch on the ref like the non-Dependabot branch does, e.g. `format('ci-test-{0}', github.ref)` unconditionally, or `format('dependabot-ci-test-{0}', github.ref)` if the intent was a separate namespace. Do not leave a ref-independent group paired with cancel-in-progress.

### 30. The `prepare` job adds a serial hop to the deploy critical path while both consumers already self-heal

**`ci-test.yml:36`** · waste-speed

lint-frontend (line 76) and test-frontend-unit (line 120) both `needs: prepare`, so the workflow is strictly prepare -> [lint, test]. prepare's only product is a warmed frontend/node_modules cache — but since commit 0c3c9324 both consumers carry an unconditional `npm ci` fallback (lines 99-102 and 143-146) that runs whenever the cache misses. prepare is therefore a full extra runner job (checkout + setup-node + npm ci, ~1-2 min) whose entire value is saving each consumer a ~40s npm ci that they are already prepared to run. This sits directly on the deploy critical path: ci-build-e2e.yml's deploy-staging (line 726) needs wait-for-frontend-checks, which blocks polling ci-test.yml until it completes (lines 674-707), so every merge to main pays the prepare hop before staging can start. Secondary waste at lines 62-63: prepare's cache step carries `restore-keys: frontend-deps-`, so on any lockfile change it downloads a stale node_modules that the very next step (`npm ci`, line 67) deletes and reinstalls from scratch.

**Fix:** Drop the `needs: prepare` edges and delete the prepare job; have lint-frontend and test-frontend-unit each compute their own key inline (`key: frontend-deps-${{ hashFiles('frontend/package-lock.json') }}`) with the existing npm ci fallback, so the two jobs start in parallel at t=0. If prepare is kept, at minimum remove the `restore-keys` at lines 62-63 — the restored tree is unconditionally discarded by npm ci.

### 31. Semgrep container pinned by mutable tag while the job holds security-events: write

**`semgrep.yml:33`** · security

`image: semgrep/semgrep:1.171.0` is a mutable Docker tag — a tag can be re-pushed to point at a different image. This is the only third-party code in these three workflows that is not digest-pinned: actions/checkout, actions/setup-node, actions/cache, github/codeql-action/upload-sarif and ossf/scorecard-action are all SHA-pinned here, and commit e833a8b7 explicitly pinned the Dockerfile.ci images for the same reason. The container is the execution environment for the whole job, which has `security-events: write` (line 36) and a checkout of the repo, so a substituted image runs with a token that can write code-scanning results — i.e. it could both exfiltrate source and suppress/forge Semgrep findings in the Security tab, which is where this workflow's entire value lives. CodeQL's `actions` language pack (codeql.yml) flags exactly this class of unpinned supply-chain dependency, so the repo is scanning for a pattern it also ships.

**Fix:** Pin by digest with the version as a trailing comment, matching the repo's existing convention: `image: semgrep/semgrep@sha256:<digest> # 1.171.0`. Resolve the digest with `docker buildx imagetools inspect semgrep/semgrep:1.171.0` and let Dependabot's docker ecosystem bump it.

### 32. No path filters: the full 3-language matrix runs on every PR, every rebase, and every squash-merge — 9+ jobs per Dependabot bump

**`codeql.yml:20`** · waste-speed

The `on:` block (lines 20-26) has `push: [main]` and `pull_request: [main]` with no `paths-ignore`, and the matrix (lines 52-59) always fans out to 3 jobs. Because this is a trunk repo, every change is analyzed at least twice (PR + squash-merge commit), and a rebased Dependabot PR is analyzed three times. Concretely, `chore(backend)(deps): bump tower from 0.4.13 to 0.5.3` produced CodeQL runs 30162395590 (PR, 14:49:35Z), 30165978885 (PR again after rebase, 16:36:42Z), and 30166253226 (push to main, 16:45:11Z) — 9 runner jobs for a single Cargo.toml line. On 2026-07-25 alone the workflow ran 25 times = ~75 jobs. Docs-only and workflow-only changes get full `rust` and `javascript-typescript` extraction they cannot possibly affect.

This is also inconsistent with the convention the repo already established: ci-build-e2e.yml:8-12 explicitly paths-ignores `**.md`, `docs/**` and `.github/workflows/**` for exactly this reason. Adding filters here is safe because `main` is unprotected (verified 404 on the branch-protection API), so no required status check would be left permanently pending.

**Fix:** Add to both the `push` and `pull_request` triggers: `paths-ignore: ['**.md', 'docs/**']`. Do NOT exclude `.github/workflows/**` — the `actions` language exists precisely to scan those. If you want to go further, split the matrix so the `actions` leg is driven by `paths: ['.github/workflows/**']` and the `rust`/`javascript-typescript` legs by their own source paths.

### 33. No notify-on-failure job — a red nightly backup is only visible in the Actions tab

**`backup-production.yml:79`** · correctness

Every other scheduled/unattended workflow in this repo files a GitHub issue when it goes red: deploy.yml has a `notify-on-failure` job (deploy.yml:236) and even the sibling cargo-audit.yml does (cargo-audit.yml:53-97, with the explicit rationale 'so the red workflow doesn't just sit unseen in the Actions tab'). backup-production.yml — the workflow protecting the only off-host copy of production data, running at 18:00 UTC when nobody is watching — has no notification path at all. A backup that starts failing (expired SSH key, container renamed, S3 credential rotation, evergreen disk full) goes unnoticed until someone happens to open the Actions tab or needs a restore. The `Summary` step at line 178 has `if: always()` but writes only to the run's step summary, which nobody reads on a scheduled run.

**Fix:** Add a `notify-on-failure` job mirroring cargo-audit.yml:53-97 — `needs: [backup]`, `if: failure()`, `permissions: {contents: read, issues: write}`, filing/commenting a 'Production backup failing' issue with the run URL. This also gives finding #2 somewhere to report to once the skip path becomes a failure.

### 34. DB password is interpolated into the remote command line (and never actually reaches pg_dump)

**`backup-production.yml:143`** · security

Three compounding problems in the same ssh invocation. (1) The comment at lines 134-135 claims 'The DB password is passed over the SSH session via env so it never appears in `ps`', but line 145 embeds it literally in the remote command string: sshd runs `bash -c "PGPASSWORD='<secret>' docker exec …"`, so the plaintext production DB password IS in the remote shell's argv, visible to `ps` for any user on evergreen and to auditd/sshd command logging. (2) `-o SendEnv=PGPASSWORD` (line 143) is dead config — `PGPASSWORD` is never set or exported in the runner step's environment (only `POSTGRES_PASSWORD` is, line 124), and it would additionally require a matching `AcceptEnv` on the remote sshd. (3) The `PGPASSWORD=` prefix applies to the *docker client* process, not to the container: `docker exec` does not forward host env vars without `-e`, so pg_dump inside `loyalty_postgres_production` never sees it and only succeeds because the postgres image's default pg_hba grants `local … trust` on the unix socket (confirmed by docs/restore-runbook.md:99,115, which run psql the same way with no password at all). So the secret is exposed on the remote host while providing zero authentication value. Secondary correctness hazard: a `'` anywhere in the password breaks the single-quoted remote string and the whole dump fails.

**Fix:** Drop both the `PGPASSWORD='${POSTGRES_PASSWORD}'` prefix on line 145 and the `-o SendEnv=PGPASSWORD` on line 143 (matching the restore runbook, which relies on local-socket trust), and remove the now-false comment at lines 134-135. If password auth is genuinely wanted later, pass it as `docker exec -e PGPASSWORD -i …` with the value delivered through a real `SendEnv`/`AcceptEnv` pair rather than the command string.

### 35. Workflow-level `issues: write` is inherited by the `audit` job that never needs it

**`cargo-audit.yml:24`** · security

The top-level `permissions` block (lines 22-24) grants `issues: write` to every job, including `audit`, which only checks out code and runs a third-party-installed `cargo-audit` binary (taiki-e/install-action, line 41) over the dependency tree. The only job that needs issue-write is `notify-on-failure`, and it already declares its own scoped `permissions` block at lines 58-60 — so the top-level grant is pure surplus. This is the same least-privilege tightening the repo already applied elsewhere (commit e833a8b7, 'scope CI write permissions to jobs'), just not carried into this file. Concretely: any compromised/typosquatted tool fetched by the audit job runs with a token that can open, edit, and close issues in the repo.

**Fix:** Change the workflow-level block at lines 22-24 to `permissions:\n  contents: read` and leave the job-level `issues: write` on `notify-on-failure` (lines 58-60) as-is. No behavior change; the notify job already carries its own grant.

### 36. Audit never runs on Cargo.lock changes, so a vulnerable dep merges and auto-deploys up to 24h before detection

**`cargo-audit.yml:16`** · security

The only triggers are the daily cron (line 19) and `workflow_dispatch` (line 20). Scheduled workflows run against the default branch only, so `cargo audit` sees a dependency change for the first time *after* it has already been squash-merged to main, built into a GHCR image, and — now that the production environment no longer has a required reviewer — deployed unattended to production. The detection lag is up to 24 hours, entirely on the production side of the gate. The header comment's stated rationale (lines 3-9) is about avoiding a per-push tax on every PR, which a lockfile-scoped trigger does not reintroduce: the only PRs that touch backend-rust/Cargo.lock are dependency bumps (the exact PRs where an advisory matters) and the occasional feature adding a crate.

**Fix:** Add a narrowly-scoped PR trigger alongside the cron: `pull_request:\n    paths:\n      - 'backend-rust/Cargo.lock'`. Runtime is a ~20s prebuilt-binary scan and it fires only on lockfile-changing PRs, so the documented per-push-tax concern still holds.

### 37. SHA pins whose trailing comment is not a version tag are invisible to Dependabot and will never receive updates

**`cargo-audit.yml:41`** · security

Dependabot resolves the current version of a SHA-pinned action from the trailing comment. Two pins carry non-version comments: `taiki-e/install-action@b3d3b86298745e7ee31467554af349ac2c5cec48 # cargo-audit tag` (cargo-audit.yml:41) and `taiki-e/install-action@c295c25a8d3df7288fa86db860a4f8062bf76ad8 # nextest tag` (ci-build-e2e.yml:136 and :223), plus `dtolnay/rust-toolchain@4cda84d5... # stable branch`. The proof they are not being maintained together: the SAME action is pinned to THREE different SHAs across the repo — c295c25a (x2), 3d7d7cd5 (`# v2`, ci-build-e2e.yml:290), b3d3b86 (cargo-audit.yml:41). Only the `# v2` one is bumpable. The same split exists for codeql-action: init/analyze sit at 1b168cd (codeql.yml:66,72) while upload-sarif sits at 7188fc3 (trivy.yml:73,122,148; semgrep.yml:48; scorecard.yml:51) — both commented `# v4`, drifted apart because Dependabot treats the sub-paths as separate dependencies (commit 6fc61ddd bumped only upload-sarif). These are actions that run with `security-events: write` and inside the release-build job.

**Fix:** Normalize every trailing comment to the released tag (`# v2.62.11`, `# v4.32.1`, `# v1.0.x`) so Dependabot can resolve and bump them, and collapse the three taiki-e/install-action pins to one SHA. Add `github/codeql-action` (not just `actions/*`) to the `actions` group in .github/dependabot.yml so the init/analyze/upload-sarif sub-paths move together.

### 38. trivy.yml is the only workflow with neither a concurrency group nor a single timeout-minutes on any of its three jobs

**`trivy.yml:27`** · waste-speed

Across the 10 workflows, 6 declare `concurrency` and every job except trivy's declares `timeout-minutes`. trivy.yml's scan-backend (:27), scan-frontend (:78) and scan-filesystem (:127) have neither. Consequences: (a) each push to main queues 3 more Trivy jobs with no cancellation, so a burst of merges stacks 9-12 concurrent scanner jobs against the same GHCR registry; (b) a hung `docker pull` (:62, :111) or a Trivy DB fetch stall runs to the GitHub default of 6 hours per job, burning up to 18 runner-hours before failing. semgrep.yml and scorecard.yml similarly declare no concurrency, so the same per-merge pile-up applies to them. Separately, none of the repo's static groups (`deploy`, `regression-api`, `browser-e2e`, `backup-production`) include a commit key, which is what turns a queue into an eviction.

**Fix:** Add `timeout-minutes: 20` to trivy.yml's three jobs, and a workflow-level `concurrency: {group: trivy-${{ github.event.workflow_run.head_sha || github.sha }}, cancel-in-progress: false}` (same shape for semgrep.yml and scorecard.yml). Keying static groups on the head SHA rather than a bare literal is the general fix for the eviction pattern seen in `deploy`/`regression-api`/`browser-e2e`.

### 39. Eight non-gating scanner jobs fire on every merge to main, with .github/workflows analyzed three times over

**`scorecard.yml:20`** · redundancy

Per push to main the repo launches, on top of the deploy pipeline: CodeQL x3 matrix jobs (codeql.yml:20-22), Semgrep (semgrep.yml:20-21), Scorecard (scorecard.yml:20-21), and — via workflow_run — Trivy x3 (trivy.yml:11-14). None of them gate anything (semgrep.yml:5-7 and scorecard.yml:7-8 say so explicitly). Coverage overlaps three ways on the workflow files alone: CodeQL's `actions` language (codeql.yml:54), Semgrep p/default's `yaml.github-actions.security.*` rules (the very ruleset e2e.yml:84 suppresses), and Scorecard's Dangerous-Workflow / Token-Permissions / Pinned-Dependencies checks. Scorecard is the clearest deletion candidate: it scores repo *configuration* (branch protection, pinning, token perms), which a code merge cannot change, and it already has `branch_protection_rule` (:15) plus a weekly cron (:19).

**Fix:** Delete `push: branches: [main]` from scorecard.yml:20-21, leaving branch_protection_rule + the weekly cron. Add `paths: ['.github/workflows/**']` to Semgrep's push trigger, or drop Semgrep's `actions`-class overlap by narrowing its config away from rules CodeQL's `actions` pack already covers. Keep exactly one engine as the authority for GitHub Actions misconfiguration.

### 40. Nightly E2E and weekly Trivy scan `:latest`, which is published before the gate runs — so both report on an image that may never have been deployed, and the deployed image is never re-scanned

**`e2e.yml:32`** · correctness

build-and-push writes `type=raw,value=latest` for backend (ci-build-e2e.yml:416) and frontend (:441) as soon as the binary is built, before regression-api or any test job has passed. Two scheduled consumers then target that tag: the nightly Browser E2E (e2e.yml:32 cron, falling through to `tag=latest` at :138) and the weekly Trivy scan (trivy.yml:16 cron, `TAG="latest"` at :53 and :101). If a merge fails the gate, `latest` still points at it while production keeps running the last successful SHA — so the nightly browser results and the weekly CVE report describe an artifact nobody is running, and the artifact that IS running gets no scan after its build-day one. Nothing in the repo ever tags an image `production` or `staging`, so no workflow can name what is live.

**Fix:** Move `type=raw,value=latest` off build-and-push and publish it from a post-gate step (after regression-api / verify-staging succeed), or add a `production` moving tag that deploy-production pushes on success and point trivy.yml's scheduled scan at `production` instead of `latest`.

### 41. Staging ships a GITHUB_TOKEN with no `packages` scope to evergreen, while production ships one with `packages: read` — the two deploy paths disagree

**`ci-build-e2e.yml:764`** · correctness

deploy-staging (ci-build-e2e.yml:723) declares no job-level `permissions`, so it inherits the workflow-level block at :24-26 (`contents: read`, `actions: read`) — `packages` is therefore `none`. That token is then handed to the remote shim as `GHCR_TOKEN` at :764 for the evergreen-side `docker login`/`docker pull` of `ghcr.io/thehfhotel/loyalty-app/*`. The production path does declare `packages: read` (deploy.yml:16) for the same purpose (deploy.yml:121). Today this is masked because the repo/packages are public (scorecard.yml:6 notes the repo is public), so anonymous pull works. The moment the packages are made private — or GHCR tightens anonymous pull — staging deploys break on the remote host with a docker auth error, while production keeps working; and because the deploy is a one-shot SSH pipe, the CI-side symptom is an opaque non-zero exit rather than a named permission problem.

**Fix:** Add `permissions: {contents: read, packages: read}` to the deploy-staging job in ci-build-e2e.yml so both deploy paths carry the same scope, matching deploy.yml:16.

### 42. Nightly production backup and unattended production deploys share no mutual exclusion — a migration can collide with pg_dump and stall live reads

**`backup-production.yml:46`** · correctness

backup-production.yml uses `concurrency: {group: backup-production}` (:46-48) and deploy.yml uses `group: deploy` (:9-11); they are disjoint, so both can run against the production Postgres simultaneously. The dump (:139-148) runs `pg_dump` over SSH, which holds ACCESS SHARE on every table for the full duration of the stream. A production deploy applies migrations at backend startup via `sqlx::migrate!()` (per CLAUDE.md); an `ALTER TABLE`/`CREATE INDEX` needing ACCESS EXCLUSIVE queues behind the dump, and — because a pending ACCESS EXCLUSIVE request blocks every subsequent reader — the live app stalls until the dump finishes. deploy-production has `timeout-minutes: 10` (deploy.yml:82) while the backup job allows 30 (:82), so the deploy fails first and leaves the release half-applied. This was low-risk when production required a human approver at working hours; with unattended deploys on green CI it is now purely a timing coincidence away.

**Fix:** Give both jobs the same concurrency group, e.g. `concurrency: {group: production-mutation, cancel-in-progress: false}` on backup-production.yml:46 and on deploy.yml's deploy-production job, so the nightly dump and a production deploy serialize instead of contending for locks.

## LOW severity

### 43. "Seed E2E test users" duplicates Playwright's globalSetup and can never fail

**`ci-build-e2e.yml:605`** · redundancy

The step (lines 605-629) registers e2e-browser@test.com, e2e-browser-2@test.com and e2e-admin@test.local via curl. `tests/setup/global-setup.ts` already does exactly this (`registerTestUsers(process.env.BACKEND_URL)` at line 37, same three accounts, idempotent-on-409 per its own comment at line 45) and runs before every Playwright invocation. Run 30166253220's test log confirms the duplication: globalSetup printed "Already exists" for all three because the workflow step had just created them.

Worse, the shape `curl -sf ... && echo "Created ..." || echo "User may already exist"` makes the step incapable of failing — a backend 500, a connection refused, and a genuine 409 all print the same reassuring "User may already exist" and exit 0. The real failure then surfaces 30 lines later as a confusing mass of auth-test failures in the regression suite.

**Fix:** Delete the "Seed E2E test users" step (lines 605-629) and let `tests/setup/global-setup.ts` own seeding — it already reports per-user failures with the HTTP status (global-setup.ts:84).

### 44. nosemgrep suppression rests on a false invariant: `branches: [main]` does not mean the SHA came from this repo

**`e2e.yml:82`** · security

The comment claims "The workflow_run trigger is filtered to branches: [main], so head_sha is always an already-merged main commit — never untrusted PR code", and on that basis suppresses `workflow-run-target-code-checkout`. The `branches:` filter matches `workflow_run.head_branch`, which for a fork pull request is the branch name *in the fork* — a fork whose default branch is `main` passes the filter, and ci-build-e2e.yml triggers on `pull_request: branches: [main]` (line 13-14), so such a run exists. Line 88 then checks out that PR head SHA (fetchable via refs/pull/N/head). Today the blast radius is small — the token is read-only, and the run dies at 'Pull application images' (line 148) because no GHCR image exists for a fork SHA, before `npm ci` on line 242 would execute attacker-controlled lifecycle scripts. But the invariant the comment asserts is what future edits will trust; adding a dependency-cache or moving `npm ci` ahead of the pull turns this into code execution on untrusted input, and the suppression means semgrep will not re-flag it.

**Fix:** Make the invariant real rather than asserted: add `github.event.workflow_run.event == 'push'` (or `github.event.workflow_run.head_repository.full_name == github.repository`) to the job `if:` on line 53, and correct the comment on lines 82-84 to say the guard is the trigger-event/repo check, not the branch filter.

### 45. ~70 lines of container bring-up, health-wait and user seeding duplicated verbatim from the gate job

**`e2e.yml:155`** · redundancy

Lines 155-222 (backend `docker run` with 15 `-e` flags, frontend run with the nginx.e2e.conf mount, the two 30x2s health loops, the three registration curls) are a byte-for-byte copy of ci-build-e2e.yml:546-628. Both halves must stay in lockstep — same ports 4202/3201/5436/6381, same JWT/SESSION secrets, same seeded accounts — but nothing enforces it. A future change to the backend's required env (a new mandatory var, a port move) applied to the gate job alone leaves Browser E2E failing in its 'Wait for services' loop with 'Backend failed to start', which, being non-gating and unnotified, looks like just more browser flake. The seeding curls also swallow every failure via `|| echo "User may already exist"` (lines 213/217/221), so a genuinely broken /api/auth/register surfaces only as confusing downstream login failures.

**Fix:** Extract the bring-up + wait + seed sequence into a composite action (e.g. `.github/actions/start-e2e-stack/action.yml`) taking `image-tag` as an input, and call it from both e2e.yml:155 and ci-build-e2e.yml:546 so the two environments cannot drift.

### 46. Scheduled scanners re-run on every push to main with no concurrency group and no paths-ignore

**`semgrep.yml:20`** · waste-speed

semgrep.yml (lines 16-22) and scorecard.yml (lines 12-22) both fire on a weekly cron AND on every push to main, and neither declares a `concurrency:` block or `paths-ignore`. Consequences: (a) a docs-only or workflow-only merge triggers a full `semgrep scan --config p/default` over the repo plus a full Scorecard analysis (up to 15 min each per their timeouts), even though ci-test.yml:8-11 and ci-build-e2e.yml correctly skip those same pushes; (b) with no concurrency group, back-to-back merges stack runs instead of superseding — two merges five minutes apart leave an obsolete full scan burning a runner and competing for the same Actions queue that is already producing concurrency evictions elsewhere; (c) Scorecard's score is driven almost entirely by repo configuration (branch protection, token permissions, pinned deps), which the weekly cron plus the existing branch_protection_rule trigger (line 15) already cover, so the per-push run is near-pure duplication and republishes to the public OpenSSF API each time.

**Fix:** Add `concurrency: {group: semgrep-${{ github.ref }}, cancel-in-progress: true}` to semgrep.yml and the equivalent `scorecard-${{ github.ref }}` to scorecard.yml. Then either add the same `paths-ignore` list ('**.md', 'docs/**') to both push triggers, or drop the `push:` trigger from scorecard.yml entirely and rely on the cron plus branch_protection_rule.

### 47. `scan-filesystem` lacks the upstream-success guard the two image jobs have, so it scans and uploads after failed builds

**`trivy.yml:127`** · correctness

`scan-backend` (line 30) and `scan-frontend` (line 79) both carry `if: github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'`. `scan-filesystem` (job declared at line 127) has no `if:` at all. It therefore runs on every CI Build & Deploy completion including failures and cancellations. Combined with the missing `ref:` (see the checkout finding), it then uploads a `trivy-filesystem` SARIF attributed to the default-branch tip for a build that never produced an image — writing over the last good analysis for that category with results from an unrelated commit. Given CLAUDE.md's known problem of concurrency-evicted runs on this repo, `conclusion == 'cancelled'` upstream runs are common enough for this to fire regularly.

**Fix:** Either add the same guard to `scan-filesystem` (accepting that fs coverage then depends entirely on green builds), or — preferably, once the `pull_request` trigger from the trigger finding is in place — keep it unguarded but make its SARIF attribution explicit so a failed-build scan cannot overwrite a good commit's analysis.

### 48. `timeout-minutes: 120` is ~50x the observed runtime, so a hung extractor burns two runner-hours before failing

**`codeql.yml:42`** · waste-speed

All three matrix legs inherit `timeout-minutes: 120` (line 42) despite every leg using `build-mode: none` (lines 55/57/59), which skips compilation entirely. Measured on run 30166253226: `Analyze (actions)` 16:45:14Z→16:45:53Z (39s), `Analyze (javascript-typescript)` →16:47:07Z (1m53s), `Analyze (rust)` →16:47:26Z (2m12s). Run 30165938078 matches within seconds. A stuck CodeQL bundle download or extractor hang therefore holds a runner for 2 hours and delays the failure signal by the same amount — notable given this workflow already fires ~25x/day.

**Fix:** Drop `timeout-minutes` on line 42 to `20`. That is ~9x the slowest observed leg, leaving ample headroom for a cold CodeQL bundle download while capping a hang at a fifth of an hour.

### 49. `cancel-in-progress: true` on a shared main/schedule concurrency group evicts main-branch and weekly analyses

**`codeql.yml:28`** · correctness

The group is `codeql-${{ github.workflow }}-${{ github.ref }}` (line 29) with `cancel-in-progress: true` (line 30). `github.workflow` is a constant here so it adds nothing, and `github.ref` is `refs/heads/main` for BOTH `push` and `schedule` events — they share one slot. Two consequences on this fast-merging trunk: (1) closely spaced main merges evict each other — run 30164022376 (commit 6fc61ddd, PR #334, 15:38:30Z) was cancelled by the push of 2ec2088e five seconds later at 15:38:35Z, leaving that commit with no code-scanning analysis and an unexplained `cancelled` entry of exactly the kind CLAUDE.md's notes call out as confusing; (2) the weekly cron at 04:23 UTC Monday — the only run that re-evaluates unchanged code against a refreshed CodeQL query pack — is cancelled by any concurrent Monday push. Content coverage is mostly preserved for case (1) since the surviving run's tree is a superset, but per-commit alert attribution and the query-refresh guarantee are not.

**Fix:** Change the group on line 29 to `codeql-${{ github.event_name }}-${{ github.ref }}` so scheduled runs get their own slot, and set `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` so only superseded PR runs are cancelled while main and cron analyses always complete.

### 50. Run summary prints a literal `${BACKUP_S3_BUCKET}` and silently reports empty fields on failure

**`backup-production.yml:187`** · maintainability

Line 187 writes `- Destination: \`s3://\${BACKUP_S3_BUCKET}/daily/\``, but the `Summary` step declares no `env:` block, and the `$` is backslash-escaped anyway — so the rendered summary always shows the literal text `${BACKUP_S3_BUCKET}` instead of the destination bucket. Separately, the step is `if: always()` (line 179) while `steps.dump.outputs.*` (lines 185-186) are empty whenever the dump step failed, so a failed run produces a summary that reads like a successful backup with blank name/size and no failure indicator — mildly misleading in exactly the situation where the summary is being read.

**Fix:** Either drop the destination line or add `env: {BACKUP_S3_BUCKET: ${{ secrets.BACKUP_S3_BUCKET }}}` to the Summary step and use an unescaped `$BACKUP_S3_BUCKET`. Also branch on `job.status` so a failed run's summary says so instead of emitting empty backup name/size fields.

### 51. Four overlapping dependency-CVE mechanisms with three different cadences and only one that pages anyone

**`ci-test.yml:112`** · redundancy

The same class of finding is produced by: `npm audit --audit-level=moderate` with `continue-on-error: true` on the deploy-gating lint job (ci-test.yml:112-115); Trivy's filesystem scan over Cargo.lock/package-lock.json (trivy.yml:127, workflow_run + weekly Saturday only); Trivy's two image scans (per-merge); and `cargo audit` daily (cargo-audit.yml:19). Of the four, only cargo-audit files an issue on failure (cargo-audit.yml:53); the Trivy results land silently in SARIF and the npm audit is `continue-on-error`, meaning it costs runner time on the critical deploy path and can never change an outcome. Dependabot (weekly Monday, `open-pull-requests-limit: 1` per ecosystem) is a fifth path with its own cadence. The result is high scan cost and low signal: a moderate frontend CVE produces a green check, a silent SARIF entry, and possibly a queued Dependabot PR behind the limit-1 cap.

**Fix:** Delete the `npm audit` step from ci-test.yml:112-115 (it duplicates Trivy's filesystem scan and the pre-push hook's `npm run security:audit`), and give trivy.yml's scan-filesystem the same notify-on-failure issue-filing job cargo-audit.yml:53 already implements so source-dependency CVEs have one owner and one alert channel.

## Addendum — found after the original review

### 52. Release-please PRs carry no completed check runs, so the only PR class that triggers a production deploy is the one class nothing verifies

**`release-please.yml:57`** · correctness · high · **STILL OPEN**

Both gating workflows trigger on `push: branches: [main]` and
`pull_request: branches: [main]`. The release PR targets `main`, so on paper
the `pull_request` trigger covers it. In practice it does not produce checks:
release-please opens and force-updates the PR using `GITHUB_TOKEN`, and
GitHub does not let a `GITHUB_TOKEN`-driven event start a workflow run. The
head commit of every release PR therefore reaches `main` with **no completed
check runs** — observed for #350, #358, #362, #367, #372 and #378, all
authored by `app/github-actions` on branch
`release-please--branches--main--components--loyalty-app`, with runs sitting
in `action_required` and never starting on their own.

Consequence: merging a release PR is precisely what puts a new version on
`main`, which fires CI Build & Deploy → staging → the now-**unattended**
production deploy (see finding 12 and the `deploy.yml` rewrite). The single PR
class that ships to production is the single PR class that arrives unverified.
It is also the entire shortfall behind OpenSSF Scorecard alerts #92 (SAST,
medium) and #925 (CI-Tests, low), both stuck at "26 of 30".

**Attempted fix (#377) — REVERTED, it did not work.** #377 added
`release-please--**` to the `push: branches:` list of `ci-test.yml` and
`ci-build-e2e.yml`, on the theory that the `push` trigger would fire where
`pull_request` did not. The residual risk it flagged for itself is exactly
what happened.

Empirical result, measured on release PR #378 (`chore(main): release 4.5.2`,
head `264f49dd`). The test was valid: `264f49dd`'s parent is `dbe23ea5` —
#377's own merge commit — so the release branch was cut *from* #377, and
`.github/workflows/ci-test.yml` **at `264f49dd` itself** carries the
`release-please--**` entry. (This matters because a push to a non-default
branch is evaluated against the workflow file on *that* branch, not the one
on `main`.) release-please pushed that commit to the branch at
`2026-07-27T21:53:43Z`. What the push produced:

| | |
| --- | --- |
| Workflow runs on branch `release-please--branches--main--components--loyalty-app` | 44 |
| …with `event == "pull_request"` | 44 |
| …with `event == "push"` | **0** |

The trigger was in place, on the right branch, on the right commit, and
created nothing. #377 was inert and has been reverted (the `push: branches:`
list is back to `[main]` in both workflows).

**The two `GITHUB_TOKEN` behaviours are different, and that is the whole
lesson.** GitHub's anti-recursion rule is not one rule:

- **`push` from `GITHUB_TOKEN` → no workflow run is created at all.** There
  is nothing to approve and nothing to see. This is why #377 was inert.
- **`pull_request` from `GITHUB_TOKEN` → a run *is* created**, but parked in
  an approval-required state (`status: completed`, `conclusion:
  action_required`) and never started. This behaviour arrived 2026-06-11; it
  is why the earlier release PRs show parked runs rather than no runs.

#378's own five `pull_request` runs demonstrate the parked path end to end:
all five were `created_at 2026-07-27T21:53:47Z` and sat unstarted until
`run_started_at 22:00:36Z` as `run_attempt: 2` with `triggering_actor:
jwinut` — i.e. they only ran because a human clicked approve in the Actions
UI. Absent that click, the head commit merges with no completed checks.

**Kept from #377:** the `enable={{is_default_branch}}` scoping on both
`type=ref,event=branch` tags in `build-and-push`'s `docker/metadata-action`
steps. It is correct independently of the trigger — nothing consumes a
mutable `:<branch>` GHCR tag off `main`, every automated consumer
(`deploy-staging`, `deploy.yml`, `regression-api`, `start-app-stack`) reads
the immutable commit-SHA tag, and `pull_request` events already reach this
job. `main` is unaffected: `is_default_branch` is true there, so `:main` is
published exactly as before.

**Real fix (not yet implemented):** have `release-please.yml` mint a GitHub
App installation token and pass it to `googleapis/release-please-action` via
`token:`. An App identity is not `GITHUB_TOKEN`, so its `pull_request` events
create runs that start normally, and the release PR gets checks like any
other PR. Until that lands the honest statement of the position is: **release
PRs carry no completed checks unless a maintainer manually approves their
parked runs**, and that is what Scorecard #92 / #925 are measuring.
