# Prompt history

The complete agent prompt history for WeatherBoard, in order, copied verbatim from the session transcript. Times are PKT (UTC+5).

## Tool

- **Agentic IDE:** Claude Code, in the Claude desktop app (Code tab)
- **Model:** Claude Opus 5.5
- **Session:** one continuous session, 13 Nov 2026 22:52 → 14 Nov 2026 01:50 PKT. The context was compacted automatically once (00:37, between prompts 8 and 9); no prompts were lost.

> _TODO (author): the brief lists Cursor, Antigravity or OpenCode. If you used another tool for any part of this project, name it and add those prompts here._

## Strategy in one paragraph

One master prompt fixed the stack, architecture, quality bar and working method, and asked for a plan before any code. I reviewed the plan and replied with five amendments where the generic approach would have failed in practice: the GeoDB 1 req/s limit, browser-controlled notification timing, time-zone-correct forecast grouping, querying by coordinates, and exact fallback rules. After that, each step was a scoped prompt with explicit rules: what to build, what not to touch, which tests to add, and "stop and show me how to verify". I checked each step before saying "commit". Live smoke tests against the real APIs came before the UI. They exposed GeoDB's Lahore data problem, and I chose the fix (dedupe rather than hiding results).

---

## 1 · 22:52 · Master prompt

Attached: `Edspire-Frontend-Technical-Challenge.pdf`. The prompt below was pasted twice in the same message, the second time after the words "here is document"; it is shown once.

```text
You are a senior frontend engineer. Build "WeatherBoard", a production-quality, installable weather dashboard PWA. It must feel like a polished consumer product (Linear / Vercel / Mercury quality), not a tutorial project. Quality over quantity: every feature below must work properly.

## Stack
- Vite + React 18 + TypeScript (strict), Tailwind CSS
- vite-plugin-pwa with strategy "injectManifest" (I need a custom service worker)
- Client-side only, no backend. Deploy target: Vercel
- Keys via env vars (VITE_OWM_KEY, VITE_RAPIDAPI_KEY) with a committed .env.example. Never hardcode keys.

## Architecture (feature-based, small modules)
src/
  features/{search,weather,favourites,notifications,pwa}/
  lib/{api,storage,units,time}/
  components/ui/
  sw.ts
- API layer: typed clients with a normalised WeatherData model so UI never depends on provider shape
- Hooks for logic, components for presentation only
- Central error type: { kind: 'network' | 'rate_limit' | 'not_found' | 'unknown', message, action }

## Features (all required)
1. City search with autocomplete
   - GeoDB Cities API via RapidAPI (namePrefix, minPopulation filter, limit 6)
   - 300 ms debounce, min 2 chars, AbortController to cancel stale requests (GeoDB free tier is 1 req/sec)
   - Keyboard nav (arrows/enter/esc), ARIA combobox pattern
   - Visible states: loading, no results ("No cities match 'xyz'. Check the spelling."), API error with Retry
   - Validate on blur and on submit: empty field -> inline error
2. Weather display
   - OpenWeatherMap /weather + /forecast; aggregate 3-hour forecast into 5 daily cards (min/max, dominant condition)
   - Show temp, humidity, wind, condition icon
   - Automatic fallback to Open-Meteo if OWM returns 429/5xx/network error; map WMO codes to the same icon set; show a subtle "Using backup source" indicator
   - Skeleton loaders for every async fetch; specific error messages with a recovery action (never "Something went wrong")
3. Favourites
   - Max 5, persisted in localStorage, quick-access panel with mini current temp
   - Confirm dialog before removal (accessible, focus-trapped)
   - If localStorage is unavailable (try/catch), fall back to in-memory and show a small notice
   - At limit: disable add with an explanation
4. PWA
   - Manifest: name, short_name, 192 and 512 px icons (plus maskable), theme_color, background_color, display: standalone
   - Service worker: precache app shell; runtime-cache last viewed city's weather (stale-while-revalidate); offline works for the last city
   - Offline banner using online/offline events; show "last updated" time on cached data
   - Custom install button using beforeinstallprompt
5. Daily morning notification
   - Pre-permission explainer modal (why + what to expect) BEFORE Notification.requestPermission()
   - User picks reminder time (time input, validated, persisted)
   - Implement via the service worker. No backend exists, so use Periodic Background Sync where supported, with showNotification from the SW, and a graceful fallback elsewhere (in-app scheduled check while open + clear message about the limitation). Be honest in the UI about platform support.
   - Denied or unsupported: show a clear fallback state; nothing else breaks
6. Responsive
   - Must work at 375 / 768 / 1280 px, no horizontal scroll, touch targets >= 44x44 px
   - Mobile-first layout; favourites become a bottom sheet or horizontal chips on mobile, sidebar on desktop

## Bonus (only after everything above works)
- Dark/light/system theme toggle (no flash on load)
- °C/°F toggle persisted, instant update without refetch

## Design direction
- Calm, confident palette (Mercury-like), tight type hierarchy (Inter), generous spacing, subtle motion (respect prefers-reduced-motion)
- Designed empty state on first load (suggest popular cities, geolocation opt-in button)
- Cards with clear data hierarchy: large temp, secondary stats muted

## Quality bar
- Accessible: semantic HTML, labels, focus rings, aria-live for errors/loading, WCAG AA contrast
- No `any`, no dead code, no console logs, no mocked data
- Lighthouse targets: PWA pass, Performance/Accessibility/Best Practices >= 90

## Working method
1. First, output a short plan: file tree, data models, and the 3 riskiest parts (I expect: SW push without a backend, GeoDB rate limits, forecast aggregation).
2. Wait for my approval, then implement in small steps (scaffold -> API layer -> search -> weather -> favourites -> PWA -> notifications -> polish), stopping after each step so I can verify.
3. Do not add features outside this spec.
```

**Agent output:** a plan with the file tree, data models and three risks (no push server, GeoDB rate limit, forecast aggregation).

## 2 · 22:53 · Plan approval

```text
Approve, scaffold
```

## 3 · 22:58 · Plan review (sent while the scaffold was being built)

```text
## Prompt 1: Master prompt (spec + architecture + working method)
## Agent output: Plan (file tree, models, 3 risks)
## My review: approved with amendments
- GeoDB: debounce+abort does not enforce 1 req/sec -> added throttle + LRU cache
- Notifications: PBS timing is browser-controlled -> "around your chosen time", no SW setTimeout
- Forecast: group by city.timezone; daytime mode 06-21 local; same DailyForecast type for both providers
- Query by lat/lon, not city name
```

## 4 · 23:00 · Commit scaffold, full amendments, steps 2–3

```text
Before Step 2, commit the scaffold ("chore: scaffold Vite React TS PWA") and confirm git log shows it. Then save ALL amendments, not just the first four:
1. GeoDB: throttle min 1100 ms between requests (latest query only), LRU cache by normalised query, 429 retry once (Retry-After, default 1 s), then rate_limit AppError.
2. Notifications: UI says "around your chosen time", per-platform support status, fallback on app open/visibilitychange, no setTimeout in the SW, settings stored in IndexedDB (the SW cannot read localStorage).
3. Forecast: group by city.timezone local date, today merged with current conditions + next 4 full days, condition = mode over 06:00-21:00 local slots with "d" icon, ties go to the more severe condition, identical DailyForecast type from both providers.
4. Fetch weather by lat/lon only. Offline cache key: lastCity + fetchedAt.
5. getWeather(lat, lon): OWM first, fall back to Open-Meteo on 429/5xx/network error only (never on 404/401), return source: 'owm' | 'open-meteo', typed AppError with a recovery action if both fail.
Proceed with Steps 2-3 only: API layer plus Vitest fixtures for aggregation (including a tie-break case), the fallback logic, and GeoDB (fake timers: spacing, latest-only queue, cache hit = zero network calls, 429 retries once). Stop after each step and show how to verify.
```

## 5 · 23:12 · Live smoke tests, then the search UI

```text
Step 2 is committed. Before building the UI, do these in order.

1. Live smoke tests (needs .env; never print or commit keys or full raw responses):
   - OWM current + forecast for Lahore by lat/lon
   - GeoDB namePrefix "lah"
   - Open-Meteo for Lahore
   Print only the top-level keys and one sample field per response. Confirm our parsers accept each. If any mismatch (endpoint, header name, field mapping like data[].latitude), fix the parser and add a fixture trimmed from the real response.

2. Step 3: city search UI
   - ARIA 1.2 combobox: role=combobox, aria-expanded, aria-controls, aria-activedescendant, listbox/option roles
   - Keyboard: ArrowUp/Down, Enter selects, Esc closes, Home/End
   - 300 ms debounce, min 2 chars. Use citySearch.ts as is (throttle, cache, 429 retry).
   - Show loading immediately on typing. Cached results render instantly with no loading flash.
   - States: loading, results, no results ("No cities match 'xyz'. Check the spelling."), error with a Retry button using AppError.message and action. On 429: "Search is busy, retrying...".
   - Validation: empty field shows an inline error on blur and on submit. Submitting free text with no selection says "Pick a city from the suggestions."
   - aria-live=polite for status and errors. Touch targets >= 44px. Visible focus ring.
   - On select, emit a City { id, name, region, country, lat, lon }. Do not fetch weather yet.

3. SourceBadge component (used in Step 4): when source is 'open-meteo', show "Using backup source" with a tooltip: "Backup source, conditions may differ slightly." The tooltip must be keyboard accessible.

Rules: no any, no console, no dead code, hooks for logic and components for presentation only. Add tests for useCitySearch (state transitions, stale response ignored, abort on unmount) with fake timers.

Stop after this step. Show me: npm test, typecheck, lint, build results, and how to verify manually in the browser (including a throttled 429 case).
```

## 6 · 23:22 · Keys added

```text
I have added api keys in env exmple file now test
```

## 7 · 23:26 · Step 3 review: key safety, GeoDB dedupe, more smoke tests

The last sentence was cut off when sent; it is reproduced as it arrived.

```text
Step 3 approved with changes.

1. Before committing, check that no key is in git history: git log -p --all -- .env.example. Report only yes/no, never print keys. Confirm .env is ignored and .env.example is blank.

2. GeoDB: drop types=CITY. Keep the `type` field in the parsed result.
   - Dedupe results in the same country within ~25 km: prefer type CITY over admin areas, then the higher population.
   - Strip a trailing "Division" or "District" from the display name only when type is not CITY.
   - Fixture tests trimmed from the real "lah" and "lon" responses: Lahore appears once, named "Lahore"; Londrina appears once; "Greater London" does not beat "London".

3. Extend npm run smoke: GeoDB prefixes "lahore", "islamabad", "rawalpindi", "karachi", "sargodha", "peshawar", "lon". Print only name, type and country per hit, max 3 per query. If any Pakistani city is missing, tell me before choosing a fix.

4. Show in the results list: "Name, Region, Country". Keep the second line muted.

Then commit Step 3 as "feat(search): ARIA combobox, live GeoDB search, dedupe" and report git log --oneline.
Next: Step 4 (weather display). Fetch by lat/lon from the selected City. On success persist { lastCity, fetchedAt } to storage. Skeletons for every async fetch, aria-live for status and errors, specific error messages with a recovery action, SourceBadge with the backup tooltip, "Updated X min ago". Designed first-load empty state: popular-city chips (Lahore, Islamabad, Karachi, London, New York) plus a geolocation opt-in button where denial breaks nothing. Chips
```

## 8 · 23:32 · Step 4: weather display

```text
Step 3 accepted. Proceed with Step 4 (weather display).

Your default for chips is correct: tapping a chip loads that city's weather straight away, and chips are at least 44px tall. They call getWeather directly with fixed lat/lon (Lahore, Islamabad, Karachi, London, New York), so they work even if GeoDB is down.

Scope, in order:
- Fetch by lat/lon from the selected City. On success persist { lastCity, fetchedAt } via the storage layer (try/catch, in-memory fallback).
- Skeleton loaders for every async fetch.
- aria-live for status and errors. Specific error messages, each with a recovery action.
- SourceBadge: "Using backup source" tooltip when Open-Meteo is used.
- "Updated X min ago", refreshing over time.
- Designed first-load empty state: popular-city chips plus a geolocation opt-in button. Denial or unsupported must break nothing and show a clear message.
- Add the Lahore note to known limitations later (don't act on it now).

Do not start favourites or PWA. Add tests for any new logic (time formatting, the weather hook states). Run typecheck, lint, tests and build. Then stop and show how to verify, including how to force the fallback and an error state without burning API quota.
Do not commit until I say so.
```

## 9–20 · Review, commit and continue

From here on, each step ended with the agent's results (tests, typecheck, lint, build, browser checks) and a question. These are the replies, in order. Button replies are marked.

| # | Time | Reply | Answering |
|---|---|---|---|
| 9 | 00:55 | `Review first` (button) | "Commit step 4 now?" The agent reviewed its own diff and found two issues: unused storage methods (dead code), and a restore effect that could get stuck on loading. |
| 10 | 00:56 | `Yes, fix both` (button) | "Apply both fixes before committing step 4?" |
| 11 | 01:00 | `Commit the working tree changes with a sensible message.` (commit button) | Step 4 → `5e5c7f2 feat(weather)` |
| 12 | 01:00 | `go` | Start step 5, favourites |
| 13 | 01:11 | `Commit the working tree changes with a sensible message.` (commit button) | Step 5 → `e3d3423 feat(favourites)` |
| 14 | 01:12 | `go` | Start step 6, PWA |
| 15 | 01:24 | `Commit the working tree changes with a sensible message.` (commit button) | Step 6 → `54563b1 feat(pwa)` |
| 16 | 01:25 | `go` | Start step 7, notifications |
| 17 | 01:34 | `Commit the working tree changes with a sensible message.` (commit button) | Step 7 → `4332849 feat(notifications)` |
| 18 | 01:36 | `go` | Start step 8, polish (theme, °C/°F) |
| 19 | 01:47 | `Commit the working tree changes with a sensible message.` (commit button) | Step 8 → `14d8ec6 feat(preferences)` |
| 20 | 01:50 | `for vercel and public github repo I will do it by myself proceed with readme and prompt md` | This README and PROMPTS.md |

---

## What review changed

Where the agent's first approach was generic or wrong, and what replaced it.

| Area | First approach | What changed, and why |
|---|---|---|
| GeoDB rate limit | Debounce + AbortController | Aborting doesn't stop a request already counted against the 1 req/s quota. Added a 1,100 ms throttle (latest query only), an LRU cache and a single 429 retry (prompt 4). |
| Notifications | Schedule a reminder for an exact time | Without a push server the browser decides when Periodic Background Sync runs, so the UI promises "around your chosen time". No timers in the service worker, settings in IndexedDB, a fallback check when the app opens, and per-platform support status (prompts 3–4). |
| Forecast | Group 3-hour slots by date | Group by the city's local date, not the viewer's. Daily condition = most common daytime condition, ties to the more severe. Same `DailyForecast` type from both providers (prompts 3–4). |
| Weather lookup | By city name | By lat/lon only, so ambiguous names can't return the wrong place (prompts 3–4). |
| Fallback | Fall back on any error | Only on 429, 5xx or network. A 401/404 is our bug, and falling back would hide it (prompt 4). |
| GeoDB data | `types=CITY` filter | The live smoke test showed GeoDB has no CITY entry for Lahore, so it was missing from results. Dropped the filter, deduplicated nearby results, and stripped "Division"/"District" (prompt 7). |
| Popular cities | Search for them | Fixed coordinates, so the chips work when GeoDB is down and use real city centres (prompt 8). |

## Problems caught during review and verification

| Problem | How it was caught | Fix |
|---|---|---|
| API keys typed into the tracked `.env.example` (prompt 6) | Agent check before committing | Keys moved to the ignored `.env`, template restored; git history checked: no key was ever committed |
| Step 2 reported as committed but wasn't | `git log` check | Committed before continuing |
| IDE index files swept into a commit | Reviewing the step 3 commit | Untracked and added to `.gitignore`, commit amended |
| Location copy said coordinates are "never stored" | Agent review of its own copy | Corrected: they're kept on this device as the last viewed place |
| Restoring the last city could hang on "loading" | "Review first" (prompt 9) | Fixed, with a test that fails on the old code |
| Unused storage methods (dead code) | "Review first" (prompt 9) | Removed |
| Mobile: favourites chips pushed the weather card off-screen | Screenshot at 375 px; the page-level scroll check had missed it because `body` hides horizontal overflow | Grid column fixed to `minmax(0, 1fr)` |
| Service worker "Reload" button did nothing (scaffold bug) | Clicking it in the browser | The SW listened for the string `'SKIP_WAITING'`; workbox-window sends `{ type: 'SKIP_WAITING' }` |
| First visit wasn't cached for offline | Browser check: page not controlled by the SW | `clientsClaim()` |
| A stale reload caused three extra weather requests | Counting requests in the browser | One background refresh per request, and a debounced page refresh |
| Reminder settings could overwrite the SW's "shown today" mark | Reasoning about the lint warning on the first implementation | Atomic read-modify-write in IndexedDB, with a test |
| Reminder hook tests would have called the live API | Code review: Vitest loads `.env` | Weather fetch made injectable |
