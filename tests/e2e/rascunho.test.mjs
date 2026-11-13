// C5 · O que a pessoa está digitando não pode se perder
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

test('o texto em digitação no Anotar sobrevive a sair do app e voltar', { todo: 'S0.4 · C5' }, async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  await pagina.fill('#new-line', 'rascunho que eu estava digitando');
  await pagina.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pagina.waitForTimeout(200);
  assert.equal(await pagina.inputValue('#new-line'), 'rascunho que eu estava digitando');
  await contexto.close();
});

test('o texto editado em "Editar assunto" não some ao tocar num tipo, pessoa ou tema', { todo: 'S0.4 · C5' }, async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Texto antigo', { focus: true })]));
  await pagina.goto(amb.url);
  await pagina.click('text=Editar tipo, pessoa ou tema');
  await pagina.fill('#edit-item-text', 'Texto novo editado');
  await pagina.click('.sheet button.chip:has-text("Confirmar")');
  assert.equal(await pagina.inputValue('#edit-item-text'), 'Texto novo editado');
  await contexto.close();
});
