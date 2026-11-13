// C5 · O que a pessoa está digitando não pode se perder
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto, anotar } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

test('o texto em digitação no Anotar sobrevive a sair do app e voltar', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  await pagina.fill('#new-line', 'rascunho que eu estava digitando');
  await pagina.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pagina.waitForTimeout(200);
  assert.equal(await pagina.inputValue('#new-line'), 'rascunho que eu estava digitando');
  assert.equal(await pagina.evaluate(() => document.activeElement && document.activeElement.id), 'new-line', 'o foco deve continuar no campo');
  await contexto.close();
});

test('o texto editado em "Editar assunto" não some ao tocar num tipo, pessoa ou tema', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Texto antigo', { focus: true })]));
  await pagina.goto(amb.url);
  await pagina.click('text=Editar tipo, pessoa ou tema');
  await pagina.fill('#edit-item-text', 'Texto novo editado');
  await pagina.click('.sheet button.chip:has-text("Confirmar")');
  assert.equal(await pagina.inputValue('#edit-item-text'), 'Texto novo editado');
  await contexto.close();
});

test('depois de guardar, o campo do Anotar volta vazio (o rascunho não gruda)', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  await pagina.fill('#new-line', 'primeira');
  await pagina.press('#new-line', 'Enter');
  await pagina.waitForTimeout(100);
  assert.equal(await pagina.inputValue('#new-line'), '');
  await contexto.close();
});

test('o cursor fica onde estava ao redesenhar a tela', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  await pagina.fill('#new-line', 'abcdef');
  await pagina.evaluate(() => { const e = document.getElementById('new-line'); e.setSelectionRange(2, 2); document.dispatchEvent(new Event('visibilitychange')); });
  await pagina.waitForTimeout(200);
  assert.equal(await pagina.evaluate(() => document.getElementById('new-line').selectionStart), 2);
  await contexto.close();
});

test('editar um assunto e depois outro não mistura os textos digitados', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  await anotar(pagina, 'Primeiro');
  await anotar(pagina, 'Segundo');
  await pagina.locator('button.line:has-text("Primeiro")').click();
  await pagina.fill('#edit-input', 'mudei o primeiro');
  await pagina.locator('button.line:has-text("Segundo")').click();
  const valor = await pagina.inputValue('#edit-input');
  assert.equal(valor, 'Segundo', 'o campo deve mostrar o texto do outro assunto');
  await contexto.close();
});
