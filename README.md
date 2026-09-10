# Property Portal

Buy, sell and rent property across Myanmar — Yangon and Mandalay at launch, with
more cities as a data change rather than a code change.

Read **[SPEC.md](SPEC.md)** first; it is the design this implements.

---

## Three projects

```
property/
├── api/       Express 5 · TypeScript · Prisma 7 · SQLite      → api/README.md
├── app/       Next.js 16 · React 19 · Tailwind 4 · shadcn     → app/README.md
└── mobile/    Expo SDK 57 · React Native · expo-router        → mobile/README.md
```

Each is **fully self-contained**: its own `package.json`, `tsconfig.json`,
`.env.example`, README and CI workflow, with **no imports across the
boundaries**. The only coupling is the HTTP contract — the API emits
`openapi.json`, and the two clients generate a typed layer from it
(`npm run gen:api`).

They share one git root only because this build had push access to a single
repository. Splitting them out preserves full history:

```bash
git subtree split -P api -b api-main
git push git@github.com:<org>/property-api.git api-main:main
```

## Running the whole thing

```bash
# 1. API
cd api && cp .env.example .env && npm install
npm run db:migrate && npm run db:seed && npm run dev     # :4000

# 2. Web
cd ../app && cp .env.example .env.local && npm install
npm run dev                                              # :3000

# 3. Mobile (optional)
cd ../mobile && cp .env.example .env && npm install
npm start
```

Every seeded account uses the password **`Password123!`**:

| Account | Sees |
|---|---|
| `admin@property.test` | Everything, including roles and taxonomy |
| `staff@property.test` | The moderation queue |
| `agent1@property.test` | Agent listings (1 and 2 are verified) |
| `owner1@property.test` | An owner's own listings |
| `buyer1@property.test` | The seeker side |

Sample data is ~300 listings across Yangon and Mandalay, with locally generated
images — the seed needs no network access and produces identical output on every
run.

## Decisions worth knowing

Taken at spec review:

- **Every listing is reviewed** before it goes live, including from verified
  agents. Editing a live listing returns it to the queue.
- **MMK only** at launch, displayed in lakh (သိန်း) because that is how property
  is advertised here. Prices are `BigInt` and cross the wire as strings — a kyat
  sale price overflows a 32-bit int and a JS number's exact range.
- **No map in v1.** `lat`/`lng` are nullable columns, ready when it is.

Found during the build:

- **Enums and `Json` do work on SQLite in Prisma 7** — the spec said otherwise;
  it was checked against a real install and corrected.
- **A phone number passed to a client component is in the page source.** Both
  clients fetch it on demand from a rate-limited endpoint instead.

## Environment constraints hit here

Two things this environment blocked, both documented where they matter:

- `ui.shadcn.com` — the shadcn CLI could not run. Its preset configuration was
  recovered from the CLI's own request URL and reproduced by hand; see
  `app/README.md`.
- `docs.expo.dev` — the SDK 57 docs were unreachable, so the mobile app was
  written against the installed packages' type definitions and verified by
  bundling and driving it in a browser. It has **not** run on a device; see
  `mobile/README.md`.

## Deploying

One small VPS runs everything behind Caddy. You need a rented server (~$6/mo,
Singapore) and a domain (~$12/yr); **[deploy/README.md](deploy/README.md)** walks
through getting both. Once the domain's A record points at the server:

```bash
ssh root@your-server-ip        # from your own terminal
# then, on the server:
curl -fsSLO https://raw.githubusercontent.com/au71/property/main/deploy/bootstrap.sh
DOMAIN=property.example.com bash bootstrap.sh
```

Then `sudo -u property /srv/property/deploy/deploy.sh` for every deploy after
that.

**To try it without spending anything**, run it locally instead — see Running the
whole thing above. Everything works on a laptop except the public URL.

SQLite needs a persistent disk and a single writer, so the API cannot go
serverless. Caddy serves both apps from one domain by path, which means the
browser talks to the API same-origin and there is no CORS anywhere.

Backups run hourly via `VACUUM INTO` — not `cp`, which is not atomic against a
live writer and can produce a backup that restores to a corrupt database. The
restore path has been rehearsed.

## CI

`.github/workflows/` runs each project independently, on changes to its own
directory: typecheck, lint, tests, build. The API workflow also fails if
`openapi.json` drifts from the Zod schemas, or if a migration would drop the
full-text search index.
