// E3.2 · Guardar para outro dia (HJ-06) e lista de guardados.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto, lerAssuntos } from '../helpers/app.mjs';
import { iso, addDays, proximaSegunda } from '../../src/util.js';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const hoje = () => iso(new Date());
const semDicas = { anotar: true, 'clear-intro': true, hoje: true, historico: true };
const um = () => estadoBase([assunto('Ligar para o contador', { focus: true })], { tips: semDicas });
const dd = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
async function abrirOutroDia(pagina) {
  await pagina.click('.focus.open button:text-is("Adiar")');
  await pagina.waitForSelector('text=Adiar para quando?');
}

test('Adiar > Em 3 dias: o assunto fica agendado com a data certa e o Hoje mostra a lista', async () => {
  const { contexto, pagina } = await novaPagina(amb, um());
  await pagina.goto(amb.url);
  await abrirOutroDia(pagina);
  await pagina.click('button:has-text("Em 3 dias")');
  await pagina.waitForSelector(`text=Guardado até ${dd(addDays(hoje(), 3))}`);
  const a = (await lerAssuntos(pagina))[0].v2;
  assert.deepEqual([a.status, a.resume_at], ['scheduled', addDays(hoje(), 3)]);
  assert.equal(await pagina.locator('button:text-is("1 assunto guardado para outro dia")').count(), 1);
  assert.equal(pagina.errosJs.length, 0);
  await contexto.close();
});

test('Adiar > Próxima segunda e Escolher data', async () => {
  const seg = await novaPagina(amb, um());
  await seg.pagina.goto(amb.url);
  await abrirOutroDia(seg.pagina);
  await seg.pagina.click('button:has-text("Próxima segunda")');
  await seg.pagina.waitForSelector('text=Guardado até');
  assert.equal((await lerAssuntos(seg.pagina))[0].v2.resume_at, proximaSegunda(hoje()));
  await seg.contexto.close();

  const dt = await novaPagina(amb, um());
  await dt.pagina.goto(amb.url);
  await abrirOutroDia(dt.pagina);
  await dt.pagina.fill('#adiar-data', addDays(hoje(), 10));
  await dt.pagina.click('button:has-text("Adiar até essa data")');
  await dt.pagina.waitForSelector(`text=Guardado até ${dd(addDays(hoje(), 10))}`);
  assert.equal((await lerAssuntos(dt.pagina))[0].v2.resume_at, addDays(hoje(), 10));
  await dt.contexto.close();
});

test('data de hoje, do passado ou longe demais não guarda nada e avisa', async () => {
  const { contexto, pagina } = await novaPagina(amb, um());
  await pagina.goto(amb.url);
  await abrirOutroDia(pagina);
  for (const [data, aviso] of [[hoje(), 'a partir de amanhã'], [addDays(hoje(), 900), 'até 2 anos']]) {
    await pagina.evaluate((v) => { document.getElementById('adiar-data').value = v; document.getElementById('adiar-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }, data);
    await pagina.waitForSelector(`text=${aviso}`);
  }
  assert.equal((await lerAssuntos(pagina))[0].v2.status, 'in_progress');
  await contexto.close();
});

test('lista de guardados mostra a data e Trazer de volta devolve o assunto ao Hoje', async () => {
  const volta = addDays(hoje(), 4);
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Revisar contrato', { snoozeUntil: volta }), assunto('Ligar para o contador', { focus: true })], { tips: semDicas }));
  await pagina.goto(amb.url);
  await pagina.click('button:text-is("1 assunto guardado para outro dia")');
  await pagina.waitForSelector(`text=Volta em ${dd(volta)}`);
  await pagina.click('button:text-is("Trazer de volta")');
  await pagina.waitForSelector('text=Voltou para o seu Hoje.');
  const a = (await lerAssuntos(pagina)).find((x) => x.text === 'Revisar contrato').v2;
  assert.deepEqual([a.status, a.resume_at], ['in_progress', null]);
  assert.equal(await pagina.locator('button:has-text("guardado para outro dia")').count(), 0);
  assert.equal(pagina.errosJs.length, 0);
  await contexto.close();
});

test('Adiar > Amanhã guarda para amanhã e explica o que acontece', async () => {
  const { contexto, pagina } = await novaPagina(amb, um());
  await pagina.goto(amb.url);
  await abrirOutroDia(pagina);
  assert.equal(await pagina.locator('text=sai do seu Hoje e volta na data escolhida').count(), 1);
  await pagina.click('button:has-text("Amanhã")');
  await pagina.waitForSelector(`text=Guardado até ${dd(addDays(hoje(), 1))}`);
  const a = (await lerAssuntos(pagina))[0].v2;
  assert.deepEqual([a.status, a.resume_at], ['scheduled', addDays(hoje(), 1)]);
  await contexto.close();
});

test('o assunto tem 2 botões (Resolvido, Adiar) e "Deixar pra lá" é um link ao lado de Editar', async () => {
  const { contexto, pagina } = await novaPagina(amb, um(), { viewport: { width: 360, height: 740 } });
  await pagina.goto(amb.url);
  const caixas = await pagina.locator('.focus.open .actions .act').evaluateAll((els) => els.map((e) => ({ t: e.textContent.trim(), cortado: e.scrollWidth > e.clientWidth })));
  assert.deepEqual(caixas.map((c) => c.t), ['Resolvido', 'Adiar']);
  caixas.forEach((c) => assert.equal(c.cortado, false, `${c.t} cortado`));
  assert.equal(await pagina.locator('.focus.open button.link:text-is("Deixar pra lá")').count(), 1);
  assert.equal(await pagina.locator('.focus.open button.link:text-is("Editar")').count(), 1);
  await contexto.close();
});
