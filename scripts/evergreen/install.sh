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

# /etc/loyalty-backup.conf now holds a GitHub PAT as well as SMTP credentials,
# and fetch() below creates a file before it chmods it — with the default umask
# that is a brief window in which the conf is world-readable. Setting the umask
# here closes the window instead of relying on the chmod winning a race.
umask 077

REPO_RAW="https://raw.githubusercontent.com/thehfhotel/loyalty-app/main/scripts/evergreen"
# `${BASH_SOURCE[0]:-}`, not `${BASH_SOURCE[0]}`: piped to bash — which is the
# documented `curl … | sudo bash` install — there is no source file, so
# BASH_SOURCE is unset and under `set -u` the bare form made
# `BASH_SOURCE[0]: unbound variable` the installer's very first line of output.
# How bad that is depends on the bash: on evergreen it was survivable noise (the
# run continued and fetch() fell through to the curl branch, which is the right
# behaviour for a piped install), but on bash 5.3 the failed command
# substitution trips `set -e` and the installer exits before it even checks for
# root. Either way it is unacceptable on a root-run installer. With a real
# source file this still resolves the checkout directory, so
# `sudo ./scripts/evergreen/install.sh` keeps using the local copies.
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-}")" && pwd)"
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
# jq is OPTIONAL: the GitHub alert transport prefers it for building request
# JSON but ships a pure-bash escaper for hosts without it. Never fatal — an
# alerting path that refuses to install because of an optional package is worse
# than one that installs with a fallback.
if ! command -v jq >/dev/null; then
  echo "  installing jq (optional — used to build alert JSON)"
  apt-get update -qq && apt-get install -y -qq jq \
    || echo "  jq install failed — the GitHub transport will use its built-in escaper"
else
  echo "  jq present ($(jq --version 2>/dev/null || echo unknown))"
fi
command -v docker >/dev/null || { echo "docker is required but not installed" >&2; exit 1; }
# Hard requirement, not best-effort: every alert transport shipped here is
# curl-based (no MTA and no `gh` on evergreen), and this script itself falls
# back to curl when run without a checkout.
command -v curl >/dev/null || { echo "curl is required but not installed" >&2; exit 1; }

echo "==> Scripts"
fetch backup-loyalty-db.sh          /usr/local/bin/backup-loyalty-db.sh          755
fetch loyalty-backup-alert.sh       /usr/local/bin/loyalty-backup-alert.sh       755
fetch loyalty-backup-notify-email.sh /usr/local/bin/loyalty-backup-notify-email.sh 755
fetch loyalty-backup-notify-github.sh /usr/local/bin/loyalty-backup-notify-github.sh 755

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
  # …which means loyalty-backup.conf.example is NEVER re-applied, so every
  # setting added after the host was provisioned is invisible unless someone
  # says so here. Silent config drift is how you end up with an upgraded alert
  # path that still has nowhere to send anything.
  if ! grep -q '^[[:space:]]*GITHUB_REPO=' "$CONF"; then
    cat <<EOF

  !! DRIFT NOTICE — $CONF predates the GitHub alert transport.
     It has no GITHUB_REPO, so loyalty-backup-notify-github.sh cannot run and
     backup alerts are whatever ALERT_COMMAND was before (email only, or
     nothing at all). This installer never rewrites an existing conf.

     Add, from scripts/evergreen/loyalty-backup.conf.example:
       GITHUB_REPO="thehfhotel/loyalty-app"
       GITHUB_TOKEN="github_pat_…"    # fine-grained, Issues: read and write
       ALERT_COMMAND=/usr/local/bin/loyalty-backup-notify-github.sh

     Then: chmod 600 $CONF && systemctl start loyalty-backup.service

EOF
  fi
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
    sudo ls -lh ${BACKUP_DIR}     # 700, root-owned — without sudo it "does not exist"

Then confirm the dump actually restores — an untested backup is not a backup.
On YOUR machine (which holds the private key). Note the 'sudo cat' — ${BACKUP_DIR}
is mode 700 and root-owned, so scp runs as your unprivileged login, cannot stat
inside it, and fails with a misleading "No such file or directory":
    ssh evergreen 'sudo cat ${BACKUP_DIR}/<dump>.sql.gz.age' > /tmp/restore.sql.gz.age
    age --decrypt --identity ~/.age/loyalty-backup.key /tmp/restore.sql.gz.age \\
      | gunzip | head -20

Set ALERT_COMMAND in ${CONF} so failures reach a human, then re-run this
script or 'systemctl restart loyalty-backup.timer'.
EOF
