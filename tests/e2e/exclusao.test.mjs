// A2 · Exclusões precisam de "Desfazer"
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

test('apagar uma anotação oferece Desfazer', { todo: 'S0.6 · A2' }, async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Para apagar', { status: 'novo', type: '' })]));
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.click('button.line:has-text("Para apagar")');
  await pagina.click('button:has-text("Apagar")');
  const aviso = await pagina.textContent('#toast');
  assert.match(aviso, /Desfazer/);
  await contexto.close();
});

test('limpar tarefas concluídas oferece Desfazer', { todo: 'S0.6 · A2' }, async () => {
  const estado = estadoBase([assunto('Em andamento', { focus: true })], {
    tasks: [{ id: 't1', text: 'Tarefa feita', done: true, created: '2026-11-10', itemId: 'x' }]
  });
  const { contexto, pagina } = await novaPagina(amb, estado);
  await pagina.goto(amb.url);
  await pagina.click('text=Limpar concluídas');
  const visivel = await pagina.evaluate(() => !document.getElementById('toast').hidden);
  assert.ok(visivel, 'esperava um aviso na tela');
  assert.match(await pagina.textContent('#toast'), /Desfazer/);
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
