// E3.4b · Foco principal no Hoje e na folha "Mudar" (HJ-02, D-017).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto, lerAssuntos } from '../helpers/app.mjs';
import { iso, addDays } from '../../src/util.js';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const hoje = () => iso(new Date());
const semDicas = { anotar: true, 'clear-intro': true, hoje: true, historico: true };
const dia = (n) => addDays(hoje(), -n);
// Idades diferentes: Velho (10 dias) assume como principal quando ninguém foi marcado.
const tres = (foco = true) => estadoBase([
  assunto('Velho', { type: 'fazer', focus: foco, created: dia(10) }),
  assunto('Medio', { type: 'fazer', focus: foco, created: dia(5) }),
  assunto('Novo', { type: 'fazer', focus: foco, created: dia(1) })
], { tips: semDicas });
const idDe = async (pagina, texto) => (await lerAssuntos(pagina)).find((a) => a.text === texto).id;
const v2 = async (pagina, texto) => (await lerAssuntos(pagina)).find((a) => a.text === texto).v2;
const cartoes = (pagina) => pagina.locator('.focus-list .focus');

test('Hoje mostra só o foco principal e uma linha "Também hoje" recolhida com os outros', async () => {
  const { contexto, pagina } = await novaPagina(amb, tres());
  await pagina.goto(amb.url);
  assert.equal(await pagina.locator('.label:text-is("Foco principal")').count(), 1);
  assert.equal(await cartoes(pagina).count(), 1);
  assert.match(await cartoes(pagina).first().textContent(), /Velho/);
  const tambem = pagina.locator('button[data-act="toggle-tambem"]');
  assert.equal((await tambem.textContent()).trim(), 'Também hoje · 2 ▾');
  await tambem.click();
  assert.equal(await cartoes(pagina).count(), 3);
  assert.deepEqual(await pagina.locator('.focus-list .focus-text').allTextContents(), ['Velho', 'Medio', 'Novo']);
  await pagina.locator('button[data-act="toggle-tambem"]').click();
  assert.equal(await cartoes(pagina).count(), 1, 'recolhe de novo');
  assert.equal(pagina.errosJs.length, 0);
  await contexto.close();
});

test('foco só sugerido: o primeiro vem com "Comece por este"; com um só assunto não há "Também hoje"', async () => {
  const sug = await novaPagina(amb, tres(false));
  await sug.pagina.goto(amb.url);
  assert.equal(await sug.pagina.locator('.label:text-is("Comece por este")').count(), 1);
  assert.equal(await sug.pagina.locator('.label:text-is("Foco principal")').count(), 0);
  await sug.contexto.close();
  const um = await novaPagina(amb, estadoBase([assunto('Sozinho', { type: 'fazer', focus: true })], { tips: semDicas }));
  await um.pagina.goto(amb.url);
  assert.equal(await um.pagina.locator('button[data-act="toggle-tambem"]').count(), 0);
  assert.equal(await cartoes(um.pagina).count(), 1);
  await um.contexto.close();
});

test('Mudar > Tornar principal: o escolhido vira o principal, grava só um e continua depois de recarregar', async () => {
  const { contexto, pagina } = await novaPagina(amb, tres());
  await pagina.goto(amb.url);
  await pagina.click('button[data-act="foco-open"]');
  assert.equal(await pagina.locator('button[data-act="pick-main"]:text-is("Foco principal (automático)")').count(), 1);
  const idNovo = await idDe(pagina, 'Novo'), idMedio = await idDe(pagina, 'Medio');
  await pagina.click(`button[data-act="pick-main"][data-id="${idNovo}"]`);
  assert.equal(await pagina.locator(`button[data-act="pick-main"][data-id="${idNovo}"]`).textContent(), 'Foco principal');
  await pagina.click(`button[data-act="pick-main"][data-id="${idMedio}"]`);
  await pagina.click(`button[data-act="pick-main"][data-id="${idNovo}"]`);
  await pagina.click('button[data-act="foco-save"]');
  await pagina.waitForSelector('text=Foco atualizado.');
  assert.match(await cartoes(pagina).first().textContent(), /Novo/);
  const marcados = (await lerAssuntos(pagina)).filter((a) => a.v2.focus_main).map((a) => a.text);
  assert.deepEqual(marcados, ['Novo']);
  await pagina.reload();
  assert.match(await cartoes(pagina).first().textContent(), /Novo/);
  assert.equal(pagina.errosJs.length, 0);
  await contexto.close();
});

test('tocar de novo no principal volta ao automático; tirar o principal do foco também limpa a escolha', async () => {
  const { contexto, pagina } = await novaPagina(amb, tres());
  await pagina.goto(amb.url);
  await pagina.click('button[data-act="foco-open"]');
  const idNovo = await idDe(pagina, 'Novo');
  await pagina.click(`button[data-act="pick-main"][data-id="${idNovo}"]`);
  await pagina.click(`button[data-act="pick-main"][data-id="${idNovo}"]`);
  assert.equal(await pagina.locator('button[data-act="pick-main"]:text-is("Foco principal (automático)")').count(), 1);
  await pagina.click(`button[data-act="pick-main"][data-id="${idNovo}"]`);
  await pagina.click(`.opt[data-id="${idNovo}"]`);
  assert.equal(await pagina.locator(`button[data-act="pick-main"][data-id="${idNovo}"]`).count(), 0, 'sem botão para quem saiu do foco');
  await pagina.click('button[data-act="foco-save"]');
  await pagina.waitForSelector('text=Foco atualizado.');
  const a = await v2(pagina, 'Novo');
  assert.deepEqual([a.focus, a.focus_main], [false, false]);
  await contexto.close();
});

test('resolver o principal: o seguinte assume, sem nova escolha, e Desfazer devolve o principal', async () => {
  const { contexto, pagina } = await novaPagina(amb, tres());
  await pagina.goto(amb.url);
  await pagina.click('button[data-act="foco-open"]');
  await pagina.click(`button[data-act="pick-main"][data-id="${await idDe(pagina, 'Novo')}"]`);
  await pagina.click('button[data-act="foco-save"]');
  await pagina.waitForSelector('text=Foco atualizado.');
  await pagina.click('.focus.open button[data-how="resolvido"]');
  await pagina.waitForSelector('text=Resolvido.');
  assert.match(await cartoes(pagina).first().textContent(), /Velho/, 'o de maior prioridade assume');
  assert.equal(await pagina.locator('.label:text-is("Foco principal")').count(), 1);
  assert.deepEqual([(await v2(pagina, 'Novo')).focus, (await v2(pagina, 'Novo')).focus_main], [false, false]);
  await pagina.click('[data-act="undo"]');
  await pagina.waitForSelector('.focus-text:text-is("Novo")');
  assert.match(await cartoes(pagina).first().textContent(), /Novo/);
  assert.equal((await v2(pagina, 'Novo')).focus_main, true);
  await contexto.close();
});

test('o limite de 3 no foco continua e o principal só pode estar entre os escolhidos', async () => {
  const quatro = estadoBase([
    assunto('A', { type: 'fazer', focus: true, created: dia(4) }), assunto('B', { type: 'fazer', focus: true, created: dia(3) }),
    assunto('C', { type: 'fazer', focus: true, created: dia(2) }), assunto('D', { type: 'fazer', created: dia(1) })
  ], { tips: semDicas });
  const { contexto, pagina } = await novaPagina(amb, quatro);
  await pagina.goto(amb.url);
  await pagina.click('button[data-act="foco-open"]');
  await pagina.click(`.opt[data-id="${await idDe(pagina, 'D')}"]`);
  await pagina.waitForSelector('text=Até 3 no foco');
  assert.equal(await pagina.locator('button[data-act="pick-main"]').count(), 3, 'só os 3 escolhidos têm o botão');
  await contexto.close();
});
