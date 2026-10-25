# Verification — 25 October 2026

| Check | Result |
| --- | --- |
| Unit tests | 36 passed |
| Chrome browser tests | 17 passed |
| TypeScript / Vite / PWA build | Passed |
| Real OpenWeatherMap current data | HTTP 200 |
| Free GeoDB HTTPS and CORS | HTTP 200; browser search passed |
| Real London and Paris / favourites | Passed |
| Offline last-city reload | Passed locally and on the updated public deployment |
| Widths 375, 768, 1280 | Browser tests passed; no page overflow |
| Mobile buttons below 44x44px | None in live smoke |
| Live JavaScript errors | None |
| Independent Web Push decryption and VAPID verification | Passed for local corrected sender |

The local live report is [live-smoke.json](live-smoke.json). It measured **1386ms** for Paris autocomplete including 200ms debounce. This exceeds the strict 300ms target. Tests use provider-specific fixtures for controlled error/race coverage; the smoke script uses real services.

[production-smoke.json](production-smoke.json) records the latest completed public-host check, with its timestamp. The updated public deployment passed at 21:01 Asia/Karachi on 25 October 2026: OpenWeatherMap current/forecast and free GeoDB returned HTTP 200; Paris offline reload passed; no mobile overflow, undersized targets, or JavaScript errors. Production autocomplete measured 1386ms.

Previously repaired regressions include Vary: Origin cache mismatches, cached redirected HTML navigation, malformed reminder preferences, and saving a changed reminder only after acknowledgement. All browser regressions still pass.

## Push verification boundary

The local repaired sender is in services/push; tests independently decrypt its RFC8291 payload and verify its VAPID signature. The original Lovable source has not received that repair because the workspace has no credits. Daily reminders remain unavailable. Reported managed scheduling and HTTP-sink tests do not establish actual closed-tab browser delivery.

## Reproduce

```sh
npm ci
npm test
npm run build
npm run test:e2e
node scripts/live-smoke.mjs
```

Use npm.cmd where PowerShell blocks npm.ps1. Set WEATHERBOARD_URL to the deployed origin for production smoke. Chrome must be installed. Physical PWA installation and native notifications remain manual tests.
