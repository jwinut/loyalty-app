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
human. Without it, failures land only in the journal and in
`/srv/backups/loyalty/LAST-FAILURE`.

| Setting          | What it is                                                 |
| ---------------- | ---------------------------------------------------------- |
| `AGE_RECIPIENT`  | Single-line `age1...` **public** key (safe to store here)  |
| `BACKUP_DIR`     | Where dumps are written (default `/srv/backups/loyalty`)   |
| `PG_CONTAINER`   | Production Postgres container name                          |
| `KEEP_DAYS`      | Age-based retention (default 30)                            |
| `KEEP_MIN`       | Floor on retained dumps regardless of age (default 7)       |
| `ALERT_COMMAND`  | Command receiving the failure text on stdin                 |

The age **private** key stays on the operator's machine at
`~/.age/loyalty-backup.key` and is the only thing that can decrypt a dump.
**If it is lost, every backup is unreadable** — store a copy in a password
manager, not only on one laptop.

### Verify it works

```bash
# On evergreen — run now rather than waiting for 18:00 UTC
sudo systemctl start loyalty-backup.service
journalctl -u loyalty-backup.service -n 40 --no-pager
ls -lh /srv/backups/loyalty
```

An untested backup is not a backup — confirm one actually restores using the
procedure below.

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
