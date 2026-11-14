// E1.4a · Casos de uso gravando no Dexie, no navegador de verdade (IndexedDB real). Ainda não ligado ao app.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { abrirAmbiente, novaPagina } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const v1 = JSON.parse(readFileSync(resolve(import.meta.dirname, '../fixtures/backups/tipico.json'), 'utf8'));
const CTX = { hoje: '2026-11-14', agora: '2026-11-14T15:00:00.000Z' };
async function pagina() {
  const p = await novaPagina(amb);
  await p.pagina.goto(amb.url + '/manifest.webmanifest');
  return p;
}

test('atualização do banco 1 → 2: assuntos antigos ganham os dias locais e nada se perde', async () => {
  const { contexto, pagina: pg } = await pagina();
  const r = await pg.evaluate(async () => {
    const { default: Dexie } = await import('/vendor/dexie.mjs');
    const velho = new Dexie('banco-antigo');
    velho.version(1).stores({ assuntos: 'id, status, person_id, topic_id, updated_at, ordem', pessoas: 'id', temas: 'id', tarefas: 'id, assunto_id', eventos: '++seq, assunto_id, em', copias: 'id, criada_em', meta: 'chave' });
    await velho.open();
    await velho.assuntos.bulkPut([
      { id: 'a', text: 'um', status: 'inbox', ordem: 0, created_at: '2026-11-10T12:00:00.000Z', completed_at: null },
      { id: 'b', text: 'dois', status: 'done', ordem: 1, created_at: '2026-11-09T12:00:00.000Z', completed_at: '2026-11-12T12:00:00.000Z' }
    ]);
    await velho.pessoas.put({ id: 'p', name: 'Ana' });
    velho.close();
    const m = await import('/src/armazenamento.js');
    const db = await m.abrir('banco-antigo');
    const est = await m.lerEstado(db);
    const porDia = await db.assuntos.where('completed_day').equals('2026-11-12').toArray();
    return { versao: db.verno, a: est.assuntos[0], b: est.assuntos[1], pessoas: est.pessoas.length, porDia: porDia.map((x) => x.id) };
  });
  assert.equal(r.versao, 2);
  assert.deepEqual([r.a.created_day, r.a.completed_day, r.a.text], ['2026-11-10', null, 'um']);
  assert.deepEqual([r.b.created_day, r.b.completed_day], ['2026-11-09', '2026-11-12']);
  assert.equal(r.pessoas, 1);
  assert.deepEqual(r.porDia, ['b'], 'o índice novo funciona');
  assert.deepEqual(pg.errosJs, []);
  await contexto.close();
});

test('casos de uso gravados por mudança: só os registros citados são tocados, e reabrir mostra o mesmo', async () => {
  const { contexto, pagina: pg } = await pagina();
  const r = await pg.evaluate(async ({ v1, ctx }) => {
    const m = await import('/src/armazenamento.js'), C = await import('/src/casos.js'), { validar } = await import('/src/modelo.js');
    const db = await m.abrir('repo-1');
    await m.importarV1(db, v1, ctx);
    let est = await m.lerEstado(db);
    const antes = Object.fromEntries(est.assuntos.map((a) => [a.id, JSON.stringify(a)]));
    const g = (mud) => m.aplicarMudanca(db, mud);

    const cap = C.capturar(est, 'Pagar boleto', { ...ctx, novoId: undefined });
    await g(cap);
    est = await m.lerEstado(db);
    const novoId = cap.assuntos[0].id;
    await g(C.organizar(est, novoId, { tipo: 'fazer', pessoa: 'Gente Nova', tema: 'Casa' }, ctx));
    est = await m.lerEstado(db);
    await g(C.resolver(est, 'a1', ctx));
    est = await m.lerEstado(db);
    await g(C.adiar(est, 'a3', ctx));
    est = await m.lerEstado(db);
    const antesApagar = est;
    const apagar = C.apagar(est, 'a8');
    await g(apagar);
    est = await m.lerEstado(db);
    const semA8 = !est.assuntos.some((a) => a.id === 'a8');
    await g(C.inverter(antesApagar, apagar));
    est = await m.lerEstado(db);
    await m.fechar(db);
    const db2 = await m.abrir('repo-1');
    const de = await m.lerEstado(db2);
    const tocados = de.assuntos.filter((a) => antes[a.id] && antes[a.id] !== JSON.stringify(a)).map((a) => a.id).sort();
    const novo = de.assuntos.find((a) => a.id === novoId);
    return { erros: validar(de), tocados, semA8, a8: de.assuntos.some((a) => a.id === 'a8'), total: de.assuntos.length, novo: [novo.status, novo.next_action, de.pessoas.find((p) => p.id === novo.person_id).name, de.temas.find((t) => t.id === novo.topic_id).name], a1: de.assuntos.find((a) => a.id === 'a1').completed_day, a3: de.assuntos.find((a) => a.id === 'a3').resume_at, uuid: /^[0-9a-f-]{36}$/.test(novoId) };
  }, { v1, ctx: CTX });
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.tocados, ['a1', 'a3'], 'apagar e desfazer devolvem o a8 idêntico; só a1 e a3 ficaram diferentes');
  assert.equal(r.semA8, true); assert.equal(r.a8, true);
  assert.equal(r.total, 11);
  assert.deepEqual(r.novo, ['in_progress', 'do', 'Gente Nova', 'Casa']);
  assert.equal(r.a1, '2026-11-14'); assert.equal(r.a3, '2026-11-15'); assert.ok(r.uuid, 'sem novoId informado, usa UUID de verdade');
  await contexto.close();
});

test('mudança que falha no meio não grava nada (tudo ou nada)', async () => {
  const { contexto, pagina: pg } = await pagina();
  const r = await pg.evaluate(async ({ v1, ctx }) => {
    const m = await import('/src/armazenamento.js');
    const db = await m.abrir('repo-2');
    await m.importarV1(db, v1, ctx);
    const antes = { p: await db.pessoas.count(), a: await db.assuntos.count() };
    let erro = '';
    try { await m.aplicarMudanca(db, { pessoas: [{ id: 'pe_nova', name: 'Nova' }], temas: [], assuntos: [{ text: 'sem id' }], removerAssuntos: ['a1'], removerPessoas: [], removerTemas: [] }); } catch (e) { erro = e.name; }
    return { erro, p: await db.pessoas.count(), a: await db.assuntos.count(), a1: !!(await db.assuntos.get('a1')), antes };
  }, { v1, ctx: CTX });
  assert.ok(r.erro);
  assert.equal(r.p, r.antes.p, 'a pessoa nova não ficou gravada');
  assert.equal(r.a, r.antes.a); assert.equal(r.a1, true);
  await contexto.close();
});

test('duas abas gravando assuntos diferentes ao mesmo tempo: nenhuma sobrescreve a outra', async () => {
  const { contexto, pagina: pg } = await pagina();
  const r = await pg.evaluate(async ({ v1, ctx }) => {
    const m = await import('/src/armazenamento.js'), C = await import('/src/casos.js');
    const [d1, d2] = [await m.abrir('repo-3'), await m.abrir('repo-3')];
    await m.importarV1(d1, v1, ctx);
    const e1 = await m.lerEstado(d1), e2 = await m.lerEstado(d2);
    const rs = await Promise.allSettled([m.aplicarMudanca(d1, C.resolver(e1, 'a1', ctx)), m.aplicarMudanca(d2, C.deixarPraLa(e2, 'a3', ctx))]);
    const est = await m.lerEstado(d1);
    return { falhas: rs.filter((x) => x.status === 'rejected').length, a1: est.assuntos.find((a) => a.id === 'a1').status, a3: est.assuntos.find((a) => a.id === 'a3').status };
  }, { v1, ctx: CTX });
  assert.equal(r.falhas, 0);
  assert.deepEqual([r.a1, r.a3], ['done', 'discarded'], 'as duas gravações valem (antes, o último a salvar apagava a outra)');
  await contexto.close();
});
