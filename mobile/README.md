# property-mobile

The mobile app for the property portal.

Expo SDK 57 · React Native 0.86 · expo-router · TypeScript

> This directory is a self-contained project. It shares a git root with `api/`
> and `app/` for convenience only — no imports cross those boundaries, and it can
> be split out at any time with `git subtree split -P mobile -b mobile-main`.

---

## Getting started

The API must be running first (see `../api/README.md`).

```bash
cp .env.example .env
npm install
npm start           # then press a / i / w, or scan the QR code
```

**`localhost` will not work from a phone.** On a device or an Android emulator
it means the device itself. Set the API to your machine's LAN address:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000   # your machine on the LAN
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000       # Android emulator
```

Sign in with a seeded account, e.g. `buyer1@property.test` / `Password123!`.

## Scope

Per the spec, v1 mobile is the **seeker** side: browse, search and filter,
listing detail, save, and reveal contact details. Creating and editing listings
stays on the web until v2 — a five-step form with photo upload is a poor first
mobile feature, and the moderation workflow behind it is staff-only anyway.

| Screen | |
|---|---|
| Browse | Buy/rent toggle, infinite scroll, pull to refresh |
| Search | Text search plus deal type, bedrooms and price band |
| Listing | Swipeable gallery, attributes, amenities, contact reveal, save |
| Saved | Refetches on focus so a save from the detail screen appears |
| Account | Session, roles, sign out |

## Things worth knowing

### The Expo docs were unreachable during this build

`docs.expo.dev` is blocked by this environment's network policy, and the SDK 57
scaffold warns that its conventions have changed. Everything here was therefore
written against the **installed packages' own type definitions**, and
`npx expo install` (which needs Expo's version-resolution API) was replaced by
reading `node_modules/expo/bundledNativeModules.json` and installing those exact
versions directly.

**Verified**: `npx expo export --platform web` bundles cleanly, and the exported
build was driven end to end in a headless browser — tabs, browse, navigation to
a listing, contact reveal, and search all work against the live API with zero
console errors.

**Not verified**: this has never run on a real device or simulator, and no native
build has been produced. Check it on Android before trusting it — that is the
launch platform.

### Tokens go in the keychain, not AsyncStorage

`src/lib/auth/store.ts` uses `expo-secure-store`, which is the platform keychain
or keystore. AsyncStorage is plain files: readable on a rooted or jailbroken
handset and included in device backups.

`expo-secure-store` **has no web implementation** — calling it in a web build
throws `getValueWithKeyAsync is not a function` and takes the auth provider down
with it. The store falls back to `localStorage` on web, which is development-only;
native is the shipping target.

The client sends `X-Client: mobile`, so the API returns tokens in the response
body rather than setting a cookie. A 401 triggers one transparent refresh before
anything is surfaced to the user, because a 15-minute access token expires
mid-session constantly.

### The phone number is not in the listing payload

Same rule as the web app: the payload carries `contact.hasPhone`, and the number
comes from `GET /listings/{id}/contact` when the user taps. Rate limited at the
API.

### Prices are strings, and quoted in lakh

`src/lib/format.ts` is a deliberate copy of the web app's — the projects are
separate by design, so it is duplicated rather than imported. It parses prices
with `BigInt` (a MMK amount overflows a JS number's exact range) and displays
lakh (သိန်း), which is how property is advertised here. Keep the two copies in
step; both have the same test suite.

`src/theme/index.ts` is likewise a hand-kept copy of the web design tokens.

## Layout

```
app/                          # expo-router file-based routes
├── _layout.tsx               # Stack + AuthProvider + SafeAreaProvider
├── (tabs)/
│   ├── _layout.tsx           # bottom tabs
│   ├── index.tsx             # browse
│   ├── search.tsx
│   ├── saved.tsx
│   └── account.tsx
├── listing/[ref].tsx
└── login.tsx                 # presented as a modal
src/
├── components/listing-card.tsx
├── lib/api/{client,types}.ts + generated/
├── lib/auth/{store,context}.tsx
├── lib/format.ts
└── theme/index.ts
```

## Regenerating the API client

```bash
npm run gen:api          # reads ../api/openapi.json
npm run gen:api -- https://api.example.com/openapi.json
```

The output is committed so a build never needs the API to be reachable.

## Building

Distribution is via EAS Build, Android first — most traffic in this market is
mid-range Android.

```bash
npx eas build --platform android --profile preview
```
