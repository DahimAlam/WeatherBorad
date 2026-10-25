import { test, expect, type Page } from '@playwright/test';
import { citiesFixture, geodbFixture, meteoFixture, owmFixture } from '../fixtures';

const cityApi = /https:\/\/(?:geocoding-api\.open-meteo\.com|wft-geo-db\.p\.rapidapi\.com|geodb-free-service\.wirefreethought\.com)\//;
function cityResponse(url: string, results = citiesFixture.results) { return url.includes('open-meteo') ? { results } : geodbFixture(results); }

async function mockWeather(page: Page) {
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: meteoFixture() }));
  await page.route('https://api.openweathermap.org/**', route => route.fulfill({ json: route.request().url().includes('/forecast?') ? owmFixture().forecast : owmFixture().current }));
  await page.route(cityApi, route => route.fulfill({ json: cityResponse(route.request().url()) }));
}
async function dashboard(page: Page) { await mockWeather(page); await page.goto('/'); await expect(page.getByRole('heading', { name: 'London', exact: true })).toBeVisible(); }

test('shows current weather, five-day forecast and working unit preferences', async ({ page }) => {
  await dashboard(page);
  await expect(page.locator('.temperature-display')).toContainText('22');
  await expect(page.getByRole('button', { name: /^Forecast for/ })).toHaveCount(5);
  await page.getByRole('button', { name: '°F', exact: true }).click();
  await expect(page.locator('.temperature-display')).toContainText('72');
  await page.reload();
  await expect(page.getByRole('button', { name: '°F', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.temperature-display')).toContainText('72');
});

test('validates on blur and supports keyboard autocomplete', async ({ page }) => {
  await dashboard(page);
  const search = page.getByRole('combobox');
  await search.focus(); await search.press('Tab');
  await expect(page.getByText('Enter a city name to find its weather.')).toBeVisible();
  await search.fill('Paris');
  await expect(page.getByRole('option')).toHaveCount(2);
  await search.press('ArrowDown'); await search.press('Enter');
  await expect(page.getByRole('heading', { name: 'Paris', exact: true })).toBeVisible();
  await expect(page.getByText('Enter a city name to find its weather.')).not.toBeVisible();
});

test('shows no-results and search failures', async ({ page }) => {
  await dashboard(page);
  await page.route(cityApi, route => route.fulfill({ json: cityResponse(route.request().url(), []) }));
  await page.getByRole('combobox').fill('NoSuchCity');
  await expect(page.getByText('No cities found. Check the spelling or try a nearby city.')).toBeVisible();
  await page.route(cityApi, route => route.abort());
  await page.getByRole('combobox').fill('NetworkFailure');
  await expect(page.getByRole('alert')).toContainText('internet connection');
});

test('ignores a late response from an older search', async ({ page }) => {
  await dashboard(page);
  await page.route(cityApi, async route => {
    const url = route.request().url();
    const params = new URL(url).searchParams;
    if ((params.get('name') ?? params.get('namePrefix')) === 'Par') { await new Promise(resolve => setTimeout(resolve, 700)); await route.fulfill({ json: cityResponse(url) }); }
    else await route.fulfill({ json: cityResponse(url, [{ ...citiesFixture.results[0], name: 'Berlin', id: 2950159 }]) });
  });
  await page.getByRole('combobox').fill('Par');
  await page.waitForTimeout(250);
  await page.getByRole('combobox').fill('Berlin');
  await expect(page.getByRole('option')).toContainText('Berlin');
  await page.waitForTimeout(800);
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toContainText('Berlin');
});

test('favourites persist and removal requires confirmation', async ({ page }) => {
  await dashboard(page);
  await page.getByRole('button', { name: 'Save London to favourites' }).click();
  await expect(page.getByRole('button', { name: 'View weather in London' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'View weather in London' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove London from favourites' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep city' }).click();
  await expect(page.getByRole('button', { name: 'View weather in London' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove London from favourites' }).first().click();
  await page.getByRole('button', { name: 'Remove city', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View weather in London' })).toHaveCount(0);
});

test('sixth favourite is rejected with a clear explanation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('weatherboard:favourites', JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ id: String(i), name: `Saved ${i}`, country: 'Test', latitude: i, longitude: i })))));
  await dashboard(page);
  await page.getByRole('button', { name: 'Save London to favourites' }).click();
  await expect(page.getByRole('status')).toContainText('five favourite spots are full');
  await expect(page.locator('.favourite-row')).toHaveCount(5);
});

test('storage denial does not prevent weather or favourites', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } }); });
  await dashboard(page);
  await expect(page.getByText('Browser storage is unavailable. Your preferences will last for this visit.')).toBeVisible();
  await page.getByRole('button', { name: 'Save London to favourites' }).click();
  await expect(page.getByRole('button', { name: 'View weather in London' })).toBeVisible();
});

test('weather error offers a successful retry', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  await page.route('https://api.openweathermap.org/**', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('internet connection');
  await mockWeather(page);
  await page.getByRole('button', { name: 'Try again', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'London', exact: true })).toBeVisible();
});

test('offline reload restores the last city and weather from the cache', async ({ page, context }) => {
  await dashboard(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect.poll(() => page.evaluate(async () => !!await (await caches.open('weatherboard-data-v1')).match('/__weatherboard_snapshot__'))).toBe(true);
  await page.unrouteAll();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'London', exact: true })).toBeVisible();
  await expect(page.getByText('You’re offline.', { exact: false })).toBeVisible();
  await expect(page.locator('.temperature-display')).toContainText('22');
  await context.setOffline(false);
});

test('manifest, icons and service worker are valid', async ({ page }) => {
  await dashboard(page);
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toContain('192x192');
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toContain('512x512');
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
  const worker = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
  expect(worker).toBe('activated');
});

test('offline navigation works when the host redirects the cached document', async ({ page, context }) => {
  await dashboard(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.route('**/redirected-shell', route => route.fulfill({ status: 302, headers: { location: '/' } }));
  const redirected = await page.evaluate(async () => {
    const response = await fetch('/redirected-shell');
    const cacheName = (await caches.keys()).find(name => name.startsWith('weatherboard-shell-'))!;
    const cache = await caches.open(cacheName);
    await cache.put('/', response.clone()); await cache.put('/index.html', response.clone());
    return response.redirected;
  });
  expect(redirected).toBe(true);
  await page.unrouteAll(); await context.setOffline(true); await page.reload();
  await expect(page.getByRole('heading', { name: 'London', exact: true })).toBeVisible();
  await expect(page.getByText('You’re offline.', { exact: false })).toBeVisible();
});

test('malformed reminder preferences recover and a chosen time persists', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('weatherboard:reminder', 'null'));
  await dashboard(page);
  await page.getByRole('button', { name: 'Notification settings' }).click();
  await expect(page.getByLabel('Your preferred time', { exact: false })).toHaveValue('08:00');
  await page.getByLabel('Your preferred time', { exact: false }).fill('09:30');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Notification settings' }).click();
  await expect(page.getByLabel('Your preferred time', { exact: false })).toHaveValue('09:30');
});

test('reminder settings disclose availability and handle blocked permission', async ({ page, context }) => {
  await dashboard(page);
  await context.clearPermissions();
  await page.evaluate(() => Object.defineProperty(Notification, 'permission', { get: () => 'denied' }));
  await page.getByRole('button', { name: 'Notification settings' }).click();
  await expect(page.getByRole('dialog')).toContainText('Daily reminders aren’t available');
  await page.getByRole('button', { name: 'Send a test notification' }).click();
  await expect(page.getByRole('alert')).toContainText('Notifications are blocked');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('heading', { name: 'London', exact: true })).toBeVisible();
});

test('supports themes, forecast details, and install guidance', async ({ page }) => {
  await dashboard(page);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: /^Forecast for/ }).first().click();
  await expect(page.getByRole('dialog')).toContainText('10% chance of precipitation');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const width of [375, 768, 1280]) {
  test(`responsive dashboard at ${width}px with no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await dashboard(page);
    await expect(page.getByRole('heading', { name: 'Every day has an outlook.' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/weatherboard-${width}.png`, fullPage: true });
  });
}
