#!/usr/bin/env bash
#
# Rebuild a working sandbox from a fresh clone, end to end.
#
# WHY THIS FILE EXISTS
# On 2026-08-04 the sandbox was reset. The code survived because it was pushed to
# GitHub; everything around it did not. MySQL was gone, node_modules was gone, the
# runtime env file was gone, and the seed script's input file was gone. Rebuilding
# by hand took an evening and turned up three defects in committed migration
# history along the way. Anything that lives only in a sandbox is one reset from
# gone, so the whole sequence lives here instead.
#
# SECRETS: this file contains NO secret values and must never contain any. Every
# credential is read from the environment. On a Manus sandbox they are injected
# automatically from the secrets store; elsewhere, export them before running.
#
# USAGE
#   bash scripts/bootstrap-sandbox.sh            # full rebuild, preserves existing DB
#   RESET_DB=1 bash scripts/bootstrap-sandbox.sh # drop and rebuild the database
#   SKIP_SEED=1 bash scripts/bootstrap-sandbox.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
ok()   { printf '    \033[0;32mok\033[0m %s\n' "$1"; }
warn() { printf '    \033[0;33mwarn\033[0m %s\n' "$1"; }
die()  { printf '    \033[0;31mfail\033[0m %s\n' "$1"; exit 1; }

# ─── 1. Secrets ──────────────────────────────────────────────────────────────
# Required vs optional is a real distinction: the app cannot generate a script
# without OpenAI, but it degrades honestly without VidIQ. Failing on an optional
# key would block a rebuild for no reason; silently ignoring a required one would
# produce a server that boots and then 500s on first use.
step "Checking secrets (values are never printed)"

REQUIRED=(OPENAI_API_KEY JWT_SECRET)
OPTIONAL=(SUPADATA_API_KEY VIDIQ_API_KEY OWNER_OPEN_ID OWNER_NAME)

missing=()
for k in "${REQUIRED[@]}"; do
  if [ -z "${!k:-}" ]; then missing+=("$k"); else ok "$k present"; fi
done
if [ ${#missing[@]} -gt 0 ]; then
  die "missing required secrets: ${missing[*]} — export them or enable them in the secrets store"
fi

for k in "${OPTIONAL[@]}"; do
  if [ -z "${!k:-}" ]; then
    warn "$k absent — continuing"
    # VidIQ is the primary outlier source for research-first generation, with
    # Supadata trending as fallback. Without it the research path still runs but
    # in degraded mode, and scripts generated this way must not be presented as
    # fully grounded.
    if [ "$k" = "VIDIQ_API_KEY" ]; then
      warn "  research-first generation will run in DEGRADED MODE (Supadata fallback only)"
    fi
  else
    ok "$k present"
  fi
done

# ─── 2. Database URL ─────────────────────────────────────────────────────────
# Prefer an injected DATABASE_URL over inventing one. On a Manus sandbox the
# platform injects a localhost URL; matching MySQL to it is less fragile than
# writing a different URL and then fighting the platform's value.
step "Resolving DATABASE_URL"
if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="mysql://root:${MYSQL_ROOT_PASSWORD:-password}@localhost:3306/${MYSQL_DATABASE:-webdev_db}"
  warn "DATABASE_URL was unset; defaulted to a local MySQL URL"
else
  ok "using injected DATABASE_URL"
fi

# Parse the URL rather than assuming defaults, so a changed password or db name
# in the injected value is honoured instead of silently ignored.
DB_USER="$(node -e 'const u=new URL(process.env.DATABASE_URL);process.stdout.write(decodeURIComponent(u.username||"root"))')"
DB_PASS="$(node -e 'const u=new URL(process.env.DATABASE_URL);process.stdout.write(decodeURIComponent(u.password||""))')"
DB_NAME="$(node -e 'const u=new URL(process.env.DATABASE_URL);process.stdout.write(u.pathname.replace(/^\//,"")||"webdev_db")')"
DB_PORT="$(node -e 'const u=new URL(process.env.DATABASE_URL);process.stdout.write(u.port||"3306")')"
ok "database=$DB_NAME user=$DB_USER port=$DB_PORT"

# ─── 3. MySQL ────────────────────────────────────────────────────────────────
step "Ensuring MySQL server is installed and running"
if ! command -v mysqld >/dev/null 2>&1; then
  warn "mysqld not found — installing mysql-server (this takes ~2 min)"
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mysql-server >/dev/null
  ok "mysql-server installed"
else
  ok "mysqld already installed"
fi

sudo service mysql start >/dev/null 2>&1 || true
for i in $(seq 1 30); do
  if sudo mysqladmin ping >/dev/null 2>&1; then break; fi
  sleep 1
done
sudo mysqladmin ping >/dev/null 2>&1 || die "MySQL did not come up"
ok "MySQL responding"

# Align the root credential with DATABASE_URL. A fresh apt install uses
# auth_socket for root, which mysql2 cannot use, so this must be explicit.
sudo mysql -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}'; FLUSH PRIVILEGES;" 2>/dev/null \
  || warn "could not reset ${DB_USER} credential (may already match)"

if [ "${RESET_DB:-0}" = "1" ]; then
  warn "RESET_DB=1 — dropping database ${DB_NAME}"
  mysql -u"$DB_USER" -p"$DB_PASS" -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`;" 2>/dev/null
fi

# utf8mb3 default matches how the original database was created, so the schema is
# built the same way it was. Step 6 then converts the Script Factory text columns
# to utf8mb4 — see convert-utf8mb4.mjs for why that split matters.
mysql -u"$DB_USER" -p"$DB_PASS" -e \
  "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb3;" 2>/dev/null
ok "database ${DB_NAME} exists (default charset utf8mb3)"

# ─── 4. Dependencies ────────────────────────────────────────────────────────
step "Installing dependencies"
if [ ! -d node_modules ]; then
  pnpm install --silent
  ok "pnpm install complete"
else
  ok "node_modules present — skipping (delete it to force reinstall)"
fi

# ─── 5. Schema ──────────────────────────────────────────────────────────────
# DELIBERATELY `push`, NOT `migrate`.
#
# The committed migration chain cannot rebuild this database. Verified on
# 2026-08-04, three independent defects:
#   1. 0114 does ALTER TABLE video_jobs MODIFY COLUMN vj_status, but that column
#      has never existed (0113 and schema.ts both name it video_job_status).
#   2. Hand-written migrations (0113, 0115) lack --> statement-breakpoint markers,
#      so marker-based splitting sends MySQL concatenated statements.
#   3. Seven .sql files named in the journal were never committed (0116-0122),
#      so 0123 fails with ER_NO_SUCH_TABLE on youtube_pipeline_videos — and the
#      Script Factory migrations come after 0123.
# drizzle/schema.ts IS authoritative and complete, so generating DDL from it is
# both correct and the only thing that works. See docs/defects/ for the writeup.
#
# push needs an EMPTY database: with partially-applied tables present its column
# conflict resolver demands a TTY, and --force does not answer that prompt.
step "Building schema from drizzle/schema.ts"
TABLE_COUNT="$(mysql -u"$DB_USER" -p"$DB_PASS" -N -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null || echo 0)"

if [ "$TABLE_COUNT" -gt 0 ] && [ "${RESET_DB:-0}" != "1" ]; then
  ok "${TABLE_COUNT} tables already present — skipping push (use RESET_DB=1 to rebuild)"
else
  npx drizzle-kit push --force
  TABLE_COUNT="$(mysql -u"$DB_USER" -p"$DB_PASS" -N -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null)"
  ok "schema built: ${TABLE_COUNT} tables"
fi

# Assert the v2.3 lineage columns rather than trusting the push exit code. If
# these are missing the Regenerate group silently disables itself, which is a
# confusing way to discover a schema problem.
LINEAGE="$(mysql -u"$DB_USER" -p"$DB_PASS" -N -e "
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema='${DB_NAME}' AND table_name='script_factory_outputs'
    AND column_name IN ('parent_script_id','variant_label','variant_of_root_id','generation_params','section_history');" 2>/dev/null)"
[ "$LINEAGE" = "5" ] || die "script_factory_outputs is missing v2.3 lineage columns (found ${LINEAGE}/5)"
ok "v2.3 lineage columns present (5/5)"

# ─── 6. Charset ─────────────────────────────────────────────────────────────
step "Converting Script Factory text columns to utf8mb4"
node scripts/convert-utf8mb4.mjs

# ─── 7. Seed ────────────────────────────────────────────────────────────────
if [ "${SKIP_SEED:-0}" = "1" ]; then
  warn "SKIP_SEED=1 — not seeding"
else
  step "Seeding sales page, offer profile and persona"
  node scripts/seed-sandbox.mjs
fi

# ─── 8. Boot ────────────────────────────────────────────────────────────────
# ALLOW_DEV_LOGIN mints a session cookie directly, bypassing the OAuth portal,
# which rejects ad-hoc sandbox redirect URLs. Gated on NODE_ENV=development in
# server/_core/devLogin.ts so it cannot be reached in production.
step "Runtime configuration"
export NODE_ENV="${NODE_ENV:-development}"
export ALLOW_DEV_LOGIN="${ALLOW_DEV_LOGIN:-true}"
export PORT="${PORT:-3001}"
ok "NODE_ENV=$NODE_ENV ALLOW_DEV_LOGIN=$ALLOW_DEV_LOGIN PORT=$PORT"

cat <<EOF

Bootstrap complete.

  Start the server:   PORT=$PORT ALLOW_DEV_LOGIN=true NODE_ENV=development pnpm dev
  Then authenticate:  <url>/api/dev/login
  Demo scripts:       node scripts/seed-demo.mjs   (generates 2 scripts + 1 variant)

EOF
