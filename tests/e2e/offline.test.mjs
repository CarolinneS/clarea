// C1 · Offline e instalação (corrigido na S0.2)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

test('o service worker é registrado e guarda o app no aparelho', { todo: 'S0.2 · C1: ícones ausentes derrubam a instalação' }, async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url);
  await pagina.waitForFunction(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return !!(r && r.active);
  }, null, { timeout: 8000 });
  const guardados = await pagina.evaluate(async () => (await (await caches.open('clarea-v1')).keys()).length);
  assert.ok(guardados >= 3, `esperava pelo menos 3 arquivos guardados, havia ${guardados}`);
  await contexto.close();
});

test('o app abre sem internet depois da primeira visita', { todo: 'S0.2 · C1' }, async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url);
  await pagina.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 8000 });
  await contexto.setOffline(true);
  await pagina.reload({ timeout: 8000 });
  await pagina.waitForSelector('#nav:not([hidden])', { timeout: 5000 });
  await contexto.close();
});
