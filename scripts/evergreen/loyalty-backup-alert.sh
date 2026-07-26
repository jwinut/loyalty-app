#!/usr/bin/env bash
#
# Fired by systemd (OnFailure=) when the nightly backup unit fails.
#
# A failed backup that only lands in the journal is the same class of problem
# as the old GitHub workflow reporting green while backing nothing up: nobody
# finds out. This writes a durable marker AND, if configured, sends a real
# alert.
#
# Configure ALERT_COMMAND in /etc/loyalty-backup.conf to route it somewhere a
# human actually reads. The message arrives on stdin.
#   e.g. ALERT_COMMAND='mail -s "loyalty backup FAILED" ops@example.com'
#        ALERT_COMMAND='curl -sS -X POST -d @- https://hooks.example/…'

set -euo pipefail

FAILED_UNIT="${1:-loyalty-backup.service}"
CONFIG_FILE="${LOYALTY_BACKUP_CONFIG:-/etc/loyalty-backup.conf}"
# shellcheck source=/dev/null
[ -r "$CONFIG_FILE" ] && . "$CONFIG_FILE"

: "${BACKUP_DIR:=/srv/backups/loyalty}"

WHEN="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LAST_OK="$(cat "${BACKUP_DIR}/last-success" 2>/dev/null || echo 'never')"

MESSAGE="$(cat <<EOF
LOYALTY PRODUCTION BACKUP FAILED

Unit:       ${FAILED_UNIT}
Host:       $(hostname)
Failed at:  ${WHEN}
Last good:  ${LAST_OK}

There is no new backup for tonight. Until this is fixed the newest restorable
dump is the one listed above.

Diagnose with:
  journalctl -u ${FAILED_UNIT} -n 100 --no-pager
  ls -lh ${BACKUP_DIR}

Restore procedure: docs/restore-runbook.md
EOF
)"

mkdir -p "$BACKUP_DIR"
printf '%s\n' "$MESSAGE" > "${BACKUP_DIR}/LAST-FAILURE"

# Always land it in the journal, tagged so it is greppable.
printf '%s\n' "$MESSAGE" | systemd-cat -t loyalty-backup -p err || printf '%s\n' "$MESSAGE" >&2

if [ -n "${ALERT_COMMAND:-}" ]; then
  # Never let a broken alert channel mask the original failure.
  if printf '%s\n' "$MESSAGE" | eval "$ALERT_COMMAND"; then
    echo "Alert dispatched via ALERT_COMMAND"
  else
    echo "WARNING: ALERT_COMMAND failed; the failure is still recorded in ${BACKUP_DIR}/LAST-FAILURE" >&2
  fi
else
  echo "No ALERT_COMMAND configured — failure recorded to ${BACKUP_DIR}/LAST-FAILURE and the journal only." >&2
fi
