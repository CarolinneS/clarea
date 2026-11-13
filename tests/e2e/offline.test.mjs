// C1 · Offline e instalação (corrigido na S0.2)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase } from '../helpers/app.mjs';

// `serviceWorker.ready` só resolve quando há um service worker ativo controlando o app.
const esperarServiceWorker = (pagina) => pagina.evaluate(() => navigator.serviceWorker.ready.then(() => true));

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

test('o service worker é registrado e guarda o app no aparelho', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url);
  await esperarServiceWorker(pagina);
  const guardados = await pagina.evaluate(async () => {
    const nome = (await caches.keys()).find((n) => /^clarea-v\d+$/.test(n));
    return nome ? (await (await caches.open(nome)).keys()).length : 0;
  });
  assert.ok(guardados >= 3, `esperava pelo menos 3 arquivos guardados, havia ${guardados}`);
  await contexto.close();
});

test('o app abre sem internet depois da primeira visita', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url);
  await esperarServiceWorker(pagina);
  await contexto.setOffline(true);
  await pagina.reload({ timeout: 8000 });
  await pagina.waitForSelector('#nav:not([hidden])', { timeout: 5000 });
  await contexto.close();
});
