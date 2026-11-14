// E1.1 · Regras puras testadas sem navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ageOf, addDays, diffDays, dateShort, norm, esc, plural, initials } from '../../src/util.js';
import { suggest } from '../../src/sugestao.js';
import { focusList, dayPct, doneToday, score } from '../../src/foco.js';
import { pautaText, semanaText, observation } from '../../src/textos.js';

const HOJE = '2026-11-14';
const it = (o) => ({ id: Math.random().toString(36), text: 'x', created: HOJE, status: 'aberto', type: 'fazer', person: '', tema: '', ...o });
const ctx = (o = {}) => ({ people: [], temas: [], temasTodos: o.temas || [], items: [], ...o });

test('datas: addDays, diffDays e idade atravessam mês e ano', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-11-10', HOJE), 4);
  assert.equal(ageOf(it({ created: '2026-11-10' }), HOJE), 4);
  assert.equal(ageOf(it({ created: '2026-12-01' }), HOJE), 0, 'nunca negativa');
  assert.equal(dateShort(undefined, HOJE), '14/11');
});

test('texto: esc neutraliza HTML, norm tira acento, plural e iniciais', () => {
  assert.equal(esc('<b a="1">&\'</b>'), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;&lt;/b&gt;');
  assert.equal(norm('  Ação É Então '), 'acao e entao');
  assert.equal(plural(1, 'assunto', 'assuntos'), '1 assunto');
  assert.equal(plural(0, 'assunto', 'assuntos'), '0 assuntos');
  assert.equal(initials('Marina Souza'), 'MA');
  assert.equal(initials(''), '·');
});

test('sugestão: tipo pela palavra, pessoa por @ e tema por #', () => {
  let r = suggest('Cobrar o contrato com @marina #financeiro', ctx({ temas: ['Financeiro'] }));
  assert.equal(r.type, 'retomar');
  assert.equal(r.person, 'Marina');
  assert.equal(r.tema, 'Financeiro');
  r = suggest('Aguardando retorno do fornecedor', ctx());
  assert.equal(r.type, 'esperando');
  r = suggest('comprar café', ctx());
  assert.equal(r.type, 'fazer');
  assert.match(r.why, /Sem pistas/);
});

test('sugestão: reconhece pessoa já conhecida e não confunde mês nem tema com pessoa', () => {
  assert.equal(suggest('ligar para paulo amanhã', ctx({ people: ['Paulo'] })).person, 'Paulo');
  assert.equal(suggest('reunião com Março', ctx()).person, '', 'mês não é pessoa');
  assert.equal(suggest('falar com Vendas hoje', ctx({ temas: ['Vendas'], temasTodos: ['Vendas'] })).person, '', 'tema não é pessoa');
  assert.equal(suggest('falar com Vendas hoje', ctx({ temas: [], temasTodos: ['Vendas'] })).person, '', 'nem tema arquivado');
});

test('foco: usa o escolhido; sem escolha, sugere os 3 mais antigos (retomar pesa +2)', () => {
  const a = it({ id: 'a', created: '2026-11-14' }), b = it({ id: 'b', created: '2026-11-10' }), c = it({ id: 'c', created: '2026-11-13', type: 'retomar' }), d = it({ id: 'd', created: '2026-11-14' });
  const sug = focusList([a, b, c, d], HOJE);
  assert.equal(sug.chosen, false);
  assert.deepEqual(sug.list.map((i) => i.id), ['b', 'c', 'a']);
  assert.equal(score(c, HOJE), 3);
  const esc1 = focusList([a, { ...d, focus: true }, b], HOJE);
  assert.equal(esc1.chosen, true);
  assert.deepEqual(esc1.list.map((i) => i.id), ['d']);
});

test('progresso do dia: 0 sem nada, parcial e completo', () => {
  assert.equal(dayPct(0, 0), 0);
  assert.equal(dayPct(1, 3), 0.25);
  assert.equal(dayPct(2, 0), 1);
  const itens = [it({ status: 'resolvido', doneDate: HOJE }), it({ status: 'tarefa', doneDate: HOJE }), it({ status: 'resolvido', doneDate: '2026-11-13' }), it({})];
  assert.equal(doneToday(itens, HOJE), 2);
});

test('textos: pauta lista só a pessoa pedida, do mais antigo ao mais novo', () => {
  const t = pautaText('Marina', [it({ text: 'Novo', person: 'Marina' }), it({ text: 'Velho', person: 'marina', created: '2026-11-10', type: 'esperando' }), it({ text: 'Outro', person: 'Paulo' })], HOJE);
  assert.match(t, /^Pauta com Marina \(14\/11\)/);
  assert.ok(t.indexOf('Velho') < t.indexOf('Novo'));
  assert.ok(!t.includes('Outro'));
  assert.match(pautaText('Zé', [], HOJE), /Nada em aberto com essa pessoa/);
});

test('textos: resumo da semana agrupa por tema e ignora o que é antigo', () => {
  const itens = [it({ status: 'resolvido', doneDate: '2026-11-12', text: 'Feito', tema: 'RH' }), it({ status: 'resolvido', doneDate: '2026-11-01', text: 'Antigo', tema: 'RH' }), it({ text: 'Seguindo', tema: '' })];
  const t = semanaText(itens, HOJE);
  assert.match(t, /Resumo da semana \(08\/11 a 14\/11\)/);
  assert.ok(t.includes('Feito') && !t.includes('Antigo') && t.includes('Sem tema'));
  assert.match(semanaText([], HOJE), /Nada registrado/);
});

test('observação: duas pendências antigas com a mesma pessoa; senão um assunto parado há 7 dias; senão nada', () => {
  const dois = [it({ person: 'Ana', created: '2026-11-08' }), it({ person: 'Ana', created: '2026-11-09' })];
  const o = observation(dois, HOJE);
  assert.equal(o.person, 'Ana');
  assert.match(o.text, /2 assuntos com Ana seguem há pelo menos 5 dias/);
  assert.match(observation([it({ text: 'Parado', created: '2026-11-01' })], HOJE).text, /“Parado” está aqui há 13 dias/);
  assert.equal(observation([it({})], HOJE), null);
});

test('todo módulo de src/ está na lista de arquivos essenciais do service worker', () => {
  const raiz = resolve(import.meta.dirname, '../..');
  const sw = readFileSync(resolve(raiz, 'sw.js'), 'utf8');
  const bloco = sw.match(/ESSENCIAIS\s*=\s*\[([\s\S]*?)\]/)[1];
  const faltando = readdirSync(resolve(raiz, 'src')).filter((f) => f.endsWith('.js')).filter((f) => !bloco.includes(`'./src/${f}'`));
  assert.deepEqual(faltando, [], 'sem isso o app não abre offline');
});
