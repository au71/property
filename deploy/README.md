# Deploying the property portal

One small VPS runs everything: the API, the web app, and Caddy in front of both.
Around $6–12/month. **Singapore** is the nearest sensible region for Myanmar
traffic.

Why one box rather than something serverless: SQLite needs a persistent disk and
a single writer. That rules out Vercel Functions, Lambda and Workers for the API.
The database and the uploaded photos are files, and they want to stay files.

---

## What you need before you start

Two things you have to buy. Together they cost roughly **$6–13 a month plus
$10–15 a year**.

### 1. A server (VPS)

A Linux machine rented by the month. Any of these work; pick **Singapore** as the
region, it is the nearest major location to Myanmar.

| Provider | Smallest sensible plan | Cost |
|---|---|---|
| Hetzner | CX22 — 2 vCPU, 4 GB | ~€4.50/mo |
| DigitalOcean | Basic droplet — 1 vCPU, 2 GB | $6/mo |
| Vultr | Regular — 1 vCPU, 2 GB | $6/mo |

When you create it, choose **Debian 12** or **Ubuntu 24.04**. Add your SSH key if
the provider offers it — otherwise it emails you a root password.

2 GB of RAM is enough. The Next.js build is the heaviest moment; if it ever gets
killed mid-build, that is the reason, and 4 GB fixes it.

### 2. A domain name

From Namecheap, Porkbun or Cloudflare, around $10–15/year. You need one because
Caddy gets a real HTTPS certificate, and certificates are issued for domains, not
IP addresses.

Once you have both, add a **DNS A record** pointing your domain at the server's
IP address:

```
Type   Name   Value
A      @      203.0.113.42        <- your server's IP
```

Check it has taken effect before going further — this can take minutes to an
hour:

```bash
dig +short property.example.com
# should print your server's IP
```

**Caddy cannot get a certificate until this resolves.** Running the bootstrap
early is not harmful, but it will fail at the TLS step.

## First time

From **your own machine** — Terminal on macOS or Linux, PowerShell on Windows 10
or later — connect to the server:

```bash
ssh root@203.0.113.42          # your server's IP
```

Your prompt changes to the server. Everything after this runs **there**, not on
your laptop:

```bash
curl -fsSLO https://raw.githubusercontent.com/au71/property/main/deploy/bootstrap.sh
DOMAIN=property.example.com bash bootstrap.sh     # your domain
```

It takes about five minutes, most of it building the web app.

The script is idempotent — re-running it is safe and is the intended way to
recover from a half-finished first run.

### If you make the repository private again

The script notices: a public clone is tried first, and only if that is refused
does it generate a **read-only deploy key**, print it, and stop with the page to
paste it into.

> Settings → Deploy keys → Add deploy key.
> **Leave "Allow write access" unchecked** — a deploy only ever reads.

Then run it again. A deploy key beats a personal access token here: scoped to
this one repository, cannot push, and revoking it affects nothing else.

That installs Node 22 and Caddy, creates a `property` service account, clones the
repo to `/srv/property`, generates a JWT secret, writes both `.env` files, builds
everything, loads the taxonomy, opens the firewall to 80/443 only, and starts the
services.

Add `SEED_DEMO=1` for a staging box you want populated with ~300 fake listings.
**Never on production** — those accounts have a password published in the README.

Then create a real administrator:

```bash
cd /srv/property/api
sudo -u property npm run make:admin -- --email you@example.com --name "Your Name"
```

It prints a generated password **once**. Nothing stores it in plain text.

Finally, allow the deploy user to restart the services:

```bash
sudo install -m 0440 -o root -g root /srv/property/deploy/sudoers.property /etc/sudoers.d/property
sudo visudo -c
```

## Every deploy after that

```bash
sudo -u property /srv/property/deploy/deploy.sh
```

Fetches `main`, installs, builds, runs `prisma migrate deploy`, restarts the API,
**waits for `/ready` before restarting the web app**, and verifies both answer. If
the API does not come up it stops and leaves the old web app serving rather than
completing a half-broken deploy.

Rolling back:

```bash
cd /srv/property
git reset --hard "$(cat .last-deploy)"
sudo -u property deploy/deploy.sh --skip-pull
```

A migration is not undone by that. Migrations here are additive — new nullable
columns — so an older build tolerates a newer schema. Anything destructive needs
a considered down-migration, written at the time.

## What runs where

| | |
|---|---|
| Caddy | :80, :443 — TLS, routing, compression |
| API | 127.0.0.1:4000, `property-api.service` |
| Web | 127.0.0.1:3000, `property-web.service` |
| Database | `/srv/property/data/property.db` |
| Photos | `/srv/property/data/uploads/` |
| Backups | `/srv/property/backups/` |
| Code | `/srv/property/` |

Data lives **outside** the checkout, so `git reset --hard` can never touch it.

Ports 3000 and 4000 are closed at the firewall; both are reachable only through
Caddy over loopback.

### One domain, not two

Caddy routes by path: `/api/v1/*` and `/media/*` to the API, everything else to
Next. The browser therefore talks to the API **same-origin**, so there is no CORS
preflight anywhere and session cookies need no cross-site relaxation. The web
app's own handlers at `/api/auth/*` and `/api/proxy/*` do not collide with
`/api/v1`.

A subdomain split is commented at the bottom of the `Caddyfile` if you prefer it;
it costs you CORS configuration on both sides.

## Backups

`property-backup.timer` runs hourly. It keeps 24 hourly and 14 daily snapshots.

Snapshots use **`VACUUM INTO`**, not `cp`. `cp` is not atomic against a live
writer: it can capture a torn page and hand you a backup that restores to a
corrupt database. `VACUUM INTO` takes a read lock and writes a consistent,
compacted copy. It runs through the API's own `better-sqlite3`, so the backup is
written by exactly the SQLite build that writes the database, and there is no
`sqlite3` CLI to install.

Photos are hard-linked into `backups/uploads-mirror/` — uploads are immutable, so
new files are the only thing that ever needs adding, and hard links make that
nearly free.

```bash
systemctl list-timers property-backup     # when it next runs
journalctl -u property-backup -n 20       # what it did
```

### Restore

Verified end to end — a restored snapshot came back with its data and its FTS
search index intact.

```bash
systemctl stop property-api property-web
gunzip -c /srv/property/backups/daily/property-YYYYMMDD.db.gz \
  > /srv/property/data/property.db
chown property:property /srv/property/data/property.db
systemctl start property-api property-web
```

Photos: `cp -a /srv/property/backups/uploads-mirror/. /srv/property/data/uploads/`

### Offsite

**A backup on the same disk as the database is not a backup.** The bottom of
`backup.sh` has commented `rclone` and `aws s3` lines — enable one. Until you do,
a failed disk loses everything.

## Monitoring

```bash
journalctl -u property-api -u property-web -f       # live logs
systemctl status property-api property-web caddy    # health
curl -s https://your-domain/health                  # from outside
```

Point an uptime checker (Uptime Kuma, Better Stack, anything) at
`https://your-domain/ready` — it checks the database, not just the process.

The API logs structured JSON via pino, with `x-request-id` on every request and
response. Credentials, tokens and OTP codes are redacted at the logger.

## Secrets

`api/.env` holds `JWT_SECRET`. It is generated once at bootstrap and stored
nowhere else. **Back it up.** Losing it signs every user out permanently;
leaking it lets anyone mint a valid token for any account.

Rotating it signs everyone out, which is the correct response to a suspected
leak:

```bash
sudo -u property sed -i "s|^JWT_SECRET=.*|JWT_SECRET=\"$(openssl rand -base64 48)\"|" /srv/property/api/.env
sudo systemctl restart property-api
```

## Before you take real traffic

- [ ] `make:admin` run, demo accounts deleted if you seeded them.
      The repository is public, so `Password123!` and every demo email are
      world-readable. `SEED_DEMO=1` on a public-facing box hands anyone an
      admin login.
- [ ] Offsite backup enabled in `backup.sh`
- [ ] `JWT_SECRET` backed up somewhere other than the server
- [ ] A restore rehearsed at least once
- [ ] Uptime check pointed at `/ready`
- [ ] `SMS_PROVIDER` configured if you want OTP phone sign-in to actually send
- [ ] Unattended security upgrades: `apt install unattended-upgrades`

## When SQLite stops being enough

One box, one writer. That is fine well past the traffic this will see at launch,
and the read path is fast. The signals to move are sustained `SQLITE_BUSY` in the
logs, or needing a second app server.

The port to Postgres touches three things and nothing else: the FTS5 triggers
become a `tsvector` column, the string-backed enums can become real enums, and
the WAL pragmas go away. All of it is inside `prisma/` and the search module.
