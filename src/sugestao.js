// Sugestão de tipo, pessoa e tema por regras (sem IA). Função pura: tudo entra por parâmetro.
import { norm, cap, plural } from './util.js';

const STOP = new Set(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo', 'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro', 'deus']);
const TYPE_RULES = [
  ['esperando', /\b(aguardando|aguardar|esperando|esperar|retorno|resposta)\b/],
  ['retomar', /\b(cobrar|retomar|lembrar|pedir)\b/],
  ['confirmar', /\b(confirmar|validar|checar|conferir)\b/],
  ['conversar', /\b(conversar|falar com|ver com|alinhar)\b/]
];
const wordIn = (needle, hay) => new RegExp('(^|[^a-z0-9])' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])').test(hay);

/**
 * @param {string} text texto da anotação
 * @param {{people: string[], temas: string[], temasTodos: string[], items: object[]}} ctx pessoas conhecidas, temas ativos, todos os temas (inclusive arquivados) e assuntos já existentes
 */
export function suggest(text, ctx) {
  const { people, temas, temasTodos, items } = ctx;
  const t = norm(text);
  const r = { type: 'fazer', person: '', tema: '', why: '' };
  const reasons = [];
  for (const [k, re] of TYPE_RULES) { const m = t.match(re); if (m) { r.type = k; reasons.push(`pela palavra “${m[1]}”`); break; } }
  const at = text.match(/@([\p{L}]+)/u);
  if (at) r.person = people.find((p) => norm(p) === norm(at[1])) || cap(at[1]);
  if (!r.person) r.person = people.find((p) => wordIn(norm(p), t)) || '';
  if (!r.person) {
    const tit = text.match(/(?:^|\s)(?:Dr|Dra|Sr|Sra|Prof|Profa)\.?\s+(\p{Lu}\p{Ll}+)/u);
    if (tit) r.person = tit[1];
  }
  if (!r.person) {
    const m = text.match(/(?:^|\s)(?:com|da|do|de|a|o|à|pela|pelo|para|pra)\s+(\p{Lu}\p{Ll}+)(?!\.)/u);
    if (m && !STOP.has(norm(m[1])) && !temasTodos.some((p) => norm(p).split(' ').includes(norm(m[1])))) r.person = m[1];
  }
  if (r.person) {
    const n = items.filter((i) => i.status !== 'novo' && norm(i.person) === norm(r.person)).length;
    reasons.push(n ? `porque ${r.person} já apareceu em ${plural(n, 'item', 'itens')}` : `pelo nome ${r.person} no texto`);
  }
  const tag = text.match(/#([\p{L}\d]+)/u);
  if (tag) r.tema = temas.find((p) => norm(p).replace(/\s/g, '') === norm(tag[1])) || cap(tag[1]);
  if (!r.tema) r.tema = temas.find((p) => wordIn(norm(p), t) || norm(p).split(' ').some((w) => w.length > 3 && wordIn(w, t))) || '';
  if (!r.tema && r.person) {
    const count = {};
    items.forEach((i) => { if (norm(i.person) === norm(r.person) && i.tema && temas.includes(i.tema)) count[i.tema] = (count[i.tema] || 0) + 1; });
    const best = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    if (best) r.tema = best;
  }
  r.why = reasons.length ? 'Sugerido ' + reasons.join(' e ') + '.' : 'Sem pistas no texto: escolha se quiser, ou pule.';
  return r;
}
