# Prompt history

## 1. Milestone 1 (2026-10-24)

````text
Build WeatherBoard from the attached challenge. Use Lovable as the primary
development tool. Implement a working React + TypeScript app with real data.
Keep the architecture small and understandable for an interview.

Visual direction:
A polished, calm weather dashboard: off-white background, navy typography,
subtle blue accents, clear card hierarchy, restrained shadows. Prioritise
weather information and useful empty/error states. No marketing landing page.
Support 375px, 768px and 1280px without horizontal scrolling. Mobile touch
targets must be at least 44px.

Implement this first working milestone:

1. GeoDB Cities autocomplete through RapidAPI.
Use a 250ms debounce, show searching feedback immediately, cancel stale
requests, cache repeated searches, and support keyboard selection.
Show city, region and country to distinguish duplicate names.
Handle empty input on blur, no results, network failures and rate limits.
Do not promise API responses within 300ms; make UI feedback immediate.

2. Current weather and a 5-day forecast.
Use OpenWeatherMap, with Open-Meteo fallback when OpenWeatherMap is
unavailable or rate-limited. Use the selected city's coordinates.
Show temperature, condition icon/text, humidity, wind speed and units.
Group forecast data by the city's local date; do not display five
three-hour intervals as five days.
Every request needs loading, success and actionable error states.
No mocked weather or fabricated city suggestions.

3. Up to five favourite cities.
Persist favourites in localStorage. Prevent duplicates, explain the
five-city limit, and confirm removal. If storage fails, keep the app usable
in memory and explain that favourites will not persist.

4. Clean structure:
Separate API adapters, storage helpers and UI components.
Include accessible labels, visible focus and clear retry actions.
Prevent older requests from overwriting a more recent city selection.

Configuration:
Tell me exactly which API configuration is needed. Do not invent credentials.
Do not commit real keys. Explain that frontend environment variables are
visible in the built app and cannot keep API credentials secret.
Do not introduce a backend without explaining why it is needed.

This is milestone 1. Leave PWA and notification implementation for the next
prompt. Do not add bonus animations or unrelated features yet.

Create README.md with setup and architectural decisions.
Create PROMPTS.md and record this prompt verbatim as the first entry.
Append future prompts accurately; never invent prompt history.
````

## 2. API configuration question (2026-10-24)

````text
is this is the vite rapid api key ?
curl --request POST \
     --url 'http://geodb-free-service.wirefreethought.com/graphql' \
     --header 'content-type: application/json' \
     --data '{"query":"QUERY"}'

and this is openweather apik ey ??
https://api.openweathermap.org/data/4.0/onecall/current?lat={lat}&lon={lon}&appid={API key}
````

## 3. Free-service choice (2026-10-24)

```text
Yes, use free service
```

## 4. Completion check (2026-10-24)

```text
is this is done ?
```

## 5. Notification check (2026-10-24)

```text
and the notification system is working?
```

## 6. Full challenge completion (2026-10-24)

Attachment: `frontend_challenge_weather.pdf` (full challenge, including PWA/offline and daily reminder requirements).

```text
i am providing you a pdf checkk it and fullfilled all the requqirement
```

Entries 2–4 were recovered from the available conversation summary; its formatting may differ from the original messages. Entries 5–6 reproduce the visible user messages. No unavailable prompts have been invented.

## 7. Managed Web Push scheduler (2026-10-25)

```text
Continue the existing WeatherBoard challenge project; preserve existing work. The user has authorized completion, public GitHub publication and deployment. A separately improved local React/Vite version is being published to https://github.com/DahimAlam/WeatherBorad and https://weatherboard-dahim.sunlitotter64.chatgpt.site. Do not recreate the app or claim that separate source was authored here. Focus on the one unfinished capability: a real managed Web Push scheduler for daily closed-tab reminders. Determine whether this workspace already offers a provisionable scheduled sender without a new paid purchase. Frontend integration contract: POST /subscriptions {subscription: PushSubscriptionJSON,time:"HH:mm",timezone:"IANA/Zone"} and DELETE /subscriptions {endpoint}, with ownership protection and CORS for https://weatherboard-dahim.sunlitotter64.chatgpt.site. Private VAPID keys must stay server-side, public key and endpoint may be returned. Need timezone/DST-aware scheduling, expired-subscription cleanup and verifiable test dispatch. Explain that this is an external managed service exception to the client-only brief. If available, implement and test the managed sender. If provisioning or credits require the user, stop and report the exact prerequisite; don't simulate delivery with timers or purchase a plan. Append this exact prompt and actual results to PROMPTS.md.
```

