// E3.3 · Visão Aguardando no Hoje (HJ-03, CA-05, D-010).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto, lerAssuntos } from '../helpers/app.mjs';
import { iso, addDays } from '../../src/util.js';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const hoje = () => iso(new Date());
const semDicas = { anotar: true, 'clear-intro': true, hoje: true, historico: true };
const dd = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
const espera = (extra = {}) => assunto('Resposta do banco', { type: 'esperando', person: 'Banco', ...extra });
const estado = (...itens) => estadoBase(itens, { tips: semDicas, people: ['Banco'] });
// A importação do formato 1.0 ignora datas que não são futuras; por isso o retorno é gravado para amanhã
// e o relógio do navegador avança para esse dia.
async function chegouOAmanha(extra = {}) {
  const r = await novaPagina(amb, estado(espera({ snoozeUntil: addDays(hoje(), 1), ...extra })));
  await r.pagina.goto(amb.url);
  await r.pagina.waitForSelector('button[data-act="toggle-espera"]');
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(12, 0, 0, 0);
  await r.contexto.clock.setFixedTime(amanha);
  await r.pagina.reload();
  return r;
}
const secao = (pagina) => pagina.locator('button[data-act="toggle-espera"]');

test('aguardando fica numa seção recolhida, fora do foco e do progresso do dia', async () => {
  const { contexto, pagina } = await novaPagina(amb, estado(espera({ focus: true }), assunto('Pagar a conta', { type: 'fazer' })));
  await pagina.goto(amb.url);
  assert.equal(await secao(pagina).textContent().then((t) => t.trim()), '1 assunto aguardando ▾');
  assert.equal(await pagina.locator('.focus-list .focus', { hasText: 'Resposta do banco' }).count(), 0, 'fora do foco');
  assert.equal(await pagina.locator('.focus', { hasText: 'Pagar a conta' }).count(), 1);
  assert.equal(await pagina.locator('.focus').count(), 1, 'só o assunto próprio no foco');
  assert.match(await pagina.locator('.lens-card').textContent(), /1 assunto pede sua atenção/);
  assert.equal(await pagina.locator('text=sem data de retorno').count(), 0, 'recolhida');
  await secao(pagina).click();
  const linha = pagina.locator('li.card', { hasText: 'Resposta do banco' });
  assert.match(await linha.textContent(), /Banco · .*(Atualizado hoje|Sem novidade há \d+ dias?) · sem data de retorno/);
  assert.deepEqual(await linha.locator('button').allTextContents(), ['Resolvido', 'Recebi resposta', 'Definir retorno']);
  assert.equal(pagina.errosJs.length, 0);
  await contexto.close();
});

test('sem nenhum assunto aguardando a seção não aparece', async () => {
  const { contexto, pagina } = await novaPagina(amb, estado(assunto('Pagar a conta', { type: 'fazer', focus: true })));
  await pagina.goto(amb.url);
  assert.equal(await secao(pagina).count(), 0);
  assert.equal(await pagina.locator('text=aguardando').count(), 0);
  await contexto.close();
});

test('Definir retorno: continua aguardando com a data, fora de "guardados", e dá para mudar e tirar a data', async () => {
  const { contexto, pagina } = await novaPagina(amb, estado(espera()));
  await pagina.goto(amb.url);
  await secao(pagina).click();
  await pagina.click('button:text-is("Definir retorno")');
  await pagina.waitForSelector('text=Voltar a olhar quando?');
  assert.equal(await pagina.locator('text=continua aguardando e volta ao seu Hoje').count(), 1);
  await pagina.click('button:has-text("Em 3 dias")');
  await pagina.waitForSelector(`text=Retorno em ${dd(addDays(hoje(), 3))}. Continua aguardando.`);
  let a = (await lerAssuntos(pagina))[0].v2;
  assert.deepEqual([a.status, a.resume_at], ['waiting', addDays(hoje(), 3)]);
  assert.equal(await pagina.locator('button[data-kind="guardados"]').count(), 0, 'não vira guardado');
  assert.equal(await secao(pagina).count(), 1);
  assert.match(await pagina.locator('li.card', { hasText: 'Resposta do banco' }).textContent(), new RegExp(`retorno em ${dd(addDays(hoje(), 3))}`));
  await pagina.click('button:text-is("Mudar retorno")');
  await pagina.click('button:text-is("Sem data de retorno")');
  await pagina.waitForSelector('text=Retorno removido. Continua aguardando.');
  a = (await lerAssuntos(pagina))[0].v2;
  assert.deepEqual([a.status, a.resume_at], ['waiting', null]);
  assert.equal(pagina.errosJs.length, 0);
  await contexto.close();
});

test('chegou o dia de retorno: o assunto volta ao foco do Hoje com um aviso neutro', async () => {
  const { contexto, pagina } = await chegouOAmanha();
  assert.equal(await secao(pagina).count(), 0, 'sai da seção');
  const cartao = pagina.locator('.focus', { hasText: 'Resposta do banco' });
  assert.equal(await cartao.count(), 1);
  assert.match(await cartao.textContent(), /Chegou o dia de acompanhar\./);
  assert.doesNotMatch(await cartao.textContent(), /atrasad|vencid|cobrar/i);
  await contexto.close();
});

test('Recebi resposta: vira assunto em andamento, entra no foco e dá para desfazer', async () => {
  const { contexto, pagina } = await novaPagina(amb, estado(espera({ snoozeUntil: addDays(hoje(), 5) })));
  await pagina.goto(amb.url);
  await secao(pagina).click();
  await pagina.click('button:text-is("Recebi resposta")');
  await pagina.waitForSelector('text=Voltou para o seu Hoje.');
  let a = (await lerAssuntos(pagina))[0].v2;
  assert.deepEqual([a.status, a.resume_at], ['in_progress', null]);
  assert.equal(await pagina.locator('.focus', { hasText: 'Resposta do banco' }).count(), 1);
  assert.equal(await secao(pagina).count(), 0);
  await pagina.click('[data-act="undo"]');
  await pagina.waitForSelector('button[data-act="toggle-espera"]');
  a = (await lerAssuntos(pagina))[0].v2;
  assert.deepEqual([a.status, a.resume_at], ['waiting', addDays(hoje(), 5)]);
  await contexto.close();
});

test('Resolvido na seção: resolve o assunto e ele sai da seção', async () => {
  const { contexto, pagina } = await novaPagina(amb, estado(espera()));
  await pagina.goto(amb.url);
  await secao(pagina).click();
  await pagina.click('li.card button:text-is("Resolvido")');
  await pagina.waitForSelector('text=Resolvido.');
  const a = (await lerAssuntos(pagina))[0].v2;
  assert.equal(a.status, 'done');
  assert.equal(await secao(pagina).count(), 0);
  await contexto.close();
});

test('adiar um assunto que já chegou o dia continua aguardando, agora com nova data', async () => {
  const { contexto, pagina } = await chegouOAmanha();
  const depois = addDays(hoje(), 2);
  await pagina.click('.focus [data-act="adiar-open"]');
  await pagina.click('button:has-text("Amanhã")');
  await pagina.waitForSelector(`text=Retorno em ${dd(depois)}`);
  const a = (await lerAssuntos(pagina))[0].v2;
  assert.deepEqual([a.status, a.resume_at], ['waiting', depois]);
  assert.equal(await secao(pagina).count(), 1);
  await contexto.close();
});
