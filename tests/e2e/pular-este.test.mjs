// P-014 / D-017 · "Pular este" deixa o assunto para depois: continua na caixa de entrada.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto, lerAssuntos } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const semDicas = { anotar: true, 'clear-intro': true, hoje: true, historico: true };
const dois = () => [assunto('Ligar para o contador', { status: 'novo', type: '', created: '2026-11-10' }), assunto('Comprar café', { status: 'novo', type: '', created: '2026-11-11' })];
async function abrirClarear() {
  const r = await novaPagina(amb, estadoBase(dois(), { tips: semDicas }));
  await r.pagina.goto(amb.url);
  await r.pagina.click('[data-act="go"][data-to="clarear"]').catch(async () => { await r.pagina.click('[data-act="clear-intro"]'); });
  await r.pagina.click('[data-act="clear-start"]');
  return r;
}

test('Pular este não muda o assunto: segue novo, fora de "organizado", e aparece como "ficou para depois"', async () => {
  const { contexto, pagina } = await abrirClarear();
  await pagina.click('[data-act="clear-skip"]');          // pula o mais antigo
  await pagina.click('[data-act="clear-ok"]');            // confirma o outro
  await pagina.click('[data-act="foco-ok"]');             // escolhe o foco de amanhã
  await pagina.waitForSelector('text=Dia clareado.');
  const lead = await pagina.locator('.lead').innerText();
  assert.match(lead, /1 organizado/);
  assert.match(lead, /1 ficou para depois/);
  const lista = await lerAssuntos(pagina);
  const pulado = lista.find((a) => a.text === 'Ligar para o contador');
  assert.equal(pulado.status, 'novo', 'continua na caixa de entrada');
  assert.equal(await pagina.locator('text=/1 anotação ficou para outro momento/').count(), 1);
  assert.equal(pagina.errosJs.length, 0);
  await contexto.close();
});

test('Desfazer anterior volta o assunto pulado para a fila, sem erro', async () => {
  const { contexto, pagina } = await abrirClarear();
  await pagina.click('[data-act="clear-skip"]');
  await pagina.click('[data-act="clear-undo"]');
  assert.match(await pagina.locator('.clear-text').innerText(), /Ligar para o contador/);
  await pagina.click('[data-act="clear-skip"]');
  await pagina.click('[data-act="clear-skip"]');
  await pagina.waitForSelector('text=Dia clareado.');
  assert.match(await pagina.locator('.lead').innerText(), /2 ficaram para depois/);
  assert.equal(pagina.errosJs.length, 0);
  await contexto.close();
});

test('o assunto pulado volta no próximo Clarear o dia', async () => {
  const { contexto, pagina } = await abrirClarear();
  await pagina.click('[data-act="clear-skip"]');
  await pagina.click('[data-act="clear-skip"]');
  await pagina.click('[data-act="resumo-ok"]');
  await pagina.click('[data-act="go"][data-to="clarear"]').catch(async () => { await pagina.click('[data-act="clear-intro"]'); });
  await pagina.click('[data-act="clear-start"]');
  assert.match(await pagina.locator('.clear-card').innerText(), /Ligar para o contador|Comprar café/);
  await contexto.close();
});
