# Email Canary Runbook

The canary is `.github/workflows/email-canary.yml`. Every 6 hours it sends a
real message through the production SMTP relay and files a GitHub issue when
the relay refuses it.

It exists because of the #352 outage: the PrivateEmail subscription lapsed,
SMTP `AUTH` kept succeeding, and every message was then refused at `MAIL FROM`
with

```
553 5.7.1 <info@saichon.com>: Sender address rejected: not owned by user info@saichon.com
```

Password resets, address verification and booking mail failed silently for
days while `/api/health` stayed green throughout.

---

## What it proves

- The relay is reachable, TLS negotiates, and the credentials still
  authenticate.
- **The relay accepts a message from our configured sender.** This is the part
  no health check can do. `MAIL FROM` / `RCPT TO` / `DATA` all return 250.
- Therefore: at the moment of the probe, mail that the backend hands to this
  relay leaves the building.

## What it does NOT prove

- **Not that anything arrived.** There is no IMAP round trip (tier 3 in #364),
  so a message accepted with 250 and then silently dropped, greylisted,
  spam-foldered, or DMARC-quarantined at the *recipient* looks green here.
- **Not that the app sends correctly.** It exercises the same *relay* and the
  same `SMTP_FROM`/`SMTP_USER` resolution as the backend, but not the
  backend's own code path — a bug in `services/email.rs` or a bad template
  will not show up. The `loyalty_email_*` counters on `/metrics` cover that
  half (see below).
- **Not continuous coverage.** Up to 6 hours can pass between probes; a short
  outage inside that window leaves no trace here.
- **Not inbound mail.** Nothing checks that the mailbox can receive.

## What it must never do

Gate a deploy. It never touches `/api/health`, no workflow lists it in
`workflow_run`, and it has its own concurrency group. A mail problem is an ops
alert, never a shipping blocker (#364, design question 5).

---

## Why alerts are GitHub issues and not email

#364's design question 1 suggested reusing
`scripts/evergreen/loyalty-backup-notify-email.sh` as the canary's transport.
**That would have been wrong**: that script sends through the *same*
`info@saichon.com` PrivateEmail mailbox the canary is watching. In the exact
incident this monitor exists for, the alert would have been refused with the
same 553 as everything else — a self-suppressing alarm.

So the probe borrows that script's *technique* (curl over SMTPS, no MTA) but
the alert channel is a GitHub issue, via the create-or-comment idiom already
used by `deploy.yml`'s `notify-on-failure` and `cargo-audit.yml`. GitHub is
already the channel for "production deploy failed", and it survives a mail
outage.

## Alert hygiene

- Each run retries the send **3 times** (0s / 20s / 60s backoff). Only a run
  where *every* attempt fails counts as a confirmed failure — one refused
  connection at 03:23 is a blip, not an incident.
- Success → comment "delivering again" on **any** of the three alarms below
  that is open, and **close it**. A probe the relay accepted disproves all
  three at once: the canary evidently ran, saw its secrets, and got a `250`.
  Failure alerts are always paired with a recovery notification.

### The three alarms

Each has a different *first move*, which is why they are three issues and not
one. Every one of them is closed automatically by the same recovery step, so no
alarm can be left without a closer. That step's `if:` is prefixed with
`always() &&` deliberately: without it the step would be implicitly ANDed with
`success()`, so a probe that recorded `result=ok` and then died would leave a
stale alarm open even though the relay had just accepted a real message.

| Title (no colons — see below) | Means | First move |
| --- | --- | --- |
| `Email canary - outbound mail is failing` | The probe ran and the relay refused every attempt. Mail is **known broken**. | Read the relay response quoted in the issue; work the table below. |
| `Email canary - probe could not run, SMTP secrets empty` | The guard step found an empty `SMTP_HOST`/`USER`/`PASS`. Nothing was probed. | Fix the secrets/workflow — see "the environment-scope trap". |
| `Email canary - the canary itself is broken, mail state unknown` | The run died somewhere the workflow does not model, or was cancelled. Mail is **neither known broken nor known working**. | **Read the run log first** — not the relay, not the secrets. |

The third one is the catch-all. Before it existed, a probe step that died for
any reason other than the secrets guard produced a red run and *no alert at
all* — three separate holes:

1. the probe dies early (missing tool, a `set -u` trip, `mktemp` failing):
   `result` is never written, so the delivery-failure alert's `if:` is false,
   and the misconfig alert's is false too because the guard passed;
2. the probe writes `result=failed` **and then dies**: the output is there and
   correct, but a step `if:` containing no status function is implicitly ANDed
   with `success()`, so the alert is skipped on the run where it mattered most.
   This is why the catch-all's own gate keys on step *outcomes*, never on
   `steps.probe.outputs.result`;
3. an alert step itself fails (a `gh`/network hiccup), or the run is cancelled.

Its issue body leads with "the state of outbound mail is UNKNOWN", carries a
table of every step's outcome, and deliberately contains **no relay
diagnosis** — sending someone to inspect secrets or a mailbox that are both
fine is how an alert loses its audience. If the probe *had* recorded
`result=failed` before dying, the body says so and tells you to treat it as a
probable mail outage as well. If **you** cancelled the run, close the issue.

The catch-all sits *above* the final "fail the run" step on purpose: that step
calls `exit 1` on every confirmed delivery failure, which makes `failure()`
true for everything after it, so a catch-all placed below would file "the
canary is broken" alongside every genuine mail outage.

### Deduplication

Alert lookups use the issues API, **not** the search index:

```bash
EXISTING=$(TITLE="$TITLE" gh issue list -R "$REPO" --state open --limit 200 \
  --json number,title --jq 'map(select(.title == env.TITLE)) | .[0].number // empty')
```

`gh issue list --search` reads GitHub's *search index*, which lags writes by
seconds to minutes, so two runs inside that window each conclude "no open
issue" and each file one. Without `--search`, `gh` reads the issues API, which
is read-after-write consistent. A post-create re-search would not help — it
re-reads the same stale index. The residual race is two creates within the same
few milliseconds; `concurrency: email-canary` (with `cancel-in-progress:
false`) already serialises this workflow, so that is accepted.

The four lookups in the workflow are byte-identical, so a reviewer can diff
them by eye. None of the create paths passes `--label`: as in `cargo-audit.yml`
and `deploy.yml`'s notifier, alerting must never depend on label configuration
— an unlabelled issue beats an alert that failed because a label was renamed.
Label after triage.

**No title contains a colon.** The lookups no longer use `--search`, but the
rule stands for the day someone reaches for it again: `--search` speaks GitHub
search syntax, where `word:` reads as a qualifier, so a colon silently matches
nothing and files a duplicate on every probe.

---

## When it fires

Open the run linked in the issue and read the captured relay response. The
response code is the diagnosis:

| Response | Meaning | Action |
| --- | --- | --- |
| `553 ... Sender address rejected` / `not owned by user` | The relay will not let us send as our own `SMTP_FROM`. This is #352: lapsed subscription, expired card, revoked alias, or a `SMTP_FROM` the mailbox does not own. | Check the PrivateEmail account's billing and the alias list. Compare `SMTP_FROM` against the mailbox's owned addresses. |
| `535` / `authentication failed` | Credentials rejected. | Rotate `SMTP_PASS` in Settings → Environments → production, then redeploy so the backend picks it up. |
| `550` / `User unknown` | The recipient no longer exists (only reachable if `CANARY_EMAIL_TO` is set to a stale address). | Fix or unset `CANARY_EMAIL_TO`. |
| `4xx`, "try again later" | Throttling. Three failures in a row is still worth a look. | Check send volume; consider whether the relay is rate-limiting. |
| `curl: (7)` / timeout / TLS error | Network or relay down. | Check the provider's status page; re-run the workflow. |
| "one or more SMTP secrets were empty" | The canary never probed. | See "the environment-scope trap" below. |
| "the canary itself is broken, mail state unknown" | No relay response exists — the run died or was cancelled. | Read the run log; the issue's step-outcome table says which step. Mail may be perfectly fine. |

While any of these is unresolved, assume **password resets, email verification
and booking mail are all failing**, and that `/api/health` will keep saying
email is `configured` — configuration is all that endpoint can see.

Once fixed, re-run the workflow by hand (below). A green run comments on the
issue and closes it automatically.

## Testing it by hand

Actions → **Email Canary** → *Run workflow*:

- **Normal probe** — leave every input unchecked. Sends a real canary message
  and, if an alert issue is open, closes it.
- **Exercise the delivery-failure alert** — check `simulate_failure`. The send
  is retried with a deliberately unowned envelope sender
  (`simulated-failure@canary.invalid`, a reserved TLD per RFC 2606), so the
  relay refuses it exactly the way it refused everything in #352 — a real
  rejection, not a faked exit code, and no message can escape to a real
  mailbox. The alert issue is then filed for real, so **close it yourself**
  afterwards or let the next scheduled run close it.
- **Exercise the catch-all alert** — check `simulate_crash`. The probe step
  dereferences a deliberately unset variable under `set -u`, which kills the
  shell outright *before* anything is written to `$GITHUB_OUTPUT` — a genuine
  dead step, not a scripted `exit 1`, and the same discipline `simulate_failure`
  uses. Expect: the probe step red, the two normal alert steps skipped, and
  `Email canary - the canary itself is broken, mail state unknown` filed with
  `Probe recorded result` = *never written*. **No mail is sent.** Close the
  issue yourself afterwards or let the next scheduled run close it.
  `simulate_crash` **wins over** `simulate_failure` if both are checked: the
  crash happens before the send is even assembled.
- **Probe without side effects** — check `skip_alert`. Sends (or fails) and
  reports in the job summary, but never creates, comments on, or closes an
  issue — including the catch-all. Useful when verifying a relay change.

`workflow_dispatch` only appears once the workflow is on `main`.

### Known gap — a job-level death cannot alert

Every alarm above is raised by a *step inside the job*. If the job itself never
gets to run those steps, nothing is filed:

- the job hits its `timeout-minutes: 15` ceiling,
- the runner is lost (hardware, network, a spot reclaim),
- the whole workflow is cancelled before the alert steps are reached, or
- the YAML fails to parse / the `production` environment blocks the job.

In those cases the only signal is **a red run in the Actions list**. This is a
deliberate call: catching it would need a second job (`if: always()`, `needs:
probe`) whose only purpose is to watch the first, and a monitor-the-monitor job
is its own maintenance burden and its own thing to go quietly wrong. A
scheduled canary that silently stops appearing is a slow failure mode, so the
compensating habit is: if you have not seen a green **Email Canary** run in the
last ~12 hours (it runs every 6), open the Actions tab and look.

---

## Configuration

| Name | Where | Notes |
| --- | --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Secrets on the **`production` environment** | The same values `deploy.yml` already pipes through a runner on every production deploy — using them here is not a new exposure class. |
| `SMTP_PORT` specifically | Same secret — **single source of truth** | A repo *variable* named `SMTP_PORT` is read by nothing. When the secret is empty the canary falls back to **587/STARTTLS** and logs a `::warning`, because 587 is what `deploy.yml`, all four `docker-compose.*.yml` files and the backend's `config/mod.rs` fall back to. A canary that defaulted to 465 would probe implicit TLS on a door the app never opens and report green about it. |
| `CANARY_EMAIL_TO` | *Optional* secret or variable | Where the canary mail goes. **Unset today**, so the canary sends the mailbox a message to itself. That default needs no second mailbox to exist and still has to pass `MAIL FROM`, which is the stage where #352 failed. |

### The environment-scope trap

`SMTP_*` are **environment-scoped** secrets. A job that does not declare
`environment: production` reads every one of them as an **empty string, with
no error** — which is exactly how the old nightly backup workflow reported
green while backing nothing up. The canary defends against this twice:

1. the `probe` job declares `environment: production`;
2. its first step fails loudly, naming this trap, if any of `SMTP_HOST` /
   `SMTP_USER` / `SMTP_PASS` is empty — and files the alert issue, because a
   canary that silently probes nothing is worse than no canary.

If you ever copy this job, copy both.

### Handling of credentials and PII

- The password is **never on the process argv**. The host script
  (`loyalty-backup-notify-email.sh`) passes it via `curl --user`, which is
  visible in `/proc` to any local user; here curl reads it from a mode-0600
  `--config` file in a private temp dir that is deleted on exit.
- Only *server-side* lines of the SMTP dialog are ever printed or quoted into
  an issue. The client side of a verbose trace contains the `AUTH` line, whose
  base64 payload **is** the password, and GitHub's secret masking does not
  cover the base64 form.
- Email local parts are masked (`***@saichon.com`) before anything reaches a
  log or an issue body — this repository is public.
- A side effect of `environment: production`: canary runs show up in the
  production environment's activity log alongside real deploys. Cosmetic, but
  do not mistake one for a deploy.

---

## The other half: backend send-failure metrics

The canary probes every 6 hours; the backend knows *immediately* when a real
send fails. `services/email.rs` exports on `/metrics` (internal to the Docker
network — nginx does not proxy it):

| Metric | Meaning |
| --- | --- |
| `loyalty_email_sends_total` | Messages the relay accepted. |
| `loyalty_email_send_failures_total{kind="..."}` | Failed sends. `kind` is one of `sender_rejected` (the #352 signature), `auth`, `recipient_rejected`, `throttled`, `transport`, `invalid_address`, `message_build`, `other`. |
| `loyalty_email_sends_skipped_total{reason="..."}` | Sends that never happened because SMTP is unconfigured. **Not** counted as successes — `send_email` returns `Ok(())` on that path, and counting it would claim mail is flowing on a stack that cannot send at all. A stack with a non-zero rate here and zero on `loyalty_email_sends_total` is mute, not healthy. |

A hard failure also logs one greppable line:

```
EMAIL_SEND_FAILED: the SMTP relay refused the message
```

with `kind`, a hashed recipient (`crate::utils::hash_email`), and the relay's
own text scrubbed of email addresses. On the box:

```bash
docker logs loyalty_backend_production 2>&1 | grep EMAIL_SEND_FAILED
```

---

## References

- Issue #364 — email canary (this document)
- Issue #352 — the outage, and part 3 (surface send failures)
- PR #363 — `SMTP_FROM` plumbing and honest `services.email` in `/api/health`
- `docs/secrets-runbook.md` — secret inventory and rotation
- `scripts/evergreen/loyalty-backup-notify-email.sh` — the curl-SMTPS
  technique this borrows (and the alert channel it deliberately does not)
