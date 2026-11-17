// D-015 · Anotações com várias linhas e limite de tamanho
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto, lerAssuntos } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const base = () => estadoBase([], { tips: { anotar: true, 'clear-intro': true, hoje: true, historico: true } });

test('computador: Enter guarda; Shift+Enter quebra a linha; as quebras ficam guardadas', async () => {
  const { contexto, pagina } = await novaPagina(amb, base());
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.fill('#new-line', 'Primeira linha');
  await pagina.press('#new-line', 'Shift+Enter');
  await pagina.type('#new-line', 'Segunda linha');
  assert.equal(await pagina.inputValue('#new-line'), 'Primeira linha\nSegunda linha');
  assert.equal((await lerAssuntos(pagina)), null, 'Shift+Enter não guarda');
  await pagina.press('#new-line', 'Enter');
  await pagina.waitForFunction(() => document.querySelector('#new-line').value === '');
  const [a] = await lerAssuntos(pagina);
  assert.equal(a.text, 'Primeira linha\nSegunda linha');
  assert.equal(a.v2.original_text, 'Primeira linha\nSegunda linha');
  await contexto.close();
});

test('colar um texto com várias linhas vira um único assunto, com as linhas', async () => {
  const { contexto, pagina } = await novaPagina(amb, base());
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.fill('#new-line', 'Ata da reunião\n- item um\n- item dois\n- item três');
  await pagina.click('.composer .send');
  await pagina.waitForFunction(() => document.querySelector('#new-line').value === '');
  const itens = await lerAssuntos(pagina);
  assert.equal(itens.length, 1);
  assert.equal(itens[0].text.split('\n').length, 4);
  // na lista, as quebras aparecem e o texto fica limitado a 4 linhas
  const css = await pagina.locator('.line > span:first-child').evaluate((e) => { const c = getComputedStyle(e); return [c.whiteSpace, c.webkitLineClamp || c.lineClamp]; });
  assert.deepEqual(css, ['pre-line', '4']);
  await contexto.close();
});

test('o rascunho com várias linhas volta inteiro ao reabrir o app, e o campo cresce', async () => {
  const { contexto, pagina } = await novaPagina(amb, base());
  await pagina.goto(amb.url + '?tela=anotar');
  const antes = await pagina.locator('#new-line').evaluate((e) => e.getBoundingClientRect().height);
  await pagina.fill('#new-line', 'a\nb\nc\nd');
  const depois = await pagina.locator('#new-line').evaluate((e) => e.getBoundingClientRect().height);
  assert.ok(depois > antes + 20, `o campo deve crescer (${antes} → ${depois})`);
  await pagina.reload();
  assert.equal(await pagina.inputValue('#new-line'), 'a\nb\nc\nd');
  await contexto.close();
});

test('celular (toque): Enter quebra a linha e só o botão enviar guarda', async () => {
  const { contexto, pagina } = await novaPagina(amb, base(), { hasTouch: true, isMobile: true });
  await pagina.goto(amb.url + '?tela=anotar');
  assert.match(await pagina.getAttribute('#new-line', 'placeholder'), /toque em enviar/);
  await pagina.fill('#new-line', 'Linha A');
  await pagina.press('#new-line', 'Enter');
  await pagina.type('#new-line', 'Linha B');
  assert.equal(await pagina.inputValue('#new-line'), 'Linha A\nLinha B');
  assert.equal(await lerAssuntos(pagina), null, 'Enter no celular não guarda');
  await pagina.click('.composer .send');
  await pagina.waitForFunction(() => document.querySelector('#new-line').value === '');
  assert.equal((await lerAssuntos(pagina))[0].text, 'Linha A\nLinha B');
  await contexto.close();
});

test('limite de 10.000 caracteres: no limite grava; acima avisa, não grava e não corta', async () => {
  const { contexto, pagina } = await novaPagina(amb, base());
  await pagina.goto(amb.url + '?tela=anotar');
  const longo = 'x'.repeat(10001);
  await pagina.fill('#new-line', longo);
  await pagina.press('#new-line', 'Enter');
  await pagina.waitForSelector('#limite:not([hidden])');
  assert.match(await pagina.locator('#limite').innerText(), /10\.001 de 10\.000/);
  assert.equal(await pagina.inputValue('#new-line').then((v) => v.length), 10001, 'nada foi cortado');
  assert.equal(await lerAssuntos(pagina), null, 'nada foi gravado');
  await pagina.fill('#new-line', 'x'.repeat(10000));
  await pagina.press('#new-line', 'Enter');
  await pagina.waitForFunction(() => document.querySelector('#new-line').value === '');
  assert.equal((await lerAssuntos(pagina))[0].text.length, 10000);
  await contexto.close();
});

test('editar um assunto mantém as linhas e respeita o limite', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Original', { status: 'novo', type: '' })], { tips: { anotar: true, 'clear-intro': true, hoje: true, historico: true } }));
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.click('.line');
  await pagina.fill('#edit-input', 'Novo\ntexto');
  await pagina.press('#edit-input', 'Enter');
  await pagina.waitForFunction(() => !document.querySelector('#edit-input'));
  assert.equal((await lerAssuntos(pagina))[0].text, 'Novo\ntexto');
  await pagina.click('.line');
  await pagina.fill('#edit-input', 'y'.repeat(10001));
  await pagina.press('#edit-input', 'Enter');
  await pagina.waitForSelector('#limite:not([hidden])');
  assert.equal((await lerAssuntos(pagina))[0].text, 'Novo\ntexto', 'o texto antigo continua');
  await contexto.close();
});
