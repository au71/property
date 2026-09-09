# property-app

The web front end for the property portal.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · shadcn-style UI

> This directory is a self-contained project. It shares a git root with `api/`
> and `mobile/` for convenience only — no imports cross those boundaries, and it
> can be split out at any time with `git subtree split -P app -b app-main`.

---

## Getting started

The API must be running first (see `../api/README.md`).

```bash
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

Sign in with any seeded account, password `Password123!` — `owner1@property.test`
for the seller side, `staff@property.test` for the moderation queue.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `start` | Production build and serve |
| `npm run typecheck` / `lint` | tsc, ESLint |
| `npm test` | Vitest (formatting logic) |
| `npm run gen:api` | Regenerate the typed API client from `../api/openapi.json` |

## About the shadcn setup

The brief specified:

```bash
npx shadcn@latest init --preset b1e79D0qa9 --template next
```

**That command could not run here**: `ui.shadcn.com` is blocked by this
environment's network policy (the egress proxy returns 403 on CONNECT), and the
CLI needs it for both the preset and every component.

The preset's configuration was recoverable from the CLI's own request URL —
style `mira`, base colour `mist`, `tabler` icons, Inter body / Roboto headings,
default radius, emerald chart colour — and is reproduced by hand in
`src/app/globals.css`. The components in `src/components/ui/` are the same Radix
primitives plus Tailwind classes that the CLI would have written.

**On a machine with access**, re-running the command will reconcile this against
the real preset. `components.json` is present so the CLI recognises the project
and `npx shadcn@latest add <component>` works normally.

## Things worth knowing

### Next 16 is not Next 15

`node_modules/next/dist/docs/` ships agent-readable docs; read them before
changing framework-level code. The three that bit during this build:

- **`params` and `searchParams` are Promises.** Always `await` them. `PageProps<'/route'>`
  and `LayoutProps<'/route'>` are generated globals (`npx next typegen`).
- **`middleware.ts` is now `proxy.ts`**, and it runs on Node, not edge.
- **Local-IP images are blocked by default.** The API serves media from
  `localhost:4000` in development, so `images.dangerouslyAllowLocalIP` is set for
  non-production in `next.config.ts`. Without it every listing photo 400s.

### No token ever reaches JavaScript

The browser posts credentials to `/api/auth/*` (a route handler in this app),
which calls the API as a `mobile` client to get the tokens in the body, then
writes them into **httpOnly cookies**. Client components that need an
authenticated endpoint call `/api/proxy/*`, which attaches the token server-side
and transparently refreshes it once on a 401.

So: a script injection cannot read a session, and the API keeps one token
contract for every client.

### Phone numbers are not in the page source

A number passed as a prop to a client component is serialised into the
server-rendered payload — a "reveal" button in front of it would be decoration
while scrapers read it straight out of the HTML.

The listing payload therefore carries `contact.hasPhone`, not the number.
`ContactCard` fetches `GET /listings/{id}/contact` on click, which is rate
limited. Verified: a listing page contains zero phone numbers before the click.

### Locale is a cookie, not a URL segment

One canonical URL per page — `/buy/yangon/condo`, not `/en/buy/...` and
`/my/buy/...` competing in search results. `LanguageSwitch` sets a cookie and
calls `router.refresh()`; server components read it via `getTranslations()`.
Dictionaries are in `src/lib/i18n/dictionaries.ts`; a missing key renders the key
rather than throwing.

Burmese script needs a taller line-height and a font with the glyphs — both are
set in `globals.css` under `:lang(my)`, with Noto Sans Myanmar loaded in the root
layout.

### Prices are strings, and quoted in lakh

A MMK price arrives as a decimal string and is parsed with `BigInt`, never
`Number`. Display is in **lakh (သိန်း)** — `2,500 သိန်း`, not `25 ကုဋေ` and not
`250,000,000`, because lakh is how property is actually advertised here. The
exact figure sits underneath on the detail page. See `src/lib/format.ts` and its
tests.

### Search state lives in the URL

`/buy?townshipSlug=bahan,yankin&minPrice=10000000&sort=priceAsc` is the whole
state. Filtered results are shareable and indexable, the back button works, and
the server renders the first page. `SearchResults` is remounted by `key` when
the query changes rather than syncing props into state.

Price inputs are in lakh and converted to kyat on submit, because nobody types
`250000000`.

## Layout

```
src/
├── app/
│   ├── page.tsx                        # home
│   ├── [dealType]/                     # /buy, /rent — search results
│   │   └── [city]/[category]/          # SEO landing, e.g. /buy/yangon/condo
│   ├── listing/[ref]/                  # detail, with RealEstateListing JSON-LD
│   ├── (auth)/                         # login, register
│   ├── (dashboard)/                    # my listings, wizard, enquiries, saved
│   ├── (admin)/                        # queue, reports, users, stats
│   ├── api/auth/[...action]/           # credentials → httpOnly cookies
│   └── api/proxy/[...path]/            # authenticated passthrough + refresh
├── components/{ui,listing,search,layout,dashboard,admin}/
└── lib/
    ├── api/generated/                  # from openapi.json — do not edit
    ├── api/{client,queries,types}.ts
    ├── format.ts                       # prices, areas, dates, Burmese numerals
    ├── i18n/
    └── auth/session.ts
```

## Accessibility

Radix primitives throughout, a skip link, visible focus rings (`:focus-visible`
is never removed), labelled form controls with `aria-invalid`/`aria-describedby`
on errors, and one tab stop per listing card via a stretched link rather than
three competing ones.
