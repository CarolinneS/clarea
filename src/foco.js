// Regras do foco do dia e do progresso. Funções puras.
import { ageOf } from './util.js';

export const score = (i, hoje) => ageOf(i, hoje) + (i.type === 'retomar' ? 2 : 0);
export const bySuggestion = (list, hoje) => list.slice().sort((a, b) => score(b, hoje) - score(a, hoje));

/** `visiveis`: assuntos abertos e não adiados. Devolve o foco escolhido ou, na falta dele, os 3 sugeridos.
 *  O principal vem primeiro: o marcado pela pessoa (`main`) ou, se não houver (ou ele saiu do foco), o de maior prioridade.
 *  Só um é principal, mesmo que dados antigos ou de fora tragam mais de um marcado. `principal` é o id. */
export function focusList(visiveis, hoje) {
  const chosen = visiveis.filter((i) => i.focus);
  const base = chosen.length ? bySuggestion(chosen, hoje) : bySuggestion(visiveis, hoje).slice(0, 3);
  const principal = (chosen.length && base.find((i) => i.main)) || base[0] || null;
  const list = principal ? [principal, ...base.filter((i) => i !== principal)] : [];
  return { list, chosen: chosen.length > 0, principal: principal ? principal.id : null };
}

/** Progresso do dia (0 a 1): resolvidos hoje sobre (resolvidos hoje + ainda visíveis). */
export const dayPct = (feitosHoje, visiveisQtd) => (feitosHoje + visiveisQtd ? feitosHoje / (feitosHoje + visiveisQtd) : 0);

/** Quantos assuntos foram resolvidos (ou viraram tarefa) na data `hoje`. */
export const doneToday = (items, hoje) => items.filter((i) => i.doneDate === hoje && (i.status === 'resolvido' || i.status === 'tarefa')).length;
