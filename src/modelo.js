// Modelo de dados 2.0 do Clarea (D-006, D-007, D-009, D-010; especificação 3.1 a 3.6).
// Este arquivo só descreve e valida o formato. Não lê tela, não grava nada.

export const VERSAO_MODELO = 2;

/** Estado do assunto (especificação 3.2). */
export const ESTADOS = ['inbox', 'in_progress', 'waiting', 'scheduled', 'done', 'archived', 'discarded'];
/** Próxima ação, campo independente do estado. `null` = nenhuma definida. "Acompanhar" é implícita em `waiting` (D-010). */
export const ACOES = ['do', 'chase', 'check', 'talk', 'follow'];
export const ORIGENS = ['manual', 'share', 'voice', 'migration'];

/** Estrutura vazia do estado 2.0. */
export function estadoVazio() {
  return {
    formato: 'clarea',
    versao_modelo: VERSAO_MODELO,
    config: { name: '', hora: '18:00', dias: [true, true, true, true, true, false, false], atrapalha: [], lembrete: false, theme: 'light', onboarded: false, welcomed: false, tips: {}, lastBackup: '', lastNotified: '' },
    assuntos: [],
    pessoas: [],
    temas: [],
    // Guardada no modelo, sem uso na interface (D-009). Campos: id, assunto_id, title, status, due_at, reminder_at, created_at, completed_at.
    tarefas: [],
    eventos: [],
    migracao: null
  };
}

const ehIso = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const ehIsoOuNulo = (v) => v === null || ehIso(v);
const ehData = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Confere o estado 2.0. Devolve a lista de problemas (vazia = válido). */
export function validar(est) {
  const erros = [];
  const e = (m) => erros.push(m);
  if (!est || typeof est !== 'object') return ['estado não é um objeto'];
  if (est.versao_modelo !== VERSAO_MODELO) e(`versao_modelo deve ser ${VERSAO_MODELO}`);
  for (const k of ['assuntos', 'pessoas', 'temas', 'tarefas', 'eventos']) if (!Array.isArray(est[k])) e(`${k} deve ser uma lista`);
  if (erros.length) return erros;

  const unicos = (lista, nome) => {
    const vistos = new Set();
    lista.forEach((x) => { if (!x || typeof x.id !== 'string' || !x.id) e(`${nome}: id ausente`); else if (vistos.has(x.id)) e(`${nome}: id repetido ${x.id}`); else vistos.add(x.id); });
    return vistos;
  };
  const pessoas = unicos(est.pessoas, 'pessoas');
  const temas = unicos(est.temas, 'temas');
  const assuntos = unicos(est.assuntos, 'assuntos');
  unicos(est.tarefas, 'tarefas');

  est.pessoas.forEach((p) => { if (typeof p.name !== 'string' || !p.name.trim()) e(`pessoa ${p.id}: nome vazio`); });
  est.temas.forEach((t) => { if (typeof t.name !== 'string' || !t.name.trim()) e(`tema ${t.id}: nome vazio`); });
  est.assuntos.forEach((a) => {
    const w = `assunto ${a.id}`;
    if (typeof a.original_text !== 'string' || !a.original_text.trim()) e(`${w}: original_text vazio`);
    if (typeof a.text !== 'string' || !a.text.trim()) e(`${w}: text vazio`);
    if (!ESTADOS.includes(a.status)) e(`${w}: estado inválido (${a.status})`);
    if (a.next_action !== null && !ACOES.includes(a.next_action)) e(`${w}: ação inválida (${a.next_action})`);
    if (a.person_id !== null && !pessoas.has(a.person_id)) e(`${w}: pessoa inexistente (${a.person_id})`);
    if (a.topic_id !== null && !temas.has(a.topic_id)) e(`${w}: tema inexistente (${a.topic_id})`);
    if (!ehIso(a.created_at)) e(`${w}: created_at inválido`);
    if (!ehIso(a.updated_at)) e(`${w}: updated_at inválido`);
    for (const k of ['completed_at', 'archived_at', 'deleted_at', 'confirmed_at', 'due_at', 'reminder_at']) if (!ehIsoOuNulo(a[k])) e(`${w}: ${k} inválido`);
    if (a.resume_at !== null && !ehData(a.resume_at)) e(`${w}: resume_at deve ser AAAA-MM-DD`);
    if (a.status === 'done' && !a.completed_at) e(`${w}: concluído sem completed_at`);
    if (typeof a.focus !== 'boolean') e(`${w}: focus deve ser verdadeiro ou falso`);
    if (!ORIGENS.includes(a.source)) e(`${w}: origem inválida (${a.source})`);
  });
  est.tarefas.forEach((t) => { if (!assuntos.has(t.assunto_id)) e(`tarefa ${t.id}: assunto inexistente`); });
  return erros;
}
