/** Visão "Aguardando" (E3.3, HJ-03, CA-05, D-010). Regras puras sobre a visão das telas.
 *  Aguardando = assunto aberto que depende de outra pessoa ou evento. Não é tarefa própria:
 *  fica fora do foco e do progresso do dia, até a data de retorno (opcional) chegar. */
const aberto = (i) => i.status === 'aberto';
const ehEspera = (i) => aberto(i) && i.type === 'esperando';

/** Chegou o dia de retorno: volta a aparecer no Hoje. */
export const chegouODia = (i, hoje) => ehEspera(i) && !!i.snoozeUntil && i.snoozeUntil <= hoje;

/** Está esperando e ainda não é hora de olhar de novo (sem data de retorno, fica aqui até a pessoa mexer). */
export const emEspera = (i, hoje) => ehEspera(i) && !chegouODia(i, hoje);

/** Esperando: sem data primeiro? Não. Com data mais próxima primeiro; sem data depois, do mais antigo ao mais novo. */
export function ordenar(lista) {
  const chave = (i) => (i.snoozeUntil ? '0' + i.snoozeUntil : '1' + (i.atualizado || i.created || ''));
  return lista.slice().sort((a, b) => (chave(a) < chave(b) ? -1 : chave(a) > chave(b) ? 1 : 0));
}

/** Tempo sem novidade, em linguagem neutra (sem tom de cobrança). */
export function semNovidade(dias) {
  if (!(dias >= 1)) return 'Atualizado hoje';
  return dias === 1 ? 'Sem novidade há 1 dia' : `Sem novidade há ${dias} dias`;
}
