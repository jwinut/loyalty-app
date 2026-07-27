#!/usr/bin/env bash
#
# Nightly encrypted backup of the production loyalty database.
#
# Runs ON evergreen (via the systemd timer in this directory) — NOT in GitHub
# Actions. The plaintext dump therefore never leaves the host, and no CI runner
# ever holds production data or a token alongside it.
#
# Pipeline:  pg_dump -> gzip -9 -> age (public-key encrypt) -> local file
#
# The age PRIVATE key lives only on the operator's machine
# (~/.age/loyalty-backup.key). This host holds the PUBLIC key alone, so a
# compromise of evergreen yields encrypted blobs it cannot read.
#
# Config: /etc/loyalty-backup.conf (see loyalty-backup.conf.example).
# Exit non-zero on ANY failure — the systemd unit's OnFailure= turns that into
# an alert. Silence must never be mistaken for success.

set -euo pipefail

CONFIG_FILE="${LOYALTY_BACKUP_CONFIG:-/etc/loyalty-backup.conf}"
# shellcheck source=/dev/null
[ -r "$CONFIG_FILE" ] && . "$CONFIG_FILE"

: "${BACKUP_DIR:=/srv/backups/loyalty}"
: "${PG_CONTAINER:=loyalty_postgres_production}"
: "${KEEP_DAYS:=30}"
: "${KEEP_MIN:=7}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT must be set in $CONFIG_FILE (the age1... PUBLIC key)}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

command -v age >/dev/null || die "age is not installed (apt install age, or see install.md)"
command -v docker >/dev/null || die "docker is not installed"
docker inspect "$PG_CONTAINER" >/dev/null 2>&1 || die "container '$PG_CONTAINER' not found"

# Read the DB credentials from the container itself rather than hunting for a
# compose .env path — the container is the source of truth and cannot drift.
PGUSER_VAL="$(docker exec "$PG_CONTAINER" printenv POSTGRES_USER 2>/dev/null || true)"
PGDB_VAL="$(docker exec "$PG_CONTAINER" printenv POSTGRES_DB 2>/dev/null || true)"
[ -n "$PGUSER_VAL" ] || die "could not read POSTGRES_USER from $PG_CONTAINER"
[ -n "$PGDB_VAL" ] || die "could not read POSTGRES_DB from $PG_CONTAINER"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="loyalty_pg_${TIMESTAMP}.sql.gz.age"
TMP="${BACKUP_DIR}/.${NAME}.partial"
DEST="${BACKUP_DIR}/${NAME}"

# Write to a .partial file first and rename only after every check passes, so a
# half-written dump can never be picked up by a restore or counted by the
# freshness check.
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

log "Dumping ${PGDB_VAL} from ${PG_CONTAINER}"

# `docker exec -i` (no TTY) keeps stdout binary-clean for the gzip stream.
# pg_dump authenticates over the container's unix socket (trust) — no password
# is passed, so none can leak into argv.
#
# pipefail is load-bearing: without it `pg_dump | gzip` exits with gzip's
# status, and gzip writes a valid trailer over a truncated stream — a pg_dump
# killed mid-run (OOM, lock timeout, disk pressure) would otherwise produce an
# unrestorable file that looks perfectly healthy.
set -o pipefail
docker exec -i "$PG_CONTAINER" \
    pg_dump -U "$PGUSER_VAL" -d "$PGDB_VAL" --no-owner --no-acl \
  | gzip -9 \
  | age --recipient "$AGE_RECIPIENT" --output "$TMP"

SIZE="$(stat -c%s "$TMP" 2>/dev/null || stat -f%z "$TMP")"
[ "$SIZE" -ge 1024 ] || die "dump is only ${SIZE} bytes — pg_dump almost certainly failed"

# Prove the artifact is actually decryptable-shaped age output before trusting
# it. This does not need the private key: `age` refuses a malformed header.
head -c 64 "$TMP" | grep -q '^age-encryption.org/' \
  || die "output is not a valid age file — encryption step misbehaved"

mv "$TMP" "$DEST"
chmod 600 "$DEST"
trap - EXIT
log "Wrote ${DEST} (${SIZE} bytes)"

# Rotation. Delete by age, but never drop below KEEP_MIN most-recent files —
# a wrong system clock or a stalled timer must not be able to empty the
# backup directory.
TOTAL="$(find "$BACKUP_DIR" -maxdepth 1 -name 'loyalty_pg_*.sql.gz.age' | wc -l | tr -d ' ')"
if [ "$TOTAL" -gt "$KEEP_MIN" ]; then
  find "$BACKUP_DIR" -maxdepth 1 -name 'loyalty_pg_*.sql.gz.age' -mtime "+${KEEP_DAYS}" -print \
    | sort | head -n "$(( TOTAL - KEEP_MIN ))" \
    | while IFS= read -r old; do
        log "Rotating out $(basename "$old")"
        rm -f "$old"
      done
fi

# Freshness marker for monitoring. Written last, so it only ever advances after
# a fully verified backup.
printf '%s %s %s\n' "$TIMESTAMP" "$NAME" "$SIZE" > "${BACKUP_DIR}/last-success"

REMAINING="$(find "$BACKUP_DIR" -maxdepth 1 -name 'loyalty_pg_*.sql.gz.age' | wc -l | tr -d ' ')"
log "Backup complete — ${REMAINING} dump(s) retained in ${BACKUP_DIR}"

# ---------------------------------------------------------------------------
# Recovery signal.
#
# The presence of LAST-FAILURE is the whole "were we previously broken?" test —
# no new state. Before #366 nothing ever removed it, so a marker from weeks ago
# sat next to a fresh last-success and an operator mid-incident had to compare
# timestamps to work out which was current. Worse, a failure alert with no
# closing signal trains people to ignore the channel.
#
# The dispatch (and the marker policy: clear on success, KEEP on a failed
# dispatch so tomorrow retries, clear when no ALERT_COMMAND is configured at
# all) lives in loyalty-backup-alert.sh, so both directions go out through
# exactly one code path.
# ---------------------------------------------------------------------------
if [ -f "${BACKUP_DIR}/LAST-FAILURE" ]; then
  ALERT_SCRIPT="${LOYALTY_ALERT_SCRIPT:-}"
  if [ -z "$ALERT_SCRIPT" ]; then
    # install.sh puts both scripts in /usr/local/bin; prefer a sibling so a
    # checkout runs against its own copy.
    SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -x "${SELF_DIR}/loyalty-backup-alert.sh" ]; then
      ALERT_SCRIPT="${SELF_DIR}/loyalty-backup-alert.sh"
    else
      ALERT_SCRIPT=/usr/local/bin/loyalty-backup-alert.sh
    fi
  fi

  if [ -x "$ALERT_SCRIPT" ]; then
    log "Previous run had failed — sending the recovery notification"
    # #########################################################################
    # ##  THE `|| log` GUARD IS LOAD-BEARING. DO NOT REMOVE IT.              ##
    # ##                                                                     ##
    # ##  This script runs under `set -euo pipefail`, and this line executes ##
    # ##  AFTER a fully verified backup. An unguarded non-zero exit here     ##
    # ##  would fail loyalty-backup.service, fire its OnFailure=, and file a ##
    # ##  FAILURE alert for a run that SUCCEEDED — strictly worse than the   ##
    # ##  silence this feature exists to fix. loyalty-backup-alert.sh also   ##
    # ##  ends with an unconditional `exit 0` for the same reason; both      ##
    # ##  belong, because either one can be lost in a refactor.              ##
    # #########################################################################
    LOYALTY_ALERT_KIND=recovered "$ALERT_SCRIPT" loyalty-backup.service \
      || log "WARNING: recovery notification failed; ${BACKUP_DIR}/LAST-FAILURE kept for the next run to retry"
  else
    log "WARNING: ${ALERT_SCRIPT} is missing — cannot send the recovery notification; ${BACKUP_DIR}/LAST-FAILURE left in place"
  fi
fi
