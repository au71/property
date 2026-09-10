#!/usr/bin/env bash
#
# Start the property portal on your own machine.
#
#   ./start.sh
#
# Sets up whatever is not set up yet, then runs the API and the web app
# together. Press Ctrl+C once to stop both. Safe to run repeatedly — it skips
# any step that is already done.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

say()  { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
ok()   { printf '    \033[0;32m%s\033[0m\n' "$1"; }
warn() { printf '    \033[0;33m%s\033[0m\n' "$1"; }
die()  { printf '\n\033[0;31mX  %s\033[0m\n\n' "$1" >&2; exit 1; }

# --- Prerequisites ----------------------------------------------------------

say "Checking prerequisites"

command -v node >/dev/null || die "Node.js is not installed. Get the LTS from https://nodejs.org and run this again."

NODE_MAJOR="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
if (( NODE_MAJOR < 22 )); then
  die "Node $(node -v) is too old; this needs 22 or newer.
   Install the LTS from https://nodejs.org, or with Homebrew:
     brew install node@22 && brew link --overwrite --force node@22"
fi
ok "Node $(node -v)"

# A previous ./start.sh still running holds the SQLite file open, and the
# migration step then dies with a raw "database is locked" stack trace that says
# nothing about the actual cause. Catch it here instead.
port_busy() { curl -fsS --max-time 1 -o /dev/null "http://localhost:$1" 2>/dev/null; }

if port_busy 4000 || port_busy 3000; then
  die "Something is already using port 3000 or 4000 — almost certainly a
   ./start.sh running in another terminal window.

   Switch to that window and press Ctrl+C, then run this again.

   If you cannot find it, this stops them:
     pkill -f 'tsx watch' ; pkill -f 'next dev'"
fi

# --- API --------------------------------------------------------------------

say "Setting up the API"
cd "$ROOT/api"

if [[ ! -f .env ]]; then
  cp .env.example .env
  ok "created api/.env"
else
  ok "api/.env already there"
fi

if [[ ! -d node_modules ]]; then
  warn "installing dependencies, this takes a minute or two..."
  npm install --silent > "$ROOT/setup.log" 2>&1
  ok "dependencies installed"
else
  ok "dependencies already installed"
fi

npm run db:setup --silent > "$ROOT/setup.log" 2>&1
ok "database ready"

# Seeding is the slow step, so only do it when the database is actually empty.
LISTING_COUNT="$(node -e '
  const Database = require("better-sqlite3");
  try {
    const db = new Database("prisma/dev.db", { readonly: true, fileMustExist: true });
    const row = db.prepare("SELECT COUNT(*) AS n FROM Listing").get();
    console.log(row.n);
  } catch { console.log(0); }
' 2>/dev/null || echo 0)"

if [[ "$LISTING_COUNT" -eq 0 ]]; then
  warn "loading sample data, this takes about a minute..."
  npm run db:seed --silent >> "$ROOT/setup.log" 2>&1
  ok "sample data loaded"
else
  ok "sample data already loaded ($LISTING_COUNT listings)"
fi

# --- Web --------------------------------------------------------------------

say "Setting up the web app"
cd "$ROOT/app"

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
  ok "created app/.env.local"
else
  ok "app/.env.local already there"
fi

if [[ ! -d node_modules ]]; then
  warn "installing dependencies, this takes a minute or two..."
  npm install --silent >> "$ROOT/setup.log" 2>&1
  ok "dependencies installed"
else
  ok "dependencies already installed"
fi

# --- Run --------------------------------------------------------------------

say "Starting"

# Job control, so each background job becomes its own process group and `$!` is
# that group's id. Without this, killing $! only kills the `npm` wrapper and
# leaves the actual server it spawned running and holding the port.
set -m

API_PID=""
WEB_PID=""
stopped=0
cleanup() {
  (( stopped )) && return
  stopped=1
  printf '\n\033[1;36m==>\033[0m Stopping...\n'
  # The leading dash targets the whole process group.
  [[ -n "$WEB_PID" ]] && kill -- "-$WEB_PID" 2>/dev/null || true
  [[ -n "$API_PID" ]] && kill -- "-$API_PID" 2>/dev/null || true
  sleep 1
  [[ -n "$WEB_PID" ]] && kill -9 -- "-$WEB_PID" 2>/dev/null || true
  [[ -n "$API_PID" ]] && kill -9 -- "-$API_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  printf '    stopped\n\n'
}
# One Ctrl+C stops both, rather than leaving a server running in the background.
trap cleanup EXIT INT TERM

cd "$ROOT/api"
npm run dev > "$ROOT/api-local.log" 2>&1 &
API_PID=$!

printf '    waiting for the API'
for _ in $(seq 1 60); do
  if curl -fsS --max-time 1 http://localhost:4000/health >/dev/null 2>&1; then
    printf '\n'
    ok "API running on http://localhost:4000"
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    printf '\n'
    echo
    tail -20 "$ROOT/api-local.log" >&2
    die "The API failed to start. The last lines of its log are above (full log: api-local.log)."
  fi
  printf '.'
  sleep 1
done

curl -fsS --max-time 1 http://localhost:4000/health >/dev/null 2>&1 \
  || die "The API did not come up in time. See api-local.log"

cd "$ROOT/app"
npm run dev > "$ROOT/web-local.log" 2>&1 &
WEB_PID=$!

printf '    waiting for the web app'
for _ in $(seq 1 90); do
  if curl -fsS --max-time 2 -o /dev/null http://localhost:3000/ 2>/dev/null; then
    printf '\n'
    ok "Web app running on http://localhost:3000"
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    printf '\n'
    echo
    tail -20 "$ROOT/web-local.log" >&2
    die "The web app failed to start. The last lines of its log are above (full log: web-local.log)."
  fi
  printf '.'
  sleep 1
done

cat <<'BANNER'

  ────────────────────────────────────────────────────────────

    Open   http://localhost:3000

    Sign in with any of these — password is  Password123!

      owner1@property.test    post and manage listings
      staff@property.test     the moderation queue
      admin@property.test     everything
      buyer1@property.test    the buyer side

    Logs      api-local.log  and  web-local.log
    To stop   press Ctrl+C

  ────────────────────────────────────────────────────────────

BANNER

# Hold the terminal open until Ctrl+C; the trap above stops both servers.
wait
