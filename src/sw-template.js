/* Generated into dist/sw.js by scripts/build-pwa.mjs. */
const SHELL_CACHE = 'weatherboard-shell-__CACHE_VERSION__';
const SHELL_FILES = __SHELL_FILES__;
const DATA_CACHE = 'weatherboard-data-v1';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_FILES.map(url => new Request(url, { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('weatherboard-shell-') && name !== SHELL_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/__weatherboard_snapshot__') {
    event.respondWith(caches.open(DATA_CACHE).then(async cache => await cache.match(request) ?? new Response('{}', { status: 404 })));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(SHELL_CACHE);
      const saved = await cache.match('/', { ignoreVary: true }) ?? await cache.match('/index.html', { ignoreVary: true });
      if (!saved) return new Response('Connect to the internet to load WeatherBoard.', { status: 503 });
      // Static hosts may redirect /index.html to /. A redirected cached response
      // cannot satisfy a navigation whose redirect mode is manual. Reconstruct
      // it from its body/headers so offline navigation works on those hosts too.
      return new Response(saved.body, { status: saved.status, statusText: saved.statusText, headers: saved.headers });
    }));
    return;
  }
  if (SHELL_FILES.includes(url.pathname)) {
    // Shell assets are identical for every same-origin visitor. Ignore the
    // server's Vary: Origin header, which differs for module-script requests.
    event.respondWith(caches.open(SHELL_CACHE).then(async cache => await cache.match(request, { ignoreVary: true }) ?? fetch(request)));
  }
});
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch { payload = { body: 'Your daily forecast is ready. Take a look before you head out.' }; }
  event.waitUntil(self.registration.showNotification(typeof payload.title === 'string' ? payload.title : 'A little clarity for your day', {
    body: typeof payload.body === 'string' ? payload.body : 'Check your weather before you head out. Your daily outlook is waiting.',
    icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'weatherboard-daily', data: { url: '/' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate('/'); return existing.focus(); }
    return self.clients.openWindow('/');
  })());
});
