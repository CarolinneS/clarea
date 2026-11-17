// E2.3 · Busca sobre o modelo 2.0 (D-015)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscar } from '../../src/busca.js';
import { estadoVazio, novoAssunto } from '../../src/modelo.js';

const mk = (id, texto, extra = {}) => novoAssunto({ id, original_text: texto, text: texto, created_day: '2026-11-10', created_at: '2026-11-10T12:00:00.000Z', ordem: Number(id.replace(/\D/g, '')) || 0, ...extra });
const est = () => {
  const e = estadoVazio();
  e.pessoas = [{ id: 'p1', name: 'Ana Paula' }];
  e.temas = [{ id: 't1', name: 'Matemática' }];
  e.assuntos = [
    mk('a1', 'Estudar Álgebra linear', { topic_id: 't1' }),
    mk('a2', 'Cobrar o contrato', { person_id: 'p1', next_action: 'chase', created_day: '2026-11-12', created_at: '2026-11-12T09:00:00.000Z' }),
    mk('a3', 'Comprar pão', { status: 'done', created_day: '2026-11-11', created_at: '2026-11-11T09:00:00.000Z' }),
    mk('a4', 'Texto novo', { original_text: 'Texto original antigo' })
  ];
  return e;
};

test('busca vazia devolve todos, do mais recente para o mais antigo', () => {
  const ids = buscar(est(), '');
  assert.equal(ids.length, 4);
  assert.deepEqual(ids.slice(0, 2), ['a2', 'a3']);
  assert.deepEqual(buscar(est(), '   '), ids);
});

test('ignora maiúsculas e acentos', () => {
  assert.deepEqual(buscar(est(), 'ALGEBRA'), ['a1']);
  assert.deepEqual(buscar(est(), 'matematica'), ['a1'], 'acha pelo tema');
});

test('acha por pessoa, por tipo e pelo texto original', () => {
  assert.deepEqual(buscar(est(), 'paula'), ['a2']);
  assert.deepEqual(buscar(est(), 'retomar'), ['a2'], 'tipo do assunto');
  assert.deepEqual(buscar(est(), 'antigo'), ['a4'], 'texto original, mesmo depois de editar o texto');
});

test('várias palavras: todas precisam aparecer, em qualquer ordem', () => {
  assert.deepEqual(buscar(est(), 'contrato ana'), ['a2']);
  assert.deepEqual(buscar(est(), 'paula contrato'), ['a2'], 'ordem diferente da do texto');
  assert.deepEqual(buscar(est(), 'ana pão'), []);
});

test('não altera o estado recebido', () => {
  const e = est(), antes = JSON.stringify(e);
  buscar(e, 'ana');
  assert.equal(JSON.stringify(e), antes);
});

test('desempenho: 5.000 assuntos respondem rápido (a lista só desenha 50)', () => {
  const e = estadoVazio();
  e.assuntos = Array.from({ length: 5000 }, (_, i) => mk('x' + i, `Assunto número ${i} sobre estudo de capítulo ${i % 37}`));
  const t0 = performance.now();
  const r = buscar(e, 'capitulo 12');
  const ms = performance.now() - t0;
  assert.ok(r.length > 0);
  assert.ok(ms < 500, `buscou em ${ms.toFixed(0)} ms (limite de segurança: 500 ms)`);
});
