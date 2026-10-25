# WeatherBoard

A responsive weather dashboard with live current conditions, five-day forecasts, saved cities, themes, temperature units and offline access. React 19, TypeScript, Vite and custom CSS.

**Live:** https://weatherboard-dahim.sunlitotter64.chatgpt.site

**Source:** https://github.com/DahimAlam/WeatherBorad

## Run and test

Requires Node.js 22.12+ and npm; tested with Node.js 24 and installed Google Chrome.

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:e2e
node scripts/live-smoke.mjs
```

Use `npm.cmd` in Windows PowerShell if script execution is disabled. `npm run preview` serves the production build. Test service workers/offline behavior on HTTPS or localhost with a production build.

## Features

- Live temperature, condition, humidity, wind, visibility, sunrise/sunset and five-day forecast; missing optional measurements are shown honestly.
- OpenWeatherMap current and 5-day/3-hour forecast with Open-Meteo fallback.
- **Free GeoDB city search, without a key or paid subscription**, with city/region/country, keyboard navigation, 200ms debounce, cached results, cancellation, empty states and actionable errors.
- Validation on blur and submit; loading and error states for asynchronous work.
- At most five unique favourites, confirmed removal, persistence, and usable in-memory behavior when storage is unavailable.
- Installable PWA, 192/512px icons and maskable icon; cached shell, fonts and last successful city; explicit offline/saved-data banner.
- Celsius/Fahrenheit, light/dark/system themes, reduced-motion support and optional device location.
- Responsive at 375/768/1280px, visible focus and 44px mobile targets.
- Notification permission explanation, supported/denied states, local test notification, and a tested external scheduler adapter. **Daily closed-tab reminders are not enabled; see below.**

## Configuration

Copy `.env.example` to `.env.local`. No key is required for the default free city search and Open-Meteo weather.

| Variable | Purpose |
| --- | --- |
| `VITE_CITY_SEARCH_PROVIDER` | `geodb-free` (default), `rapidapi`, or `open-meteo`. |
| `VITE_OPENWEATHER_API_KEY` | Optional OpenWeatherMap key; failure falls back to Open-Meteo. |
| `VITE_GEODB_API_KEY` | Used only when provider is explicitly `rapidapi`; requires a GeoDB subscription for the same RapidAPI application. |
| `VITE_PUSH_API_URL` | Base URL of a repaired and verified external push service. Leave empty for now. |
| `VITE_VAPID_PUBLIC_KEY` | Browser-safe public key of that sender. Leave empty for now. |

The user's free-API preference is implemented with GeoDB's free endpoint, verified over HTTPS with browser CORS. The saved RapidAPI key is not used in free mode. The free service is rate limited and has a smaller city catalogue; search errors explain rate limits.

`VITE_*` values are browser-visible build configuration, **not secrets**. Do not put a VAPID private key or server credentials here. `.env.local` and build output are ignored and excluded from source publication. Changing browser configuration requires a rebuild.

Sources: [GeoDB API](https://geodb-cities-api.wirefreethought.com/docs/api), [GeoDB free-tier limits](https://geodb-cities-api.wirefreethought.com/pricing), [OpenWeatherMap](https://openweathermap.org/forecast5), [Open-Meteo](https://open-meteo.com/en/docs).

## Architecture

- `src/lib/weather.ts`: typed provider adapters, source fallback, search caching, city-local forecast grouping and unit conversion.
- `src/lib/storage.ts`: validated favourites/snapshots, in-memory fallback and Cache Storage backup.
- `src/components/`: autocomplete, modal dialogs, weather icons and reminder settings.
- `src/sw-template.js`: versioned shell caching, push receipt/click handlers and offline navigation. Redirected cached HTML is reconstructed to support the production host.
- `scripts/build-pwa.mjs`: generated PNGs and service worker whose version includes all shell asset contents.
- `tests/`: fixtures isolated from production, unit tests and Chrome browser tests.
- `services/push/`: locally corrected Lovable sender source and remaining deployment instructions; not bundled into the frontend.

The dashboard is a client-side SPA. Preferences stay in the browser. Only selected coordinates are sent to weather providers. Optional location permission is requested after the user's action.

## Reminders: honest deployment status

Reliable daily delivery while the tab is closed requires an external scheduled push sender. A service worker cannot reliably wake itself at an arbitrary time.

The existing [Lovable project](https://lovable.dev/projects/97c3f284-b63f-4355-895a-6c0dcc3589c8) provisioned a managed database, subscription API, VAPID sender and a reported 15-minute dispatcher. Review found an incorrect encrypted payload delimiter; a corrected sender and independent decrypt/signature test are included locally. The public API also needs endpoint restrictions and stronger dispatch concurrency handling before activation.

**Lovable's workspace is out of credits. The repair could not be applied/published through its connected editor, so this deployment keeps daily reminders disabled.** No paid plan was purchased. Existing local test notifications do not establish scheduled delivery.

The frontend's adapter expects:

- `POST /subscriptions`: `{subscription: PushSubscriptionJSON, time: "HH:mm", timezone: "IANA/Zone"}`, acknowledged after persistence.
- `DELETE /subscriptions`: `{endpoint}`, acknowledged after cancellation.
- A server-held VAPID private key, verified CORS, valid destination restrictions, timezone-aware schedules and expired-subscription cleanup.
- Payload `{title?: string, body?: string}`; service-worker clicks open this app.

See [sender repair and activation steps](services/push/README.md). Enabling this managed backend is an exception to the challenge's client-only constraint. Physical closed-tab delivery must be verified after repair.

## Verification and limitations

See [TESTING.md](docs/TESTING.md), [local live evidence](docs/live-smoke.json) and [production live evidence](docs/production-smoke.json). Automated browser tests cover weather errors/fallback, search races/empty states, favourites/limits/confirmation, blocked storage, offline reload, themes, forecast details and responsive layouts.

The latest free-GeoDB local search took **1386ms**, including debounce. Immediate loading feedback and caching work, but a strict 300ms uncached-results guarantee is **not met**. No fake suggestions or invented weather are used.

Native PWA installation and notification appearance on physical iOS/Android devices remain manual checks.

## Provenance

An original WeatherBoard scaffold and six challenge prompts existed in Lovable. Connector access recovered them on 25 October 2026. The current React/Vite frontend was separately developed in Codex and preserves that work; it is not falsely labelled as the original Lovable-generated TanStack scaffold. The managed reminder service was subsequently implemented in Lovable.

[PROMPTS.md](PROMPTS.md) links the recovered actual prompts and clearly distinguishes them from unexecuted drafts. This mixed development history is a deviation from a strict interpretation of “Lovable as the primary development tool.”

## Deployment

Static build command: `npm run build`; publish directory: `dist`. Netlify and Vercel configurations are included. The deployed Sites identity is retained in `.openai/hosting.json`; public reviewer access is enabled. Do not create another Site for updates.

The existing Git history remains local. Public GitHub publication adds the reviewed source to the user's existing repository without replacing unrelated work or publishing credentials. Sites source hosting and GitHub submission are separate.

## Credits

Weather: OpenWeatherMap/Open-Meteo. City data: GeoDB (Wirefree Thought; GeoNames/Wikidata). Icons: Lucide (ISC). Fonts: DM Sans and Manrope (SIL OFL, included locally). Weather artwork: original CSS/SVG.
