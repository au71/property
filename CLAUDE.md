# Working on this repository

A property portal for Myanmar — buy, sell and rent, Yangon and Mandalay at
launch. Three self-contained projects sharing one git root:

```
api/      Express 5 · TypeScript · Prisma 7 · SQLite   → api/README.md
app/      Next.js 16 · React 19 · Tailwind 4          → app/README.md
mobile/   Expo SDK 57 · expo-router                   → mobile/README.md
deploy/   Caddy · systemd · backups                   → deploy/README.md
```

**No imports cross those directories.** The only coupling is the HTTP contract:
`api/` emits `openapi.json`, and both clients generate a typed layer from it
with `npm run gen:api`. Each can be split into its own repository with
`git subtree split -P api -b api-main`.

Read **SPEC.md** for the design. §11 records the decisions the owner has made
and why; do not silently reverse them.

## Running it

```bash
./start.sh          # sets up what is missing, runs both servers, Ctrl+C stops
```

Or by hand: `api/` needs `cp .env.example .env`, `npm install`,
`npm run db:setup`, `npm run db:seed`, `npm run dev`; then `app/` needs
`cp .env.example .env.local`, `npm install`, `npm run dev`.

Seeded accounts all use `Password123!` — `owner1@property.test`,
`staff@property.test`, `admin@property.test`, `buyer1@property.test`.

## Traps

These have each cost real time. Read them before touching the relevant area.

### Never run `prisma migrate dev`

Search uses `listing_fts`, an FTS5 virtual table with sync triggers. Prisma
cannot represent virtual tables, so it sees them as orphans and offers to drop
your search index — and the prompt makes it unusable unattended.

Use `npm run db:setup` to apply migrations and
`npm run db:migrate:new -- --name x` to create one. There is deliberately no
`db:migrate` script. `npm run db:check` fails CI if a migration drops the index.

### Prices are BigInt, and cross the wire as strings

A MMK sale price exceeds 2³¹, so `Int` is unsafe, and JSON has no BigInt.
Parse with `BigInt`, never `Number`. Display in **lakh (သိန်း)** — that is how
property is advertised here, not millions and not crore.

### Never put a phone number in a page payload

Anything passed to a client component is serialised into the server-rendered
HTML, so a "reveal" button in front of it is decoration while scrapers read the
number from the source. Public responses carry `contact.hasPhone`; the number
comes from `GET /listings/:id/contact`, rate limited.

The exception: whoever may **edit** a listing gets `contact.phone` and
`propertyOwner`, because an edit form has to prefill them. Gated by
`canSeePropertyOwner` in `api/src/domain/policy.ts`.

### SQLite reality, verified against Prisma 7.10

`enum` and `Json` **do** work (the spec once said otherwise).
`mode: 'insensitive'` **throws** — hence FTS5. Config lives in
`prisma7.config.ts`; the datasource block has no `url`; the generated client is
**TypeScript source**, compiled by our own `tsc`.

### Next 16 is not Next 15

`node_modules/next/dist/docs/` ships agent-readable docs — read them before
changing framework-level code. `params` and `searchParams` are Promises.
`middleware` is now `proxy`. Local-IP images are blocked by default, which is
why `dangerouslyAllowLocalIP` is set for development.

Run `npx next typegen` after adding a route, or `PageProps<'/your/route'>`
will not typecheck.

## Conventions

- Controllers do HTTP; services hold business rules and never touch `req`/`res`;
  `api/src/domain/policy.ts` holds authorization as pure functions.
- Authorization is enforced twice: a role gate on the router and an ownership
  check in the service. Roles are read from the database per request, not from
  the token, so revocation is immediate.
- Every listing is reviewed before going live, including from verified agents.
  Editing a published listing returns it to the queue.
- Quota is five new listings per account per rolling 24 hours, charged to
  whoever creates them.
- Search state lives entirely in the URL, so filtered results are shareable and
  indexable.
- Locale is a cookie, not a URL segment — one canonical URL per page.

## Before you finish

```bash
cd api && npm run typecheck && npm run lint && npm test && npm run openapi
cd ../app && npx next typegen && npm run typecheck && npm run lint && npm test && npm run build
```

If the API contract changed, regenerate the clients (`npm run gen:api` in `app/`
and `mobile/`) and commit the result — the type errors it produces are the point.
`openapi.json` is committed and CI fails if it drifts from the Zod schemas.

Integration tests run against a real SQLite file, not mocks: the behaviour worth
testing (FTS triggers, cascades, BigInt round-trips) only exists in the database.

## Still open

`SPEC.md` §12. The sharpest is quota appeals — an agency hits five a day
quickly and the only lever today is granting STAFF, which is far too much.
Mobile has never run on a physical device.
