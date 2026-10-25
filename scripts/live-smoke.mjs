import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.env.WEATHERBOARD_URL || 'http://127.0.0.1:4174';
const production = !!process.env.WEATHERBOARD_URL;
const server = process.env.WEATHERBOARD_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], { windowsHide: true, stdio: 'pipe' });
let browser;
try {
  for (let attempt = 0; attempt < 30; attempt++) {
    try { if ((await fetch(baseURL)).ok) break; } catch {}
    if (attempt === 29) throw new Error('Preview did not become ready');
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: 'light' });
  const page = await context.newPage();
  const errors = [];
  const apiResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    const url = new URL(response.url());
    if (/openweathermap|open-meteo|wirefreethought|rapidapi/.test(url.hostname)) apiResponses.push({ host: url.hostname, path: url.pathname, status: response.status() });
  });
  // Hosting may inject background frames that delay the global load event.
  // Verify the app's own readiness explicitly instead of waiting on those.
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'London', exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Save London to favourites' }).click();
  const initialTemperature = await page.locator('.temperature-display').innerText();
  const searchStart = Date.now();
  await page.getByRole('combobox').fill('Paris');
  await page.getByRole('option').first().waitFor({ timeout: 20000 });
  const searchLatencyMs = Date.now() - searchStart;
  await page.getByRole('option').first().click();
  await page.getByRole('heading', { name: 'Paris', exact: true }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Save Paris to favourites' }).click();
  await page.getByRole('button', { name: 'Dismiss message' }).click();
  await page.evaluate(() => document.fonts.ready);
  await mkdir('docs/screenshots', { recursive: true });
  await page.screenshot({ path: `docs/screenshots/${production ? 'production-' : ''}desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: `docs/screenshots/${production ? 'production-' : ''}mobile.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const undersizedTargets = await page.locator('button').evaluateAll(buttons => buttons.filter(button => {
    const r = button.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !button.disabled && (r.width < 43.9 || r.height < 43.9);
  }).map(button => ({ label: button.getAttribute('aria-label') || button.textContent, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(async () => {
    const response = await (await caches.open('weatherboard-data-v1')).match('/__weatherboard_snapshot__');
    return navigator.serviceWorker.controller && response && (await response.json()).city.name === 'Paris';
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Paris', exact: true }).waitFor();
  await page.getByText('You’re offline.', { exact: false }).waitFor();
  const report = { timestamp: new Date().toISOString(), url: baseURL, liveApi: true, apiResponses, initialTemperature: initialTemperature.replace(/\n/g, ''), autocompleteLatencyMs: searchLatencyMs, selectedCity: 'Paris', offlineReload: 'passed', mobileOverflow: overflow, undersizedTargets, pageErrors: errors };
  await writeFile(`docs/${production ? 'production' : 'live'}-smoke.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (overflow || undersizedTargets.length || errors.length) process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill();
}
