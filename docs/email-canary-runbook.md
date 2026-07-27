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
- Failure → create the issue `Email canary - outbound mail is failing`, or
  comment on it if it is already open.
- "The canary could not run at all" (empty SMTP secrets) files a second issue,
  `Email canary - probe could not run, SMTP secrets empty`, because the first
  move differs: fix the workflow or the secrets, not the mailbox. Unverified is
  still an alert — it is not the same as working.
- Success → comment "delivering again" on **either** issue if open and **close
  it**. A probe the relay accepted disproves both alarms at once. Failure
  alerts are always paired with a recovery notification.
- Neither title contains a colon, and both are searched as quoted phrases:
  `gh issue list --search` speaks GitHub search syntax, where `word:` reads as
  a qualifier. Get that wrong and the lookup silently returns nothing, filing a
  duplicate issue on every probe instead of commenting on the open one.

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

While any of these is unresolved, assume **password resets, email verification
and booking mail are all failing**, and that `/api/health` will keep saying
email is `configured` — configuration is all that endpoint can see.

Once fixed, re-run the workflow by hand (below). A green run comments on the
issue and closes it automatically.

## Testing it by hand

Actions → **Email Canary** → *Run workflow*:

- **Normal probe** — leave both inputs unchecked. Sends a real canary message
  and, if an alert issue is open, closes it.
- **Exercise the alert path** — check `simulate_failure`. The send is retried
  with a deliberately unowned envelope sender
  (`simulated-failure@canary.invalid`, a reserved TLD per RFC 2606), so the
  relay refuses it exactly the way it refused everything in #352 — a real
  rejection, not a faked exit code, and no message can escape to a real
  mailbox. The alert issue is then filed for real, so **close it yourself**
  afterwards or let the next scheduled run close it.
- **Probe without side effects** — check `skip_alert`. Sends (or fails) and
  reports in the job summary, but never creates, comments on, or closes an
  issue. Useful when verifying a relay change.

`workflow_dispatch` only appears once the workflow is on `main`.

---

## Configuration

| Name | Where | Notes |
| --- | --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Secrets on the **`production` environment** | The same values `deploy.yml` already pipes through a runner on every production deploy — using them here is not a new exposure class. |
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
