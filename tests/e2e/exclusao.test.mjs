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

// E2.2 · CAP-05 / D-015: "Apagar tudo" pede confirmação clara; apagar uma anotação segue com Desfazer.
const comDados = () => estadoBase([assunto('Primeiro', { focus: true }), assunto('Segundo'), assunto('Terceiro', { status: 'resolvido', doneDate: '2026-11-10' })]);
async function abrirPerfil(pagina) { await pagina.goto(amb.url); await pagina.click('[data-act="go"][data-to="perfil"]'); }

test('Apagar tudo: o primeiro toque só abre a confirmação, que diz quanto some e que não dá para desfazer', async () => {
  const { contexto, pagina } = await novaPagina(amb, comDados());
  await abrirPerfil(pagina);
  await pagina.click('[data-act="reset"]');
  const card = pagina.locator('#reset-card');
  assert.match(await card.innerText(), /3 assuntos/);
  assert.match(await card.innerText(), /Não dá para desfazer/);
  assert.equal((await lerAssuntos(pagina)).length, 3, 'nada foi apagado ainda');
  await contexto.close();
});

test('Apagar tudo: Cancelar e sair da tela mantêm tudo; só "Apagar tudo" apaga', async () => {
  const { contexto, pagina } = await novaPagina(amb, comDados());
  await abrirPerfil(pagina);
  await pagina.click('[data-act="reset"]');
  await pagina.click('[data-act="reset-cancel"]');
  assert.equal(await pagina.locator('#reset-card').count(), 0);
  assert.equal((await lerAssuntos(pagina)).length, 3);
  await pagina.click('[data-act="reset"]');
  await pagina.click('[data-act="go"][data-to="hoje"]');
  await pagina.click('[data-act="go"][data-to="perfil"]');
  assert.equal(await pagina.locator('#reset-card').count(), 0, 'sair da tela cancela');
  await pagina.click('[data-act="reset"]');
  await pagina.click('[data-act="reset-ok"]');
  await pagina.waitForSelector('text=Tudo apagado');
  assert.equal(await lerAssuntos(pagina), null);
  await contexto.close();
});

test('Apagar tudo: "Salvar uma cópia primeiro" baixa a cópia e mantém a confirmação aberta', async () => {
  const { contexto, pagina } = await novaPagina(amb, comDados());
  await abrirPerfil(pagina);
  await pagina.click('[data-act="reset"]');
  const [download] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#reset-card [data-act="export"]')]);
  assert.match(download.suggestedFilename(), /clarea/i);
  assert.equal(await pagina.locator('#reset-card').count(), 1, 'a confirmação continua aberta');
  assert.equal((await lerAssuntos(pagina)).length, 3);
  await contexto.close();
});
