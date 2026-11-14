// E1.2 · Migração 1.0 → 2.0 com cópias de segurança fictícias (D-009 e D-010).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrarParaV2, detectarFormato } from '../../src/migracao.js';
import { validar, estadoVazio, VERSAO_MODELO } from '../../src/modelo.js';

const dir = resolve(import.meta.dirname, '../fixtures/backups');
const arquivos = readdirSync(dir).filter((f) => f.endsWith('.json'));
const ler = (nome) => JSON.parse(readFileSync(resolve(dir, nome + '.json'), 'utf8'));
const CTX = { hoje: '2026-11-14', agora: '2026-11-14T15:00:00.000Z' };
const porId = (est, id) => est.assuntos.find((a) => a.id === id);
const congelar = (o) => { Object.values(o).forEach((v) => { if (v && typeof v === 'object') congelar(v); }); return Object.freeze(o); };

test('há cópias fictícias para testar', () => { assert.ok(arquivos.length >= 5); });

for (const arq of arquivos) {
  const nome = arq.replace('.json', '');
  test(`[${nome}] gera um estado 2.0 válido, sem perder assuntos e sem alterar a entrada`, () => {
    const v1 = congelar(ler(nome));
    assert.equal(detectarFormato(v1), 'v1');
    const v2 = migrarParaV2(v1, CTX);
    assert.deepEqual(validar(v2), []);
    assert.equal(v2.versao_modelo, VERSAO_MODELO);
    v1.items.forEach((i) => {
      const a = porId(v2, i.id);
      assert.ok(a, `assunto ${i.id} perdido`);
      assert.equal(a.original_text, i.text, 'texto preservado');
      assert.equal(a.legado.status, i.status, 'estado antigo guardado');
    });
    const orfas = v2.assuntos.filter((a) => a.id.startsWith('t_')).length;
    const absorvidas = v1.items.filter((i) => i.status === 'tarefa' && v1.tasks.some((t) => t.itemId === i.id)).length;
    assert.equal(v2.assuntos.length, v1.items.length + orfas);
    assert.equal(orfas, v1.tasks.length - absorvidas, 'toda tarefa ou virou parte de um assunto ou virou assunto');
    assert.deepEqual(v2.tarefas, [], 'tabela de tarefas dormente fica vazia');
  });

  test(`[${nome}] é repetível: migrar duas vezes dá o mesmo resultado; migrar um estado 2.0 não muda nada`, () => {
    const a = migrarParaV2(ler(nome), CTX), b = migrarParaV2(ler(nome), CTX);
    assert.deepEqual(a, b);
    assert.deepEqual(migrarParaV2(a, CTX), a);
    assert.equal(detectarFormato(a), 'v2');
  });
}

test('estados e ações do assunto (tabela do E0 com D-009 e D-010)', () => {
  const v2 = migrarParaV2(ler('tipico'), CTX);
  const quero = (id, status, acao) => { const a = porId(v2, id); assert.equal(a.status, status, id); assert.equal(a.next_action, acao, id); return a; };
  quero('a1', 'in_progress', 'do');
  quero('a2', 'waiting', null);               // Aguardando sem ação própria (D-010)
  quero('a3', 'in_progress', 'chase');         // Retomar → Em andamento + Cobrar/retomar (D-009)
  quero('a4', 'in_progress', 'check');
  const a5 = quero('a5', 'scheduled', 'talk'); // adiamento futuro → Agendado
  assert.equal(a5.resume_at, '2026-11-20');
  quero('a6', 'inbox', null);
  const a7 = quero('a7', 'done', 'do');
  assert.equal(a7.completed_at, '2026-11-12T12:00:00.000Z');
  quero('a8', 'discarded', null);
  const a9 = quero('a9', 'waiting', null);     // esperando + adiado: continua Aguardando, com data de retomada opcional
  assert.equal(a9.resume_at, '2026-11-18');
  const a10 = quero('a10', 'in_progress', 'do'); // adiamento que já passou não esconde mais nada
  assert.equal(a10.resume_at, null);
  assert.equal(a10.legado.snoozeUntil, '2026-11-01', 'valor antigo preservado');
  assert.equal(porId(v2, 'a2').focus, true);
});

test('"Virar tarefa" (D-009): pendente → Em andamento + Fazer; concluída ou já limpa → Concluído; sem origem → novo assunto', () => {
  const v2 = migrarParaV2(ler('tarefas'), CTX);
  assert.equal(porId(v2, 'b1').status, 'in_progress');
  assert.equal(porId(v2, 'b1').next_action, 'do');
  assert.equal(porId(v2, 'b2').status, 'done');
  assert.equal(porId(v2, 'b3').status, 'done');
  assert.equal(porId(v2, 'b4').status, 'in_progress', 'assunto aberto não é alterado por tarefa ligada a ele');
  const t3 = porId(v2, 't_t3'), t4 = porId(v2, 't_t4'), t5 = porId(v2, 't_t5');
  assert.equal(t3.status, 'in_progress'); assert.equal(t3.next_action, 'do'); assert.equal(t3.original_text, 'Tarefa sem assunto');
  assert.equal(t4.status, 'done'); assert.ok(t4.completed_at);
  assert.equal(t5.status, 'in_progress'); assert.equal(t5.legado.tarefa.itemId, 'b4');
  assert.equal(v2.assuntos.length, 4 + 3);
});

test('pessoas e temas: nomes iguais só por maiúsculas, espaços e acentos viram um só; nomes diferentes não são fundidos', () => {
  const v2 = migrarParaV2(ler('nomes-parecidos'), CTX);
  assert.deepEqual(v2.pessoas.map((p) => p.name), ['Maria', 'João', 'Zélia']);
  assert.equal(v2.pessoas.length, 3, 'maria/MARIA = Maria; Joao = João');
  assert.equal(porId(v2, 'c1').person_id, porId(v2, 'c2').person_id);
  assert.equal(porId(v2, 'c3').person_id, v2.pessoas.find((p) => p.name === 'João').id);
  assert.equal(new Set(v2.temas.map((t) => t.id)).size, v2.temas.length, 'ids únicos');
  const nomes = v2.temas.map((t) => t.name);
  assert.ok(nomes.includes('Projeto A') && nomes.includes('Projeto-A'), 'Projeto A e Projeto-A são nomes diferentes');
  assert.equal(nomes.filter((n) => n.trim().toLowerCase() === 'vendas').length, 1);
  assert.ok(v2.temas.find((t) => t.name === 'Projeto A').archived_at, 'tema arquivado continua arquivado');
  assert.equal(porId(v2, 'c6').topic_id, v2.temas.find((t) => t.name === 'Projeto A').id);
  assert.equal(porId(v2, 'c1').legado.person, 'maria', 'nome original guardado');
});

test('datas antigas viram aproximações em UTC e o que falta usa o momento da migração', () => {
  const v2 = migrarParaV2(ler('datas-estranhas'), CTX);
  assert.equal(porId(v2, 'd1').created_at, CTX.agora);
  assert.equal(porId(v2, 'd2').completed_at, '2026-11-10T12:00:00.000Z', 'concluído sem data usa a data de criação, para não contar como feito hoje');
  assert.equal(porId(v2, 'd3').status, 'in_progress', 'adiado até hoje já está visível');
  assert.equal(porId(v2, 'd4').next_action, null);
  assert.equal(porId(v2, 'd5').original_text, 'Texto com <b>HTML</b> & "aspas" e emoji 😀');
  assert.equal(porId(v2, 'a-inexistente'), undefined);
});

test('configurações são copiadas e o registro da migração diz o que foi feito', () => {
  const v2 = migrarParaV2(ler('tipico'), CTX);
  assert.equal(v2.config.name, 'Pessoa Fictícia');
  assert.deepEqual(v2.config.atrapalha, [0, 2]);
  assert.deepEqual(v2.migracao, { de: 'v1', para: 2, em: CTX.agora, assuntos_v1: 10, tarefas_v1: 0 });
});

test('entradas inválidas são recusadas sem estragar nada', () => {
  assert.throws(() => migrarParaV2({ qualquer: 1 }, CTX), /não reconhecido/);
  assert.throws(() => migrarParaV2(null, CTX), /não reconhecido/);
  assert.throws(() => migrarParaV2(ler('vazio'), { hoje: 'ontem', agora: 'x' }), /válidos/);
  assert.equal(detectarFormato([]), 'desconhecido');
});

test('item sem texto ou sem id é ignorado sem derrubar a migração; volume grande migra', () => {
  const v1 = ler('vazio');
  v1.items = [{ id: 'x1', text: '   ' }, { text: 'sem id' }, 7, null, { id: 'x2', text: 'ok', created: '2026-11-01', status: 'aberto', type: 'fazer' }];
  const v2 = migrarParaV2(v1, CTX);
  assert.deepEqual(v2.assuntos.map((a) => a.id), ['x2']);
  const grande = ler('vazio');
  grande.items = Array.from({ length: 5000 }, (_, k) => ({ id: 'g' + k, text: 'Assunto ' + k, created: '2026-10-01', status: ['aberto', 'resolvido', 'novo', 'solto'][k % 4], type: ['fazer', 'esperando', 'retomar', ''][k % 4], person: 'P' + (k % 50), tema: 'T' + (k % 7), snoozeUntil: '', doneDate: k % 4 === 1 ? '2026-11-01' : '', focus: false }));
  const t0 = Date.now();
  const g2 = migrarParaV2(grande, CTX);
  assert.deepEqual(validar(g2), []);
  assert.equal(g2.assuntos.length, 5000);
  assert.equal(g2.pessoas.length, 50);
  assert.ok(Date.now() - t0 < 2000, 'migração de 5.000 assuntos em menos de 2 s');
});

test('validar pega estado 2.0 quebrado', () => {
  const v2 = migrarParaV2(ler('tipico'), CTX);
  const ruim = structuredClone(v2);
  ruim.assuntos[0].status = 'qualquer';
  ruim.assuntos[1].person_id = 'pe_fantasma';
  ruim.assuntos[2].id = ruim.assuntos[3].id;
  const erros = validar(ruim).join('|');
  assert.match(erros, /estado inválido/); assert.match(erros, /pessoa inexistente/); assert.match(erros, /id repetido/);
  assert.deepEqual(validar(estadoVazio()), []);
});
