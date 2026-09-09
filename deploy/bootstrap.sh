#!/usr/bin/env bash
#
# First-time server setup. Run once, as root, on a fresh Debian 12 or Ubuntu
# 24.04 box. Safe to re-run.
#
#   curl -fsSL https://raw.githubusercontent.com/au71/property/main/deploy/bootstrap.sh | bash
#   # or: scp it over and run it
#
set -euo pipefail

DOMAIN="${DOMAIN:-}"
REPO="${REPO:-https://github.com/au71/property.git}"
BRANCH="${BRANCH:-main}"
APP_ROOT=/srv/property

if [[ $EUID -ne 0 ]]; then
  echo "Run this as root." >&2
  exit 1
fi

if [[ -z "$DOMAIN" ]]; then
  echo "Set DOMAIN first, e.g.  DOMAIN=property.example.com bash bootstrap.sh" >&2
  exit 1
fi

echo "==> Packages"
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg ufw openssl
apt-get install -y -qq build-essential

echo "==> Node 22"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
node -v

echo "==> Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

echo "==> Service account"
id -u property &>/dev/null || useradd --system --create-home --home-dir /home/property --shell /usr/sbin/nologin property

echo "==> Directories"
# The database and uploads live outside the checkout, so a deploy never touches
# them and a bad deploy cannot delete them.
mkdir -p "$APP_ROOT" /srv/property/data/uploads /srv/property/backups /var/log/caddy
chown -R property:property /srv/property
chown -R caddy:caddy /var/log/caddy

echo "==> Checkout"
if [[ ! -d "$APP_ROOT/.git" ]]; then
  git clone --branch "$BRANCH" "$REPO" "$APP_ROOT.tmp"
  # Move contents in, preserving the data directory created above.
  shopt -s dotglob
  mv "$APP_ROOT.tmp"/* "$APP_ROOT"/
  rmdir "$APP_ROOT.tmp"
  chown -R property:property "$APP_ROOT"
fi

echo "==> Secrets"
API_ENV="$APP_ROOT/api/.env"
if [[ ! -f "$API_ENV" ]]; then
  JWT_SECRET="$(openssl rand -base64 48)"
  cat > "$API_ENV" <<ENVEOF
NODE_ENV=production
PORT=4000
DATABASE_URL="file:/srv/property/data/property.db"
JWT_SECRET="$JWT_SECRET"
ACCESS_TOKEN_TTL_MIN=15
REFRESH_TOKEN_TTL_DAYS=30
WEB_ORIGIN="https://$DOMAIN"
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=/srv/property/data/uploads
PUBLIC_BASE_URL="https://$DOMAIN"
SMS_PROVIDER=noop
ENABLE_CRON=true
ENVEOF
  chmod 600 "$API_ENV"
  chown property:property "$API_ENV"
  echo "    Generated a JWT secret. It is in $API_ENV and nowhere else — back it up."
fi

WEB_ENV="$APP_ROOT/app/.env.production"
if [[ ! -f "$WEB_ENV" ]]; then
  cat > "$WEB_ENV" <<ENVEOF
NODE_ENV=production
# Baked into the browser bundle at build time; must be the public origin.
NEXT_PUBLIC_API_URL="https://$DOMAIN"
NEXT_PUBLIC_SITE_URL="https://$DOMAIN"
# Server-side calls skip Caddy and go straight to the API on loopback.
API_URL="http://127.0.0.1:4000"
ENVEOF
  chmod 600 "$WEB_ENV"
  chown property:property "$WEB_ENV"
fi

echo "==> Caddy config"
sed "s/property\.example\.com/$DOMAIN/g" "$APP_ROOT/deploy/Caddyfile" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo "==> systemd units"
cp "$APP_ROOT/deploy/property-api.service" /etc/systemd/system/
cp "$APP_ROOT/deploy/property-web.service" /etc/systemd/system/
cp "$APP_ROOT/deploy/property-backup.service" /etc/systemd/system/
cp "$APP_ROOT/deploy/property-backup.timer" /etc/systemd/system/
systemctl daemon-reload

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# 3000 and 4000 stay closed: they are reached only through Caddy on loopback.
ufw --force enable

echo "==> First build"
# SEED_DEMO=1 loads ~300 fake listings — useful for a staging box you want to
# click around, wrong for production. Either way the taxonomy (regions, cities,
# townships, categories, amenities) is loaded, because the portal cannot
# function without it.
if [[ "${SEED_DEMO:-0}" == "1" ]]; then
  sudo -u property bash "$APP_ROOT/deploy/deploy.sh" --skip-pull --seed-demo
else
  sudo -u property bash "$APP_ROOT/deploy/deploy.sh" --skip-pull --seed-taxonomy
fi

echo "==> Starting"
systemctl enable --now property-api property-web property-backup.timer
systemctl reload caddy || systemctl restart caddy

cat <<DONE

Done.

  Site        https://$DOMAIN
  Health      https://$DOMAIN/health
  Logs        journalctl -u property-api -u property-web -f
  Deploy      sudo -u property $APP_ROOT/deploy/deploy.sh

Two things to do now:

  1. Point $DOMAIN at this server's IP if you have not already; Caddy needs
     that before it can get a certificate.
  2. Create your administrator account:
       cd $APP_ROOT/api && sudo -u property npm run make:admin -- \
         --email you@example.com --name "Your Name"

     If you bootstrapped with SEED_DEMO=1, the demo accounts exist with the
     published password Password123! — delete them before this box sees real
     traffic.

DONE
