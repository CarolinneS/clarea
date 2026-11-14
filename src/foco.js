// Regras do foco do dia e do progresso. Funções puras.
import { ageOf } from './util.js';

export const score = (i, hoje) => ageOf(i, hoje) + (i.type === 'retomar' ? 2 : 0);
export const bySuggestion = (list, hoje) => list.slice().sort((a, b) => score(b, hoje) - score(a, hoje));

/** `visiveis`: assuntos abertos e não adiados. Devolve o foco escolhido ou, na falta dele, os 3 sugeridos. */
export function focusList(visiveis, hoje) {
  const chosen = visiveis.filter((i) => i.focus);
  if (chosen.length) return { list: bySuggestion(chosen, hoje), chosen: true };
  return { list: bySuggestion(visiveis, hoje).slice(0, 3), chosen: false };
}

/** Progresso do dia (0 a 1): resolvidos hoje sobre (resolvidos hoje + ainda visíveis). */
export const dayPct = (feitosHoje, visiveisQtd) => (feitosHoje + visiveisQtd ? feitosHoje / (feitosHoje + visiveisQtd) : 0);

/** Quantos assuntos foram resolvidos (ou viraram tarefa) na data `hoje`. */
export const doneToday = (items, hoje) => items.filter((i) => i.doneDate === hoje && (i.status === 'resolvido' || i.status === 'tarefa')).length;
