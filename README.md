# WeatherBoard

An installable weather dashboard. Search any city with live autocomplete, see current conditions and a 5-day forecast, keep up to 5 favourites, use it offline for the last city you viewed, and get a daily weather reminder.

- **Live URL:** https://weatherboard-bay.vercel.app/
- **Repository:** https://github.com/Sajad-ahmed-soomro/WeatherBoard

Built for the Edspire Frontend (React) technical challenge. The agent prompt history is in [PROMPTS.md](PROMPTS.md).

---

## Features

| Area | What it does |
|---|---|
| City search | GeoDB autocomplete with an ARIA 1.2 combobox (arrow keys, Home/End, Enter, Esc). Results arrive 300 ms after you stop typing, and repeat searches come from a cache instantly. Loading, no-results, rate-limit ("Search is busy, retrying…") and error-with-Retry states. Validation runs on blur and on submit. |
| Weather | Current temperature, feels-like, humidity, wind and condition icon, plus a 5-day forecast with low–high bars. Data comes from OpenWeatherMap, with automatic fallback to Open-Meteo and a subtle "Using backup source" badge. Every fetch has a skeleton, a screen-reader announcement and a specific error with a recovery action. |
| First visit | Popular-city chips (Lahore, Islamabad, Karachi, London, New York) and an opt-in "Use my current location". Denied or unsupported geolocation shows a clear message and breaks nothing. |
| Favourites | Up to 5 cities, each showing its current temperature. Removal asks for confirmation in a focus-trapped dialog. At the limit, the add button stays focusable and explains why it can't add. If storage is blocked, favourites live in memory and a notice says so. Chips on mobile, a sidebar on desktop. |
| PWA | Manifest with 192, 512 and maskable icons. The app shell is precached, and the last viewed city's weather is cached with stale-while-revalidate. An offline banner shows the cached data's real age. Custom install button, and an "update available" prompt. |
| Daily reminder | An explainer appears before the browser's permission prompt. You choose a time (validated), saved in IndexedDB. Periodic Background Sync is used where the browser allows it; otherwise the app checks while open. The UI states honestly how this browser delivers the reminder. |
| Bonus | System / light / dark theme with no flash on load. A °C/°F switch, persisted and applied instantly without refetching. |
| Responsive | Checked at 375, 768 and 1280 px: no horizontal scroll, touch targets ≥ 44 px. |

---

## Setup

Requires Node 20.19+ or 22.12+ (Vite 8). Developed on Node 24.

```bash
npm install
cp .env.example .env    # then add your two keys
npm run dev
```

| Variable | Where to get it |
|---|---|
| `VITE_OWM_KEY` | [OpenWeatherMap API keys](https://home.openweathermap.org/api_keys). A new key can take up to 2 hours to activate. |
| `VITE_RAPIDAPI_KEY` | A [RapidAPI](https://rapidapi.com/wirefreethought/api/geodb-cities) key subscribed to GeoDB Cities (free tier). |

`.env` is git-ignored. On Vercel, set both variables under Project → Settings → Environment Variables, then redeploy: Vite inlines them at build time.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (the service worker also runs in dev) |
| `npm run build` | Type-check, then a production build into `dist/` |
| `npm run preview` | Serve the production build locally (best for testing the PWA and offline mode) |
| `npm test` | Unit and component tests (Vitest + Testing Library, jsdom) |
| `npm run typecheck` / `npm run lint` | `tsc -b` across app, service worker, node and script projects; ESLint with typescript-eslint strict and react-hooks |
| `npm run smoke` | **Live** smoke tests against the real APIs (uses `.env`). Prints only status, top-level keys and one field per response, never keys or full bodies. |
| `npm run icons` | Regenerate PWA icons from `public/icons/icon.svg` |

---

## APIs used

| API | Used for | Endpoint(s) |
|---|---|---|
| OpenWeatherMap (free) | Primary current conditions and 3-hour forecast | `api.openweathermap.org/data/2.5/weather`, `/forecast` (by lat/lon, metric) |
| Open-Meteo (no key) | Fallback weather source | `api.open-meteo.com/v1/forecast` (current + daily, `timezone=auto`) |
| GeoDB Cities via RapidAPI (free) | City autocomplete | `wft-geo-db.p.rapidapi.com/v1/geo/cities` (`namePrefix`, `minPopulation=10000`, sorted by population) |
| Notifications API + Periodic Background Sync | Daily reminder | Browser-native, through the service worker |
| Geolocation API | Optional "Use my current location" | Browser-native, only after the user presses the button |

---

## Architecture

```
src/
  features/
    search/          City search: useCitySearch (requests), useCityCombobox (ARIA + keyboard), CitySearch UI
    weather/         useWeather, useGeolocation, current card, forecast, empty state, error and skeleton
    favourites/      useFavourites (max 5), useMiniTemps (per-city current temp), panel, toggle
    pwa/             useAppUpdate, useInstallPrompt, useOnlineStatus, useWeatherCacheUpdates, banner, toast
    notifications/   useReminder, settings (IndexedDB), schedule rules, shared daily check, card, explainer
    preferences/     useTheme, useUnits, unit context, display switches
  lib/
    api/             Typed clients, normalisers, fallback, aggregation, errors, GeoDB throttle/cache/dedupe
    storage/         safeStorage (localStorage with in-memory fallback), IndexedDB wrapper, guards
    pwa/             Weather cache rules shared by the page and the service worker
    time/, units/    Relative time, city-local dates, temperature/wind formatting
  components/ui/     Icons, Skeleton, Tooltip, ConfirmDialog (native <dialog>), SegmentedControl
  sw.ts              Custom service worker (injectManifest)
```

Hooks hold the logic and components only render. TypeScript is strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). There is no `any` and no `console`, and ESLint enforces both.

### Key decisions

**A normalised data model.** Both weather providers are parsed into one `WeatherData` type: current conditions plus `DailyForecast[]`. The UI never sees a provider's response shape. Responses are validated field by field; an unexpected shape becomes a typed parse error instead of `undefined` reaching the UI.

**One error type with a next step.** Every failure becomes `AppError { kind: 'network' | 'rate_limit' | 'not_found' | 'unknown', message, action }`. The message says what failed and what to do (for example, "rejected this app's API key… a new key can take up to 2 hours to activate"), and `action` is a Retry or Search-again button. There is no generic "Something went wrong".

**Fallback only when the primary is unavailable.** `getWeather(lat, lon)` tries OpenWeatherMap first and falls back to Open-Meteo only on 429, 5xx or a network error. A 401 or 404 means our request is wrong, so falling back would hide the bug. The result records its `source`, which drives the badge.

**Forecast aggregation in the city's own time zone.** OWM's 3-hour slots are grouped by the city's local date, not the viewer's. Today merges in the current reading, followed by the next 4 days. A day's condition is the most common one between 06:00 and 21:00 local time, with ties going to the more severe condition and the day icon always used. The tie-break and day boundaries have fixture tests.

**GeoDB within its free tier (1 request/second).**
- At least 1,100 ms between requests. Only the latest query waits; older ones are dropped.
- An LRU cache keyed by the normalised query, so a repeat search costs no request.
- A 429 is retried once, honouring `Retry-After`, before showing a rate-limit message.
- Results are deduplicated. Some cities exist only as admin areas: Lahore appears only as "Lahore Division" and "Lahore District". So there's no `type=CITY` filter; nearby duplicates are merged and "Division"/"District" is stripped from the name.

**Fetch by coordinates.** Weather is always requested by lat/lon from the selected city, never by name, to avoid ambiguous city names.

**Storage that never throws.** `safeStorage` checks localStorage and switches to memory if it's blocked or a write fails (e.g. quota). Saved values are validated when read back. Favourites tell the user when they're memory-only.

**Offline cache for the last viewed city ([`src/sw.ts`](src/sw.ts)).**
- Only the main weather requests for the city being viewed are cached. Loading a new city's forecast deletes the previous city's entries.
- Cache keys have the API key removed, so it never reaches Cache Storage.
- Favourites' mini temperatures use `cache: 'no-store'`, so they can never replace the last city.
- Stale-while-revalidate: the cached copy is served at once. If it's over 60 s old, it's refreshed in the background (one refresh per request at a time) and the page is told, so it updates without a skeleton.
- Each response is stamped with its network fetch time, so cached data shows its real age ("Updated 3 hr ago").
- Updates wait for the user ("A new version is ready → Reload").

**Daily reminder without a push server.**
- There's no backend, so true Web Push isn't possible.
- Where available, Periodic Background Sync wakes the service worker. On each wake-up it checks whether today's reminder is due. There are no timers in the service worker, because it can be stopped at any moment.
- An open page runs the same check on launch, when you return to the tab, and every minute.
- Settings live in IndexedDB, because the service worker can't read localStorage. Writes are atomic read-modify-write, and the day is "claimed" before showing, so the page and the service worker can never both send it.
- The UI says "around your chosen time" and explains, per platform, where reminders work.

**No theme flash.** A small inline script in `index.html` applies the saved theme before first paint. A test runs that exact script, so it can't drift from the app's theme code. Dark-mode colours were checked against WCAG AA.

**Units are display-only.** All data stays in °C, and a React context converts at render time, so switching never refetches. The choice is also copied into the reminder settings so background notifications use it.

### Testing

- **166 tests in 22 files**, all run with `npm test`. They cover:
  - forecast aggregation fixtures, including the tie-break
  - provider fallback rules
  - GeoDB throttling, cache and 429 retry, with fake timers
  - deduplication fixtures trimmed from real responses
  - the search, weather, favourites, mini-temperature, PWA and reminder hooks
  - storage fallbacks, cache rules, the confirm dialog's focus handling, and the theme script
- `npm run smoke` checks the real APIs and the parsers against live responses.
- Checked by hand in Chromium at 375, 768 and 1280 px:
  - the fallback, by blocking `api.openweathermap.org`, and the error state, by blocking both weather providers
  - offline app shell and last city
  - stale-while-revalidate timing
  - the update prompt
  - the removal dialog with keyboard
  - theme and unit switching (zero weather requests on unit change)

---

## Known limitations

1. **API keys are public.** Vite inlines `VITE_*` variables, so both keys are readable in the shipped JavaScript, including `sw.js`, which fetches the reminder forecast. This is unavoidable without a backend. Both are free-tier keys that can be rotated if abused; a small proxy (e.g. a Vercel function) holding the keys server-side would be the proper fix.
2. **The daily reminder can't be guaranteed while the app is closed.**
   - No push server means only Periodic Background Sync can wake the app. That works only in Chrome or Edge, usually only for an installed app.
   - The browser picks the timing based on how much you use the site, often 12 hours or more apart.
   - Everywhere else (Safari, Firefox, iOS, a normal tab) the reminder shows only while the app is open, or when you next open it.
   - A reminder more than 6 hours late is skipped. The UI says all of this.
   - On iPhone/iPad, notifications need the app added to the Home Screen first.
3. **GeoDB's Lahore is not the city centre.** GeoDB has no CITY entry for Lahore, only the Division and District, whose coordinates are about 30 km from the centre. Searching "Lahore" therefore shows weather for that point. The popular-city chip uses true city-centre coordinates. Favourites are matched by id, so the chip Lahore and the search Lahore count as different places.
4. **Search rate limit.** The GeoDB free tier allows 1 request/second, so very fast typing can wait about 1 s for suggestions. Repeat queries are instant from the cache.
5. **The providers summarise a day differently.**
   - With OWM, each day's condition is the most common daytime condition. Open-Meteo's daily code is the most *severe* condition of the day, so the backup source can show "Rain" where OWM would show "Cloudy".
   - The UTC offset is taken once per response, so on a daylight-saving change day, later 3-hour slots can shift by an hour.
   - Late at night, "Today" may contain only the current reading.
6. **Offline covers one city.** Other cities, search and favourites' mini temperatures need a connection; mini temperatures show "–" when unavailable.
7. **Install button on Chromium only.** Safari and Firefox don't fire `beforeinstallprompt`; use the browser's own menu (Share → Add to Home Screen on iOS).
8. **Favourites' temperatures** refresh every 10 minutes when you return to the tab, not continuously.
9. **Wind speed stays in km/h** when °F is selected (the brief only asks for a °C/°F toggle).
10. **Not covered:**
    - Animated weather icons (the third bonus) aren't implemented.
    - Lighthouse scores haven't been measured.
    - A real granted notification, a real periodic-sync wake-up and the browser's own offline toggle were tested with unit tests and simulated events, not end to end in a real browser.
11. **Location privacy.** If you use "Use my current location", the coordinates are sent to the weather providers and remembered on this device as the last viewed place.
