// Busca sobre o modelo 2.0 (E2.3, D-015). Função pura: recebe o estado e o texto buscado, devolve os ids
// dos assuntos que combinam, do mais recente para o mais antigo. Ignora maiúsculas e acentos; todas as
// palavras buscadas precisam aparecer (em qualquer ordem) no texto, no texto original, na pessoa, no tema
// ou no tipo. Busca vazia devolve todos.
import { norm, typeLabel } from './util.js';
import { tipoDe } from './casos.js';

const maisRecente = (a, b) =>
  (b.created_day || '').localeCompare(a.created_day || '') || (b.created_at || '').localeCompare(a.created_at || '') || (b.ordem || 0) - (a.ordem || 0);

/**
 * @param {object} est estado 2.0 (assuntos, pessoas, temas)
 * @param {string} consulta o que a pessoa digitou
 * @returns {string[]} ids, mais recentes primeiro
 */
export function buscar(est, consulta) {
  const termos = norm(consulta).split(/\s+/).filter(Boolean);
  const nomeP = new Map(est.pessoas.map((p) => [p.id, p.name]));
  const nomeT = new Map(est.temas.map((t) => [t.id, t.name]));
  const lista = termos.length
    ? est.assuntos.filter((a) => {
      const palheiro = norm([a.text, a.original_text, nomeP.get(a.person_id), nomeT.get(a.topic_id), typeLabel(tipoDe(a))].filter(Boolean).join(' '));
      return termos.every((t) => palheiro.includes(t));
    })
    : est.assuntos.slice();
  return lista.sort(maisRecente).map((a) => a.id);
}
