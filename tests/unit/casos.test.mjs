// E1.4a · Casos de uso sobre o modelo 2.0 (D-012): regras puras, sem navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as C from '../../src/casos.js';
import { novoId } from '../../src/id.js';
import { estadoVazio, validar } from '../../src/modelo.js';
import { migrarParaV2 } from '../../src/migracao.js';

const CTX = { hoje: '2026-11-14', agora: '2026-11-14T15:00:00.000Z' };
const AMANHA = '2026-11-15';
let n = 0;
const ctx = (o = {}) => ({ ...CTX, novoId: () => `id-${++n}`, ...o });
const congelar = (o) => { Object.values(o).forEach((v) => { if (v && typeof v === 'object') congelar(v); }); return Object.freeze(o); };
const v1 = JSON.parse(readFileSync(resolve(import.meta.dirname, '../fixtures/backups/tipico.json'), 'utf8'));
const base = () => migrarParaV2(v1, CTX);
const ap = (est, m) => C.aplicar(est, m);
const por = (est, id) => est.assuntos.find((a) => a.id === id);
const ok = (est) => assert.deepEqual(validar(est), []);

test('id: UUID v4, único, e com plano B quando randomUUID não existe', () => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const ids = new Set(Array.from({ length: 500 }, () => novoId()));
  assert.equal(ids.size, 500);
  ids.forEach((i) => assert.match(i, re));
  assert.match(novoId({ getRandomValues: (b) => b.fill(255) }), re);
  assert.match(novoId(null), re);
  assert.equal(novoId({ randomUUID: () => 'fixo' }), 'fixo');
});

test('capturar: entra na caixa de entrada com o texto original e o dia local; texto vazio não cria nada', () => {
  const est = congelar(base());
  const m = C.capturar(est, '  Ligar para o banco  ', ctx());
  assert.equal(m.assuntos.length, 1);
  const a = m.assuntos[0];
  assert.deepEqual([a.status, a.original_text, a.text, a.created_day, a.source, a.next_action], ['inbox', 'Ligar para o banco', 'Ligar para o banco', CTX.hoje, 'manual', null]);
  assert.ok(a.ordem > Math.max(...est.assuntos.map((x) => x.ordem)), 'vai para o fim');
  ok(ap(est, m));
  assert.ok(C.semMudanca(C.capturar(est, '   ', ctx())));
});

test('organizar: tira da caixa de entrada, aprende pessoa e tema sem duplicar e mantém o texto original', () => {
  const est = congelar(base());
  const inbox = est.assuntos.find((a) => a.status === 'inbox');
  const m = C.organizar(est, inbox.id, { tipo: 'confirmar', pessoa: 'Pessoa Nova', tema: 'tema novo', texto: 'Texto editado' }, ctx());
  assert.equal(m.pessoas.length, 1); assert.equal(m.temas.length, 1);
  const dep = ap(est, m), a = por(dep, inbox.id);
  assert.deepEqual([a.status, a.next_action, a.text, a.original_text, a.confirmed_at], ['in_progress', 'check', 'Texto editado', inbox.original_text, CTX.agora]);
  assert.equal(dep.pessoas.find((p) => p.id === a.person_id).name, 'Pessoa Nova');
  ok(dep);
  // mesma pessoa de novo, com outra grafia: reaproveita
  const m2 = C.organizar(dep, a.id, { pessoa: 'pessoa nova' }, ctx());
  assert.equal(m2.pessoas.length, 0);
  assert.equal(m2.assuntos[0].person_id, a.person_id);
});

test('organizar sem tipo também tira da caixa de entrada; "esperando" vira Aguardando sem ação; tirar pessoa e tema', () => {
  const est = base();
  const inbox = est.assuntos.find((a) => a.status === 'inbox');
  const a1 = C.organizar(est, inbox.id, {}, ctx()).assuntos[0];
  assert.deepEqual([a1.status, a1.next_action], ['in_progress', null]);
  const a2 = C.organizar(est, inbox.id, { tipo: 'esperando' }, ctx()).assuntos[0];
  assert.deepEqual([a2.status, a2.next_action], ['waiting', null]);
  const comPessoa = est.assuntos.find((a) => (a.person_id || a.topic_id) && a.status === 'in_progress');
  const a3 = C.organizar(est, comPessoa.id, { pessoa: '', tema: '' }, ctx()).assuntos[0];
  assert.deepEqual([a3.person_id, a3.topic_id], [null, null]);
});

test('editar o tipo: Aguardando ⇄ ação própria, e adiado continua adiado', () => {
  const est = base();
  const agu = est.assuntos.find((a) => a.status === 'waiting' && !a.resume_at);
  const virou = C.organizar(est, agu.id, { tipo: 'retomar' }, ctx()).assuntos[0];
  assert.deepEqual([virou.status, virou.next_action], ['in_progress', 'chase']);
  const agendado = est.assuntos.find((a) => a.status === 'scheduled');
  const mudou = C.organizar(est, agendado.id, { tipo: 'fazer' }, ctx()).assuntos[0];
  assert.deepEqual([mudou.status, mudou.next_action, mudou.resume_at], ['scheduled', 'do', agendado.resume_at]);
  const emAnd = est.assuntos.find((a) => a.status === 'in_progress' && a.next_action);
  const semTipo = C.organizar(est, emAnd.id, { tipo: '' }, ctx()).assuntos[0];
  assert.deepEqual([semTipo.status, semTipo.next_action], ['in_progress', null]);
  assert.equal(C.tipoDe(virou), 'retomar'); assert.equal(C.tipoDe(semTipo), '');
  assert.equal(C.tipoDe(C.organizar(est, emAnd.id, { tipo: 'esperando' }, ctx()).assuntos[0]), 'esperando');
});

test('editar assunto concluído muda só a ação, sem reabrir', () => {
  const est = base();
  const feito = est.assuntos.find((a) => a.status === 'done');
  const a = C.organizar(est, feito.id, { tipo: 'conversar' }, ctx()).assuntos[0];
  assert.deepEqual([a.status, a.next_action], ['done', 'talk']);
});

test('resolver: conclui com data e dia locais, tira do foco e limpa a retomada', () => {
  const est = base();
  const foco = est.assuntos.find((a) => a.status === 'scheduled');
  const a = C.resolver({ ...est, assuntos: est.assuntos.map((x) => (x === foco ? { ...x, focus: true } : x)) }, foco.id, ctx()).assuntos[0];
  assert.deepEqual([a.status, a.completed_at, a.completed_day, a.focus, a.resume_at], ['done', CTX.agora, CTX.hoje, false, null]);
  assert.equal(a.local_version, foco.local_version + 1);
  assert.equal(a.updated_at, CTX.agora);
});

test('adiar: amanhã vira Agendado com data; Aguardando continua Aguardando com data de retomada', () => {
  const est = base();
  const emAnd = est.assuntos.find((a) => a.status === 'in_progress');
  const a = C.adiar(est, emAnd.id, ctx()).assuntos[0];
  assert.deepEqual([a.status, a.resume_at, a.next_action], ['scheduled', AMANHA, emAnd.next_action]);
  const agu = est.assuntos.find((a2) => a2.status === 'waiting');
  const b = C.adiar(est, agu.id, ctx(), 3).assuntos[0];
  assert.deepEqual([b.status, b.resume_at], ['waiting', '2026-11-17']);
});

test('acordar: só adiados cuja data chegou voltam para Em andamento', () => {
  const est = base();
  const ag = est.assuntos.find((a) => a.status === 'scheduled'); // 2026-11-20
  assert.ok(C.semMudanca(C.acordar(est, ctx())));
  const m = C.acordar(est, ctx({ hoje: '2026-11-20' }));
  const ids = m.assuntos.map((a) => a.id);
  assert.ok(ids.includes(ag.id));
  m.assuntos.forEach((a) => assert.deepEqual([a.status, a.resume_at], ['in_progress', null]));
  assert.equal(m.assuntos.length, est.assuntos.filter((a) => a.status === 'scheduled' && a.resume_at <= '2026-11-20').length);
});

test('deixar pra lá: descartado, sem ação, fora do foco', () => {
  const est = base();
  const a0 = est.assuntos.find((a) => a.status === 'in_progress');
  const a = C.deixarPraLa(est, a0.id, ctx()).assuntos[0];
  assert.deepEqual([a.status, a.next_action, a.focus, a.original_text], ['discarded', null, false, a0.original_text]);
});

test('foco: só devolve o que mudou, e só entre assuntos em aberto', () => {
  const est = base();
  const abertos = est.assuntos.filter((a) => ['in_progress', 'waiting', 'scheduled'].includes(a.status));
  const m1 = C.definirFoco(est, [abertos[0].id], ctx());
  const dep = ap(est, m1);
  assert.deepEqual(dep.assuntos.filter((a) => a.focus).map((a) => a.id), [abertos[0].id]);
  assert.ok(C.semMudanca(C.definirFoco(dep, [abertos[0].id], ctx())), 'repetir não muda nada');
  const m2 = C.definirFoco(dep, [abertos[1].id], ctx());
  assert.deepEqual(m2.assuntos.map((a) => [a.id, a.focus]).sort(), [[abertos[0].id, false], [abertos[1].id, true]].sort());
  const feito = est.assuntos.find((a) => a.status === 'done');
  assert.ok(!C.definirFoco(est, [feito.id], ctx()).assuntos.some((a) => a.id === feito.id), 'concluído não entra no foco');
});

test('apagar e desfazer: o assunto volta idêntico, na mesma posição de ordem', () => {
  const est = congelar(base());
  const alvo = est.assuntos[2];
  const m = C.apagar(est, alvo.id);
  const dep = ap(est, m);
  assert.ok(!por(dep, alvo.id));
  const volta = ap(dep, C.inverter(est, m));
  assert.deepEqual(por(volta, alvo.id), alvo);
  assert.equal(volta.assuntos.length, est.assuntos.length);
  assert.throws(() => C.apagar(est, 'nao-existe'), /não encontrado/);
});

test('desfazer reverte qualquer mudança, inclusive pessoa e tema criados', () => {
  const est = congelar(base());
  const inbox = est.assuntos.find((a) => a.status === 'inbox');
  const m = C.organizar(est, inbox.id, { tipo: 'fazer', pessoa: 'Fulana Nova', tema: 'Tema Novo' }, ctx());
  const dep = ap(est, m);
  const volta = ap(dep, C.inverter(est, m));
  assert.deepEqual(volta.assuntos, est.assuntos);
  assert.deepEqual(volta.pessoas, est.pessoas);
  assert.deepEqual(volta.temas, est.temas);
  const cap = C.capturar(est, 'novo', ctx());
  assert.deepEqual(ap(ap(est, cap), C.inverter(est, cap)).assuntos, est.assuntos);
});

test('renomear pessoa/tema: muda o nome, mantém o id e os vínculos', () => {
  const est = congelar(base());
  const p = est.pessoas[0];
  const m = C.renomearPessoa(est, p.id, '  Nome Corrigido ', ctx());
  assert.equal(m.pessoas[0].name, 'Nome Corrigido');
  assert.equal(m.assuntos.length, 0, 'assuntos não precisam mudar: apontam pelo id');
  const dep = ap(est, m);
  assert.equal(dep.pessoas.find((x) => x.id === p.id).name, 'Nome Corrigido');
  ok(dep);
  assert.ok(C.semMudanca(C.renomearPessoa(est, p.id, p.name, ctx())));
});

test('renomear para um nome que já existe junta as duas e leva os assuntos junto', () => {
  const est = congelar(base());
  const [a, b] = est.pessoas;
  const antes = est.assuntos.filter((x) => x.person_id === a.id).length;
  assert.ok(antes > 0);
  const m = C.renomearPessoa(est, a.id, b.name.toUpperCase(), ctx());
  assert.deepEqual(m.removerPessoas, [a.id]);
  const dep = ap(est, m);
  assert.ok(!dep.pessoas.some((p) => p.id === a.id));
  assert.equal(dep.assuntos.filter((x) => x.person_id === a.id).length, 0);
  assert.equal(dep.assuntos.filter((x) => x.person_id === b.id).length, est.assuntos.filter((x) => x.person_id === b.id).length + antes);
  ok(dep);
  const t = est.temas;
  if (t.length >= 2) {
    const mt = C.renomearTema(est, t[0].id, t[1].name, ctx());
    assert.deepEqual(mt.removerTemas, [t[0].id]);
    ok(ap(est, mt));
  }
});

test('arquivar e reativar tema', () => {
  const est = congelar(base());
  const t = est.temas[0];
  const arq = ap(est, C.arquivarTema(est, t.id, true, ctx()));
  assert.equal(arq.temas.find((x) => x.id === t.id).archived_at, CTX.agora);
  const reat = ap(arq, C.arquivarTema(arq, t.id, false, ctx()));
  assert.equal(reat.temas.find((x) => x.id === t.id).archived_at, null);
});

test('o estado de entrada nunca é alterado e todos os casos devolvem estado válido', () => {
  const est = congelar(base());
  const inbox = est.assuntos.find((a) => a.status === 'inbox'), aberto = est.assuntos.find((a) => a.status === 'in_progress');
  const mudancas = [
    C.capturar(est, 'x', ctx()), C.organizar(est, inbox.id, { tipo: 'fazer', pessoa: 'Z', tema: 'Y' }, ctx()), C.resolver(est, aberto.id, ctx()),
    C.adiar(est, aberto.id, ctx()), C.deixarPraLa(est, aberto.id, ctx()), C.definirFoco(est, [aberto.id], ctx()), C.apagar(est, aberto.id),
    C.acordar(est, ctx({ hoje: '2027-01-01' })), C.renomearPessoa(est, est.pessoas[0].id, 'Outro', ctx())
  ];
  mudancas.forEach((m) => ok(ap(est, m)));
  assert.deepEqual(estadoVazio().assuntos, []);
});

test('assunto inexistente dá erro claro em todos os casos que pedem id', () => {
  const est = base();
  for (const f of [() => C.organizar(est, 'x', {}, ctx()), () => C.resolver(est, 'x', ctx()), () => C.adiar(est, 'x', ctx()), () => C.deixarPraLa(est, 'x', ctx())]) assert.throws(f, /não encontrado/);
});

test('editarTexto: troca só o texto, mantém o original e não tira da caixa de entrada', () => {
  const est = congelar(base());
  const inbox = est.assuntos.find((a) => a.status === 'inbox');
  const a = C.editarTexto(est, inbox.id, '  Novo texto ', ctx()).assuntos[0];
  assert.deepEqual([a.status, a.text, a.original_text], ['inbox', 'Novo texto', inbox.original_text]);
  assert.ok(C.semMudanca(C.editarTexto(est, inbox.id, '   ', ctx())));
  assert.ok(C.semMudanca(C.editarTexto(est, inbox.id, inbox.text, ctx())));
});

test('unir: duas mudanças em sequência valem como uma, e desfazer volta ao começo', () => {
  const est = congelar(base());
  const inbox = est.assuntos.find((a) => a.status === 'inbox');
  const m1 = C.organizar(est, inbox.id, { tipo: 'fazer', pessoa: 'Gente Nova' }, ctx());
  const m2 = C.resolver(ap(est, m1), inbox.id, ctx());
  const junto = C.unir(m1, m2);
  assert.equal(junto.assuntos.filter((a) => a.id === inbox.id).length, 1);
  const dep = ap(est, junto);
  assert.deepEqual(dep, ap(ap(est, m1), m2));
  assert.deepEqual([por(dep, inbox.id).status, por(dep, inbox.id).next_action], ['done', 'do']);
  assert.deepEqual(ap(dep, C.inverter(est, junto)).assuntos, est.assuntos);
  assert.deepEqual(ap(dep, C.inverter(est, junto)).pessoas, est.pessoas);
  const apaga = C.unir(m1, C.apagar(ap(est, m1), inbox.id));
  assert.ok(!ap(est, apaga).assuntos.some((a) => a.id === inbox.id));
});
