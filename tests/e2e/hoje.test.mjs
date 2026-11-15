// V1 · Tela Hoje (D-011, Opção C)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const dois = () => [assunto('Primeiro assunto', { focus: true, person: 'Marina', type: 'esperando' }), assunto('Segundo assunto', { focus: true, person: 'Paulo', type: 'fazer' })];

test('o anel aparece mesmo sem nenhum assunto resolvido, sem o ponto decorativo', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase(dois()));
  await pagina.goto(amb.url);
  assert.equal(await pagina.locator('.lens-card svg').count(), 1);
  assert.equal(await pagina.locator('.lens-card svg circle').count(), 2, 'só trilha e arco, sem ponto');
  await contexto.close();
});

test('"Editar" só aparece dentro do assunto aberto, com esse texto', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase(dois()));
  await pagina.goto(amb.url);
  assert.equal(await pagina.locator('button:text-is("Editar")').count(), 1);
  assert.equal(await pagina.locator('.focus.open button:text-is("Editar")').count(), 1);
  assert.equal(await pagina.locator('text=Editar tipo, pessoa ou tema').count(), 0);
  await contexto.close();
});

test('assuntos do foco não mostram bolha de pessoa; o nome aparece como texto', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase(dois()));
  await pagina.goto(amb.url);
  assert.equal(await pagina.locator('.focus .ava').count(), 0);
  assert.ok(await pagina.locator('.focus .meta:has-text("Paulo")').count() >= 1);
  await contexto.close();
});

test('as ações principais cabem em uma linha e "Virar tarefa" não existe mais (D-009)', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase(dois()));
  await pagina.setViewportSize({ width: 360, height: 740 });
  await pagina.goto(amb.url);
  const topos = await pagina.locator('.actions .act').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  assert.equal(topos.length, 3);
  assert.equal(new Set(topos).size, 1, 'os três botões na mesma linha');
  const alt = await pagina.locator('.actions .act').first().evaluate((e) => e.getBoundingClientRect().height);
  assert.ok(alt >= 48);
  assert.equal(await pagina.locator('[data-how="tarefa"]').count(), 0);
  assert.equal(await pagina.locator('text=Virar tarefa').count(), 0);
  await contexto.close();
});

test('o chip só diz "sugerido" e a dica fica no fim da tela e some com "Entendi"', async () => {
  const { contexto, pagina } = await novaPagina(amb, { ...estadoBase(dois()), tips: {} });
  await pagina.goto(amb.url);
  assert.equal(await pagina.locator('text=escolhido por você').count(), 0);
  assert.equal(await pagina.locator('.tip-line').count(), 1);
  const ordem = await pagina.evaluate(() => { const t = document.querySelector('.tip-line'), l = document.querySelector('.lens-card'); return !!(l.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING); });
  assert.ok(ordem);
  await pagina.click('.tip-line button');
  assert.equal(await pagina.locator('.tip-line').count(), 0);
  await contexto.close();
});

test('a saudação usa 26px', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase(dois()));
  await pagina.goto(amb.url);
  assert.equal(await pagina.locator('h1.hoje-h1').evaluate((e) => getComputedStyle(e).fontSize), '26px');
  await contexto.close();
});

const novas = (n) => Array.from({ length: n }, (_, k) => assunto(`Anotação ${k + 1}`, { status: 'novo', type: '' }));

test('o Hoje mostra as 3 anotações mais recentes para clarear, sem precisar clarear, e expande', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([...novas(5), assunto('Em foco', { focus: true })], { tips: {} }));
  await pagina.goto(amb.url);
  const cartao = pagina.locator('.soft', { hasText: 'Para clarear' });
  assert.match(await cartao.innerText(), /para clarear · 5/i);
  assert.deepEqual(await cartao.locator('button.line span:first-child').allInnerTexts(), ['Anotação 5', 'Anotação 4', 'Anotação 3']);
  await cartao.locator('[data-act="toggle-novos"]').click();
  assert.equal(await cartao.locator('button.line').count(), 5);
  await cartao.locator('[data-act="toggle-novos"]').click();
  assert.equal(await cartao.locator('button.line').count(), 3);
  await contexto.close();
});

test('no Hoje dá para editar e apagar uma anotação para clarear, e o botão Clarear o dia continua lá', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([...novas(2), assunto('Em foco', { focus: true })]));
  await pagina.goto(amb.url);
  await pagina.click('button.line:has-text("Anotação 2")');
  await pagina.fill('#edit-input', 'Anotação 2 corrigida');
  await pagina.click('#edit-form button[type="submit"]');
  assert.equal(await pagina.locator('button.line:has-text("Anotação 2 corrigida")').count(), 1);
  await pagina.click('button.line:has-text("Anotação 1")');
  await pagina.click('#edit-form [data-act="edit-del"]');
  assert.equal(await pagina.locator('button.line:has-text("Anotação 1")').count(), 0);
  assert.equal(await pagina.locator('.soft [data-act="clear-intro"]').count(), 1);
  await contexto.close();
});

test('sem anotações para clarear o cartão não aparece', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Em foco', { focus: true })]));
  await pagina.goto(amb.url);
  assert.equal(await pagina.locator('text=Para clarear').count(), 0);
  await contexto.close();
});

test('a tela Anotar tem Voltar, que leva ao Hoje', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Em foco', { focus: true })]));
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.click('header [aria-label="Voltar"]');
  await pagina.waitForSelector('.lens-card');
  await contexto.close();
});

test('quando tudo foi resolvido o título é "Dia clareado"', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Feito', { status: 'resolvido', doneDate: new Date().toISOString().slice(0, 10) })]));
  await pagina.goto(amb.url);
  assert.equal(await pagina.locator('.lens-title').innerText(), 'Dia clareado');
  assert.equal(await pagina.locator('text=Dia claro').count(), 0);
  await contexto.close();
});
