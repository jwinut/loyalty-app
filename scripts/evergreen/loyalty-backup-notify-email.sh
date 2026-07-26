#!/usr/bin/env bash
#
# Email transport for backup failure alerts. Set as ALERT_COMMAND in
# /etc/loyalty-backup.conf; the alert text arrives on stdin.
#
#   ALERT_COMMAND=/usr/local/bin/loyalty-backup-notify-email.sh
#
# Credentials come from /etc/loyalty-backup.conf (root-only, mode 600) rather
# than from the running backend container. That is deliberate: the alert must
# still work when the app is down — which is exactly the situation where a
# backup is most likely to have failed.
#
# Uses curl's SMTP support; no MTA is installed on evergreen.

set -euo pipefail

CONFIG_FILE="${LOYALTY_BACKUP_CONFIG:-/etc/loyalty-backup.conf}"
# shellcheck source=/dev/null
[ -r "$CONFIG_FILE" ] && . "$CONFIG_FILE"

: "${SMTP_HOST:?SMTP_HOST not set in $CONFIG_FILE}"
: "${SMTP_PORT:=465}"
: "${SMTP_USER:?SMTP_USER not set in $CONFIG_FILE}"
: "${SMTP_PASS:?SMTP_PASS not set in $CONFIG_FILE}"
: "${ALERT_EMAIL_TO:?ALERT_EMAIL_TO not set in $CONFIG_FILE}"
: "${ALERT_EMAIL_FROM:=$SMTP_USER}"

BODY="$(cat)"
[ -n "$BODY" ] || BODY="(no alert body received on stdin)"

# 465 is implicit TLS (smtps://); 587 is STARTTLS on a plain smtp:// URL.
if [ "$SMTP_PORT" = "465" ]; then
  URL="smtps://${SMTP_HOST}:${SMTP_PORT}"
else
  URL="smtp://${SMTP_HOST}:${SMTP_PORT}"
fi

MAIL_FILE="$(mktemp)"
trap 'rm -f "$MAIL_FILE"' EXIT
chmod 600 "$MAIL_FILE"

{
  printf 'From: %s\r\n' "$ALERT_EMAIL_FROM"
  printf 'To: %s\r\n' "$ALERT_EMAIL_TO"
  printf 'Subject: [loyalty] PRODUCTION BACKUP FAILED on %s\r\n' "$(hostname)"
  printf 'Date: %s\r\n' "$(date -R)"
  printf 'Content-Type: text/plain; charset=UTF-8\r\n'
  printf '\r\n'
  printf '%s\r\n' "$BODY"
} > "$MAIL_FILE"

# --silent --show-error: quiet on success, loud on failure. The exit status is
# what loyalty-backup-alert.sh checks to decide whether the alert got out.
curl --silent --show-error --ssl-reqd \
     --url "$URL" \
     --user "${SMTP_USER}:${SMTP_PASS}" \
     --mail-from "$ALERT_EMAIL_FROM" \
     --mail-rcpt "$ALERT_EMAIL_TO" \
     --upload-file "$MAIL_FILE" \
     --max-time 60

echo "Alert emailed to ${ALERT_EMAIL_TO}"
