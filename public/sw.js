// Service worker di TempoMax: rete prima, cache come riserva, solo per i file dell'app (stessa origine).
// Le API Google non passano da qui: senza rete le visite restano nell'archivio locale dell'app.
const CACHE_NAME = 'tempomax-v1';

// Alla prima visita i file sono già stati scaricati prima che il service worker esistesse:
// si mettono in cache la pagina e i file che essa referenzia, così l'app si apre subito anche offline.
async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const scope = self.registration.scope;
  await cache.add(scope);
  const html = await (await cache.match(scope)).text();
  const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], scope))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.href);
  await cache.addAll(urls);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached =
      (await cache.match(request)) ?? (request.mode === 'navigate' ? await cache.match(self.registration.scope) : undefined);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }
  event.respondWith(networkFirst(request));
});
