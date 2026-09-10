# property-api

The API behind the property portal: buy, sell and rent property across Myanmar.

Express 5 · TypeScript · Prisma 7 · SQLite · Zod

> This directory is a self-contained project. It shares a git root with `app/`
> and `mobile/` for convenience only — there are no imports across those
> boundaries, and it can be split into its own repository at any time with
> `git subtree split -P api -b api-main`.

---

## Getting started

```bash
cp .env.example .env      # JWT_SECRET must be at least 32 characters
npm install               # runs `prisma generate` via postinstall
npm run db:setup          # creates prisma/dev.db and applies migrations
npm run db:seed           # ~300 listings, users for every role, generated images
npm run dev               # http://localhost:4000
```

Then `curl http://localhost:4000/api/v1/listings?limit=3 | jq`.

Every seeded account uses the password **`Password123!`**:

| Account | Roles |
|---|---|
| `admin@property.test` | ADMIN, STAFF |
| `staff@property.test` | STAFF |
| `agent1@property.test` … `agent5@property.test` | AGENT (1 and 2 verified) |
| `owner1@property.test` … `owner40@property.test` | OWNER |
| `buyer1@property.test` … `buyer10@property.test` | SEEKER |

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Watch mode on port 4000 |
| `npm run build` | `prisma generate` then `tsc` into `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Vitest — unit plus integration against a real SQLite file |
| `npm run typecheck` / `lint` / `format` | tsc, ESLint, Prettier |
| `npm run db:setup` | Apply migrations (this is `migrate deploy`, and it is what you want) |
| `npm run db:migrate:new -- --name x` | Create a new migration. **Never run `prisma migrate dev`** (see below) |
| `npm run db:reset` | Drop, migrate, reseed |
| `npm run db:check` | CI guard on the search index |
| `npm run openapi` | Regenerate `openapi.json` from the Zod schemas |

## Things that will surprise you

### Prisma 7 is not Prisma 5

- Config lives in **`prisma7.config.ts`**, not `package.json`. The `datasource`
  block in the schema has **no `url`**.
- The generated client is **TypeScript source**, not compiled JS. It lands in
  `src/generated/prisma/` (gitignored, rebuilt by `postinstall`) and is compiled
  by our own `tsc`.
- The driver adapter export is `PrismaBetterSqlite3` — lowercase `q`, `l`.
- `prisma` and `@prisma/client` are **pinned to 7.10.0 exactly**. npm's `latest`
  tag currently points at an 8.0 release candidate, so a caret range would drag
  in a prerelease.

### Never run `prisma migrate dev`

There is deliberately no `db:migrate` script, because the obvious name for it
would be a trap. Use `db:setup` to apply migrations and `db:migrate:new` to
create one.


Full-text search uses an FTS5 virtual table (`listing_fts`) plus triggers, created
by a hand-written migration. Virtual tables cannot be expressed in
`schema.prisma`, so Prisma diffs the schema against the database, sees them as
orphans, and offers to **drop your search index**.

Worse, that warning makes `migrate dev` **prompt**, so it cannot run unattended
at all — not in a script, not in CI.

Use `npm run db:migrate:new -- --name your_change` instead. It builds the SQL
with `prisma migrate diff` (non-interactive), strips the blocks targeting the
FTS objects, writes the migration, and applies it with `migrate deploy`. Every
Prisma diff proposes those drops — replaying the history into its shadow database
creates the tables, and the schema does not contain them — so seeing them
stripped is expected, not a warning sign. `npm run db:check` fails CI if a
migration ever does drop the index.

### Prices are strings

`priceAmount` is a `BigInt` in the smallest currency unit. A MMK sale price
routinely exceeds 2^31, so a 32-bit `Int` is not safe, and JSON has no BigInt —
prices therefore cross the wire as decimal strings (`"5000000000"`). MMK has no
circulating subunit, so its minor unit is 1 kyat; USD uses cents.

The API also returns `lakhLabel` (e.g. `"2,500 သိန်း"`), since that is how prices
are actually quoted here.

### SQLite reality check, verified against 7.10.0

| Feature | Result |
|---|---|
| `enum` | **Works** — stored as `TEXT` |
| `Json` | **Works** — stored as `JSONB`, but unindexable, so filterable attributes are real columns |
| `BigInt` | **Works** |
| `mode: 'insensitive'` | **Throws** — this is why text search goes through FTS5 |
| FTS5 | Compiled into `better-sqlite3` |

WAL mode, a busy timeout and foreign keys are set per connection in
`src/db/prisma.ts`.

## Layout

```
src/
├── app.ts, server.ts       # express app (exported for tests) and bootstrap
├── config/                 # Zod-parsed env; refuses to boot on a bad value
├── db/                     # prisma client + SQLite pragmas
├── domain/                 # policy.ts, money.ts, area.ts — pure, unit-tested
├── middleware/             # auth, validate, error, rateLimit, requestId
├── modules/<feature>/      # routes → service → prisma, one folder per feature
├── jobs/                   # expiry, unfeaturing, pruning
├── lib/                    # tokens, password, otp, storage, pagination, errors
└── openapi/                # spec generated from the same Zod schemas
```

Controllers do HTTP; services do business rules and never touch `req`/`res`;
`domain/policy.ts` holds the authorization rules as pure functions so they can be
tested without a database.

## Authorization

Enforced twice: `requireRole(...)` as a coarse gate on the router, and an
explicit ownership check inside each service. Roles are read from the **database**
on every request, not from the token, so revoking a role takes effect at once
rather than at token expiry.

| Capability | SEEKER | OWNER | AGENT | STAFF | ADMIN |
|---|:--:|:--:|:--:|:--:|:--:|
| Browse, save, enquire | yes | yes | yes | yes | yes |
| Create and edit own listings | — | yes | yes | yes | yes |
| New listings per rolling 24h | — | 5 | 5 | none | none |
| Approve / reject / suspend | — | — | — | yes | yes |
| Manage roles and taxonomy | — | — | — | — | yes |

**Every listing is reviewed before it goes live**, including listings from
verified agents. Editing a published listing returns it to `PENDING_REVIEW`.

The quota is a **rate, not a cap**: five new listings per account per rolling 24
hours, charged to whoever creates them. A cap on live listings would punish an
agency with real stock while doing nothing about someone posting the same flat
five times an hour; a daily rate is the other way round. Soft-deleted listings
still count, or the limit is bypassed by create-and-delete.

**An owner does not need an account** for their agent to list their property.
`propertyOwnerName` / `propertyOwnerPhone` record them as free text, and those
fields are stripped from every response except to the listing's own account and
to staff — see `canSeePropertyOwner`.

**Enquiries are delivered in-app only.** No email, no SMS.
`GET /me/enquiries/unread-count` drives the dashboard badge, which is the whole
delivery mechanism. **Featuring is free and editorial** — staff-only, with no
payment and no self-service route.

## Auth flow

Access token (15 min, `Authorization: Bearer`) plus a rotating refresh token
(30 days, stored only as a SHA-256 digest).

Send `X-Client: web` (default) and the refresh token comes back as an `httpOnly`
cookie; send `X-Client: mobile` and it comes back in the body for secure storage.

Refresh rotation includes **reuse detection**: replaying a token that has already
been rotated revokes every session in its family, on the assumption that it leaked.

**Phone sign-in (OTP).** `POST /auth/otp/request` always answers `202 { sent: true }`
— identical for a registered number and an unknown one, so it cannot be used to
test which numbers have accounts. Only the code's salted hash is stored, it lasts
five minutes, and five wrong guesses burn it.

A number with no account gets one on first successful verification, so the same
two endpoints serve sign-up and sign-in.

Requesting a code while a fresh one is still outstanding sends nothing
(`OTP_RESEND_SECONDS`, 60). The per-IP limiter cannot help here — the requests
that matter come from many addresses aimed at one handset — and every message
costs money and lands on a stranger's phone. In development the code is written
to the log by the SMS stand-in; production needs a real `SmsProvider`, and logs
an error rather than silently dropping the message if none is configured.

## Testing

```bash
npm test
```

Unit tests cover the policy and money layers as pure functions. Integration tests
run against a real SQLite database created by `tests/globalSetup.ts` — the
behaviour most worth testing (FTS5 triggers, cascade deletes, unique constraints,
BigInt round-trips) only exists in the database, so mocking it would test nothing.

## Known advisories

`npm audit` reports 4 issues, all from the Prisma 7 CLI's own transitive
dependencies (`mysql2`, `deepmerge-ts`). They are dev-only — the CLI is not on the
runtime path — and the only "fix" npm offers is downgrading to Prisma 6. Left in
place deliberately; revisit when Prisma 8 is stable.

## Deployment

```bash
npm ci && npm run build && npm run db:deploy && npm start
```

Behind a reverse proxy that terminates TLS (`trust proxy` is on). Back up by
copying the SQLite file with `VACUUM INTO` rather than `cp`, which is not atomic
against a live writer.
