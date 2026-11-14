// E1.3 · Armazenamento com Dexie, no navegador de verdade (IndexedDB real).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { abrirAmbiente, novaPagina, estadoBase, assunto } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const fixture = (n) => JSON.parse(readFileSync(resolve(import.meta.dirname, '../fixtures/backups', n + '.json'), 'utf8'));
const CTX = { hoje: '2026-11-14', agora: '2026-11-14T15:00:00.000Z' };

// Abre uma página do mesmo endereço (sem rodar o app) para usar os módulos direto.
async function pagina(estadoV1) {
  const p = await novaPagina(amb, estadoV1);
  await p.pagina.goto(amb.url + '/manifest.webmanifest');
  return p;
}
const rodar = (pg, fn, arg) => pg.evaluate(fn, arg);

test('Dexie abre, grava um assunto e ele continua lá depois de fechar e reabrir', async () => {
  const { contexto, pagina: pg } = await pagina();
  const r = await rodar(pg, async () => {
    const m = await import('/src/armazenamento.js'), { estadoVazio } = await import('/src/modelo.js');
    const db = await m.abrir('teste-basico');
    await db.assuntos.put({ id: 'x', ordem: 0, status: 'inbox', person_id: null, topic_id: null, updated_at: 'a', text: 'olá' });
    await m.fechar(db);
    const db2 = await m.abrir('teste-basico');
    const est = await m.lerEstado(db2);
    return { n: est.assuntos.length, texto: est.assuntos[0].text, vazio: estadoVazio().versao_modelo };
  });
  assert.equal(r.n, 1); assert.equal(r.texto, 'olá'); assert.equal(r.vazio, 2);
  assert.deepEqual(pg.errosJs, []);
  assert.deepEqual(pg.requisicoesExternas, []);
  await contexto.close();
});

test('importarV1: guarda cópia integral dos dados 1.0, grava o modelo 2.0 e não mexe no banco antigo', async () => {
  const v1 = fixture('tipico');
  const { contexto, pagina: pg } = await pagina(v1);
  const r = await rodar(pg, async ({ v1, ctx }) => {
    const m = await import('/src/armazenamento.js'), { validar } = await import('/src/modelo.js');
    const db = await m.abrir();
    const res = await m.importarV1(db, v1, ctx);
    const est = await m.lerEstado(db), copias = await m.copiasV1(db);
    const antigo = await new Promise((ok) => { const q = indexedDB.open('clarea'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('estado'); g.onsuccess = () => { q.result.close(); ok(g.result); }; }; });
    return { res, erros: validar(est), ids: est.assuntos.map((a) => a.id), copias: copias.map((c) => ({ id: c.id, formato: c.formato, dados: c.dados })), antigo, cfgNome: est.config.name };
  }, { v1, ctx: CTX });
  assert.equal(r.res.importado, true);
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.ids, v1.items.map((i) => i.id), 'mesma ordem de antes');
  assert.equal(r.copias.length, 1);
  assert.equal(r.copias[0].formato, 'v1');
  assert.deepEqual(r.copias[0].dados, v1, 'cópia idêntica aos dados 1.0');
  assert.deepEqual(r.antigo, v1, 'banco antigo intacto');
  assert.equal(r.cfgNome, 'Pessoa Fictícia');
  await contexto.close();
});

test('importarV1 é repetível: chamar de novo não duplica nada nem cria outra cópia', async () => {
  const v1 = fixture('tarefas');
  const { contexto, pagina: pg } = await pagina();
  const r = await rodar(pg, async ({ v1, ctx }) => {
    const m = await import('/src/armazenamento.js');
    const db = await m.abrir();
    const a = await m.importarV1(db, v1, ctx);
    const b = await m.importarV1(db, v1, { ...ctx, agora: '2026-11-15T10:00:00.000Z' });
    const est = await m.lerEstado(db);
    return { a: a.importado, b: b.importado, n: est.assuntos.length, copias: (await m.copiasV1(db)).length, em: est.migracao.em };
  }, { v1, ctx: CTX });
  assert.equal(r.a, true); assert.equal(r.b, false);
  assert.equal(r.n, 7); assert.equal(r.copias, 1);
  assert.equal(r.em, CTX.agora, 'registro da primeira migração preservado');
  await contexto.close();
});

test('duas abas importando ao mesmo tempo: só uma importa, sem duplicar', async () => {
  const v1 = fixture('tipico');
  const { contexto, pagina: pg } = await pagina();
  const r = await rodar(pg, async ({ v1, ctx }) => {
    const m = await import('/src/armazenamento.js');
    const [d1, d2] = [await m.abrir(), await m.abrir()];
    const rs = await Promise.allSettled([m.importarV1(d1, v1, ctx), m.importarV1(d2, v1, ctx)]);
    const est = await m.lerEstado(d1);
    return { falhas: rs.filter((x) => x.status === 'rejected').length, ok: rs.filter((x) => x.status === 'fulfilled').map((x) => x.value.importado), n: est.assuntos.length, copias: (await m.copiasV1(d1)).length };
  }, { v1, ctx: CTX });
  assert.equal(r.falhas, 0, 'a segunda aba termina sem erro, só não importa de novo');
  assert.equal(r.n, 10); assert.equal(r.copias, 1);
  assert.equal(r.ok.filter(Boolean).length, 1, 'exatamente uma importação efetiva');
  await contexto.close();
});

test('se a migração falhar, nada é escrito: nem cópia, nem dados', async () => {
  const ruim = fixture('vazio');
  ruim.items = [{ id: 'dup', text: 'um', created: '2026-11-01', status: 'aberto' }, { id: 'dup', text: 'dois', created: '2026-11-01', status: 'aberto' }];
  const { contexto, pagina: pg } = await pagina();
  const r = await rodar(pg, async ({ v1, ctx }) => {
    const m = await import('/src/armazenamento.js');
    const db = await m.abrir();
    let erro = '';
    try { await m.importarV1(db, v1, ctx); } catch (e) { erro = e.message; }
    let erro2 = '';
    try { await m.importarV1(db, { qualquer: 1 }, ctx); } catch (e) { erro2 = e.message; }
    return { erro, erro2, assuntos: await db.assuntos.count(), copias: await db.copias.count(), meta: await db.meta.count() };
  }, { v1: ruim, ctx: CTX });
  assert.match(r.erro, /inválidos.*id repetido/);
  assert.match(r.erro2, /não reconhecido/);
  assert.deepEqual([r.assuntos, r.copias, r.meta], [0, 0, 0]);
  await contexto.close();
});

test('gravarAssunto altera só aquele assunto, e 5.000 assuntos importam em poucos segundos', async () => {
  const v1 = fixture('vazio');
  v1.items = Array.from({ length: 5000 }, (_, k) => ({ id: 'g' + k, text: 'Assunto ' + k, created: '2026-10-01', status: 'aberto', type: 'fazer', person: 'P' + (k % 50), tema: 'T' + (k % 7), snoozeUntil: '', doneDate: '', focus: false }));
  const { contexto, pagina: pg } = await pagina();
  const r = await rodar(pg, async ({ v1, ctx }) => {
    const m = await import('/src/armazenamento.js');
    const db = await m.abrir();
    const t0 = performance.now();
    await m.importarV1(db, v1, ctx);
    const ms = performance.now() - t0;
    const a = await db.assuntos.get('g10');
    await m.gravarAssunto(db, { ...a, status: 'done', completed_at: ctx.agora });
    const est = await m.lerEstado(db);
    return { ms, n: est.assuntos.length, g10: est.assuntos.find((x) => x.id === 'g10').status, g11: est.assuntos.find((x) => x.id === 'g11').status, ordemOk: est.assuntos.every((x, i) => x.ordem === i) };
  }, { v1, ctx: CTX });
  assert.equal(r.n, 5000); assert.equal(r.g10, 'done'); assert.equal(r.g11, 'in_progress'); assert.ok(r.ordemOk);
  assert.ok(r.ms < 8000, `importação levou ${Math.round(r.ms)} ms`);
  await contexto.close();
});

test('o app continua abrindo e funcionando igual (o armazenamento novo ainda não está ligado)', async () => {
  const { contexto, pagina: pg } = await novaPagina(amb, estadoBase([assunto('Continua aqui')]));
  await pg.goto(amb.url);
  assert.ok(await pg.locator('text=Continua aqui').count() >= 1);
  assert.deepEqual(pg.errosJs, []);
  await contexto.close();
});
