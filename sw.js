/* Service worker do Clarea: guarda o app no aparelho para funcionar sem internet.
   Ao mudar qualquer arquivo do app, aumente o número da versão abaixo. */
const VERSAO = 'clarea-v1';
const ESSENCIAIS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];
const OPCIONAIS = [
  './fonts/AtkinsonHyperlegible-Regular.ttf',
  './fonts/AtkinsonHyperlegible-Bold.ttf'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    await cache.addAll(ESSENCIAIS);
    await Promise.all(OPCIONAIS.map((url) => cache.add(url).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Páginas: tenta a internet para pegar a versão nova; sem internet, usa a guardada.
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(VERSAO);
        cache.put('./index.html', res.clone());
        return res;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }
  // Demais arquivos: usa o guardado e, se não houver, busca e guarda.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(VERSAO)).put(req, res.clone());
      return res;
    } catch (e) {
      return new Response('', { status: 504 });
    }
  })());
});

// Tocar na notificação abre o Clarea.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of janelas) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  })());
});
