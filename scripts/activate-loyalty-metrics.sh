#!/usr/bin/env bash
#
# Activate the loyalty-metrics → hf-analytics dashboard pipeline by
# provisioning the GitHub secrets/variables it needs. Run this LOCALLY — no
# secret is ever printed; values move only between your machine and the GitHub
# API over `gh`.
#
# What it does:
#   1. Generates a fresh `loyalty-metrics` ingest token (openssl rand).
#   2. MERGES it into hf-analytics' INGEST_TOKENS, preserving every existing
#      key (you supply the current JSON, so nothing is clobbered).
#   3. Sets the matching LOYALTY_ANALYTICS_TOKEN secret + LOYALTY_METRICS_URL
#      variable on host-metrics-pusher.
#   4. Optionally re-triggers both deploys.
#
# Prereqs: `gh` (authenticated, with access to both repos), `jq`, `openssl`.
#
# Supplying the current INGEST_TOKENS (gh cannot read secrets back, so the
# merge needs the present value — pick one):
#   - env:   CURRENT_INGEST_TOKENS='{"host-metrics":"…",...}' ./activate-loyalty-metrics.sh
#   - file:  ./activate-loyalty-metrics.sh path/to/ingest_tokens.json
#   - prompt (hidden paste) if neither is given.
#
# Override defaults via env: HF_REPO, PUSHER_REPO, LOYALTY_METRICS_URL, LOYALTY_APP_ID.

set -euo pipefail

HF_REPO="${HF_REPO:-thehfhotel/hf-analytics}"
PUSHER_REPO="${PUSHER_REPO:-thehfhotel/host-metrics-pusher}"
METRICS_URL="${LOYALTY_METRICS_URL:-http://localhost:4011/metrics}"
APP_ID="${LOYALTY_APP_ID:-loyalty-backend}"

for bin in gh jq openssl; do
  command -v "$bin" >/dev/null 2>&1 || { echo "ERROR: '$bin' is required" >&2; exit 1; }
done

# --- obtain the current INGEST_TOKENS to merge into (never via this chat) ---
if [[ -n "${CURRENT_INGEST_TOKENS:-}" ]]; then
  current="$CURRENT_INGEST_TOKENS"
elif [[ -n "${1:-}" && -f "${1:-}" ]]; then
  current="$(cat -- "$1")"
else
  echo "Paste the CURRENT hf-analytics INGEST_TOKENS JSON (input hidden), then Enter."
  echo "If this is the very first source, just press Enter for {}."
  read -rs current
  echo
fi
[[ -z "${current//[[:space:]]/}" ]] && current='{}'

if ! jq -e . >/dev/null 2>&1 <<<"$current"; then
  echo "ERROR: the supplied INGEST_TOKENS is not valid JSON — aborting (nothing changed)." >&2
  exit 1
fi

if jq -e 'has("loyalty-metrics")' >/dev/null 2>&1 <<<"$current"; then
  read -rp "INGEST_TOKENS already has a 'loyalty-metrics' key. Overwrite it? [y/N] " ow
  [[ "$ow" == "y" || "$ow" == "Y" ]] || { echo "Aborted; nothing changed."; exit 0; }
fi

# --- generate + merge ---
TOK="$(openssl rand -hex 32)"
merged="$(jq -c --arg t "$TOK" '. + {"loyalty-metrics": $t}' <<<"$current")"

echo "→ hf-analytics INGEST_TOKENS keys after merge: $(jq -r 'keys | join(", ")' <<<"$merged")"
printf '%s' "$merged" | gh secret set INGEST_TOKENS -R "$HF_REPO"

echo "→ host-metrics-pusher LOYALTY_ANALYTICS_TOKEN (secret)"
printf '%s' "$TOK" | gh secret set LOYALTY_ANALYTICS_TOKEN -R "$PUSHER_REPO"

echo "→ host-metrics-pusher LOYALTY_METRICS_URL=$METRICS_URL (variable)"
gh variable set LOYALTY_METRICS_URL -R "$PUSHER_REPO" --body "$METRICS_URL"
echo "→ host-metrics-pusher LOYALTY_APP_ID=$APP_ID (variable)"
gh variable set LOYALTY_APP_ID -R "$PUSHER_REPO" --body "$APP_ID"

# scrub sensitive locals
unset TOK current merged

echo
echo "Secrets provisioned. Re-deploy both so they pick up the new config:"
read -rp "Trigger both deploys now via workflow_dispatch? [y/N] " yn
if [[ "$yn" == "y" || "$yn" == "Y" ]]; then
  gh workflow run deploy.yml -R "$HF_REPO"     && echo "  dispatched hf-analytics deploy"  || echo "  ! dispatch hf-analytics deploy manually"
  gh workflow run deploy.yml -R "$PUSHER_REPO" && echo "  dispatched pusher deploy"         || echo "  ! dispatch pusher deploy manually"
else
  echo "  gh workflow run deploy.yml -R $HF_REPO"
  echo "  gh workflow run deploy.yml -R $PUSHER_REPO"
fi
echo "Done. The 'แอป Loyalty' page fills in once the pusher's first interval elapses."
