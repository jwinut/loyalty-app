#!/usr/bin/env bash
#
# GitHub-issue transport for loyalty backup alerts. Set it as ALERT_COMMAND in
# /etc/loyalty-backup.conf; the alert text arrives on stdin.
#
#   ALERT_COMMAND=/usr/local/bin/loyalty-backup-notify-github.sh
#
# WHY THIS EXISTS (#366). The only transport this repo shipped before sent mail
# through info@saichon.com — the same mailbox whose lapsed subscription caused
# #352, and the same mailbox the app's password resets ride on. A mail outage
# therefore suppressed its own alarm: the backup failed, LAST-FAILURE was
# written, the journal recorded it, and nothing left the host. GitHub is already
# where "Production deploy failed" and "outbound mail is failing" land, it does
# not share fate with the mailbox, and it de-duplicates instead of piling up one
# message per night.
#
# Two directions, selected by LOYALTY_ALERT_KIND (exported by
# loyalty-backup-alert.sh, never taken from argv — ALERT_COMMAND is a free-form
# shell string and an appended word would land on its LAST command):
#
#   failure    create the issue, or comment on the one already open
#   recovered  comment on the open issue and CLOSE it
#
# Anything else (including unset) is treated as `failure`: failing toward
# alerting is the only safe default.
#
# ############################################################################
# ##  THIS REPOSITORY IS PUBLIC. EVERY ISSUE BODY AND COMMENT WRITTEN HERE   ##
# ##  IS WORLD-READABLE, FOREVER, INCLUDING BY SEARCH ENGINES.               ##
# ##                                                                         ##
# ##  The body below is deliberately limited to facts that are ALREADY       ##
# ##  public in this repository: the host name, the unit name, timestamps,   ##
# ##  the paths that scripts/evergreen/ already documents, and the alert     ##
# ##  text this project generates itself. NEVER extend it with journal       ##
# ##  excerpts, `docker inspect` / container environment, connection         ##
# ##  strings, database names, user counts, dump contents, or the age key.   ##
# ##  If you need any of that to debug, read it on the host — the issue      ##
# ##  tells the operator exactly which commands to run.                      ##
# ############################################################################
#
# Transport is curl against the REST API: evergreen has no MTA and no `gh`, and
# this keeps the dependency list at curl (jq is optional, see below).

set -euo pipefail
# Belt and braces, and it must come before the config file is read: if this ever
# runs from a shell with xtrace inherited (`bash -x`, or SHELLOPTS=xtrace in the
# environment) every expansion is echoed to the journal — including the PAT.
set +x
# Everything this script creates (temp dir, curl config, issue-state file) holds
# or touches the token, so default to owner-only from the first byte rather than
# creating world-readable and chmod-ing afterwards.
umask 077

# The caller's intent, captured BEFORE the config file is sourced so a stray
# assignment in /etc/loyalty-backup.conf cannot override it.
ALERT_KIND="${LOYALTY_ALERT_KIND:-failure}"
case "$ALERT_KIND" in
  failure|recovered) ;;
  *) ALERT_KIND=failure ;;
esac

ALERT_UNIT="${LOYALTY_ALERT_UNIT:-loyalty-backup.service}"
ALERT_LAST_SUCCESS_AGE="${LOYALTY_ALERT_LAST_SUCCESS_AGE:-unknown}"

CONFIG_FILE="${LOYALTY_BACKUP_CONFIG:-/etc/loyalty-backup.conf}"
# shellcheck source=/dev/null
[ -r "$CONFIG_FILE" ] && . "$CONFIG_FILE"

: "${BACKUP_DIR:=/srv/backups/loyalty}"
: "${GITHUB_API_BASE:=https://api.github.com}"
# NO COLON IN THIS TITLE. The search fallback below goes through GitHub's search
# API, where `word:` is read as a qualifier — a colon makes the query silently
# match nothing, which files a brand new duplicate issue on every single run.
: "${GITHUB_ISSUE_TITLE:=Production backup failed on evergreen}"
: "${GITHUB_REPO:?GITHUB_REPO is not set in ${CONFIG_FILE} (expected owner/repo)}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is not set in ${CONFIG_FILE} (fine-grained PAT with Issues: read and write)}"

GITHUB_API_BASE="${GITHUB_API_BASE%/}"
STATE_FILE="${BACKUP_DIR}/.github-alert-issue"
HOST="$(hostname 2>/dev/null || echo 'unknown-host')"
WHEN="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

log()  { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
warn() { log "WARNING: $*" >&2; }
die()  { log "ERROR: $*" >&2; exit 1; }

# A credential problem is not a transient problem, and it is the one failure
# mode that makes this whole transport useless without changing anything the
# operator can see. Say so at maximum volume, in the journal, with words worth
# grepping for.
loud() {
  printf '%s\n' "$@" >&2
  if command -v systemd-cat >/dev/null 2>&1; then
    printf '%s\n' "$@" | systemd-cat -t loyalty-backup -p err || true
  fi
}

case "$GITHUB_REPO" in
  */*/*|/*|*/) die "GITHUB_REPO='${GITHUB_REPO}' is not owner/repo" ;;
  */*)         ;;
  *)           die "GITHUB_REPO='${GITHUB_REPO}' is not owner/repo" ;;
esac

case "$GITHUB_ISSUE_TITLE" in
  *:*) warn "GITHUB_ISSUE_TITLE contains a colon; GitHub search reads 'word:' as a qualifier, so the de-dupe fallback will not match it" ;;
esac

RAW_ALERT="$(cat || true)"
[ -n "$RAW_ALERT" ] || RAW_ALERT='(no alert text received on stdin)'

# -----------------------------------------------------------------------------
# Workspace. The PAT is written into a curl config file inside a private temp
# directory and NEVER passed as an argument: /proc/<pid>/cmdline is readable by
# any process of the same user, which is exactly the defect email-canary.yml
# calls out in loyalty-backup-notify-email.sh's `--user` flag.
# -----------------------------------------------------------------------------
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
CURL_CFG="${WORKDIR}/curlrc"
RESP="${WORKDIR}/response.json"
CURL_ERR="${WORKDIR}/curl.err"
PAYLOAD="${WORKDIR}/payload.json"

# curl's config syntax takes a double-quoted value, so backslash and quote are
# escaped here. printf is a shell BUILTIN — the token never becomes an argument
# to an external process, and never reaches any log.
esc_token="${GITHUB_TOKEN//\\/\\\\}"
esc_token="${esc_token//\"/\\\"}"
printf 'header = "Authorization: Bearer %s"\n' "$esc_token" > "$CURL_CFG"
chmod 600 "$CURL_CFG"
# Drop the token from this shell entirely. It is deliberately never exported:
# an exported value would be inherited by curl and visible in
# /proc/<pid>/environ for the life of every request.
unset esc_token GITHUB_TOKEN

HAVE_JQ=0
command -v jq >/dev/null 2>&1 && HAVE_JQ=1

# -----------------------------------------------------------------------------
# JSON — building (jq preferred) and parsing (never jq).
#
# jq is used ONLY to build request bodies. That is the dangerous half: the body
# carries arbitrary multi-line operator-supplied text, and one unescaped quote
# turns a 201 into a 422 at 3am. The pure-bash escaper below is a real fallback,
# not a stub — evergreen may not have jq, and an alert that depends on an
# optional package is not an alert.
# -----------------------------------------------------------------------------
json_escape() {  # -> a complete JSON string literal, quotes included
  local s="$1"
  # Byte-wise: with LC_ALL=C the ranges below are byte ranges and any UTF-8
  # sequence passes through untouched instead of tripping over the locale.
  local LC_ALL=C
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  s="${s//$'\n'/\\n}"
  # Any remaining C0 control byte is illegal raw inside a JSON string.
  case "$s" in
    *[$'\001'-$'\010'$'\013'$'\014'$'\016'-$'\037']*)
      local out='' i ch
      for (( i = 0; i < ${#s}; i++ )); do
        ch="${s:i:1}"
        case "$ch" in
          [$'\001'-$'\010'$'\013'$'\014'$'\016'-$'\037']) printf -v ch '\\u%04x' "'$ch" ;;
        esac
        out="${out}${ch}"
      done
      s="$out"
      ;;
  esac
  printf '"%s"' "$s"
}

json_object() {  # json_object KEY VALUE [KEY VALUE ...] -> stdout (all strings)
  if [ "$HAVE_JQ" -eq 1 ]; then
    jq -n --args '
      $ARGS.positional as $a
      | reduce range(0; ($a | length); 2) as $i ({}; . + { ($a[$i]): $a[$i + 1] })
    ' "$@"
    return
  fi
  local out='{' first=1
  while [ "$#" -ge 2 ]; do
    if [ "$first" -eq 0 ]; then out="${out},"; fi
    first=0
    out="${out}$(json_escape "$1"):$(json_escape "$2")"
    shift 2
  done
  printf '%s}\n' "$out"
}

# Responses are parsed with grep, which is safe ONLY because every request below
# asks for exactly ONE object: per_page=1 for the search, a single issue
# everywhere else. In a single issue object GitHub emits `number` and `state`
# before any nested object that could repeat those keys, so "first match wins"
# is correct.
#
# *** RAISING per_page BREAKS THIS AND YOU MUST SWITCH TO jq. *** With two items
# in the array, item 1's `milestone.number` precedes item 2's own `number`, and
# the first match would be the wrong issue. If more than one result is ever
# needed, make jq REQUIRED and parse `.items[0].number`.
#
# `sed -n 1p` rather than `head -n1`: head closes the pipe early, grep dies with
# SIGPIPE, and `set -o pipefail` would turn that into a script-killing failure.
json_first_number() {  # json_first_number KEY FILE
  grep -oE "\"$1\"[[:space:]]*:[[:space:]]*[0-9]+" "$2" 2>/dev/null \
    | sed -n '1p' | grep -oE '[0-9]+$' || true
}

json_first_string() {  # json_first_string KEY FILE
  grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$2" 2>/dev/null \
    | sed -n '1p' | sed -E 's/^.*:[[:space:]]*"//; s/"$//' || true
}

# -----------------------------------------------------------------------------
# One API call, with retries for the failures that are worth retrying.
#
# Extra curl arguments (the search query string) come in through API_EXTRA so
# the retry/classification logic exists exactly once. Sets API_STATUS; returns 0
# when a definitive HTTP status was obtained (the caller decides what 404 means),
# 1 when every attempt was a transport error / 5xx / 429. A rejected credential
# exits the script outright — see below.
# -----------------------------------------------------------------------------
API_EXTRA=()
API_STATUS=''

api() {  # api METHOD URL [PAYLOAD_FILE]
  local method="$1" url="$2" payload="${3:-}"
  local attempt=0 delay status rc
  local -a args

  for delay in 0 3 9; do
    attempt=$(( attempt + 1 ))
    if [ "$delay" -gt 0 ]; then
      log "retrying ${method} in ${delay}s (attempt ${attempt}/3)"
      sleep "$delay"
    fi

    args=(
      --silent --show-error
      --config "$CURL_CFG"
      --header 'Accept: application/vnd.github+json'
      --header 'X-GitHub-Api-Version: 2022-11-28'
      --user-agent 'loyalty-backup-notify-github'
      # Per call, not per script: a wedged TLS handshake must not hold the
      # backup unit's failure handler open until systemd kills it.
      --connect-timeout 10 --max-time 25
      --request "$method"
      --output "$RESP"
      --write-out '%{http_code}'
    )
    # NEVER --verbose here: a verbose trace prints the request headers, and the
    # Authorization header IS the token.
    [ "${#API_EXTRA[@]}" -eq 0 ] || args+=("${API_EXTRA[@]}")
    if [ -n "$payload" ]; then
      args+=(--header 'Content-Type: application/json' --data-binary "@${payload}")
    fi
    args+=("$url")

    : > "$RESP"
    : > "$CURL_ERR"
    rc=0
    status="$(curl "${args[@]}" 2>"$CURL_ERR")" || rc=$?
    [ -n "$status" ] || status='000'

    case "$status" in
      401|403)
        loud \
          "################################################################" \
          "## BACKUP ALERTS ARE NOT REACHING GITHUB                      ##" \
          "################################################################" \
          "The GitHub API rejected the credential with HTTP ${status}." \
          "Until GITHUB_TOKEN in ${CONFIG_FILE} is fixed, every backup failure" \
          "on ${HOST} is invisible outside this host: the only remaining record" \
          "is ${BACKUP_DIR}/LAST-FAILURE and the local journal, and nobody" \
          "watches those (that is the entire reason this transport exists)." \
          "Fix: mint a fine-grained PAT for ${GITHUB_REPO} with Issues: read and" \
          "write, put it in ${CONFIG_FILE} (mode 600), and re-run" \
          "'systemctl start loyalty-backup.service'. See docs/restore-runbook.md." \
          "Not retrying: a rejected credential does not start working on attempt 2." \
          "(HTTP 403 can also be a secondary rate limit; the response body above" \
          "says which, and a rate limit clears on its own.)"
        sed -n '1,5p' "$RESP" >&2 || true
        exit 1
        ;;
      000|429|5??)
        warn "${method} ${url} -> HTTP ${status} (curl exit ${rc})"
        sed -n '1,3p' "$CURL_ERR" >&2 || true
        if [ "$attempt" -ge 3 ]; then break; fi
        continue
        ;;
      *)
        API_STATUS="$status"
        return 0
        ;;
    esac
  done

  API_STATUS="$status"
  warn "${method} ${url} gave up after ${attempt} attempts (last HTTP ${status})"
  return 1
}

# -----------------------------------------------------------------------------
# Issue de-dupe. Local state first, search only as a fallback.
#
# The state file is the primary index because a GET of a known issue number hits
# GitHub's primary database and is always current, whereas the search index lags
# by seconds to minutes — long enough for two consecutive nightly failures to
# each conclude "nothing open" and file a duplicate. Search still earns its keep
# for the cases the state file cannot cover: BACKUP_DIR rebuilt, the host
# reinstalled, or the issue opened by hand.
# -----------------------------------------------------------------------------
read_state_issue() {
  local n
  [ -r "$STATE_FILE" ] || return 0
  n="$(tr -cd '0-9' < "$STATE_FILE" 2>/dev/null || true)"
  printf '%s' "$n"
}

write_state_issue() {
  mkdir -p "$BACKUP_DIR" 2>/dev/null || true
  if printf '%s\n' "$1" > "$STATE_FILE" 2>/dev/null; then
    chmod 600 "$STATE_FILE" 2>/dev/null || true
  else
    warn "could not write ${STATE_FILE}; de-dupe will fall back to the search API"
  fi
}

ISSUE=''
UNCERTAIN=0

CACHED="$(read_state_issue)"
if [ -n "$CACHED" ]; then
  API_EXTRA=()
  if api GET "${GITHUB_API_BASE}/repos/${GITHUB_REPO}/issues/${CACHED}"; then
    case "$API_STATUS" in
      200)
        STATE="$(json_first_string state "$RESP")"
        case "$STATE" in
          open)
            ISSUE="$CACHED"
            log "issue #${CACHED} from ${STATE_FILE} is still open"
            ;;
          closed)
            log "issue #${CACHED} from ${STATE_FILE} is closed; forgetting it"
            rm -f "$STATE_FILE"
            ;;
          *)
            warn "could not read the state of issue #${CACHED} from the response"
            UNCERTAIN=1
            ;;
        esac
        ;;
      404|410)
        log "issue #${CACHED} from ${STATE_FILE} no longer exists; forgetting it"
        rm -f "$STATE_FILE"
        ;;
      *)
        warn "unexpected HTTP ${API_STATUS} looking up issue #${CACHED}"
        UNCERTAIN=1
        ;;
    esac
  else
    UNCERTAIN=1
  fi
fi

if [ -z "$ISSUE" ]; then
  # per_page=1 — see the parser comment above before touching this.
  API_EXTRA=(
    --get
    --data-urlencode "q=repo:${GITHUB_REPO} is:issue is:open in:title \"${GITHUB_ISSUE_TITLE}\""
    --data-urlencode 'per_page=1'
  )
  if api GET "${GITHUB_API_BASE}/search/issues" && [ "$API_STATUS" = '200' ]; then
    FOUND="$(json_first_number number "$RESP")"
    if [ -n "$FOUND" ]; then
      ISSUE="$FOUND"
      log "search found open issue #${ISSUE}"
      write_state_issue "$ISSUE"
    fi
  else
    warn "issue search failed (HTTP ${API_STATUS:-none})"
    UNCERTAIN=1
  fi
  API_EXTRA=()
fi

# -----------------------------------------------------------------------------
# Bodies. printf rather than a heredoc so the markdown fences stay literal
# backticks with no escaping games, and so nothing in the text can be taken as
# shell.
# -----------------------------------------------------------------------------
LAST_SUCCESS_LINE="$(cat "${BACKUP_DIR}/last-success" 2>/dev/null || true)"
[ -n "$LAST_SUCCESS_LINE" ] || LAST_SUCCESS_LINE='(none recorded)'

# SC2016 is disabled across these builders on purpose: the single quotes are
# what keep markdown's backticks and $-signs literal, and every value that
# should expand is passed as a printf argument instead.
# shellcheck disable=SC2016
emit_facts() {  # $1 = label for the timestamp row
  printf '| | |\n'
  printf '| --- | --- |\n'
  printf '| Host | `%s` |\n' "$HOST"
  printf '| Unit | `%s` |\n' "$ALERT_UNIT"
  printf '| %s (UTC) | `%s` |\n' "$1" "$WHEN"
  printf '| Last successful backup | `%s` |\n' "$ALERT_LAST_SUCCESS_AGE"
  printf '| last-success | `%s` |\n' "$LAST_SUCCESS_LINE"
  printf '| Failure marker | `%s/LAST-FAILURE` |\n' "$BACKUP_DIR"
}

# shellcheck disable=SC2016
emit_raw_alert() {
  printf '<details><summary>Raw alert text</summary>\n\n'
  # FOUR backticks: the alert text is not guaranteed to be free of three, and a
  # three-backtick fence would be terminated early by the payload it is fencing.
  printf '````\n%s\n````\n\n' "$RAW_ALERT"
  printf '</details>\n'
}

# shellcheck disable=SC2016
emit_public_warning() {
  printf -- '---\n\n'
  printf 'Filed automatically by `scripts/evergreen/loyalty-backup-notify-github.sh` on `%s`. It comments here on every further failure and **closes this issue by itself** after the next successful backup.\n\n' "$HOST"
  printf '**This repository is PUBLIC and everything in this thread is world-readable.** Keep journal excerpts, container environment, connection strings and dump contents on the host — the commands above are there so you never need to paste any of it here.\n'
}

# shellcheck disable=SC2016
build_failure_body() {
  if [ -n "$ISSUE" ]; then
    printf '**The nightly production backup failed again.** Still no new dump.\n\n'
  else
    printf '**The nightly production backup FAILED.** There is no new dump for tonight; the newest restorable dump is the one below.\n\n'
  fi
  emit_facts 'Failed at'
  printf '\n### Triage, on the host\n\n'
  printf '```sh\n'
  printf 'journalctl -u %s -n 100 --no-pager\n' "$ALERT_UNIT"
  printf 'systemctl status %s\n' "$ALERT_UNIT"
  printf 'ls -lh %s\n' "$BACKUP_DIR"
  printf 'sudo systemctl start loyalty-backup.service   # retry the backup now\n'
  printf '```\n\n'
  printf 'Restore procedure: `docs/restore-runbook.md`.\n\n'
  emit_raw_alert
  printf '\n'
  emit_public_warning
}

# shellcheck disable=SC2016
build_recovery_body() {
  printf '**Backups are working again.** A run completed and verified a new dump, so this alert is resolved and the issue is being closed automatically.\n\n'
  emit_facts 'Recovered at'
  printf '\n'
  printf 'The failure marker `%s/LAST-FAILURE` has been cleared. If backups fail again a fresh issue is filed (or this one is reopened by hand and commented on).\n\n' "$BACKUP_DIR"
  emit_raw_alert
  printf '\n'
  emit_public_warning
}

post_comment() {  # post_comment ISSUE BODY
  json_object body "$2" > "$PAYLOAD"
  API_EXTRA=()
  if api POST "${GITHUB_API_BASE}/repos/${GITHUB_REPO}/issues/${1}/comments" "$PAYLOAD" \
     && [ "$API_STATUS" = '201' ]; then
    return 0
  fi
  warn "commenting on issue #${1} failed (HTTP ${API_STATUS:-none})"
  sed -n '1,5p' "$RESP" >&2 || true
  return 1
}

# -----------------------------------------------------------------------------
# Dispatch.
# -----------------------------------------------------------------------------
case "$ALERT_KIND" in
  failure)
    BODY="$(build_failure_body)"
    if [ -n "$ISSUE" ]; then
      post_comment "$ISSUE" "$BODY" || die "could not report the backup failure to GitHub"
      log "commented on issue #${ISSUE} (${GITHUB_REPO})"
      write_state_issue "$ISSUE"
      exit 0
    fi

    # No open issue found — and if the lookup itself was inconclusive we create
    # anyway. A duplicate issue costs one click; a 3am alert that was never
    # filed because a search API hiccuped costs a database.
    if [ "$UNCERTAIN" -eq 1 ]; then
      warn "could not confirm whether an issue is already open; creating one rather than risking a lost alert"
    fi
    json_object title "$GITHUB_ISSUE_TITLE" body "$BODY" > "$PAYLOAD"
    API_EXTRA=()
    if api POST "${GITHUB_API_BASE}/repos/${GITHUB_REPO}/issues" "$PAYLOAD" \
       && [ "$API_STATUS" = '201' ]; then
      NEW="$(json_first_number number "$RESP")"
      [ -n "$NEW" ] || NEW='?'
      log "filed issue #${NEW} on ${GITHUB_REPO}"
      [ "$NEW" = '?' ] || write_state_issue "$NEW"
      exit 0
    fi
    sed -n '1,5p' "$RESP" >&2 || true
    die "could not file the backup failure issue (HTTP ${API_STATUS:-none})"
    ;;

  recovered)
    if [ -z "$ISSUE" ]; then
      if [ "$UNCERTAIN" -eq 1 ]; then
        # Exiting non-zero makes loyalty-backup-alert.sh KEEP LAST-FAILURE, so
        # tomorrow's successful run tries again. An issue left open forever
        # because one lookup failed is exactly the stale-signal problem #366 is
        # about.
        die "could not determine whether an alert issue is open; leaving the failure marker in place so the next run retries"
      fi
      log "no open '${GITHUB_ISSUE_TITLE}' issue to close — nothing to do"
      exit 0
    fi

    BODY="$(build_recovery_body)"
    post_comment "$ISSUE" "$BODY" || die "could not comment the recovery on issue #${ISSUE}"

    json_object state closed state_reason completed > "$PAYLOAD"
    API_EXTRA=()
    if api PATCH "${GITHUB_API_BASE}/repos/${GITHUB_REPO}/issues/${ISSUE}" "$PAYLOAD" \
       && [ "$API_STATUS" = '200' ]; then
      log "commented and closed issue #${ISSUE} (${GITHUB_REPO})"
      rm -f "$STATE_FILE"
      exit 0
    fi
    sed -n '1,5p' "$RESP" >&2 || true
    die "commented on issue #${ISSUE} but could not close it (HTTP ${API_STATUS:-none})"
    ;;
esac
