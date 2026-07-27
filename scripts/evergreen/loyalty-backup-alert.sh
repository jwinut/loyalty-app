#!/usr/bin/env bash
#
# The one place a backup alert is dispatched from — in BOTH directions.
#
#   FAILURE    fired by systemd (OnFailure= on loyalty-backup.service). Writes
#              the durable LAST-FAILURE marker and sends the alert.
#   RECOVERED  fired by backup-loyalty-db.sh after a verified successful dump,
#              but only if LAST-FAILURE exists. Sends the "working again"
#              message and clears the marker.
#
# A failed backup that only lands in the journal is the same class of problem as
# the old GitHub workflow reporting green while backing nothing up: nobody finds
# out. And a failure alert with no matching recovery is only half a signal —
# this repo's alerting convention is to pair the two so alarms stay trusted, and
# #366 recorded that LAST-FAILURE was written but never cleared.
#
# Configure ALERT_COMMAND in /etc/loyalty-backup.conf to route it somewhere a
# human actually reads. The message arrives on stdin.
#   e.g. ALERT_COMMAND=/usr/local/bin/loyalty-backup-notify-github.sh
#        ALERT_COMMAND='mail -s "loyalty backup" ops@example.com'
#        ALERT_COMMAND='curl -sS -X POST -d @- https://hooks.example/…'
#
# Which direction this is, is passed to the transport in the ENVIRONMENT, never
# in argv:
#
#   LOYALTY_ALERT_KIND              failure | recovered
#   LOYALTY_ALERT_UNIT              the systemd unit the alert is about
#   LOYALTY_ALERT_LAST_SUCCESS_AGE  how old the last good dump is, human form
#
# ALERT_COMMAND is a free-form shell string run through `eval`, so appending an
# argument (`eval "$ALERT_COMMAND" recovered`) would tack the word onto that
# string's LAST command. Both configurations this repo documents would break:
# `mail -s … ops@example.com recovered` gains a second recipient, and
# `curl … https://hooks.example/backup recovered` gains a second URL. Sniffing
# the message text instead would be worse still — the wording is not an API.
# Transports that ignore these variables keep working unchanged, which is why
# loyalty-backup-notify-email.sh needed no edit for any of this.

set -euo pipefail

# The caller's intent, captured BEFORE the config file is sourced: a stray
# LOYALTY_ALERT_KIND assignment in /etc/loyalty-backup.conf must not be able to
# turn a failure into a recovery. Anything unrecognised becomes `failure` —
# always fail toward alerting.
ALERT_KIND="${LOYALTY_ALERT_KIND:-failure}"
case "$ALERT_KIND" in
  failure|recovered) ;;
  *) ALERT_KIND=failure ;;
esac

FAILED_UNIT="${1:-loyalty-backup.service}"
CONFIG_FILE="${LOYALTY_BACKUP_CONFIG:-/etc/loyalty-backup.conf}"
# shellcheck source=/dev/null
[ -r "$CONFIG_FILE" ] && . "$CONFIG_FILE"

: "${BACKUP_DIR:=/srv/backups/loyalty}"

MARKER="${BACKUP_DIR}/LAST-FAILURE"
WHEN="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LAST_OK="$(cat "${BACKUP_DIR}/last-success" 2>/dev/null || echo 'never')"

# Age of the last good dump, from the marker file's mtime rather than by parsing
# its timestamp: `date -d` cannot read the compact 20260726T180001Z form
# portably, and mtime is written by the same successful run.
last_success_age() {
  local f="${BACKUP_DIR}/last-success" mtime now age
  [ -f "$f" ] || { printf 'never — no successful backup has ever been recorded'; return 0; }
  mtime="$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || true)"
  case "${mtime:-x}" in
    ''|*[!0-9]*) printf 'unknown — could not stat %s' "$f"; return 0 ;;
  esac
  now="$(date -u +%s)"
  age=$(( now - mtime ))
  if [ "$age" -lt 0 ]; then
    printf 'unknown — %s is in the future (clock skew)' "$f"
    return 0
  fi
  printf '%dd %dh %dm ago' "$(( age / 86400 ))" "$(( age % 86400 / 3600 ))" "$(( age % 3600 / 60 ))"
}
LAST_SUCCESS_AGE="$(last_success_age)"

if [ "$ALERT_KIND" = 'recovered' ]; then
  FAILING_SINCE='unknown'
  if [ -f "$MARKER" ]; then
    FAILING_SINCE="$(
      { stat -c %y "$MARKER" 2>/dev/null || stat -f %Sm "$MARKER" 2>/dev/null; } || true
    )"
    [ -n "$FAILING_SINCE" ] || FAILING_SINCE='unknown'
  fi
  MESSAGE="$(cat <<EOF
LOYALTY PRODUCTION BACKUP RECOVERED

Unit:          ${FAILED_UNIT}
Host:          $(hostname)
Recovered at:  ${WHEN}
Last good:     ${LAST_OK}
Backup age:    ${LAST_SUCCESS_AGE}
Failing since: ${FAILING_SINCE}

A backup ran, passed its size and age-header checks, and was written to
${BACKUP_DIR}. The failure marker below is being cleared.

Marker: ${MARKER}

Restore procedure: docs/restore-runbook.md
EOF
  )"
else
  MESSAGE="$(cat <<EOF
LOYALTY PRODUCTION BACKUP FAILED

Unit:        ${FAILED_UNIT}
Host:        $(hostname)
Failed at:   ${WHEN}
Last good:   ${LAST_OK}
Backup age:  ${LAST_SUCCESS_AGE}

There is no new backup for tonight. Until this is fixed the newest restorable
dump is the one listed above.

Diagnose with:
  journalctl -u ${FAILED_UNIT} -n 100 --no-pager
  ls -lh ${BACKUP_DIR}

Restore procedure: docs/restore-runbook.md
EOF
  )"
fi

mkdir -p "$BACKUP_DIR"

# The marker is written for a failure and cleared for a recovery — but only
# after the recovery has actually been delivered (below), so a transport outage
# cannot silently drop the "we are fine again" signal AND erase the evidence.
if [ "$ALERT_KIND" = 'failure' ]; then
  printf '%s\n' "$MESSAGE" > "$MARKER"
  chmod 600 "$MARKER"   # match the dumps and .github-alert-issue; 644 was untidy
fi

# Always land it in the journal, tagged so it is greppable.
printf '%s\n' "$MESSAGE" | systemd-cat -t loyalty-backup -p err || printf '%s\n' "$MESSAGE" >&2

if [ -n "${ALERT_COMMAND:-}" ]; then
  # Exported for the transport. A transport that ignores them behaves exactly as
  # it did before these existed.
  export LOYALTY_ALERT_KIND="$ALERT_KIND"
  export LOYALTY_ALERT_UNIT="$FAILED_UNIT"
  export LOYALTY_ALERT_LAST_SUCCESS_AGE="$LAST_SUCCESS_AGE"

  # Never let a broken alert channel mask the original failure.
  if printf '%s\n' "$MESSAGE" | eval "$ALERT_COMMAND"; then
    echo "Alert dispatched via ALERT_COMMAND (kind=${ALERT_KIND})"
    if [ "$ALERT_KIND" = 'recovered' ]; then
      rm -f "$MARKER"
      echo "Cleared ${MARKER}"
    fi
  else
    if [ "$ALERT_KIND" = 'recovered' ]; then
      # KEEP the marker. It is the only record that we still owe someone a
      # recovery message, and it is what makes tomorrow's successful run try
      # again instead of leaving an alert issue open forever.
      echo "WARNING: ALERT_COMMAND failed for the recovery notice; ${MARKER} kept so the next successful run retries" >&2
    else
      echo "WARNING: ALERT_COMMAND failed; the failure is still recorded in ${MARKER}" >&2
    fi
  fi
else
  echo "No ALERT_COMMAND configured — ${ALERT_KIND} recorded to the journal only." >&2
  if [ "$ALERT_KIND" = 'recovered' ]; then
    # Nothing to deliver and nothing to retry: keeping the marker would leave a
    # stale LAST-FAILURE sitting next to a fresh last-success forever, which is
    # the exact confusion #366 opens with.
    rm -f "$MARKER"
    echo "Cleared ${MARKER}" >&2
  fi
fi

# ###########################################################################
# ##  UNCONDITIONAL exit 0 — LOAD-BEARING, DO NOT "TIDY" THIS AWAY.         ##
# ##                                                                        ##
# ##  backup-loyalty-db.sh calls this script on the RECOVERY path, and it   ##
# ##  runs under `set -euo pipefail` AFTER a fully verified backup. A       ##
# ##  non-zero exit here would fail loyalty-backup.service, fire its        ##
# ##  OnFailure=, and file a FAILURE alert for a run that succeeded —       ##
# ##  strictly worse than the silence #366 is fixing. The caller guards the ##
# ##  invocation with `|| log WARNING` as well; both belong here.           ##
# ##                                                                        ##
# ##  Nothing downstream reads this status: whether the alert got out is    ##
# ##  reported through the journal and through the LAST-FAILURE marker.     ##
# ###########################################################################
exit 0
