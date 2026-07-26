#!/usr/bin/env bash
#
# Install the local nightly backup on evergreen. Run AS ROOT on that host:
#
#   curl -fsSL https://raw.githubusercontent.com/thehfhotel/loyalty-app/main/scripts/evergreen/install.sh | sudo bash
#
# …or, from a checkout:  sudo ./scripts/evergreen/install.sh
#
# Idempotent: safe to re-run to pick up script changes. It never overwrites an
# existing /etc/loyalty-backup.conf, so your AGE_RECIPIENT and ALERT_COMMAND
# survive upgrades.

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/thehfhotel/loyalty-app/main/scripts/evergreen"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF=/etc/loyalty-backup.conf
BACKUP_DIR=/srv/backups/loyalty

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)." >&2; exit 1; }

fetch() {  # fetch <name> <dest> — use the local copy if present, else download
  local name="$1" dest="$2"
  if [ -f "${SRC_DIR}/${name}" ]; then
    install -m "$3" "${SRC_DIR}/${name}" "$dest"
  else
    curl -fsSL "${REPO_RAW}/${name}" -o "$dest"
    chmod "$3" "$dest"
  fi
  echo "  installed $dest"
}

echo "==> Dependencies"
if ! command -v age >/dev/null; then
  echo "  installing age"
  apt-get update -qq && apt-get install -y -qq age
else
  echo "  age present ($(age --version 2>/dev/null || echo unknown))"
fi
command -v docker >/dev/null || { echo "docker is required but not installed" >&2; exit 1; }

echo "==> Scripts"
fetch backup-loyalty-db.sh    /usr/local/bin/backup-loyalty-db.sh    755
fetch loyalty-backup-alert.sh /usr/local/bin/loyalty-backup-alert.sh 755

echo "==> systemd units"
fetch loyalty-backup.service          /etc/systemd/system/loyalty-backup.service          644
fetch loyalty-backup.timer            /etc/systemd/system/loyalty-backup.timer            644
fetch loyalty-backup-failure@.service /etc/systemd/system/loyalty-backup-failure@.service 644

echo "==> Backup directory"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
echo "  $BACKUP_DIR (mode 700)"

echo "==> Config"
if [ -f "$CONF" ]; then
  echo "  $CONF already exists — left untouched"
else
  fetch loyalty-backup.conf.example "$CONF" 600
  echo "  wrote $CONF (mode 600) — review AGE_RECIPIENT and set ALERT_COMMAND"
fi

echo "==> Enabling timer"
systemctl daemon-reload
systemctl enable --now loyalty-backup.timer
systemctl list-timers loyalty-backup.timer --no-pager || true

cat <<EOF

Installed.

Verify with a real run right now (does not wait for 18:00 UTC):
    systemctl start loyalty-backup.service
    journalctl -u loyalty-backup.service -n 40 --no-pager
    ls -lh ${BACKUP_DIR}

Then confirm the dump actually restores — an untested backup is not a backup.
On YOUR machine (which holds the private key):
    scp evergreen:${BACKUP_DIR}/loyalty_pg_*.sql.gz.age /tmp/
    age --decrypt --identity ~/.age/loyalty-backup.key /tmp/loyalty_pg_*.sql.gz.age \\
      | gunzip | head -20

Set ALERT_COMMAND in ${CONF} so failures reach a human, then re-run this
script or 'systemctl restart loyalty-backup.timer'.
EOF
