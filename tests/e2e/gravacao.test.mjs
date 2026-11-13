// C2 · Gravação imediata, C3 · Várias abas, e textos especiais (CA-01)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, lerAssuntos, textos, anotar } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

for (const espera of [50, 200, 600]) {
  test(`anotação confirmada sobrevive a recarregar após ${espera} ms`, async () => {
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

test('duas abas anotando não perdem anotações uma da outra', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url + '?tela=anotar');
  const outra = await contexto.newPage();
  await outra.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  await outra.waitForSelector('#new-line');
  await anotar(pagina, 'Da aba 1');
  await outra.waitForFunction(() => document.body.innerText.includes('Da aba 1'));
  await anotar(outra, 'Da aba 2');
  await pagina.waitForFunction(() => document.body.innerText.includes('Da aba 2'));
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

test('aba que recebe mudança de outra não apaga o que está sendo digitado', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url + '?tela=anotar');
  const outra = await contexto.newPage();
  await outra.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  await outra.waitForSelector('#new-line');
  await pagina.fill('#new-line', 'texto pela metade');
  await anotar(outra, 'Da outra aba');
  await pagina.waitForTimeout(500);
  assert.equal(await pagina.inputValue('#new-line'), 'texto pela metade');
  await contexto.close();
});

test('apagar tudo em uma aba reinicia a outra, sem reviver dados', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.goto(amb.url + '?tela=anotar');
  const outra = await contexto.newPage();
  await outra.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  await outra.waitForSelector('#new-line');
  await anotar(pagina, 'Vai sumir');
  await outra.waitForFunction(() => document.body.innerText.includes('Vai sumir'));
  await pagina.click('[data-act="go"][data-to="perfil"]');
  await pagina.click('[data-act="reset"]');
  await pagina.click('[data-act="reset"]');
  await outra.waitForFunction(() => !document.querySelector('#new-line') && !document.body.innerText.includes('Vai sumir'), null, { timeout: 5000 });
  await outra.reload();
  await outra.waitForTimeout(500);
  assert.equal((await outra.evaluate(() => document.body.innerText)).includes('Vai sumir'), false, 'dados não podem voltar');
  await contexto.close();
});

test('o app pede armazenamento persistente ao abrir', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase());
  await pagina.addInitScript(() => { window.__persist = 0; if (navigator.storage) navigator.storage.persist = async () => { window.__persist++; return true; }; });
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  assert.ok((await pagina.evaluate(() => window.__persist)) >= 1);
  await contexto.close();
});
