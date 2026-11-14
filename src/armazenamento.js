// Armazenamento local do modelo 2.0 com Dexie sobre IndexedDB (D-007). Um registro por entidade.
// O banco novo (`clarea-v2`) é separado do banco do formato 1.0 (`clarea`), que nunca é alterado aqui:
// ele continua intacto como cópia de segurança viva dos dados antigos.
import Dexie from '../vendor/dexie.mjs';
import { migrarParaV2 } from './migracao.js';
import { validar, estadoVazio } from './modelo.js';

export const NOME_BANCO = 'clarea-v2';

/** Abre (ou cria) o banco. Mudanças futuras de estrutura entram como novas `version(n)`, com `upgrade`. */
export async function abrir(nome = NOME_BANCO) {
  const db = new Dexie(nome);
  db.version(1).stores({
    assuntos: 'id, status, person_id, topic_id, updated_at, ordem',
    pessoas: 'id',
    temas: 'id',
    tarefas: 'id, assunto_id',
    eventos: '++seq, assunto_id, em',
    copias: 'id, criada_em',
    meta: 'chave'
  });
  // Versão 2 (E1.4a): índices pelos dias locais e pela data de retomada. Assuntos gravados antes ganham os campos de dia.
  db.version(2).stores({
    assuntos: 'id, status, person_id, topic_id, updated_at, ordem, created_day, completed_day, resume_at'
  }).upgrade((tx) => tx.table('assuntos').toCollection().modify((a) => {
    if (!a.created_day) a.created_day = String(a.created_at || '').slice(0, 10);
    if (a.completed_day === undefined) a.completed_day = a.completed_at ? String(a.completed_at).slice(0, 10) : null;
  }));
  await db.open();
  return db;
}

export const fechar = (db) => db.close();

const TABELAS = (db) => [db.assuntos, db.pessoas, db.temas, db.tarefas, db.eventos, db.copias, db.meta];

/**
 * Importa os dados do formato 1.0 uma única vez.
 * 1) migra em memória (se falhar, nada é escrito); 2) confere o resultado; 3) numa única transação,
 * guarda uma cópia integral dos dados 1.0 e grava o modelo 2.0. Ou tudo entra, ou nada entra.
 * Chamar de novo depois de migrado não faz nada.
 * @returns {Promise<{importado: boolean, migracao: object}>}
 */
export async function importarV1(db, v1, ctx) {
  const antes = await db.meta.get('migracao');
  if (antes) return { importado: false, migracao: antes.valor };

  const v2 = migrarParaV2(v1, ctx);
  const erros = validar(v2);
  if (erros.length) throw new Error('A migração gerou dados inválidos: ' + erros.slice(0, 3).join('; '));
  const copia = { id: `v1-${ctx.agora}`, formato: 'v1', criada_em: ctx.agora, dados: structuredClone(v1) };

  let importado = false;
  await db.transaction('rw', TABELAS(db), async () => {
    if (await db.meta.get('migracao')) return; // outra aba migrou enquanto esta preparava
    await db.copias.add(copia);
    await db.assuntos.bulkAdd(v2.assuntos);
    await db.pessoas.bulkAdd(v2.pessoas);
    await db.temas.bulkAdd(v2.temas);
    await db.tarefas.bulkAdd(v2.tarefas);
    await db.eventos.bulkAdd(v2.eventos);
    await db.meta.put({ chave: 'config', valor: v2.config });
    await db.meta.put({ chave: 'migracao', valor: v2.migracao });
    importado = true;
  });
  const m = await db.meta.get('migracao');
  return { importado, migracao: m.valor };
}

/** Monta o estado 2.0 completo a partir das tabelas. Assuntos na ordem em que foram criados. */
export async function lerEstado(db) {
  const est = estadoVazio();
  const [cfg, mig] = await Promise.all([db.meta.get('config'), db.meta.get('migracao')]);
  if (cfg) est.config = cfg.valor;
  est.migracao = mig ? mig.valor : null;
  est.assuntos = await db.assuntos.orderBy('ordem').toArray();
  est.pessoas = await db.pessoas.toArray();
  est.temas = await db.temas.toArray();
  est.tarefas = await db.tarefas.toArray();
  est.eventos = await db.eventos.orderBy('seq').toArray();
  return est;
}

/** Grava (cria ou substitui) um único assunto, sem tocar nos demais. */
export async function gravarAssunto(db, assunto) {
  await db.assuntos.put(assunto);
}

export async function gravarConfig(db, config) {
  await db.meta.put({ chave: 'config', valor: config });
}

/** Cópias integrais dos dados 1.0 feitas antes da migração, da mais recente para a mais antiga. */
export const copiasV1 = (db) => db.copias.orderBy('criada_em').reverse().toArray();

/**
 * Grava uma mudança dos casos de uso (src/casos.js) numa única transação: ou tudo entra, ou nada entra.
 * Mexe só nos registros citados; os demais assuntos não são tocados.
 */
export async function aplicarMudanca(db, m) {
  await db.transaction('rw', [db.assuntos, db.pessoas, db.temas], async () => {
    if (m.pessoas.length) await db.pessoas.bulkPut(m.pessoas);
    if (m.temas.length) await db.temas.bulkPut(m.temas);
    if (m.assuntos.length) await db.assuntos.bulkPut(m.assuntos);
    if (m.removerAssuntos.length) await db.assuntos.bulkDelete(m.removerAssuntos);
    if (m.removerPessoas.length) await db.pessoas.bulkDelete(m.removerPessoas);
    if (m.removerTemas.length) await db.temas.bulkDelete(m.removerTemas);
  });
}

/**
 * Troca todos os dados de uso pelos de `est` (restaurar uma cópia de segurança), numa única transação.
 * As cópias dos dados 1.0 guardadas em `copias` não são tocadas.
 */
export async function substituirTudo(db, est) {
  await db.transaction('rw', [db.assuntos, db.pessoas, db.temas, db.tarefas, db.eventos, db.meta], async () => {
    await Promise.all([db.assuntos.clear(), db.pessoas.clear(), db.temas.clear(), db.tarefas.clear(), db.eventos.clear()]);
    await db.assuntos.bulkAdd(est.assuntos);
    await db.pessoas.bulkAdd(est.pessoas);
    await db.temas.bulkAdd(est.temas);
    await db.tarefas.bulkAdd(est.tarefas);
    await db.eventos.bulkAdd(est.eventos.map(({ seq, ...resto }) => resto));
    await db.meta.put({ chave: 'config', valor: est.config });
    await db.meta.put({ chave: 'migracao', valor: est.migracao || { de: 'copia', para: 2, em: new Date().toISOString() } });
  });
}

/** Apaga todos os bancos do Clarea neste aparelho: o novo e o do formato 1.0. */
export async function apagarBancos(db, nomes = [NOME_BANCO, 'clarea']) {
  if (db) db.close();
  await Promise.all(nomes.map((n) => new Promise((ok) => {
    try { const q = indexedDB.deleteDatabase(n); q.onsuccess = q.onerror = q.onblocked = () => ok(); } catch (e) { ok(); }
  })));
}
