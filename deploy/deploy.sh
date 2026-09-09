#!/usr/bin/env bash
#
# Deploy the property portal. Run as the `property` user:
#
#   sudo -u property /srv/property/deploy/deploy.sh
#
# Flags:
#   --skip-pull        build what is already checked out
#   --seed-taxonomy    load reference data (safe, idempotent, skips if present)
#   --seed-demo        load ~300 fake listings — NEVER on production
#
set -euo pipefail

APP_ROOT="${APP_ROOT:-/srv/property}"
BRANCH="${BRANCH:-main}"

SKIP_PULL=0
SEED_TAXONOMY=0
SEED_DEMO=0
for arg in "$@"; do
  case "$arg" in
    --skip-pull) SKIP_PULL=1 ;;
    --seed-taxonomy) SEED_TAXONOMY=1 ;;
    --seed-demo) SEED_DEMO=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

cd "$APP_ROOT"

if [[ $SKIP_PULL -eq 0 ]]; then
  echo "==> Fetching $BRANCH"
  git fetch --quiet origin "$BRANCH"
  PREVIOUS="$(git rev-parse HEAD)"
  git reset --hard "origin/$BRANCH" --quiet
  echo "    $PREVIOUS -> $(git rev-parse --short HEAD)"
  # Remembered so a failed deploy can be rolled back by hand.
  echo "$PREVIOUS" > "$APP_ROOT/.last-deploy"
fi

echo "==> API: install and build"
cd "$APP_ROOT/api"
# Dev dependencies are needed at build time (tsc, the Prisma CLI) and cost
# nothing to leave in place, so this is a single plain install.
npm ci
npm run build

echo "==> API: migrate"
# `migrate deploy` only applies committed migrations. It never generates one and
# never prompts, which is what makes it safe to run unattended — unlike
# `migrate dev`, which would offer to drop the search index (see api/README.md).
npx prisma migrate deploy

if [[ $SEED_TAXONOMY -eq 1 ]]; then
  echo "==> API: taxonomy"
  npm run db:seed:taxonomy
fi

if [[ $SEED_DEMO -eq 1 ]]; then
  echo "==> API: demo data (NOT for production)"
  npm run db:seed
fi

echo "==> Web: install and build"
cd "$APP_ROOT/app"
npm ci
npx next typegen
npm run build

echo "==> Restart"
# Needs a sudoers rule; see deploy/README.md. The API goes first so the web app
# never talks to a stale schema.
sudo systemctl restart property-api
# Wait for it to answer before swapping the web app over.
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:4000/ready >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! curl -fsS --max-time 2 http://127.0.0.1:4000/ready >/dev/null 2>&1; then
  echo "API did not become ready. Not restarting the web app." >&2
  echo "  journalctl -u property-api -n 50" >&2
  exit 1
fi
sudo systemctl restart property-web

echo "==> Verify"
sleep 3
curl -fsS --max-time 5 http://127.0.0.1:4000/health >/dev/null && echo "    api ok"
curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:3000/ && echo "    web ok"

echo
echo "Deployed $(git -C "$APP_ROOT" rev-parse --short HEAD)."
