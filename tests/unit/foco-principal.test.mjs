// E3.4 · Foco principal (HJ-02, D-017): campo aditivo `focus_main`, regras puras.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/casos.js';
import { focusList } from '../../src/foco.js';
import { estadoVazio, novoAssunto, validar } from '../../src/modelo.js';

const CTX = { hoje: '2026-11-18', agora: '2026-11-18T15:00:00.000Z' };
const mk = (id, extra = {}) => novoAssunto({ id, original_text: id, text: id, created_at: '2026-11-10T12:00:00.000Z', updated_at: '2026-11-10T12:00:00.000Z', created_day: '2026-11-10', status: 'in_progress', ordem: Number(id.slice(1)), ...extra });
const est = (...as) => { const e = estadoVazio(); e.assuntos = as; return e; };
const ap = (e, m) => C.aplicar(e, m);
const por = (e, id) => e.assuntos.find((a) => a.id === id);
const v = (id, o = {}) => ({ id, text: id, created: '2026-11-10', status: 'aberto', type: 'fazer', focus: false, main: false, snoozeUntil: '', ...o });

test('modelo: focus_main é opcional (dados antigos valem como falso), mas se existir tem de ser verdadeiro ou falso', () => {
  assert.equal(novoAssunto({}).focus_main, false);
  const antigo = mk('a1'); delete antigo.focus_main;
  assert.deepEqual(validar(est(antigo)), []);
  assert.deepEqual(validar(est(mk('a1', { focus_main: true }))), []);
  assert.match(validar(est(mk('a1', { focus_main: 'sim' }))).join(), /focus_main/);
});

test('definirFoco: marca o principal entre os escolhidos e só um fica principal', () => {
  let e = est(mk('a1'), mk('a2'), mk('a3'), mk('a4'));
  e = ap(e, C.definirFoco(e, ['a1', 'a2', 'a3'], CTX, 'a2'));
  assert.deepEqual(e.assuntos.map((a) => [a.focus, a.focus_main]), [[true, false], [true, true], [true, false], [false, false]]);
  e = ap(e, C.definirFoco(e, ['a1', 'a2', 'a3'], CTX, 'a3'));
  assert.deepEqual(e.assuntos.filter((a) => a.focus_main).map((a) => a.id), ['a3']);
});

test('definirFoco: principal fora da lista (ou ausente) não marca ninguém; só devolve o que mudou', () => {
  let e = est(mk('a1'), mk('a2'));
  e = ap(e, C.definirFoco(e, ['a1'], CTX, 'a2'));
  assert.deepEqual(e.assuntos.map((a) => [a.focus, a.focus_main]), [[true, false], [false, false]]);
  assert.ok(C.semMudanca(C.definirFoco(e, ['a1'], CTX)), 'nada a mudar');
  const so = C.definirFoco(e, ['a1'], CTX, 'a1');
  assert.deepEqual(so.assuntos.map((a) => a.id), ['a1'], 'só o a1 mudou');
});

test('resolver, adiar e deixar pra lá tiram o assunto do foco e da condição de principal; desfazer devolve', () => {
  const base = ap(est(mk('a1'), mk('a2')), C.definirFoco(est(mk('a1'), mk('a2')), ['a1', 'a2'], CTX, 'a1'));
  for (const fn of [C.resolver, (e, id, c) => C.adiar(e, id, c, 2), C.deixarPraLa]) {
    const m = fn(base, 'a1', CTX);
    const depois = por(ap(base, m), 'a1');
    assert.deepEqual([depois.focus, depois.focus_main], [false, false]);
    const volta = por(ap(ap(base, m), C.inverter(base, m)), 'a1');
    assert.deepEqual([volta.focus, volta.focus_main], [true, true]);
  }
});

test('focusList: o principal vem primeiro; sem marcado, o de maior prioridade assume; nunca há dois', () => {
  const hoje = '2026-11-18';
  const l = [v('x', { focus: true, created: '2026-11-17' }), v('y', { focus: true, created: '2026-11-10' }), v('z', { focus: true, created: '2026-11-15', main: true })];
  const r = focusList(l, hoje);
  assert.deepEqual([r.principal, r.list.map((i) => i.id), r.chosen], ['z', ['z', 'y', 'x'], true]);
  const sem = focusList(l.map((i) => ({ ...i, main: false })), hoje);
  assert.equal(sem.principal, 'y', 'o mais antigo assume');
  const dois = focusList(l.map((i) => ({ ...i, main: i.id !== 'x' })), hoje);
  assert.deepEqual([dois.principal, dois.list.length], ['y', 3], 'dados com dois marcados: vale um só');
});

test('focusList: principal marcado que saiu do foco não pesa; sugestão automática também tem principal; vazio não quebra', () => {
  const hoje = '2026-11-18';
  const fora = [v('a', { focus: true, created: '2026-11-17' }), v('b', { focus: false, main: true, created: '2026-11-01' })];
  assert.equal(focusList(fora, hoje).principal, 'a');
  const sug = focusList([v('a', { created: '2026-11-17' }), v('b', { created: '2026-11-10' }), v('c'), v('d', { created: '2026-11-01' })], hoje);
  assert.deepEqual([sug.chosen, sug.principal, sug.list.length], [false, 'd', 3]);
  assert.deepEqual(focusList([], hoje), { list: [], chosen: false, principal: null });
});
