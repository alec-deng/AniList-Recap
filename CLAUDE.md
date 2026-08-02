# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

AniPortable: MV3 popup extension for tracking AniList anime/manga lists. One codebase → Chrome + Firefox. Plasmo + React + TypeScript + Apollo Client + Tailwind.

## Commands

- `npx plasmo dev` — watch/HMR → `build/chrome-mv3-dev`
- `npx plasmo build [--target=firefox-mv3]` — prod → `build/<target>-prod`
- `npx plasmo package [--target=firefox-mv3]` — store zip
- `npm run build:all` — both targets + zips
- `npx tsc --noEmit` — typecheck (no lint/test setup)

`plasmo dev` holds a lock on `.plasmo/cache` — stop it before a prod build, or the build dies with `EBUSY`.

**Env files** (gitignored, one AniList app each — each build's OAuth redirect differs): `.env.development`, `.env.production`, `.env.firefox` (outranks `.env.production` on `--target=firefox-*`). Client ID: `PLASMO_PUBLIC_ANILIST_CLIENT_ID`; missing → `Auth.login()` throws.

## Manifest

Generated from `package.json`'s `"manifest"` key — edit there, never `.plasmo/` or `build/`. **The version lives in two places**: top-level `version` and `manifest.version`. Bump both; the manifest key wins.

- Permissions: `storage`, `identity`, `host_permissions: ["https://graphql.anilist.co/"]` (exact path, no wildcard).
- Plasmo rewrites per target — don't hand-maintain variants: `background.service_worker` → `background.scripts` on Firefox; `browser_specific_settings.gecko` kept on Firefox, stripped on Chrome. `gecko_android` is dropped (verified, don't retry) — expect one harmless `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` from `web-ext lint`.
- After any manifest change, check the generated `build/<target>/manifest.json`.

## Architecture

Two JS contexts, talking only via `chrome.runtime` messages/ports.

### `background.ts` (MV3 service worker)

- `Storage` — wrapper over `chrome.storage.local` (`accessToken`, `user`, `pendingUpdates`).
- `AniList` — raw-fetch GraphQL client, background-only. Every request goes through `#request()`, which throws `AniListRequestError` on `!response.ok` **or** a populated `errors[]`. `fetch` doesn't reject on 4xx/5xx and AniList's error bodies are valid JSON, so this is the only thing stopping the queue from reading a rejection as success.
- File starts with `export {}` — forces module scope so `class Storage` doesn't collide with the DOM global. Don't remove.

**Sync queue.** The popup never mutates directly; it sends `QUEUE_UPDATE`. Background merges into `pendingUpdates: Map<id, QueuedUpdate>`, mirrors to storage on every change, and flushes one bulk aliased mutation (`m<id>: SaveMediaListEntry(...)`) after a 5s debounce (`FLUSH_DEBOUNCE_MS`).

- **The debounce almost never fires.** An edit is normally followed by the popup closing within a second or two, so `FLUSH_NOW` is what sends it — the timer only covers a popup left open. That makes the close path below load-bearing rather than a fallback.

- **Failure classification**: only `AniListRequestError` with status 400/404 is a permanent rejection (capped at `MAX_FLUSH_ATTEMPTS = 3`). Everything else — offline, 429, AniList's outage 403 — retries indefinitely. **Don't reclassify 403 as permanent**; it means "temporarily disabled," not "denied."
- **A dead token and a rejected edit share status 400.** A *missing* header gets `401`, but a *dead* token gets `400 {"errors":[{"message":"Invalid token"}],"data":null}` — the same status as a validation failure. Only the body separates them, which is what `isInvalidTokenError` reads. It must run **before** `isPermanentRejection`, or an expired token burns an attempt per flush and silently discards every queued edit on the third.
- On auth failure: re-queue and persist **first**, then `clearInvalidSession()` — edits survive and flush after re-login. It removes both keys in **one** `Storage.remove([...])`; two removals fire two `onChanged` events whose `CHECK_AUTH` round trips can resolve out of order, leaving the popup on the list UI with a stale user. The same function serves the popup's `SESSION_EXPIRED`.
- **Partial success**: the aliased mutation can apply some ids and reject others. `reportSynced()` reads what actually landed (`result.data` on success, `error.data` on failure) and excludes those from re-queueing.
- **Age-out**: `dropStaleUpdates()` discards anything older than `MAX_QUEUE_AGE_MS` (24h) before every flush, so a stale offline edit can't clobber a newer one made on another device. This is *why* indefinite retry is safe.
- **Persistence**: `persistPendingUpdates()` clears storage only when the queue is empty — never an unconditional `Storage.remove`, or an edit queued mid-flight loses its mirror.
- **In-flight visibility**: `pendingUpdates` is cleared *before* the await, so `inFlightUpdates` holds the batch and `GET_PENDING_UPDATES` answers from `mergedPendingUpdates()`. Otherwise a popup opening mid-flush reads an empty queue and paints the pre-edit value for the whole session. **Don't persist `inFlightUpdates`** — the storage mirror deliberately keeps the pre-flush batch until the request settles. `QUEUE_UPDATE` must keep reading only `pendingUpdates`, so a mid-flush edit stays separate and the catch's re-queue recombines them.
- Restart replay: `restorePendingUpdates()` re-flushes on worker start; a missing `queuedAt` defaults to now, not "infinitely old."
- Eager flush on logout, on a successful `Auth.login()`, and on the popup port disconnecting.
- **`FLUSH_NOW`** — the popup sends it on `blur`/`pagehide`, i.e. the moment it starts going away (clicked outside, Escape, toolbar icon). That beats the port disconnect, which only arrives once the page is gone and the worker is already a candidate for teardown. Firing twice is harmless: the second finds the queue empty.
- **The close flush can't be the last word.** A port-disconnect listener can't hold the worker open, and the popup was its last client — the request is regularly killed mid-flight, and every other trigger needs a popup. So `persistPendingUpdates()` arms a `chrome.alarms` wake-up (`FLUSH_ALARM`) whenever the queue is non-empty and clears it when the queue drains; that alarm is the only thing that retries a failed or interrupted flush with no popup open. Needs the `alarms` permission. The delay doubles per consecutive failure from `FLUSH_RETRY_MINUTES` (0.5 — 30s is the floor Chrome clamps an alarm to) up to `MAX_FLUSH_RETRY_MINUTES` — offline, a fixed retry would wake the worker every 30s for the full 24h age-out.

`ENTRIES_SYNCED` — after a flush, background sends the server's real `updatedAt` per entry and `AniListDataContext` patches all four list caches. Keeps `rowOrder: "updatedAt"` honest without an extra request.

`Auth` — `chrome.identity.launchWebAuthFlow`, implicit grant. Random `state` per attempt (Chrome fails an identical-URL retry). No `redirect_uri` is sent; AniList redirects to whatever is registered on the `client_id`, and Firefox's is `https://<sha1(gecko.id)>.extensions.allizom.org/` — SHA-1 of the *declared* id, not the per-profile UUID. **Changing `gecko.id` invalidates the registered AniList app.**

### Popup

Fully remounted every open/close. Providers: `ApolloProvider` → `SettingsProvider` → `AniListDataProvider`.

- `apollo/client.ts` — the popup's own Apollo client; auth header read fresh from storage per request, not from React state. An `onError` link watches for `400 "Invalid token"` and sends `SESSION_EXPIRED`. It only observes — the error still reaches `useQuery`. Module-flag guarded, since one open fires several queries at once.
- `hooks/useUserId.ts` — the id comes from the stored `user`, **never a `Viewer` query**; everything needing it is `skip: !userId`, so querying it would serialise the whole first wave behind one round trip. Re-reads on `storage.onChanged`. Cached at module scope so a remount is synchronous — see Known constraints.
- `contexts/SettingsContext.tsx` — AniList prefs plus local-only settings (`manualCompletion`, `separateEntries`, `tabVisibility`, `showAnimeStats`/`showMangaStats`). Changing `tabVisibility` resets both stats toggles but they stay independently overridable — **don't re-couple**. Surfaces `error` alongside `loading`; every tab must check it or a failed query silently degrades to "0 items." The five AniList prefs mirror to storage as a paint cache, stamped with `prefsUserId` so another account's values are never shown; `serverPrefsRef` keeps the query's answer winning whichever lands first.
- `contexts/AniListDataContext.tsx` — cache/dirty-flag layer per list (`anime`/`stats`/`manga`/`mangaStats`). Call `markXDirty()` after a mutation affecting another tab. Session-only.
- `hooks/useAuth.ts` — bridge to background `Auth`, subscribes to `AUTH_CHANGED`. Treats `res.error` on a `LOGIN` response as a failed login, not a half-authed user.
- `hooks/useStableOrder.ts` — freezes on-screen order while held; item data still updates, only position holds. Kept in a **ref during render**, not `useState` + effect — the reorder re-freezes within a frame of releasing, and an effect-timeline update would hand back the pre-release order.
- `components/StateMessage.tsx` — shared loading/error/empty UI. Messages come from `lib/apolloErrors.ts#getErrorMessage`, which reads `error.networkError` (Apollo routes any HTTP ≥300 there, even for GraphQL-shaped bodies) to tell 429 / 403-outage / 400-dead-token / 5xx apart from a plain GraphQL error.
- Score formats and their max values: `MediaCard.getMaxScore`.

#### `components/MediaListTab.tsx`

The whole list pipeline (query → transform → adult filter → sort → caught-up split → grid), the optimistic update → `QUEUE_UPDATE` → dirty-flag path, and the reorder/removal choreography. `AnimeTab`/`MangaTab` are thin `MediaListConfig` wrappers — **put list-behaviour fixes here, not in the wrappers.**

- **Choreography**: one card at a time may animate a move (`animatingRef`); everything else is instant. `willEntryMove` compares the card's index within its *rendered section*, gated on `separateEntries` — otherwise a score bump that changes category reads as moving across the whole grid. A finished entry fades via `startRemoval`, the same path as "Mark as Completed", not the reorder's lift-and-return. The freeze outlives the pointer leaving — released only by `releaseOrder()` — because the grid must not reorder while a card is mid-fade.
- **The refreeze must land in a later commit than the release** (`scheduleRefreeze` + its `useLayoutEffect`). `useStableOrder` re-reads order *during render*, so a `holdOrder === false` render is the only thing that reorders the grid; batch release and refreeze together and the card plays its whole drop-in in its **old** slot, then jumps unanimated later. **Don't go back to `requestAnimationFrame`** — a frame can be served before React's scheduler task. Keep the effect keyed on `holdOrder`.
- **Timing** (`HIDE_BEFORE_REORDER_MS`, `REMOVE_FADE_MS`, `SETTLE_TOTAL_MS`) are hard ceilings on the matching classes in `styles/animation.css` — **change both together**. A CSS transition longer than its JS constant is simply cut off.
- **An open input is an interaction, not just hover**: `activeId = editingId ?? hoveredId`. `MediaCard`'s `onEditingChange(false)` must fire **after** `onProgressChange`/`onScoreChange`, or the interaction ends before the edit lands and the card teleports.
- No hover-out debounce — removed deliberately, don't re-add.

#### Focus ring and `--profile-color`

- One ring for the whole popup, defined in `styles/popup.css` under `@layer base`. **Don't add per-component focus styling.**
- `--profile-color` is set once on the popup root in `popup.tsx` and inherited, so components don't need their own declaration. `LoginPage` renders above that root, where the `#3db4f2` fallback applies.
- `outline-color`/`-width`/`-offset` are declared on `*` **and repeated with identical values** on `:focus-visible`. Both halves are load-bearing: identical values mean focus flips only `outline-style`, which isn't animatable, so a `transition-all` element can't fade the ring in or grow it outward; and the repetition on `:focus-visible` is what beats **Firefox's own `:focus-visible` rule**, which paints in `currentColor` and outranks a bare `*` selector.
- Opting out: utilities beat `@layer base`, so `focus:outline-none` still wins. Used by the card's number inputs (border-based instead) and by `CustomCheckbox`'s 0×0 hidden input, whose ring is drawn on the visible span via `peer-focus-visible`.
- Tight controls override the **offset only** (`outline-offset-0`): the card's stat arrows and `CustomToggle`'s segments, where the default 2px offset reached a neighbour. Don't inset the ring instead — on the toggle's selected segment that would be profile colour on a profile-coloured pill.
- `ScoreChart` passes `accessibilityLayer={false}`; recharts 3 defaults it on, which makes a display-only chart a tab stop.
- The popup is mouse-first. Focus styling is cosmetic — keyboard focus deliberately does **not** feed `MediaListTab`'s interaction/freeze system, so a keyboard edit reorders without animation. That's accepted, not a bug to fix.

## Known constraints

- `chrome.*` only, no `browser.*`/polyfill (Firefox aliases it). Requires **MV3** specifically: under MV2 Firefox's `chrome.*` is callback-only and the background's `await chrome.storage.local.get(...)` would silently resolve `undefined`. Never target `firefox-mv2`.
- `strict_min_version: 140.0` — required by `gecko.data_collection_permissions` (AMO, landed in 140; silently ignored below). Lowering it trips `KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION`.
- `@apollo/client` pinned to `3.8.10` (`dependencies` + `resolutions`/`overrides`) — a prior upgrade broke the MV3 build. Don't bump without testing the built extension in Chrome, not just `tsc`/`plasmo build`.
- **The popup window never shrinks.** Chrome sizes it from the document and grows it to fit, but won't narrow it again, and no reload or API resets that — so a root narrower than the window leaves bare page background down one side. The roots keep fixed `w-[…]` widths (`GRID_WIDTH`) so a card is the same size whatever the window ended up as; **don't "fix" a strip with `w-full` + `min-w-[…]`**, which fills the window by stretching the cards instead.
  - Grid Layout therefore only ever *widens* within a session. `SettingsContext` splits the value in two: `gridColumns` is the widest seen this session and is what every visual consumer reads; `gridColumnsSetting` is the stored choice and belongs only to the Settings control, which shows "Applies the next time you open the popup" while they differ. **A new width-dependent style must read `gridColumns`** — reading the setting reintroduces the strip.
  - `LoginPage` asks for the 3-column width whatever the grid setting is (`LOGIN_WIDTH`) — one small card centred in a 678px window reads as an empty popup. It's the one root that pairs that with `w-full`: it has no cards to stretch, so when the window is already wider (logged out of a 4-column session) filling it beats leaving a strip.
  - The placeholder paints at the logged-in width on purpose: almost every open resolves that way, and the alternative is a visible widen once `CHECK_AUTH` returns.
- **No native scrollbar.** Chrome sizes the popup window to its document, so a native bar appearing or disappearing resized the window *sideways*; `popup.css` hides it on both engines and `components/EdgeHandle.tsx` replaces it. Chrome has no true overlay scrollbar to fall back on — `overflow: overlay` is deprecated — and `scrollbar-gutter: stable` only trades the resize for a blank strip down every short tab.
  - The handle is a fixed-size D riding the right edge, hidden until you scroll or come within `EDGE_ZONE` of the edge. **Fixed size, not proportional**: it's a grab target, not a length indicator. It floats above the header at `z-50` with a shadow — a flat bar flush to the edge has to read on both the near-black header and the light list, and nothing flat does.
  - Its clearance comes from the list's `px-6`, **not** from the popup width — the handle is `position: fixed`, so cards always end at that padding whatever the window is. Narrow it and the handle laps the cards at its hover width.
  - It starts hidden on open, and `Tabs` fires a `tab-change` window event so it hides again on a switch. That hide has to outlive the switch: `popup.tsx` resets scroll on the new tab, and a scroll is a reveal. `ignoreScrollRef` covers `TAB_SCROLL_SETTLE_MS` after the event — a window rather than one event, since a shorter tab clamps the offset as it commits and *then* the reset scrolls again. Both scrolls must be swallowed, or the handle flashes for `IDLE_HIDE_MS` on every switch made from a scrolled list. That hide also cuts instead of fading (`instantHide`) — the reset jumps the handle to the top of the track, and the 220ms fade is long enough to watch it travel on its way out. The idle hide keeps the fade.
  - Don't tie the handle's track to the header's position. The header scrolls at rate 1 while the handle travels at `travel/maxScroll < 1`, so a track that followed it would drag the handle *upward* as you scroll down.
- `hooks/useUserId.ts` caches the id at module scope so a tab switch remounts synchronously. Reading storage on every mount briefly shortened the page mid-switch, which is what used to flash `StateMessage` — **don't make it read on every mount again**.
- Tailwind: `bg-white`/`text-white` = `#edf1f5` (popup background), **not** pure white — use `white-100` (`#ffffff`) for cards and panels.
- `components/CustomCheckbox.tsx` needs its `useEffect(() => setIsChecked(checked), [checked])` sync to stay externally controllable (e.g. `SettingsTab` flipping `showAnimeStats`) — don't remove as "redundant."
- VS Code showing a spurious `Cannot find name 'chrome'`: switch to the workspace TypeScript version (`tsconfig.json` uses `moduleResolution: "Bundler"`).
