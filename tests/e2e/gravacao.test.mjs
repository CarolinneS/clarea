// C2 · Gravação imediata, C3 · Várias abas, e textos especiais (CA-01)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, lerAssuntos, textos, anotar } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

for (const [espera, todo] of [[50, 'S0.3 · C2'], [200, 'S0.3 · C2'], [600, false]]) {
  const opcoes = todo ? { todo } : {};
  test(`anotação confirmada sobrevive a recarregar após ${espera} ms`, opcoes, async () => {
    const { contexto, pagina } = await novaPagina(amb, estadoBase());
    await pagina.goto(amb.url + '?tela=anotar');
    await pagina.waitForSelector('#new-line');
    await anotar(pagina, `Captura ${espera}`);
    await pagina.waitForTimeout(espera);
    await pagina.reload();
    await pagina.waitForSelector('#new-line');
    assert.ok(textos(await lerAssuntos(pagina)).includes(`Captura ${espera}`));
    await contexto.close();
  });
}

test('duas abas anotando não perdem anotações uma da outra', { todo: 'S0.3 · C3' }, async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url + '?tela=anotar');
  const outra = await contexto.newPage();
  await outra.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  await outra.waitForSelector('#new-line');
  await anotar(pagina, 'Da aba 1');
  await pagina.waitForTimeout(700);
  await anotar(outra, 'Da aba 2');
  await outra.waitForTimeout(700);
  const guardado = textos(await lerAssuntos(pagina));
  assert.ok(guardado.includes('Da aba 1') && guardado.includes('Da aba 2'), `guardado: ${JSON.stringify(guardado)}`);
  await contexto.close();
});

test('acentos, emoji, HTML, 3.000 caracteres e duplo Enter são guardados como digitados', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  await anotar(pagina, 'Duplo');
  await pagina.press('#new-line', 'Enter');
  const especial = 'Ação çãõ é “aspas” <b>tag</b> & 😀 ' + 'x'.repeat(3000);
  await anotar(pagina, especial);
  await pagina.waitForTimeout(700);
  await pagina.reload();
  await pagina.waitForSelector('#new-line');
  const itens = await lerAssuntos(pagina);
  assert.equal(textos(itens).filter((t) => t === 'Duplo').length, 1, 'duplo Enter não pode duplicar');
  assert.ok(textos(itens).includes(especial), 'texto especial deve ficar intacto');
  assert.equal(await pagina.evaluate(() => !!document.querySelector('.lines b')), false, 'HTML digitado não pode ser interpretado');
  await contexto.close();
});
