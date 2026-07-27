# Database Restore Runbook

This document covers how to restore a production Postgres backup created
by the `loyalty-backup.timer` systemd unit on evergreen. The on-call operator should
be able to follow this end-to-end without prior context.

> See also: `docs/secrets-runbook.md`, `docs/rollback-runbook.md`.

## What gets backed up

Nightly at 01:00 ICT (18:00 UTC) the `loyalty-backup.timer` systemd unit
**on evergreen** runs `/usr/local/bin/backup-loyalty-db.sh`, which:

1. Runs `pg_dump` inside the production Postgres container.
2. Pipes it through `gzip -9`.
3. Encrypts with `age` against the public key in `/etc/loyalty-backup.conf`.
4. Writes `/srv/backups/loyalty/loyalty_pg_<ts>.sql.gz.age` (mode 600).
5. Rotates: deletes dumps older than `KEEP_DAYS` (30) but always keeps the
   `KEEP_MIN` (7) most recent, so a wrong clock cannot empty the directory.
6. Updates `/srv/backups/loyalty/last-success` — written last, so it only
   advances after a fully verified dump.
7. If the previous run had failed, sends a **recovery** notification and clears
   `/srv/backups/loyalty/LAST-FAILURE`. See [Alerting](#alerting).

The dump uses `--no-owner --no-acl` so it can be restored into a DB owned by
any role.

**This does not run in GitHub Actions.** It used to, uploading to S3, but that
design streamed the entire production database through a GitHub-hosted runner
and required cloud object storage. It also never actually ran: the
`EVERGREEN_*`/`POSTGRES_*` secrets it needed are environment-scoped, the job
declared no `environment:`, so they resolved empty, the config check concluded
"not configured", and the workflow reported **success while backing up
nothing — every night, for months**. The workflow has been removed.

### What this protects against, and what it does not

Backups live on the same host as the database. That covers the common cases —
a bad migration, an accidental `DELETE`, a corrupted table — but **not loss of
evergreen itself**. Copying `/srv/backups/loyalty` to a second machine you own
is the obvious next step; nothing here does that yet.

## Setup (one time, on evergreen)

```bash
sudo ./scripts/evergreen/install.sh
```

It installs `age`, the backup + alert scripts, the systemd units, creates
`/srv/backups/loyalty` (mode 700) and enables the timer. Re-running it upgrades
the scripts and never overwrites `/etc/loyalty-backup.conf`.

Then set `ALERT_COMMAND` in `/etc/loyalty-backup.conf` so a failure reaches a
human — see [Alerting](#alerting) below. Without it, failures land only in the
journal and in `/srv/backups/loyalty/LAST-FAILURE`.

| Setting              | What it is                                                    |
| -------------------- | ------------------------------------------------------------- |
| `AGE_RECIPIENT`      | Single-line `age1...` **public** key (safe to store here)     |
| `BACKUP_DIR`         | Where dumps are written (default `/srv/backups/loyalty`)      |
| `PG_CONTAINER`       | Production Postgres container name                             |
| `KEEP_DAYS`          | Age-based retention (default 30)                               |
| `KEEP_MIN`           | Floor on retained dumps regardless of age (default 7)          |
| `ALERT_COMMAND`      | Command receiving the alert text on stdin                      |
| `GITHUB_REPO`        | `owner/repo` the alert issue is filed on                       |
| `GITHUB_TOKEN`       | Fine-grained PAT, **Issues: read and write** on that repo only |
| `GITHUB_ISSUE_TITLE` | Issue title, **no colon** (default is fine)                    |
| `SMTP_*`             | Only for the optional second (email) channel                   |

> `install.sh` **never re-applies** `loyalty-backup.conf.example` to an existing
> `/etc/loyalty-backup.conf`. Anything added to the example after the host was
> provisioned has to be merged in by hand; re-running the installer prints a
> DRIFT NOTICE when the live conf has no `GITHUB_REPO`.

The age **private** key stays on the operator's machine at
`~/.age/loyalty-backup.key` and is the only thing that can decrypt a dump.
**If it is lost, every backup is unreadable** — store a copy in a password
manager, not only on one laptop.

### Host requirements

Verified on evergreen (Ubuntu 24.04, snap-packaged Docker 29.x, systemd). Two
things about that host shaped the unit and are worth knowing if it is ever
rebuilt or the backup is moved elsewhere:

- Docker is **snap**-packaged, so its unit is `snap.docker.dockerd.service`,
  not `docker.service`, and its binary lives in `/snap/bin` which is absent
  from systemd's default `PATH`. The unit therefore sets `PATH` explicitly and
  uses soft `After=` ordering against both possible unit names — a `Requires=`
  on a non-existent unit makes systemd refuse to start the backup at all.
- `NoNewPrivileges=` must **not** be set: snap confinement needs privilege
  transitions, and with it enabled every run fails with
  `container 'loyalty_postgres_production' not found`. `PrivateTmp`,
  `ProtectSystem=strict` and `ProtectHome` were each tested individually and
  are fine.

A harmless warning appears in the journal on every run:
`cannot create user data directory: cannot create snap home dir: mkdir
/root/snap: read-only file system`. That is snap wanting a home dir under the
`ProtectSystem=strict` read-only tree; the dump succeeds regardless.

### Verify it works

```bash
# On evergreen — run now rather than waiting for 18:00 UTC
sudo systemctl start loyalty-backup.service
journalctl -u loyalty-backup.service -n 40 --no-pager
ls -lh /srv/backups/loyalty
```

An untested backup is not a backup — confirm one actually restores using the
procedure below.

## Alerting

A backup you do not hear about is not monitored. Two things reach a human, and
one of them must not share fate with the thing being watched.

### Channels

| Channel                                       | Role            | Survives a mail outage |
| --------------------------------------------- | --------------- | ---------------------- |
| `loyalty-backup-notify-github.sh` (GitHub issue) | **primary**     | yes                    |
| `loyalty-backup-notify-email.sh` (SMTP)        | optional second | no                     |

Email is deliberately *not* the primary. The only mailbox available is
`info@saichon.com` — the same one that carries this app's password resets, and
the same one whose lapsed subscription caused #352 and made PR #351's first live
alert test fail with `553 5.7.1 ... Sender address rejected`. An email-only
alert routed through that mailbox suppresses its own alarm: the backup fails,
the alert cannot leave the host, and nobody finds out. GitHub does not share
fate with it, is already where `Production deploy failed` and
`Email canary - outbound mail is failing` land, and de-duplicates — one issue
that gains a comment per night rather than one message per night.

Set it up (on evergreen, in `/etc/loyalty-backup.conf`, mode 600):

```sh
GITHUB_REPO="thehfhotel/loyalty-app"
GITHUB_TOKEN="github_pat_…"
ALERT_COMMAND=/usr/local/bin/loyalty-backup-notify-github.sh
```

To run **both** channels, use the single-quoted two-transport form shown in
`scripts/evergreen/loyalty-backup.conf.example`. Three details there are load
bearing: single quotes (the conf is *sourced*, so double quotes expand at source
time and ship a blank alert), the GitHub transport **last** (a list's exit
status is its last command, and that status is how the alert script decides
whether the alert got out), and `|| true` on the email leg so a dead mailbox
cannot fail a dispatch GitHub already handled.

### What arrives

* **Failure** — an issue titled `Production backup failed on evergreen`, or a
  comment on the one already open. Body: host, unit, failure time, how old the
  last good dump is, the marker path, a copy-pasteable triage block, and the raw
  alert text.
* **Recovery** — a comment saying backups are working again, and the issue is
  **closed** (`state_reason: completed`).

`ALERT_COMMAND` learns which is which from the **environment**, never from
argv — `LOYALTY_ALERT_KIND=failure|recovered`, plus `LOYALTY_ALERT_UNIT` and
`LOYALTY_ALERT_LAST_SUCCESS_AGE`. A transport that ignores those variables keeps
working exactly as before, which is why `loyalty-backup-notify-email.sh` needed
no change: its subject line still says `PRODUCTION BACKUP FAILED` even for a
recovery, and the first line of the body is what distinguishes the two.

> **The issue body is world-readable.** `thehfhotel/loyalty-app` is a public
> repository. The transport only ever posts facts this repo already publishes.
> When you reply in the thread, keep journal excerpts, container environment,
> connection strings and dump contents on the host.

### `LAST-FAILURE` is now self-clearing

`/srv/backups/loyalty/LAST-FAILURE` used to be written on every failure and
removed by nothing, so a marker from weeks ago sat next to a fresh
`last-success` and an operator mid-incident had to compare timestamps to work
out which was current (#366). It is now the recovery latch:

| Event                                              | Marker      |
| -------------------------------------------------- | ----------- |
| Backup fails                                       | written     |
| Backup succeeds, recovery alert dispatched OK      | **removed** |
| Backup succeeds, recovery dispatch **failed**      | kept, so the next successful run retries |
| Backup succeeds, no `ALERT_COMMAND` configured     | removed     |

So: **if `LAST-FAILURE` exists, backups are failing right now** (or the recovery
notice has not got out yet — the journal says which). It is no longer a
historical artefact.

Two guards keep this from making things worse than the silence it replaces.
`backup-loyalty-db.sh` runs under `set -euo pipefail` and calls the alert script
*after* a verified backup, so the call is wrapped in `|| log "WARNING: …"` and
`loyalty-backup-alert.sh` ends with an unconditional `exit 0`. Without either,
a broken alert transport would fail `loyalty-backup.service`, fire its
`OnFailure=`, and file a FAILURE issue for a run that succeeded. Both comments
say so in the source; do not tidy them away.

### The token: mint, approve, rotate

The PAT is the one live secret on evergreen and it lives only in
`/etc/loyalty-backup.conf`.

1. GitHub → Settings → Developer settings → **Personal access tokens → Fine-grained tokens** → *Generate new token*.
2. **Resource owner: `thehfhotel`** (the organisation, not your personal account) — the issue has to be filed on the org's repo.
3. Repository access: **Only select repositories → `thehfhotel/loyalty-app`**.
4. Repository permissions: **Issues → Read and write**. Nothing else. (`Metadata → Read` is added automatically and is mandatory.) It cannot deploy, cannot push, and cannot touch any other repo.
5. Expiration: 90 days or less. Put the rotation date in the calendar — see the drill below for what an expired token looks like.
6. **Because `thehfhotel` is an organisation, the token may land in the org's *Pending requests*** (Settings → Third-party Access → Personal access tokens). Until an owner approves it, every call 403s and the transport logs `BACKUP ALERTS ARE NOT REACHING GITHUB`. Approve it before assuming the script is broken.
7. Install it:

   ```sh
   sudo sed -i 's|^GITHUB_TOKEN=.*|GITHUB_TOKEN="github_pat_…"|' /etc/loyalty-backup.conf
   sudo chmod 600 /etc/loyalty-backup.conf
   sudo systemctl start loyalty-backup.service    # proves the whole path
   ```

Rotation is the same steps with a new token; there is no other copy to update.
The token is never passed on a command line (it goes into a mode-600 curl config
inside a private temp dir) and is never exported, so it appears in neither
`/proc/*/cmdline` nor `/proc/*/environ`. If it ever leaks, revoke it in GitHub
first — that is instant — and only then mint a replacement.

### Alert-path drill

An alert channel nobody has ever seen fire is a hypothesis. Exercise the whole
loop end to end; it takes about two minutes and touches no production data.

```sh
# On evergreen, as root.

# 1. FAILURE. Fire the alert unit by hand — same path OnFailure= uses.
sudo systemctl start loyalty-backup-failure@loyalty-backup.service
journalctl -u 'loyalty-backup-failure@*' -n 40 --no-pager
ls -l /srv/backups/loyalty/LAST-FAILURE          # marker written
cat /srv/backups/loyalty/.github-alert-issue     # issue number remembered (mode 600)
#    -> expect a new "Production backup failed on evergreen" issue on GitHub

# 2. DE-DUPE. Do it again; it must COMMENT, not open a second issue.
sudo systemctl start loyalty-backup-failure@loyalty-backup.service

# 3. RECOVERY. A real backup run clears it and closes the issue.
sudo systemctl start loyalty-backup.service
journalctl -u loyalty-backup.service -n 40 --no-pager
ls -l /srv/backups/loyalty/LAST-FAILURE          # expect: No such file or directory
#    -> expect a "Backups are working again" comment and the issue CLOSED
```

Close the loop by hand afterwards only if something went wrong. What to look for
when it does:

| Symptom in the journal                             | Cause                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `BACKUP ALERTS ARE NOT REACHING GITHUB` + `401`     | Token wrong, revoked or expired. Mint a new one.                        |
| Same banner + `403`                                 | Org approval still pending, wrong permission, or a secondary rate limit. |
| `GITHUB_REPO is not set`                            | Config drift — the conf predates this transport. Re-run `install.sh` for the DRIFT NOTICE. |
| `gave up after 3 attempts (last HTTP 000)`          | No egress / DNS. Same fix as any other outbound problem on that host.   |
| A duplicate issue every night                       | The title acquired a colon. GitHub search reads `word:` as a qualifier, so the de-dupe search silently matches nothing. |
| Marker still present after a successful run         | The recovery dispatch failed. Deliberate — the next successful run retries. |

## Restoring from backup

### 1. Pick the dump

```bash
# On evergreen — newest last
ls -lh /srv/backups/loyalty/
cat /srv/backups/loyalty/last-success   # timestamp, filename, size of the last good run
```

Copy it to the machine holding the private key (dumps cannot be decrypted on
evergreen — it only has the public key):

```bash
scp evergreen:/srv/backups/loyalty/loyalty_pg_20260513T180001Z.sql.gz.age \
  /tmp/restore.sql.gz.age
```

### 2. Decrypt and decompress locally

```bash
age --decrypt --identity ~/.age/loyalty-backup.key \
  /tmp/restore.sql.gz.age > /tmp/restore.sql.gz
gunzip /tmp/restore.sql.gz
# /tmp/restore.sql is now plain SQL — handle as sensitive data.
```

### 3. Stop the backend (drains in-flight writes)

Graceful shutdown (PR adding this runbook) ensures in-flight requests
complete before the container exits.

```bash
ssh -o ProxyCommand="cloudflared --edge-ip-version 4 access ssh --hostname %h" \
  deploy@evergreen.thehfhotel.org \
  'docker stop loyalty_backend_production'
```

### 4. Restore the dump

Drop and recreate the DB inside the Postgres container, then `psql` the
dump in.

```bash
ssh -o ProxyCommand="cloudflared --edge-ip-version 4 access ssh --hostname %h" \
  deploy@evergreen.thehfhotel.org bash -s <<'REMOTE'
  set -euo pipefail
  docker exec -i loyalty_postgres_production psql -U "$POSTGRES_USER" -d postgres <<SQL
    DROP DATABASE IF EXISTS "${POSTGRES_DB}_restore";
    CREATE DATABASE "${POSTGRES_DB}_restore";
SQL
REMOTE

# Pipe the local SQL file into the remote postgres container
ssh -o ProxyCommand="cloudflared --edge-ip-version 4 access ssh --hostname %h" \
  deploy@evergreen.thehfhotel.org \
  "docker exec -i loyalty_postgres_production psql -U \"\$POSTGRES_USER\" -d \"\${POSTGRES_DB}_restore\"" \
  < /tmp/restore.sql
```

### 5. Verify the restored data

```bash
ssh ... 'docker exec loyalty_postgres_production psql -U "$POSTGRES_USER" \
  -d "${POSTGRES_DB}_restore" -c "SELECT COUNT(*) FROM users;"'
```

Spot-check a few tables (`users`, `bookings`, `points_transactions`,
`booking_audit_log`) match the row counts you expect for the backup date.

### 6. Promote the restored DB

Only after verification. This is irreversible without another restore.

```sql
-- inside `docker exec -it loyalty_postgres_production psql -U "$POSTGRES_USER" -d postgres`
ALTER DATABASE "${POSTGRES_DB}"          RENAME TO "${POSTGRES_DB}_pre_restore";
ALTER DATABASE "${POSTGRES_DB}_restore"  RENAME TO "${POSTGRES_DB}";
```

### 7. Bring the backend back up

```bash
ssh ... 'docker start loyalty_backend_production'

# Wait for the embedded healthcheck binary to report healthy
curl -fsS https://loyalty.saichon.com/api/health
```

### 8. Clean up

After ~24 hours of healthy production, drop the safety copy:

```sql
DROP DATABASE "${POSTGRES_DB}_pre_restore";
```

## Combining restore with a code rollback

The current `sqlx::migrate!` design is forward-only — no
down-migrations. If you also need to roll back code past the last
applied migration, **restore the DB first**, then deploy the prior
image SHA. See `docs/rollback-runbook.md` for the code rollback path.

## Restore drill log

Document each restore drill here so the next operator can see when this
was last exercised.

| Date       | Operator | Backup restored                          | Notes                |
| ---------- | -------- | ---------------------------------------- | -------------------- |
| _pending_  | _name_   | _e.g. loyalty_pg_20260513T180001Z._      | First drill required |

> **Pre-launch action**: perform one full end-to-end restore drill into
> a throwaway database before flipping the public switch. Record the
> result in this table.

## Troubleshooting

### `age: failed to decrypt: no identity matched any of the recipients`

The `BACKUP_AGE_RECIPIENT` used at backup time doesn't match the
identity you passed to `age --decrypt`. Confirm the public key in the
GitHub secret matches the private key you have.

### `aws: command not found`

```bash
brew install awscli            # macOS
sudo apt-get install awscli    # Debian/Ubuntu
```

### `psql: error: connection to server ... password authentication failed`

`POSTGRES_USER` / `POSTGRES_PASSWORD` env vars on the remote shell
don't match what's currently in the running container's `.env`. SSH in
and `cat /srv/.../.env | grep POSTGRES`.

### Dump is empty / `0 bytes`

The backup workflow includes a `< 1024 bytes` sanity check. If a dump
gets that small in production, investigate before relying on it.
