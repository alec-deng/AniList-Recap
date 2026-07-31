# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

AniPortable: MV3 popup extension for tracking AniList anime/manga lists. One codebase → Chrome + Firefox. Plasmo + React + TypeScript + Apollo Client + Tailwind.

## Commands

- `npm install`
- `npx plasmo dev` — watch/HMR build → `build/chrome-mv3-dev`
- `npx plasmo build` — prod → `build/chrome-mv3-prod`
- `npx plasmo build --target=firefox-mv3` — prod → `build/firefox-mv3-prod`
- `npx plasmo package [--target=firefox-mv3]` — zip for store submission
- `npm run build:all` — both targets + zips, via `scripts/build-all.mjs`
- `npx tsc --noEmit` — typecheck (no separate lint/test setup)

**Env files** (gitignored, one AniList app each — each build's OAuth redirect differs): `.env.development` (dev), `.env.production` (build), `.env.firefox` (`--target=firefox-*`, outranks `.env.production`). Client ID: `PLASMO_PUBLIC_ANILIST_CLIENT_ID`. Missing var → `Auth.login()` throws.

## Manifest

- Generated from `package.json`'s `"manifest"` key, not a standalone file. Edit there — never `.plasmo/` or `build/`.
- Permissions: `storage`, `identity`, `host_permissions: ["https://graphql.anilist.co/"]` (exact path, no wildcard).
- Plasmo rewrites per target — don't hand-maintain variants:
  - `background.service_worker` → `background.scripts` on Firefox (no MV3 service workers there).
  - `browser_specific_settings.gecko` kept on Firefox, stripped on Chrome. Drops `gecko_android` (verified, don't retry) — expect one harmless `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` warning from `web-ext lint`.
- After any manifest change, check the generated `build/<target>/manifest.json` directly.

## Architecture

Two JS contexts, talking only via `chrome.runtime` messages/ports.

### `background.ts` (MV3 service worker)

- `Storage` — wrapper over `chrome.storage.local` (`accessToken`, `user`, `pendingUpdates`).
- `AniList` — raw-fetch GraphQL client, background-only (popup uses its own Apollo client). All requests route through `#request()`, which throws `AniListRequestError` on `!response.ok` **or** a populated `errors[]` — `fetch` doesn't reject on 4xx/5xx by itself, and AniList's error bodies are valid JSON, so this is the only thing standing between a rejected request and the queue reading it as a success.
- **Sync queue** — popup never mutates directly; sends `QUEUE_UPDATE`. Background merges into `pendingUpdates: Map<id, QueuedUpdate>`, mirrors to `chrome.storage.local` on every change, flushes via one bulk aliased mutation (`m<id>: SaveMediaListEntry(...) { id updatedAt }`) after a 5s debounce.
  - **Failure classification** (`flushAllPendingUpdates`): only `AniListRequestError` with `status` 400/404 counts as a permanent rejection (capped at `MAX_FLUSH_ATTEMPTS = 3`, tracked per-id in `failedAttempts`). Everything else — offline, 429, and AniList's outage `403` — retries indefinitely. **Don't reclassify 403 as permanent**; it means "API temporarily disabled," not "denied."
  - **AniList splits auth failures by status, and not the way you'd expect.** A *missing* `Authorization` header gets `401 "Unauthorized."`, but a *present but dead* token gets **`400 {"errors":[{"message":"Invalid token"}],"data":null}`** — the same status as a genuinely rejected edit (`400 {"errors":[{"message":"validation",...}],"data":{"m<id>":null}}`). Status alone can't separate those two; only the body can, which is what `isInvalidTokenError` reads. (The 401 never reaches a flush — `flushAllPendingUpdates` returns early when there's no token.) It is checked **before** `isPermanentRejection`; drop that ordering and an expired token burns an attempt per flush and silently discards every queued edit on the third. On an auth failure the queue is re-queued and persisted first, then `clearInvalidSession()` removes the token/user so the popup falls back to `LoginPage` — the edits survive and flush after re-login. It removes **both keys in one `Storage.remove([...])` call**; two removals fire two `onChanged` events, and the two `CHECK_AUTH` round trips they trigger can resolve out of order, leaving the popup on the list UI with the stale user. The same function also serves the popup's `SESSION_EXPIRED` message, since a flush only runs when something is queued.
  - **Partial success**: the aliased mutation can apply some entries and reject others. `reportSynced()` reads which ids actually landed (from `result.data` on success, `error.data` on failure) and excludes them from re-queueing.
  - **Age-out**: `dropStaleUpdates()` discards anything with `queuedAt` older than `MAX_QUEUE_AGE_MS` (24h) before every flush — prevents a stale offline edit from clobbering a newer edit made on another device. This is *why* indefinite retry above is safe.
  - **Persistence**: `persistPendingUpdates()` clears storage only when the queue is empty; never an unconditional `Storage.remove`, or an edit queued mid-flight loses its mirror.
  - **In-flight visibility**: `pendingUpdates` is cleared *before* the await, so `inFlightUpdates` holds the batch for the length of the request and `GET_PENDING_UPDATES` answers from `mergedPendingUpdates()`. Without it, a popup opening during a flush reads an empty queue and paints the server's pre-edit value — and the popup reads once per open, so it stays wrong for the session. Not a narrow race: the popup is what wakes an evicted worker, and that wake runs `restorePendingUpdates()` → flush. **Don't persist `inFlightUpdates`** — the storage mirror intentionally keeps the pre-flush batch until the request settles, so a worker death mid-flush loses nothing. `QUEUE_UPDATE` must keep reading only `pendingUpdates`: an edit arriving mid-flush stays separate so a success doesn't re-send applied fields, and the catch's re-queue recombines them on failure.
  - Restart replay: `restorePendingUpdates()` re-flushes on worker start; missing `queuedAt` (pre-upgrade data) defaults to now, not "infinitely old."
  - Eager flush on logout, on a successful `Auth.login()` (the dead-token path re-queues edits then clears the session — unawaited, the popup is waiting on that response), and on the popup's `chrome.runtime.connect({ name: 'popup' })` disconnecting.
- `ENTRIES_SYNCED` broadcast — after a successful flush, background sends the server's real `updatedAt` per entry back to the popup (`AniListDataContext` listens and patches all four list caches). Corrects the popup's optimistic stamp; keeps `rowOrder: "updatedAt"` honest without an extra request.
- `Auth` — `chrome.identity.launchWebAuthFlow`, implicit grant. Random `state` param per attempt (Chrome fails an identical-URL retry otherwise). No `redirect_uri` sent — AniList redirects to whichever URL is registered on that `client_id`; Firefox's is `https://<sha1(gecko.id)>.extensions.allizom.org/` (SHA-1 of the *declared* id, not the per-profile UUID). Changing `gecko.id` invalidates the registered AniList app.
- File starts with `export {}` — forces module scope so `class Storage` doesn't collide with the DOM global. Don't remove.

### Popup (`popup.tsx`, `components/`, `contexts/`, `hooks/`)

Fully remounted every open/close. Providers: `ApolloProvider` → `SettingsProvider` → `AniListDataProvider`.

- `apollo/client.ts` — popup's own Apollo client; auth header read fresh from `chrome.storage.local` per request (not React state). An `onError` link watches for AniList's `400 "Invalid token"` and sends `SESSION_EXPIRED` to the background, which clears the session so the popup falls back to `LoginPage`. It only observes — the error still reaches `useQuery`, so each tab's `StateMessage` renders as before. Guarded by a module flag because a popup open fires several queries at once.
- `contexts/SettingsContext.tsx` — AniList-hosted prefs (profile color, title language, adult flag, score format, row order) + local-only settings (`manualCompletion`, `separateEntries`, `tabVisibility`, `showAnimeStats`/`showMangaStats`). Changing `tabVisibility` resets both stats toggles to match, but they stay independently overridable after — don't re-couple. Surfaces `error` alongside `loading`; every tab must check its own `error` or a failed query silently degrades to "0 items."
- `contexts/AniListDataContext.tsx` — manual cache/dirty-flag layer over Apollo's cache, per list (`anime`/`stats`/`manga`/`mangaStats`). `markXDirty()` after a mutation that affects another tab; each tab's effect refetches only when dirty or cache-empty. Session-only (React state, not storage).
- `hooks/useAuth.ts` — bridge to background `Auth`; subscribes to `AUTH_CHANGED`. Treats `res.error` from a `LOGIN` response as a failed login (background can now throw on a bad token via `AniListRequestError`), not a half-authed user.
- `hooks/useStableOrder.ts` — freezes a list's on-screen order while `hovering`; item data still updates live, only position holds. Held in a **ref during render**, not `useState`+`useEffect` — the reorder animation re-freezes within a frame of releasing, and an effect-timeline update would hand back the pre-release order.
- `components/MediaListTab.tsx` — the whole list-tab pipeline (query → transform → adult filter → sort → caught-up split → grid) plus optimistic update → `QUEUE_UPDATE` → dirty-flag, `useStableOrder`, and the **reorder/removal choreography**. `AnimeTab.tsx`/`MangaTab.tsx` are thin `MediaListConfig` wrappers — put list-behavior fixes in `MediaListTab`, not the wrappers. Renders through `MediaCard` (generic over anime episodes / manga chapters).
  - **Choreography** (`endInteraction`, `startRemoval`): one card at a time is allowed to animate a move (`animatingRef`); everything else is instant. `willEntryMove` compares the card's index within its *rendered section* (not the combined list), gated on `separateEntries` — else e.g. a score bump that changes category reads as moving across the whole grid even in one combined view. A finished entry (`pendingRemovalRef`) fades via the same path as the "Mark as Completed" button (`startRemoval`) rather than the reorder's lift-and-return. The freeze (`holdOrder`) outlives the pointer leaving — it's released only by `releaseOrder()`, not by the hover effect directly — because the grid must not visibly reorder while a card is mid-fade.
  - **Timing** (`HIDE_BEFORE_REORDER_MS`, `REMOVE_FADE_MS`, `SETTLE_TOTAL_MS` in `MediaListTab.tsx`) are hard ceilings on the matching classes in `styles/animation.css` (`.card-leaving`/`.card-removing`/`.card-entering`/`.card-settling`) — **change both together**. A CSS transition longer than its JS constant is simply cut off, since the next phase's class carries no transition of its own.
  - No hover-out debounce (removed deliberately): an interaction ends the instant the pointer leaves the touched card for a different card or the grid. A real accidental edge-slip lasts longer than any debounce window that wouldn't itself cost noticeable latency.
- `components/StateMessage.tsx` — shared loading/error/empty UI. Errors from `lib/apolloErrors.ts#getErrorMessage`, which reads `error.networkError` (Apollo routes any HTTP ≥300 there as `ServerError`, even for AniList's GraphQL-shaped error bodies) — this is how 429/403-outage/400-dead-token/5xx are distinguished from a plain GraphQL error. The 400 dead-token branch is the message shown in the moment before the client's `onError` link clears the session and `LoginPage` takes over — word it so it reads correctly either way.
- Score formats (`POINT_100/10_DECIMAL/10/5/3`) and their max values: `MediaCard.getMaxScore` — put new score-format logic there.

## Known constraints

- `chrome.*` only, no `browser.*`/polyfill (Firefox aliases it). Requires **MV3** specifically: under MV2 Firefox's `chrome.*` is callback-only and the background's promise-form `await chrome.storage.local.get(...)` would silently resolve `undefined`. Never target `firefox-mv2`.
- `strict_min_version: 140.0` — set by `gecko.data_collection_permissions` (AMO requirement, landed in 140; silently ignored below it). Also current ESR. Lowering it triggers `KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION` in `web-ext lint`.
- `@apollo/client` pinned to `3.8.10` (`dependencies` + `resolutions`/`overrides`) — prior upgrade broke the MV3 build. Don't bump without testing the built extension in Chrome, not just `tsc`/`plasmo build`.
- VS Code + spurious `Cannot find name 'chrome'`: check `TypeScript: Select TypeScript Version… → Use Workspace Version` (bundled TS can shadow the workspace one; `tsconfig.json` uses `moduleResolution: "Bundler"`).
- Tailwind: `bg-white`/`text-white` = `#edf1f5` (popup background), **not** pure white — use `white-100` (`#ffffff`) for cards/panels (`MediaCard`, `CustomSelect`).
- `components/CustomCheckbox.tsx` needs its `useEffect(() => setIsChecked(checked), [checked])` sync to stay externally controllable (e.g. `SettingsTab` flipping `showAnimeStats` on `tabVisibility` change) — don't remove as "redundant."
