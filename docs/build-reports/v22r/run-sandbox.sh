#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# v2.2 SANDBOX LAUNCHER — Part 2
#
# Boots the real Content Hub app for hands-on testing, with three guarantees:
#
#   1. DATABASE_URL is REWRITTEN to the scratch clone (contenthub_v22_sandbox).
#      Staging is never opened by the app, so no click can mutate it.
#   2. SANDBOX_MODE=1, which disables the weekly digest cron and the upload
#      watchdog (see server/_core/index.ts). The watchdog can resume a REAL
#      YouTube upload to the live channel; that must not fire from a test build.
#   3. Nothing is written to .env. The overrides are process-scoped only.
#
# The app still uses the real third-party API keys, because there is no separate
# test key set. Read paths (vidIQ, Claude, DataForSEO) are therefore live and
# will spend real credits. Write paths to the outside world are what SANDBOX_MODE
# shuts off.
#
# Usage:  bash docs/build-reports/v22r/run-sandbox.sh
# Logs:   /tmp/v22-sandbox.log
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/../../.."
ROOT="$(pwd)"
SCRATCH_DB="contenthub_v22_sandbox"
PORT="${PORT:-4100}"

if [[ ! -f .env ]]; then
  echo "FATAL: .env not found at $ROOT" >&2
  exit 1
fi

# Read DATABASE_URL without printing it, and swap ONLY the database name.
# Using python keeps the password out of the process list and out of the log.
SANDBOX_DB_URL="$(
  python3 - "$SCRATCH_DB" <<'PY'
import re, sys, urllib.parse
scratch = sys.argv[1]
text = open(".env", encoding="utf-8").read()
m = re.search(r'^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?', text, re.M)
if not m:
    sys.exit("DATABASE_URL not found in .env")
parsed = urllib.parse.urlparse(m.group(1).strip())
if not parsed.path.lstrip("/"):
    sys.exit("DATABASE_URL has no database component")
print(urllib.parse.urlunparse(parsed._replace(path="/" + scratch)))
PY
)"

# Fail loudly rather than silently booting against staging.
case "$SANDBOX_DB_URL" in
  *"/$SCRATCH_DB") : ;;
  *) echo "FATAL: rewritten URL does not target $SCRATCH_DB — refusing to start." >&2; exit 1 ;;
esac
echo "[sandbox] DATABASE_URL rewritten to .../$SCRATCH_DB (staging untouched)"
echo "[sandbox] SANDBOX_MODE=1 — digest cron + upload watchdog disabled"
echo "[sandbox] port $PORT · logs /tmp/v22-sandbox.log"

pkill -f "tsx watch server/_core/index.ts" 2>/dev/null || true
sleep 1

DATABASE_URL="$SANDBOX_DB_URL" \
SANDBOX_MODE=1 \
PORT="$PORT" \
NODE_ENV=development \
ALLOW_DEV_LOGIN=true \
  nohup pnpm tsx watch server/_core/index.ts > /tmp/v22-sandbox.log 2>&1 &

echo "[sandbox] pid $! — tail /tmp/v22-sandbox.log to watch startup"
