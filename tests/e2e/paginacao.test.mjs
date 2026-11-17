// E2.3 · Listas longas mostram 50 por vez, com "Mostrar mais" (D-015)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const SEM_DICAS = { anotar: true, 'clear-intro': true, hoje: true, historico: true };
const muitos = (n, extra = {}) => Array.from({ length: n }, (_, i) => assunto(`Assunto ${String(i + 1).padStart(3, '0')} de estudo`, { status: 'resolvido', doneDate: '2026-11-10', ...extra }));

test('Histórico: mostra 50, "Mostrar mais" soma 50, e some quando acaba', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase(muitos(120), { tips: SEM_DICAS }));
  await pagina.goto(amb.url);
  await pagina.click('nav [data-act="go"][data-to="historico"]');
  assert.equal(await pagina.locator('#hist-list .hist li').count(), 50);
  assert.match(await pagina.locator('[data-act="mais"][data-k="hist"]').innerText(), /\(70\)/);
  await pagina.click('[data-act="mais"][data-k="hist"]');
  assert.equal(await pagina.locator('#hist-list .hist li').count(), 100);
  await pagina.click('[data-act="mais"][data-k="hist"]');
  assert.equal(await pagina.locator('#hist-list .hist li').count(), 120);
  assert.equal(await pagina.locator('[data-act="mais"][data-k="hist"]').count(), 0);
  await contexto.close();
});

test('Histórico: a busca conta os resultados, volta a 50 e acha por várias palavras', async () => {
  const itens = muitos(120).concat([assunto('Ligar para a Marina sobre o contrato', { status: 'resolvido', doneDate: '2026-11-10' })]);
  const { contexto, pagina } = await novaPagina(amb, estadoBase(itens, { tips: SEM_DICAS }));
  await pagina.goto(amb.url);
  await pagina.click('nav [data-act="go"][data-to="historico"]');
  await pagina.click('[data-act="mais"][data-k="hist"]');
  assert.equal(await pagina.locator('#hist-list .hist li').count(), 100);
  await pagina.fill('#busca', 'estudo');
  assert.equal(await pagina.locator('#hist-list .hist li').count(), 50, 'buscar volta para a primeira página');
  assert.match(await pagina.locator('#hist-list').innerText(), /120 resultados/);
  await pagina.fill('#busca', 'contrato marina');
  assert.equal(await pagina.locator('#hist-list .hist li').count(), 1);
  assert.equal(await pagina.locator('[data-act="mais"]').count(), 0);
  await pagina.fill('#busca', 'zzzz');
  assert.match(await pagina.locator('#hist-list').innerText(), /Nada encontrado/);
  await contexto.close();
});

test('Histórico: o mais recente aparece primeiro', async () => {
  const itens = [assunto('Antigo', { status: 'resolvido', created: '2026-11-01', doneDate: '2026-11-02' }), assunto('Recente', { status: 'resolvido', created: '2026-11-12', doneDate: '2026-11-12' })];
  const { contexto, pagina } = await novaPagina(amb, estadoBase(itens, { tips: SEM_DICAS }));
  await pagina.goto(amb.url);
  await pagina.click('nav [data-act="go"][data-to="historico"]');
  assert.deepEqual(await pagina.locator('#hist-list .hist li > span:first-child').allInnerTexts(), ['Recente', 'Antigo']);
  await contexto.close();
});

test('Anotar: com 60 anotações, mostra as 50 mais novas, e a nova entra no fim da lista', async () => {
  const itens = muitos(60, { status: 'novo', type: '', doneDate: '' });
  const { contexto, pagina } = await novaPagina(amb, estadoBase(itens, { tips: SEM_DICAS }));
  await pagina.goto(amb.url + '?tela=anotar');
  assert.equal(await pagina.locator('.lines .line').count(), 50);
  assert.match(await pagina.locator('[data-act="mais"][data-k="anotar"]').innerText(), /\(10\)/);
  assert.equal(await pagina.locator('.lines .line', { hasText: 'Assunto 060 de estudo' }).count(), 1, 'a mais nova aparece');
  assert.equal(await pagina.locator('.lines .line', { hasText: 'Assunto 001 de estudo' }).count(), 0, 'a mais antiga fica para "mostrar mais"');
  await pagina.fill('#new-line', 'Acabei de anotar');
  await pagina.press('#new-line', 'Enter');
  await pagina.waitForSelector('.lines .line:has-text("Acabei de anotar")');
  await pagina.click('[data-act="mais"][data-k="anotar"]');
  assert.equal(await pagina.locator('.lines .line').count(), 61);
  await contexto.close();
});

test('Hoje: "Ver anotações" também mostra 50 por vez', async () => {
  const itens = muitos(55, { status: 'novo', type: '', doneDate: '' });
  const { contexto, pagina } = await novaPagina(amb, estadoBase(itens, { tips: SEM_DICAS }));
  await pagina.goto(amb.url);
  await pagina.click('[data-act="toggle-novos"]');
  assert.equal(await pagina.locator('.soft .lines .line').count(), 50);
  await pagina.click('[data-act="mais"][data-k="novos"]');
  assert.equal(await pagina.locator('.soft .lines .line').count(), 55);
  await contexto.close();
});
