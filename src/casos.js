// Casos de uso do Clarea sobre o modelo 2.0 (D-012). Regras puras: recebem o estado 2.0 e devolvem uma
// "mudança" (o que gravar e o que remover). Não leem tela, relógio nem banco: `hoje` (AAAA-MM-DD, dia local)
// e `agora` (ISO UTC) vêm de quem chama. O estado recebido nunca é alterado.
import { norm, addDays } from './util.js';
import { novoAssunto } from './modelo.js';
import { novoId } from './id.js';

/** @typedef {{assuntos: object[], pessoas: object[], temas: object[], removerAssuntos: string[], removerPessoas: string[], removerTemas: string[]}} Mudanca */
export const mudancaVazia = () => ({ assuntos: [], pessoas: [], temas: [], removerAssuntos: [], removerPessoas: [], removerTemas: [] });
export const semMudanca = (m) => Object.values(m).every((l) => l.length === 0);

const ACAO_POR_TIPO = { retomar: 'chase', confirmar: 'check', conversar: 'talk', fazer: 'do' };
const TIPO_POR_ACAO = { chase: 'retomar', check: 'confirmar', talk: 'conversar', do: 'fazer' };
const ABERTOS = ['inbox', 'in_progress', 'waiting', 'scheduled'];
const ATIVOS = ['in_progress', 'waiting', 'scheduled']; // organizados e ainda em aberto

/** Tipo na linguagem da tela (esperando, retomar...) de um assunto; '' quando não há. */
export const tipoDe = (a) => (a.status === 'waiting' ? 'esperando' : TIPO_POR_ACAO[a.next_action] || '');

const achar = (est, id) => { const a = est.assuntos.find((x) => x.id === id); if (!a) throw new Error(`Assunto não encontrado: ${id}`); return a; };
const tocar = (a, ctx, campos) => ({ ...a, ...campos, updated_at: ctx.agora, local_version: (a.local_version || 0) + 1 });
const maxOrdem = (est) => est.assuntos.reduce((m, a) => Math.max(m, a.ordem), -1);

/** Acha a entidade pelo nome (ignorando maiúsculas e acentos) ou cria uma nova. Não repete na mudança. */
function entidade(est, m, chave, nome, ctx) {
  const limpo = String(nome || '').trim();
  if (!limpo) return null;
  const lista = [...est[chave], ...m[chave]];
  const achada = lista.find((e) => norm(e.name) === norm(limpo));
  if (achada) return achada;
  const nova = { id: ctx.novoId ? ctx.novoId() : novoId(), name: limpo, created_at: ctx.agora, archived_at: null };
  m[chave].push(nova);
  return nova;
}
const pessoaPorNome = (est, m, nome, ctx) => entidade(est, m, 'pessoas', nome, ctx);
const temaPorNome = (est, m, nome, ctx) => entidade(est, m, 'temas', nome, ctx);

/** Ajusta estado, ação e data de retomada para um tipo da tela ('' = sem tipo). Assunto encerrado só troca a ação. */
function comTipo(a, tipo, ctx) {
  const acao = ACAO_POR_TIPO[tipo] || null;
  if (!ABERTOS.includes(a.status)) return { next_action: acao };
  if (tipo === 'esperando') return { status: 'waiting', next_action: null };
  const futuro = a.resume_at && a.resume_at > ctx.hoje;
  return { status: futuro ? 'scheduled' : 'in_progress', next_action: acao, resume_at: futuro ? a.resume_at : null };
}

/** Anotar: entra na caixa de entrada, sem classificar. Guarda o texto original. */
export function capturar(est, texto, ctx, extra = {}) {
  const t = String(texto || '').trim();
  const m = mudancaVazia();
  if (!t) return m;
  m.assuntos.push(novoAssunto({
    id: ctx.novoId ? ctx.novoId() : novoId(), original_text: t, text: t, created_at: ctx.agora, updated_at: ctx.agora,
    created_day: ctx.hoje, ordem: maxOrdem(est) + 1, ...extra
  }));
  return m;
}

/**
 * Organizar (Clarear o dia) e editar: tipo, pessoa e tema, e opcionalmente o texto.
 * `campos`: { tipo?, pessoa?, tema?, texto? }. Campo ausente = não muda; pessoa/tema vazios = tirar.
 * O texto original nunca muda (D-003).
 */
export function organizar(est, id, campos, ctx) {
  const a = achar(est, id), m = mudancaVazia();
  const novo = {};
  if ('texto' in campos && String(campos.texto || '').trim()) novo.text = String(campos.texto).trim();
  if ('pessoa' in campos) { const p = pessoaPorNome(est, m, campos.pessoa, ctx); novo.person_id = p ? p.id : null; }
  if ('tema' in campos) { const t = temaPorNome(est, m, campos.tema, ctx); novo.topic_id = t ? t.id : null; }
  if ('tipo' in campos) Object.assign(novo, comTipo(a, campos.tipo, ctx));
  if (a.status === 'inbox') { // organizar tira da caixa de entrada, mesmo sem escolher tipo
    if (!novo.status) novo.status = 'in_progress';
    novo.confirmed_at = ctx.agora;
  }
  m.assuntos.push(tocar(a, ctx, novo));
  return m;
}

/** Resolvido: conclui o assunto e tira do foco. */
export function resolver(est, id, ctx) {
  const a = achar(est, id), m = mudancaVazia();
  m.assuntos.push(tocar(a, ctx, { status: 'done', completed_at: ctx.agora, completed_day: ctx.hoje, resume_at: null, focus: false }));
  return m;
}

/** Amanhã (ou daqui a `dias`): esconde até a data. Aguardando continua Aguardando, só ganha a data de retomada. */
export function adiar(est, id, ctx, dias = 1) {
  const a = achar(est, id), m = mudancaVazia();
  const data = addDays(ctx.hoje, dias);
  const campos = a.status === 'waiting' ? { resume_at: data } : { status: 'scheduled', resume_at: data };
  m.assuntos.push(tocar(a, ctx, { ...campos, focus: false }));
  return m;
}

/** Deixar pra lá: sai da frente e fica no histórico. */
export function deixarPraLa(est, id, ctx) {
  const a = achar(est, id), m = mudancaVazia();
  m.assuntos.push(tocar(a, ctx, { status: 'discarded', next_action: null, resume_at: null, focus: false }));
  return m;
}

/** Escolher o foco do dia entre os assuntos em aberto. Só devolve o que mudou. */
export function definirFoco(est, ids, ctx) {
  const m = mudancaVazia();
  est.assuntos.filter((a) => ATIVOS.includes(a.status)).forEach((a) => {
    const quer = ids.includes(a.id);
    if (a.focus !== quer) m.assuntos.push(tocar(a, ctx, { focus: quer }));
  });
  return m;
}

/** Apagar de vez. Para desfazer, use `inverter` com o estado de antes. */
export function apagar(est, id) {
  achar(est, id);
  const m = mudancaVazia();
  m.removerAssuntos.push(id);
  return m;
}

/** Assuntos adiados cuja data chegou voltam para Em andamento. */
export function acordar(est, ctx) {
  const m = mudancaVazia();
  est.assuntos.forEach((a) => {
    if (a.status === 'scheduled' && a.resume_at && a.resume_at <= ctx.hoje) m.assuntos.push(tocar(a, ctx, { status: 'in_progress', resume_at: null }));
  });
  return m;
}

function renomear(est, chave, campoAssunto, id, para, ctx) {
  const m = mudancaVazia();
  const de = est[chave].find((e) => e.id === id);
  if (!de) throw new Error(`Não encontrado: ${id}`);
  const nome = String(para || '').trim();
  if (!nome || nome === de.name) return m;
  const outra = est[chave].find((e) => e.id !== id && norm(e.name) === norm(nome));
  if (!outra) { m[chave].push({ ...de, name: nome }); return m; }
  // Já existe com esse nome: junta. Os assuntos passam para a existente e a antiga sai.
  est.assuntos.filter((a) => a[campoAssunto] === id).forEach((a) => m.assuntos.push(tocar(a, ctx, { [campoAssunto]: outra.id })));
  m[chave === 'pessoas' ? 'removerPessoas' : 'removerTemas'].push(id);
  return m;
}
export const renomearPessoa = (est, id, nome, ctx) => renomear(est, 'pessoas', 'person_id', id, nome, ctx);
export const renomearTema = (est, id, nome, ctx) => renomear(est, 'temas', 'topic_id', id, nome, ctx);

/** Arquivar ou reativar um tema sem perder o histórico. */
export function arquivarTema(est, id, arquivar, ctx) {
  const t = est.temas.find((x) => x.id === id);
  if (!t) throw new Error(`Tema não encontrado: ${id}`);
  const m = mudancaVazia();
  m.temas.push({ ...t, archived_at: arquivar ? ctx.agora : null });
  return m;
}

const trocar = (lista, novos, remover) => {
  const ids = new Map(novos.map((x) => [x.id, x]));
  const fora = new Set(remover);
  const saida = lista.filter((x) => !fora.has(x.id)).map((x) => ids.get(x.id) || x);
  novos.forEach((x) => { if (!lista.some((y) => y.id === x.id)) saida.push(x); });
  return saida;
};

/** Estado depois da mudança (cópia; o original não é alterado). */
export function aplicar(est, m) {
  return {
    ...est,
    assuntos: trocar(est.assuntos, m.assuntos, m.removerAssuntos),
    pessoas: trocar(est.pessoas, m.pessoas, m.removerPessoas),
    temas: trocar(est.temas, m.temas, m.removerTemas)
  };
}

/** Mudança que desfaz `m`, calculada sobre o estado de antes dela (serve para o botão Desfazer). */
export function inverter(est, m) {
  const inv = mudancaVazia();
  const era = (lista, id) => lista.find((x) => x.id === id);
  [['assuntos', 'removerAssuntos'], ['pessoas', 'removerPessoas'], ['temas', 'removerTemas']].forEach(([chave, rem]) => {
    m[chave].forEach((x) => { const antes = era(est[chave], x.id); if (antes) inv[chave].push(antes); else inv[rem].push(x.id); });
    m[rem].forEach((id) => { const antes = era(est[chave], id); if (antes) inv[chave].push(antes); });
  });
  return inv;
}
