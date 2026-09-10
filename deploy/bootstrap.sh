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
# The repository is public, so a plain HTTPS clone needs no credential. If it is
# ever made private this falls back to generating a read-only deploy key — see
# the "Repository access" step below.
REPO="${REPO:-https://github.com/au71/property.git}"
SSH_REPO="${SSH_REPO:-git@github.com:au71/property.git}"
BRANCH="${BRANCH:-main}"
APP_ROOT=/srv/property
# Any key lives with the `property` user, because that is the account that runs
# every deploy after this one. A key under /root would work exactly once.
PROPERTY_HOME=/home/property
DEPLOY_KEY="$PROPERTY_HOME/.ssh/property_deploy"

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
apt-get install -y -qq curl git ca-certificates gnupg ufw openssl openssh-client sudo
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

echo "==> Repository access"
# A public repository clones with no credential at all. Only if that fails does
# this fall back to a deploy key, so the common path stays a single run.
if git ls-remote --exit-code "$REPO" "refs/heads/$BRANCH" >/dev/null 2>&1; then
  echo "    public clone over HTTPS, no credential needed"
else
  echo "    HTTPS clone refused; falling back to a deploy key"
  REPO="$SSH_REPO"
  install -d -m 700 -o property -g property "$PROPERTY_HOME/.ssh"
  if [[ ! -f "$DEPLOY_KEY" ]]; then
    sudo -u property ssh-keygen -t ed25519 -N "" \
      -C "property-deploy@$(hostname)" -f "$DEPLOY_KEY" >/dev/null
  fi
  if ! grep -q "property_deploy" "$PROPERTY_HOME/.ssh/config" 2>/dev/null; then
    cat >> "$PROPERTY_HOME/.ssh/config" <<SSHEOF
Host github.com
  IdentityFile $DEPLOY_KEY
  IdentitiesOnly yes
SSHEOF
  fi
  ssh-keyscan -t ed25519 github.com >> "$PROPERTY_HOME/.ssh/known_hosts" 2>/dev/null
  sort -u -o "$PROPERTY_HOME/.ssh/known_hosts" "$PROPERTY_HOME/.ssh/known_hosts"
  chown -R property:property "$PROPERTY_HOME/.ssh"
  chmod 600 "$PROPERTY_HOME/.ssh/config" "$PROPERTY_HOME/.ssh/known_hosts"

  # Fail legibly rather than letting `git clone` report "repository not found"
  # for what is really a missing credential.
  if ! sudo -u property ssh -o BatchMode=yes -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    cat <<KEYEOF

This server cannot reach the repository. Add its deploy key:

  https://github.com/au71/property/settings/keys/new

  Title:        $(hostname)
  Key:          (paste the line below)
  Write access: leave UNCHECKED — deploys only ever read

$(cat "$DEPLOY_KEY.pub")

Then run this script again. It is safe to re-run.

KEYEOF
    exit 1
  fi
fi

echo "==> Checkout"
if [[ ! -d "$APP_ROOT/.git" ]]; then
  # Cloned as `property` so every object is owned by the account that will run
  # `git fetch` from here on; git refuses to operate on a repository owned by
  # someone else ("dubious ownership").
  sudo -u property git clone --branch "$BRANCH" "$REPO" "$APP_ROOT.tmp"
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
