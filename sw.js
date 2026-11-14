/* Service worker do Clarea: guarda o app no aparelho para funcionar sem internet.
   Ao mudar qualquer arquivo do app, aumente o número da versão abaixo. */
const VERSAO = 'clarea-1.0.3';

// Sem estes arquivos o app não abre offline. Se algum faltar, a instalação falha de propósito.
const ESSENCIAIS = [
  './',
  './index.html',
  './manifest.webmanifest'
];
// Guardados quando possível. Se faltar algum, o app continua funcionando offline.
const OPCIONAIS = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './fonts/AtkinsonHyperlegible-Regular.ttf',
  './fonts/AtkinsonHyperlegible-Bold.ttf'
];
// Ao abrir o app, espera a internet por no máximo este tempo; depois usa a cópia guardada.
const LIMITE_REDE_MS = 3000;

function comLimite(promessa, ms) {
  return new Promise((ok, erro) => {
    const t = setTimeout(() => erro(new Error('tempo esgotado')), ms);
    promessa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); erro(e); });
  });
}

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
    // Páginas: tenta a internet para pegar a versão nova, mas sem esperar para sempre.
    // Sem internet, lenta demais ou com resposta de erro, usa a cópia guardada.
    // Só respostas de sucesso substituem a cópia guardada.
    const rede = fetch(req).then(async (res) => {
      if (res.ok) await (await caches.open(VERSAO)).put('./index.html', res.clone());
      return res;
    });
    event.waitUntil(rede.catch(() => null)); // se passar do limite, ainda atualiza a cópia em segundo plano
    event.respondWith((async () => {
      let res = null;
      try { res = await comLimite(rede, LIMITE_REDE_MS); } catch (e) { /* sem internet ou lenta */ }
      if (res && res.ok) return res;
      const copia = (await caches.match('./index.html')) || (await caches.match('./'));
      if (copia) return copia;
      return res || rede; // sem cópia guardada: devolve o que a internet respondeu (ou falha)
    })());
    return;
  }
  // Demais arquivos: usa o guardado e, se não houver, busca e guarda (só respostas de sucesso).
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
