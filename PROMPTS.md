# Prompt provenance

## Actual Lovable history

The connected Lovable project was recovered on 25 October 2026: [WeatherBoard in Lovable](https://lovable.dev/projects/97c3f284-b63f-4355-895a-6c0dcc3589c8), originally named Screenshot To Spark. Its actual recorded prompts are preserved in [LOVABLE-PROMPTS.md](docs/LOVABLE-PROMPTS.md), including the original challenge scaffold and managed push continuation. The earlier statement that no Lovable history existed was based on unavailable connector access and was incorrect.

The current React/Vite frontend was separately authored and improved with Codex. It is not the original TanStack scaffold from Lovable. The managed push service is implemented in the existing Lovable project. This distinction is retained rather than claiming the local frontend was primarily generated in Lovable.

Do not present the prompts below as previously executed. When a Lovable project is created, record the actual prompts, in chronological order, together with the changes made and any manual corrections.

## Prepared Lovable prompts (not yet executed)

### 1. Scaffold and design

Build WeatherBoard as a client-side React and TypeScript PWA. Use a warm off-white background, muted olive accents, clear typography, and responsive dashboard cards. Include a sidebar for up to five favourite cities, a keyboard-accessible city search, a large current-weather card, a five-day forecast, humidity/wind/UV/visibility cards, an hourly temperature view, and sunrise/sunset. Use actual public API data. Show intentional loading, empty, offline, and error states. Support 375px, 768px, and 1280px with no page overflow and mobile targets of at least 44x44px. Respect reduced motion.

### 2. Data and validation

Use GeoDB via RapidAPI for city autocomplete, a short debounce, cached suggestions, cancellation of stale requests, and specific no-result/network errors. Use OpenWeatherMap current and five-day data with Open-Meteo fallback. Normalize providers into a typed data model. Validate inputs on blur and submit. Store at most five unique favourite cities, confirm removal, and keep working in memory if localStorage is unavailable. Add persistent Celsius/Fahrenheit preferences without refetching.

### 3. PWA and notifications

Generate a valid manifest with 192px/512px and maskable icons. Cache the full application shell and fonts, plus the last successful city/weather snapshot. Prove offline reload works after a first online visit. Explain notification permission before prompting, handle denied/unsupported browsers, and implement the service-worker push and click handlers. Do not simulate closed-tab schedules with timers: integrate a provisioned push scheduler, or clearly disclose the unavailable feature.

### 4. Verification and handoff

Run type checks, production build, unit tests, and browser tests for data failure, fallback, autocomplete races, favourite limits/confirmation, unavailable storage, offline reload, and responsive widths. Check live APIs independently from fixtures. Record actual results and remaining limitations, preserve this exact prompt history, synchronize with public GitHub, and publish the verified build over HTTPS.
