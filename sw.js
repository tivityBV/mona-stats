/* Mona Stats service worker.
 *
 * v1 was cache-first met een vaste cachenaam. Gevolg: zodra index.html een keer in de cache
 * zat, kreeg je die versie voor altijd. Een nieuwe pagina op GitHub Pages werd nooit zichtbaar,
 * hoe vaak je de app ook afsloot, want de service worker zelf veranderde niet en installeerde
 * dus ook nooit opnieuw.
 *
 * v3 is dezelfde worker als v2, alleen met een nieuwe cachenaam. De iconen worden
 * cache-first geserveerd, dus een vervangen icoon met dezelfde bestandsnaam bereikt
 * niemand zolang de oude cache blijft staan. Ophogen dwingt hem opnieuw te installeren.
 *
 * v2 doet twee dingen anders. De cachenaam is opgehoogd, waardoor deze worker installeert en
 * de oude cache weggooit. En de pagina zelf wordt network-first opgehaald: online zie je altijd
 * de nieuwste versie, offline val je terug op de laatst opgeslagen versie. De iconen blijven
 * cache-first, want die veranderen zelden en mogen direct laden.
 */
const SHELL = 'mona-shell-v3';
const SHELL_FILES = [
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isDocument(req) {
  return req.mode === 'navigate' || (req.destination === 'document') ||
         (req.headers.get('accept') || '').indexOf('text/html') !== -1;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Live cijfers uit het Apps Script: laat de pagina dat zelf afhandelen.
  if (url.hostname.indexOf('script.google') !== -1 || url.hostname.indexOf('googleusercontent') !== -1) {
    return;
  }

  // De pagina zelf: eerst het net, dan pas de cache. Zo is een update meteen zichtbaar.
  if (isDocument(e.request)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('./index.html', copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Iconen en manifest: cache-first, die mogen direct laden.
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res && res.status === 200 && e.request.method === 'GET') {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html'))));
});
