// Textos prontos (pauta, resumo da semana) e observação do dia. Funções puras.
import { norm, typeLabel, ageOf, ageText, addDays, dateShort } from './util.js';

export function pautaText(person, abertos, hoje) {
  const its = abertos.filter((i) => norm(i.person) === norm(person)).sort((a, b) => ageOf(b, hoje) - ageOf(a, hoje));
  const lines = its.map((i) => `• ${i.type ? typeLabel(i.type) + ': ' : ''}${i.text} (${ageText(ageOf(i, hoje))})`);
  return `Pauta com ${person} (${dateShort(undefined, hoje)})\n\n${lines.join('\n') || 'Nada em aberto com essa pessoa.'}`;
}

export function semanaText(items, hoje) {
  const desde = addDays(hoje, -6);
  const groups = {};
  const put = (tema, key, txt) => { const g = (groups[tema || 'Sem tema'] = groups[tema || 'Sem tema'] || { r: [], t: [], s: [] }); g[key].push(txt); };
  items.forEach((i) => {
    if (i.status === 'resolvido' && i.doneDate >= desde) put(i.tema, 'r', i.text);
    else if (i.status === 'tarefa' && i.doneDate >= desde) put(i.tema, 't', i.text);
    else if (i.status === 'aberto') put(i.tema, 's', `${i.text} (${ageText(ageOf(i, hoje))})`);
  });
  const names = Object.keys(groups).sort((a, b) => (a === 'Sem tema') - (b === 'Sem tema') || a.localeCompare(b));
  const block = (title, arr) => (arr.length ? `  ${title}:\n${arr.map((x) => `   • ${x}`).join('\n')}\n` : '');
  const body = names.map((n) => `${n}\n${block('Resolvidos', groups[n].r)}${block('Viraram tarefa', groups[n].t)}${block('Seguindo', groups[n].s)}`).join('\n');
  return `Resumo da semana (${dateShort(desde, hoje)} a ${dateShort(undefined, hoje)})\n\n${body || 'Nada registrado ainda nesta semana.'}`;
}

/** `visiveis`: assuntos abertos e não adiados. */
export function observation(visiveis, hoje) {
  const per = {};
  visiveis.forEach((i) => { if (i.person) (per[i.person] = per[i.person] || []).push(i); });
  for (const p of Object.keys(per)) {
    const old = per[p].filter((i) => ageOf(i, hoje) >= 4);
    if (old.length >= 2) {
      const min = Math.min(...old.map((i) => ageOf(i, hoje)));
      return { text: `Notei que ${old.length} assuntos com ${p} seguem há pelo menos ${min} dias. Que tal juntar tudo numa mensagem só?`, person: p };
    }
  }
  const old = visiveis.filter((i) => ageOf(i, hoje) >= 7).sort((a, b) => ageOf(b, hoje) - ageOf(a, hoje))[0];
  if (old) return { text: `Notei que “${old.text}” está aqui ${ageText(ageOf(old, hoje))}. Ainda faz sentido manter?`, person: '' };
  return null;
}
