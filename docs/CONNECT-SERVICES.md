# Service configuration

GitHub and Lovable connectors are connected and verified. The public repository is [DahimAlam/WeatherBorad](https://github.com/DahimAlam/WeatherBorad). The existing [Lovable project](https://lovable.dev/projects/97c3f284-b63f-4355-895a-6c0dcc3589c8) contains the original challenge and managed push work.

## Free city API

No subscription or new key is needed. Free GeoDB is the default and was verified over HTTPS with CORS. Set VITE_CITY_SEARCH_PROVIDER=geodb-free explicitly if desired. The saved RapidAPI key is ignored in this mode. This honors the user's free-API preference and substitutes GeoDB's free service for the brief's RapidAPI transport.

RapidAPI mode is optional: set VITE_CITY_SEARCH_PROVIDER=rapidapi and VITE_GEODB_API_KEY only after the same RapidAPI application has a GeoDB subscription. No paid subscription was purchased.

## Weather

The saved OpenWeatherMap key works. VITE_OPENWEATHER_API_KEY is optional; Open-Meteo remains the live fallback. API keys in VITE_* are browser-visible and .env.local is excluded from Git.

## Reminders

Do not add private push keys to VITE_* variables. The Lovable managed sender needs the corrections in [services/push/README.md](../services/push/README.md), then publication and real device verification. Lovable currently reports no credits, so no further account secret is needed from the user; editor availability is the blocker. Keep VITE_PUSH_API_URL and VITE_VAPID_PUBLIC_KEY empty until repaired service verification.

Never paste credentials in chat. Save local changes before rebuilding; environment changes alone do not update production.
