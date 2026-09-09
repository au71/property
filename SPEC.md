# Property Portal — Project Specification

**Status:** Draft for review — nothing implemented yet.
**Last updated:** 2026-09-09

---

## 1. Overview

A property marketplace for Myanmar covering **buy / sell / rent** across **multiple
cities** (launching with Yangon and Mandalay) and **multiple property categories**
(land, apartment, condo, house, shophouse, office, etc.).

Delivery order is **web first, mobile later**, on top of a single shared API.

### 1.1 Products

| Product | Repo | Stack | Phase |
|---|---|---|---|
| API | `property-api` | Express 5 + TypeScript + Prisma 7 + SQLite | Phase 1 |
| Web app | `property-app` | Next.js (App Router) + React + TypeScript + shadcn/ui | Phase 1 |
| Mobile app | `property-mobile` | React Native + Expo + TypeScript | Phase 3 |

### 1.2 Non-goals for v1

- Online payments / escrow (listing promotion is invoiced offline in v1).
- In-app chat (v1 uses structured enquiries + phone/Viber handoff).
- Mortgage calculators, valuation models, price indices.
- Public agency/brokerage sub-accounts with billing hierarchies.

---

## 2. Repository & directory layout

Three **separate GitHub repositories**, cloned as **siblings** on disk:

```
~/work/
├── property-api/      # git@github.com:<org>/property-api.git
├── property-app/      # git@github.com:<org>/property-app.git
└── property-mobile/   # git@github.com:<org>/property-mobile.git
```

Each repo is independently versioned, tested, and deployed. There is no monorepo
tool (no Turborepo/Nx) — the coupling between them is the HTTP contract only.

### 2.1 Sharing types across repos

Because the repos are separate, shared types cannot be a relative import. The
contract is owned by the API and consumed by the clients:

1. `property-api` defines all request/response shapes as **Zod schemas** and emits
   an **OpenAPI 3.1 document** at build time (`npm run openapi` → `openapi.json`,
   committed to the repo and served at `GET /openapi.json`).
2. `property-app` and `property-mobile` each run `npm run gen:api`, which reads the
   published `openapi.json` and generates a typed client into
   `src/lib/api/generated/` (via `openapi-typescript` + a thin fetch wrapper).
   The generated directory is committed so builds never require the API to be up.

**Rejected alternative:** publishing a private `@property/contracts` npm package.
It is cleaner in theory but adds a publish step to every contract change; revisit
if a fourth consumer appears.

**Rule:** breaking API changes require a version bump of the `/api/v1` prefix, and
the clients regenerate before merging.

### 2.2 Common repo conventions

Every repo carries:

```
.editorconfig  .nvmrc  .env.example  README.md
.github/workflows/ci.yml     # typecheck + lint + test + build
eslint.config.js             # ESLint 9 flat config
prettier.config.mjs
tsconfig.json                # strict: true, noUncheckedIndexedAccess: true
```

- Node **22 LTS**, npm, ES modules (`"type": "module"`).
- Conventional Commits; `main` protected, work on `feat/*` branches.
- Husky + lint-staged pre-commit: prettier + eslint on staged files.

---

## 3. Domain model

### 3.1 Core concepts

- **Listing** — one property advertised under one **deal type** (`SALE` or `RENT`).
  A property offered both for sale and for rent is two listings (they have
  different prices, terms, and lifecycles); they may be linked via `groupId`.
- **Category** — what kind of property (land, condo, …). Hierarchical, seeded.
- **Location** — Myanmar administrative hierarchy, seeded, expandable.
- **User** — one account, one or more **roles**.
- **Enquiry** — a seeker's contact request against a listing.
- **Media** — ordered images (and later floor plans / video links) per listing.

### 3.2 Deal types

| Value | Meaning |
|---|---|
| `SALE` | Owner/agent sells; seeker buys. |
| `RENT` | Owner/agent rents out; seeker rents. |

"Buy" and "sell" are two views of the same `SALE` listing — sellers create them,
buyers search them. No separate entity.

### 3.3 Categories (seeded, two levels)

| Parent | Children |
|---|---|
| `residential` | `apartment`, `condo`, `house`, `villa`, `room` |
| `land` | `residential-land`, `commercial-land`, `farmland`, `industrial-land` |
| `commercial` | `office`, `shop`, `shophouse`, `warehouse`, `showroom` |
| `hospitality` | `hotel`, `guesthouse`, `serviced-apartment` |

Each category has `slug`, `nameEn`, `nameMy`, `parentId`, `sortOrder`, `isActive`,
and a `fieldSet` naming which attribute group applies (§3.5).

### 3.4 Locations (seeded, three levels + free text)

`Region/State` → `City` → `Township`. Ward/street is a free-text field on the
listing, not a seeded row (too volatile to maintain).

Launch data:

- **Yangon Region → Yangon** — Ahlone, Bahan, Botataung, Dagon, Dagon Seikkan,
  East Dagon, North Dagon, South Dagon, Dawbon, Hlaing, Hlaing Tharyar, Insein,
  Kamayut, Kyauktada, Kyimyindaing, Lanmadaw, Latha, Mayangone, Mingalar Taung
  Nyunt, Mingaladon, North Okkalapa, South Okkalapa, Pabedan, Pazundaung,
  Sanchaung, Seikkan, Shwepyithar, Tamwe, Thaketa, Thingangyun, Thanlyin,
  Yankin.
- **Mandalay Region → Mandalay** — Aungmyaythazan, Chanayethazan, Chanmyathazi,
  Mahaaungmyay, Pyigyidagun, Amarapura.

Expansion (Naypyitaw, Taunggyi, Mawlamyine, …) is a seed-data change plus an admin
UI toggle — **no code change**. Each location row carries `isActive` so a city can
be staged before launch, plus optional `centerLat`/`centerLng` for future map work.

### 3.5 Listing attributes

**Common to all listings:** title, description, dealType, categoryId, locationId,
address line (free text), price, currency, area, contact details, media, status.

**Category-specific attribute groups** (`fieldSet`), validated per category by Zod
and stored in a normalised set of nullable columns (not a JSON blob — see §4.4):

| fieldSet | Fields |
|---|---|
| `building` (apartment/condo/house/villa/serviced-apartment) | bedrooms, bathrooms, floorNumber, totalFloors, floorAreaSqft, furnishing (`none`/`partial`/`full`), hasLift, hasParking, buildYear, facing |
| `land` | landWidthFt, landLengthFt, landAreaSqft, landAreaAcre, roadWidthFt, isCornerPlot, landGrade (`grant`/`freehold`/`la-na-39`/`other`) |
| `commercial` | floorAreaSqft, floorNumber, totalFloors, hasLift, hasParking, powerPhase (`single`/`three`), ceilingHeightFt |

Land in Myanmar is commonly quoted as `width × length` in feet; the API computes
`landAreaSqft` when both are given, and accepts acres directly for farmland.

### 3.6 Pricing

- `priceAmount` is stored as **`BigInt`** in the smallest currency unit.
  MMK sale prices routinely exceed 2^31 (e.g. 5,000,000,000 MMK), so a 32-bit
  `Int` is not safe. MMK has no circulating subunit, so the minor unit is 1 MMK;
  USD uses cents.
- `currency` is `MMK` or `USD` (extensible), stored as a string code.
- `priceIsNegotiable: boolean`, `priceOnRequest: boolean` (hides the number).
- **RENT only:** `rentPeriod` (`monthly`/`yearly`), `depositAmount`,
  `advanceMonths` (Myanmar rentals commonly require 6–12 months upfront),
  `minLeaseMonths`, `utilitiesIncluded`.
- **SALE only:** `isInstallmentAvailable`, `installmentNote`.

All money is rendered client-side with a shared formatter that also shows the
Myanmar **lakh/crore** convention (e.g. `2,500 သိန်း`) alongside the raw figure.

### 3.7 Listing lifecycle

```
DRAFT ──submit──▶ PENDING_REVIEW ──approve──▶ PUBLISHED ──┬──▶ SOLD / RENTED
                       │                          │       ├──▶ EXPIRED  (auto, after expiresAt)
                       └──reject──▶ REJECTED      │       └──▶ ARCHIVED (by owner)
                                       │          │
                                       └──edit────┘  (back to PENDING_REVIEW)
```

- Only `PUBLISHED` listings appear in public search.
- `expiresAt` defaults to +60 days; owners can renew, which resets it.
- Staff can `SUSPEND` a published listing (a status of its own) with a reason.
- Every transition writes an `ListingEvent` audit row (actor, from, to, note).

---

## 4. Data layer

### 4.1 Stack

- **Prisma 7** with the `prisma-client` generator (TypeScript output, ESM).
- **SQLite** via the `better-sqlite3` driver adapter.
- Schema split across `prisma/schema/*.prisma` (Prisma 7 supports multi-file
  schemas): `base.prisma`, `user.prisma`, `listing.prisma`, `taxonomy.prisma`.
- Migrations via `prisma migrate dev` / `migrate deploy`, committed to the repo.

> **Verify at install time:** Prisma 7 moved to the new client generator, driver
> adapters, and the Rust-free query compiler. Pin the exact minor version in
> `package.json` and re-read the Prisma 7 release notes before writing the schema
> — the generator block and client import path differ from Prisma 5/6 habits.

### 4.2 SQLite constraints that shape the schema

These are real limits, not preferences:

1. **No native enums.** Prisma enums are unsupported on SQLite. Every enum-like
   field is a `String` column, constrained by a Zod enum in the API layer and a
   TypeScript union exported from `src/domain/enums.ts`. Values are `SCREAMING_SNAKE`.
2. **No `Json` scalar (treat as unavailable).** Anything document-shaped is a
   `String` column holding JSON, parsed/serialised through a Zod codec. This is
   why §3.5 uses real columns rather than an attribute blob — we need to filter on
   bedrooms and area.
3. **No case-insensitive `mode: 'insensitive'` filters.** Free-text search goes
   through **FTS5** (§4.5); simple prefix filters use a lowercased shadow column
   (`titleNormalized`).
4. **Single writer.** Enable WAL mode and a busy timeout at connection time. Fine
   for v1 traffic; §9 covers the Postgres migration path.

### 4.3 Entities

```
User            id, email(unique), phone(unique), passwordHash, name,
                avatarUrl, preferredLang, isVerified, isActive,
                createdAt, updatedAt
UserRole        id, userId, role                        # many-to-many via rows
AgentProfile    userId(unique/PK), agencyName, licenseNo, bio,
                serviceAreas(JSON string), isVerifiedAgent
Session         id, userId, refreshTokenHash, userAgent, ip,
                expiresAt, revokedAt

Region          id, slug, nameEn, nameMy, isActive, sortOrder
City            id, regionId, slug, nameEn, nameMy, isActive, sortOrder
Township        id, cityId, slug, nameEn, nameMy, isActive, sortOrder,
                centerLat, centerLng
Category        id, parentId, slug, nameEn, nameMy, fieldSet,
                isActive, sortOrder, iconKey

Listing         id, publicRef(unique, e.g. YGN-2026-000123),
                ownerId, createdById, dealType, status, categoryId,
                townshipId, addressLine, lat, lng,
                title, titleNormalized, description,
                priceAmount(BigInt), currency, priceIsNegotiable,
                priceOnRequest,
                rentPeriod, depositAmount, advanceMonths,
                minLeaseMonths, utilitiesIncluded,
                isInstallmentAvailable, installmentNote,
                bedrooms, bathrooms, floorNumber, totalFloors,
                floorAreaSqft, furnishing, hasLift, hasParking,
                buildYear, facing,
                landWidthFt, landLengthFt, landAreaSqft, landAreaAcre,
                roadWidthFt, isCornerPlot, landGrade,
                powerPhase, ceilingHeightFt,
                contactName, contactPhone, contactViber, hideExactAddress,
                isFeatured, featuredUntil,
                viewCount, enquiryCount,
                publishedAt, expiresAt, groupId,
                createdAt, updatedAt, deletedAt
ListingAmenity  listingId, amenityId                    # join
Amenity         id, slug, nameEn, nameMy, appliesTo(fieldSet)
Media           id, listingId, kind(IMAGE|FLOORPLAN), url, thumbUrl,
                width, height, bytes, sortOrder, isCover, createdAt
ListingEvent    id, listingId, actorId, fromStatus, toStatus, note, createdAt

Enquiry         id, listingId, seekerId(nullable), name, phone, email,
                message, preferredContact, status(NEW|CONTACTED|CLOSED|SPAM),
                createdAt, respondedAt
SavedListing    userId, listingId, createdAt            # favourites
SavedSearch     id, userId, name, queryJson, alertFrequency, lastRunAt
Report          id, listingId, reporterId, reason, detail, status, createdAt
AuditLog        id, actorId, action, entity, entityId, dataJson, ip, createdAt
```

Indexes: `Listing(status, dealType, townshipId, categoryId)`,
`Listing(status, publishedAt DESC)`, `Listing(status, priceAmount)`,
`Listing(ownerId, status)`, `Media(listingId, sortOrder)`,
`Enquiry(listingId, createdAt DESC)`.

Soft delete via `deletedAt`; all queries go through repository helpers that apply
the `deletedAt: null` filter so it cannot be forgotten.

### 4.4 Why normalised columns, not a JSON attribute bag

Search needs `bedrooms >= 3 AND floorAreaSqft BETWEEN x AND y ORDER BY priceAmount`.
On SQLite without a JSON scalar, that means either JSON-extract expressions in raw
SQL (unindexable, untyped) or real columns. Real columns win; the cost is a wide
nullable table, which SQLite stores sparsely anyway.

### 4.5 Search

- An FTS5 virtual table `listing_fts(title, description, address, content='Listing')`
  kept in sync by SQL triggers created in a migration.
- Text queries hit FTS5 for candidate IDs, then Prisma filters/sorts/paginates.
- Facet counts (per township, per category, per price band) come from a single
  grouped query per facet, cached in memory for 60s.
- Ranking for the default sort: featured first, then `publishedAt DESC`.

---

## 5. API (`property-api`)

### 5.1 Stack

Express 5, TypeScript, Zod, Prisma 7, `pino` logging, `helmet`, `cors`,
`express-rate-limit`, `argon2` for passwords, `jose` for JWT, `sharp` for image
processing, Vitest + Supertest for tests.

### 5.2 Structure

```
src/
├── server.ts                 # http bootstrap
├── app.ts                    # express app (exported for tests)
├── config/                   # env parsing via Zod, typed config object
├── db/                       # prisma client singleton, WAL pragmas
├── middleware/               # auth, requireRole, validate, errorHandler, rateLimit
├── modules/
│   ├── auth/                 # routes.ts controller.ts service.ts schema.ts
│   ├── users/
│   ├── listings/
│   ├── media/
│   ├── enquiries/
│   ├── taxonomy/             # categories, locations, amenities
│   ├── saved/                # favourites + saved searches
│   └── admin/                # moderation, reports, stats
├── domain/                   # enums, value objects, area/price helpers
├── lib/                      # storage adapter, mailer, otp, pagination, errors
└── openapi/                  # zod → OpenAPI registry + generator script
prisma/
├── schema/*.prisma
├── migrations/
└── seed/                     # seed.ts + data/*.ts (§7)
tests/
├── unit/
└── integration/              # spins a temp SQLite file per suite
```

Each module is `routes → controller (HTTP only) → service (business rules) →
prisma`. Controllers never touch Prisma directly; services never touch
`req`/`res`.

### 5.3 Conventions

- Base path `/api/v1`. JSON only. `snake_case` never appears — the API is
  `camelCase` end to end.
- Every request body/query is parsed by a Zod schema in `validate()` middleware;
  the parsed value replaces `req.body`/`req.query` and is typed.
- Errors are thrown as `AppError(code, status, message, details?)` and rendered by
  one error handler as
  `{ error: { code, message, details?, requestId } }`.
  Codes: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
  `CONFLICT`, `RATE_LIMITED`, `INTERNAL`.
- List endpoints return `{ data: T[], page: { limit, cursor, nextCursor, total? } }`
  with **cursor pagination** (`publishedAt,id`); `total` only when cheap.
- `BigInt` prices are serialised as **strings** in JSON (`"250000000"`) to survive
  JS number limits; the generated client converts them back.
- Every response carries `x-request-id`; it is logged and echoed in errors.

### 5.4 Authentication & authorization

- **Registration/login by phone or email.** Phone is primary in Myanmar; phone
  registration uses a 6-digit OTP (dev: logged to console via a `NoopSmsProvider`;
  production: pluggable `SmsProvider`). Email/password is also supported.
- **JWT access token** (15 min, `Authorization: Bearer`) + **rotating refresh
  token** (30 days, stored hashed in `Session`).
  - Web stores the refresh token in an `httpOnly; Secure; SameSite=Lax` cookie and
    keeps the access token in memory.
  - Mobile stores both in `expo-secure-store`.
  - The same endpoints serve both; the client sends `X-Client: web|mobile` and the
    API sets a cookie or returns the token in the body accordingly.
- Refresh rotation with reuse detection: a replayed refresh token revokes the
  whole session family.
- **Roles** (a user may hold several): `OWNER`, `AGENT`, `SEEKER`, `STAFF`, `ADMIN`.

| Capability | SEEKER | OWNER | AGENT | STAFF | ADMIN |
|---|:--:|:--:|:--:|:--:|:--:|
| Browse & search published listings | ✅ | ✅ | ✅ | ✅ | ✅ |
| Save listings / saved searches | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send enquiries | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/edit own listings | — | ✅ | ✅ | ✅ | ✅ |
| Listing quota | — | 10 active | 100 active | ∞ | ∞ |
| Create listing on behalf of an owner | — | — | ✅ | ✅ | ✅ |
| See enquiries for own listings | — | ✅ | ✅ | ✅ | ✅ |
| Approve / reject / suspend listings | — | — | — | ✅ | ✅ |
| Handle reports | — | — | — | ✅ | ✅ |
| Verify agents | — | — | — | ✅ | ✅ |
| Manage taxonomy (categories/locations) | — | — | — | — | ✅ |
| Manage users & roles, impersonate | — | — | — | — | ✅ |
| Feature a listing | — | — | — | ✅ | ✅ |

Authorization is enforced twice: a `requireRole([...])` middleware for coarse
gates, and an explicit ownership check inside each service
(`assertCanEditListing(user, listing)`) for row-level rules. Ownership rules live
in `src/domain/policy.ts` and are unit-tested as pure functions.

### 5.5 Endpoints (v1)

**Auth**
```
POST   /auth/register                 email or phone + password
POST   /auth/otp/request              { phone }
POST   /auth/otp/verify               { phone, code } → tokens
POST   /auth/login                    { identifier, password }
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
POST   /auth/password/forgot | /reset
```

**Taxonomy (public, cacheable)**
```
GET    /categories                    ?tree=true
GET    /locations/regions
GET    /locations/cities              ?regionId=
GET    /locations/townships           ?cityId=
GET    /amenities
```

**Listings (public)**
```
GET    /listings                      search + filters (below)
GET    /listings/:idOrRef
GET    /listings/:id/similar
POST   /listings/:id/view             fire-and-forget view counter
```
Filters: `q`, `dealType`, `categoryId[]`, `regionId`, `cityId`, `townshipId[]`,
`minPrice`, `maxPrice`, `currency`, `bedroomsMin`, `bathroomsMin`, `minAreaSqft`,
`maxAreaSqft`, `furnishing`, `amenityId[]`, `isFeatured`, `postedWithinDays`,
`sort` (`newest|priceAsc|priceDesc|areaDesc`), `limit`, `cursor`.

**Listings (authenticated)**
```
GET    /me/listings                   ?status=
POST   /listings                      creates DRAFT
PATCH  /listings/:id
POST   /listings/:id/submit           → PENDING_REVIEW
POST   /listings/:id/renew
POST   /listings/:id/status           { status: SOLD|RENTED|ARCHIVED }
DELETE /listings/:id                  soft delete
POST   /listings/:id/media            multipart, ≤15 images, ≤8MB each
PATCH  /listings/:id/media/reorder
DELETE /media/:id
```

**Enquiries & saved**
```
POST   /listings/:id/enquiries        public (rate-limited, honeypot)
GET    /me/enquiries/received         ?listingId=&status=
GET    /me/enquiries/sent
PATCH  /enquiries/:id                 { status }
GET/POST/DELETE /me/saved-listings
GET/POST/PATCH/DELETE /me/saved-searches
POST   /listings/:id/report
```

**Admin / staff**
```
GET    /admin/listings                ?status=PENDING_REVIEW
POST   /admin/listings/:id/approve | /reject | /suspend | /feature
GET    /admin/reports                 PATCH /admin/reports/:id
GET    /admin/users                   PATCH /admin/users/:id/roles | /status
POST   /admin/agents/:userId/verify
GET    /admin/stats                   counts by status/city/category, 30-day trend
POST   /admin/categories | /locations  (ADMIN only, CRUD)
```

**Ops**
```
GET    /health      GET /ready      GET /openapi.json
```

### 5.6 Media handling

- Upload via `multer` to a temp dir, validated by magic bytes (not extension),
  then processed with `sharp`: stripped of EXIF, resized to `1600w` (display) and
  `400w` (thumb), written as WebP.
- Stored through a `StorageAdapter` interface with two implementations:
  `LocalDiskStorage` (dev/v1, files under `var/uploads/`, served by Express at
  `/media/*`) and `S3Storage` (production later — Cloudflare R2 or S3 API).
  Swapping is one env var, `STORAGE_DRIVER`.
- Orphaned media (uploaded but listing never submitted) are cleaned by a daily job.

### 5.7 Cross-cutting

- **Rate limits:** 5/min on OTP request, 10/min on login, 5/hour per IP on public
  enquiry creation, 300/min general.
- **Scheduled jobs** (`node-cron` inside the API process for v1):
  expire listings past `expiresAt`; drop featured flags past `featuredUntil`;
  run saved-search alerts; clean orphan media; nightly SQLite `VACUUM` + backup
  copy of the DB file.
- **i18n:** the API returns machine-readable codes and both `nameEn`/`nameMy` for
  taxonomy; user-facing prose is translated client-side.
- **Config:** all env vars parsed by Zod at boot; the process refuses to start on a
  missing/invalid var. `.env.example` documents every one.

---

## 6. Web app (`property-app`)

### 6.1 Stack

Bootstrapped with:

```bash
npx shadcn@latest init --preset b1e79D0qa9 --template next
```

> **Note for review:** that command scaffolds a **Next.js** project (App Router)
> with Tailwind and shadcn/ui pre-wired — this spec assumes Next.js as the React
> framework rather than a bare Vite SPA. Server components give us fast, indexable
> listing pages, which matters a lot for a property portal's SEO. Say the word if
> you'd rather have a pure client-side SPA and I'll rework §6.

Added on top: TanStack Query (client-side data + caching), `react-hook-form` +
`@hookform/resolvers/zod`, `next-intl` (my/en), `nuqs` (filter state in the URL),
`sonner` (toasts), `embla-carousel` (galleries), `lucide-react` (icons).

### 6.2 Structure

```
src/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                       # home: search hero, featured, cities
│   │   ├── [dealType]/                    # /buy, /rent  (route-mapped to SALE/RENT)
│   │   │   ├── page.tsx                   # search results
│   │   │   └── [city]/[category]/page.tsx # SEO landing, e.g. /buy/yangon/condo
│   │   ├── listing/[ref]/page.tsx         # detail (server-rendered)
│   │   └── agents/[id]/page.tsx
│   ├── (auth)/login | register | verify
│   ├── (dashboard)/
│   │   ├── listings/                      # my listings, create, edit wizard
│   │   ├── enquiries/
│   │   └── saved/
│   ├── (admin)/admin/                     # moderation queue, users, taxonomy, stats
│   ├── api/                               # BFF route handlers: refresh-cookie proxy only
│   └── layout.tsx
├── components/
│   ├── ui/                                # shadcn primitives (generated)
│   ├── listing/                           # Card, Gallery, PriceTag, AttributeGrid
│   ├── search/                            # FilterBar, FacetPanel, SortSelect, Map (later)
│   └── layout/                            # Header, Footer, LangSwitch, RoleNav
├── lib/
│   ├── api/generated/                     # from openapi.json — do not edit
│   ├── api/client.ts                      # fetch wrapper: auth, refresh, errors
│   ├── format.ts                          # price (incl. lakh), area, date (my/en)
│   └── auth/                              # session context, route guards
└── messages/{en,my}.json
```

### 6.3 Key screens

1. **Home** — deal-type toggle (Buy / Rent), city + category + price quick search,
   featured listings, browse-by-township tiles, recent listings.
2. **Search results** — filter sidebar (collapsible sheet on mobile), result grid
   or list, sort, cursor-paged "load more", saved-search CTA. All filter state
   lives in the query string so results are linkable and shareable.
3. **Listing detail** — gallery, price block (MMK + lakh, negotiable badge),
   attribute grid driven by the category's `fieldSet`, amenities, description,
   map placeholder, agent/owner card with reveal-phone button, enquiry form,
   similar listings. Server-rendered with full JSON-LD (`RealEstateListing`),
   canonical URL, and OpenGraph image.
4. **Listing wizard** (owner/agent) — 5 steps: deal type & category → location →
   details (fields switch on `fieldSet`) → price & terms → photos & review.
   Autosaves as `DRAFT` on each step.
5. **Dashboard** — my listings with status chips and renew/mark-sold actions,
   received enquiries inbox, saved listings and searches.
6. **Admin** — moderation queue with side-by-side diff for edited listings,
   reports, user/role management, taxonomy CRUD, dashboard stats.

### 6.4 Product details that matter here

- **Bilingual (my/en)** from day one, language switch in the header, `lang` cookie,
  Myanmar text set in Pyidaungsu/Noto Sans Myanmar with correct line-height.
- **Phone privacy:** contact numbers are revealed on click and the reveal is
  counted; never rendered in the initial HTML.
- **Mobile-first CSS** — most Myanmar traffic is Android phones; target LCP < 2.5s
  on a mid-range device over 3G. Images use `next/image` with the API's WebP
  variants.
- **Accessibility:** shadcn/Radix primitives, visible focus rings, labelled form
  controls, ≥4.5:1 contrast.

---

## 7. Sample data

`property-api` ships a deterministic seed (`npm run db:seed`, fixed RNG seed so
results are reproducible; `npm run db:reset` = migrate reset + seed).

- **Taxonomy:** all regions/cities/townships from §3.4, all categories from §3.3,
  ~40 amenities.
- **Users (password `Password123!` for all):**
  | Email | Roles |
  |---|---|
  | `admin@property.test` | ADMIN, STAFF |
  | `staff@property.test` | STAFF |
  | `agent1@property.test` … `agent5@property.test` | AGENT (2 verified) |
  | `owner1@property.test` … `owner15@property.test` | OWNER |
  | `buyer1@property.test` … `buyer10@property.test` | SEEKER |
- **Listings: ~300**, distributed ≈ 65% Yangon / 35% Mandalay, ≈ 55% `SALE` /
  45% `RENT`, spread across every category, with a realistic status mix
  (≈ 70% PUBLISHED, 10% PENDING_REVIEW, 8% DRAFT, 5% SOLD/RENTED, 4% EXPIRED,
  3% REJECTED) and prices drawn from plausible per-township, per-category bands
  so filters and sorting produce sensible results.
- **Media:** 3–8 images per listing. Seed images are generated locally as
  labelled placeholder WebPs (via `sharp`) — no external image URLs, so the seed
  works offline and in CI.
- Plus ~120 enquiries, ~80 saved listings, ~20 saved searches, ~10 reports, and
  matching `ListingEvent` history so the audit UI has something to show.

---

## 8. Mobile app (`property-mobile`) — Phase 3

React Native + **Expo** (managed workflow), `expo-router` (file-based, mirrors the
web routes), NativeWind for styling, TanStack Query, `expo-secure-store` for
tokens, `expo-image-picker` + `expo-image-manipulator` for uploads,
`expo-notifications` for saved-search alerts. Consumes the same generated API
client (§2.1).

Scope for v1 mobile: browse, search + filters, listing detail, save/favourite,
enquire, login, and a light "my listings" view (create/edit stays web-only until
v2). Distribution via EAS Build; Android first.

---

## 9. Environments & operations

| Env | API | DB | Web |
|---|---|---|---|
| Local | `localhost:4000` | `prisma/dev.db` | `localhost:3000` |
| Staging | single VPS, systemd + Caddy | `/var/lib/property/staging.db` | Vercel or same VPS |
| Production | single VPS behind Caddy (TLS) | `/var/lib/property/prod.db` (WAL) | Vercel or same VPS |

- **Backups:** hourly `VACUUM INTO` snapshot to a separate volume + daily offsite
  copy; restore procedure documented and tested in the API README.
- **Monitoring:** `/health` and `/ready` polled by Uptime Kuma; `pino` JSON logs
  shipped to a file with logrotate; Sentry in both API and web.
- **Postgres migration path:** the only SQLite-specific pieces are the FTS5
  triggers, the string-typed enums, and the WAL pragmas. Moving to Postgres means
  a new datasource, swapping FTS5 for `tsvector`, and optionally promoting the
  string enums to real enums — all confined to `prisma/` and the search module.
  Do it when concurrent writes or dataset size demands it, not before.

---

## 10. Delivery plan

| Milestone | Scope | Repos |
|---|---|---|
| **M0 — Scaffolding** | Three repos created, CI green, tooling, env config, health endpoint, shadcn init, empty Next app deploying | all |
| **M1 — Data & auth** | Prisma schema, migrations, seed data (§7), auth (password + OTP), roles, policy unit tests | api |
| **M2 — Listings API** | Listing CRUD, lifecycle, media upload, taxonomy, search + FTS5, OpenAPI emitted | api |
| **M3 — Public web** | Home, search results, listing detail, SEO landings, i18n, enquiry form | app |
| **M4 — Accounts web** | Login/register, listing wizard, my listings, enquiries inbox, saved | app |
| **M5 — Admin web** | Moderation queue, reports, users & roles, taxonomy CRUD, stats | app |
| **M6 — Hardening & launch** | Rate limits, jobs, backups, monitoring, a11y & perf pass, staging soak | api + app |
| **M7 — Mobile** | Expo app per §8 | mobile |

**Definition of done for each milestone:** typecheck + lint clean, unit tests for
services/policies, integration tests for every new endpoint, seed data exercising
the feature, README updated, CI green on `main`.

---

## 11. Open questions for review

1. **Next.js vs. Vite SPA** — the shadcn preset in the brief implies Next.js (§6.1).
   Confirm that's what you want; SEO strongly favours it for a property portal.
2. **Separate repos vs. one repo with three packages** — separate repos are what
   you asked for and this spec follows that, at the cost of the codegen dance in
   §2.1. Worth a last look before M0.
3. **Currency** — is USD needed at launch, or MMK only?
4. **Agent-on-behalf-of-owner** — does an agent listing a property need the owner
   to have an account (§5.4), or is a free-text owner contact enough for v1?
5. **Moderation** — should every new listing be reviewed by staff before going
   live, or should verified agents publish immediately?
6. **Enquiry delivery** — email, SMS, or in-app only? SMS costs money and needs a
   provider decision (§5.4 already assumes a pluggable one).
7. **Map** — is a map view (pins, draw-to-search) in scope for v1, or after? It
   changes the location model (we'd want lat/lng required, plus a tile provider).
8. **Listing quotas & featured listings** (§5.4) — placeholders; confirm the real
   numbers and whether featuring is free/manual in v1.
