// E3.3 · Visão Aguardando (HJ-03, CA-05, D-010): regras puras.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emEspera, chegouODia, ordenar, semNovidade } from '../../src/aguardando.js';

const HOJE = '2026-11-18';
const i = (o) => ({ id: 'x', status: 'aberto', type: 'esperando', snoozeUntil: '', created: '2026-11-10', atualizado: '2026-11-12', ...o });

test('sem data de retorno fica em espera; com data futura também; no dia ou depois, chegou o dia', () => {
  assert.equal(emEspera(i(), HOJE), true);
  assert.equal(emEspera(i({ snoozeUntil: '2026-11-19' }), HOJE), true);
  assert.equal(chegouODia(i({ snoozeUntil: '2026-11-19' }), HOJE), false);
  for (const d of [HOJE, '2026-11-10']) {
    assert.equal(chegouODia(i({ snoozeUntil: d }), HOJE), true, d);
    assert.equal(emEspera(i({ snoozeUntil: d }), HOJE), false, d);
  }
});

test('só assunto aberto do tipo esperando conta; resolvido, solto e outros tipos não', () => {
  assert.equal(emEspera(i({ type: 'fazer' }), HOJE), false);
  assert.equal(emEspera(i({ status: 'resolvido' }), HOJE), false);
  assert.equal(emEspera(i({ status: 'novo' }), HOJE), false);
  assert.equal(chegouODia(i({ status: 'solto', snoozeUntil: HOJE }), HOJE), false);
});

test('ordenar: retorno mais próximo primeiro; sem data depois, do menos recente ao mais recente', () => {
  const l = [i({ id: 'sd2', atualizado: '2026-11-15' }), i({ id: 'longe', snoozeUntil: '2026-12-01' }), i({ id: 'sd1', atualizado: '2026-11-11' }), i({ id: 'perto', snoozeUntil: '2026-11-20' })];
  assert.deepEqual(ordenar(l).map((x) => x.id), ['perto', 'longe', 'sd1', 'sd2']);
});

test('semNovidade usa linguagem neutra, sem cobrança', () => {
  assert.equal(semNovidade(0), 'Atualizado hoje');
  assert.equal(semNovidade(1), 'Sem novidade há 1 dia');
  assert.equal(semNovidade(6), 'Sem novidade há 6 dias');
  for (const n of [0, 1, 6, 40]) assert.doesNotMatch(semNovidade(n), /atras|demor|cobr|urgente/i);
});
