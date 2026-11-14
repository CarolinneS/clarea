// A2 · Exclusões precisam de "Desfazer"
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto, lerAssuntos, textos, anotar } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

test('apagar uma anotação oferece Desfazer', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Para apagar', { status: 'novo', type: '' })]));
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.click('button.line:has-text("Para apagar")');
  await pagina.click('button:has-text("Apagar")');
  const aviso = await pagina.textContent('#toast');
  assert.match(aviso, /Desfazer/);
  await contexto.close();
});

test('"Desfazer" depois de resolver devolve o assunto ao foco', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Resolver este', { focus: true })]));
  await pagina.goto(amb.url);
  // O primeiro assunto do foco já vem aberto, com as ações visíveis.
  await pagina.click('.act.good');
  await pagina.click('#toast button:has-text("Desfazer")');
  await pagina.waitForSelector('text=Resolver este');
  await contexto.close();
});

test('Desfazer devolve a anotação apagada, no mesmo lugar', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  for (const t of ['Um', 'Dois', 'Tres']) await anotar(pagina, t);
  await pagina.click('button.line:has-text("Dois")');
  await pagina.click('button:has-text("Apagar")');
  assert.deepEqual(textos(await lerAssuntos(pagina)), ['Um', 'Tres']);
  await pagina.click('#toast button:has-text("Desfazer")');
  assert.deepEqual(textos(await lerAssuntos(pagina)), ['Um', 'Dois', 'Tres']);
  await contexto.close();
});

test('o aviso de Desfazer fica na tela por mais de 5 segundos', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Resolver este', { focus: true })]));
  await pagina.goto(amb.url);
  await pagina.click('.act.good');
  await pagina.waitForTimeout(6000);
  assert.equal(await pagina.evaluate(() => !document.getElementById('toast').hidden), true);
  await contexto.close();
});
