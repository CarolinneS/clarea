// Migração do formato 1.0 (items/tasks/people/temas) para o modelo 2.0.
// Regras aprovadas em D-009 e D-010. Função pura e repetível: o mesmo estado 1.0, com os mesmos
// `hoje` e `agora`, sempre gera o mesmo resultado, e o objeto de entrada nunca é alterado.
// Nada é descartado: o que o modelo 2.0 não tem lugar para guardar fica em `legado`.
import { norm } from './util.js';
import { VERSAO_MODELO, estadoVazio } from './modelo.js';

const ACAO_POR_TIPO = { retomar: 'chase', confirmar: 'check', conversar: 'talk', fazer: 'do' }; // 'esperando' não tem ação própria (D-010)
const meioDia = (dia) => `${dia}T12:00:00.000Z`; // data antiga só tinha o dia: usamos o meio-dia em UTC como aproximação
const ehData = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const texto = (v) => (typeof v === 'string' ? v : '');
const lista = (v) => (Array.isArray(v) ? v : []);
const objetos = (v) => lista(v).filter((x) => x && typeof x === 'object' && !Array.isArray(x));

/** Reconhece o formato de um estado guardado ou de um arquivo de cópia de segurança. */
export function detectarFormato(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'desconhecido';
  if (obj.versao_modelo === VERSAO_MODELO) return 'v2';
  if (Array.isArray(obj.items) || Array.isArray(obj.tasks) || obj.v === 1 || obj.app === 'clarea') return 'v1';
  return 'desconhecido';
}

const slug = (nome) => norm(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

/** Cria entidades (pessoas ou temas) sem fundir nomes diferentes: só maiúsculas, espaços e acentos contam como o mesmo nome. */
function criarEntidades(prefixo, nomes, arquivados, agora) {
  const porNorm = new Map(), usados = new Set(), saida = [];
  const arq = new Set(arquivados.map(norm));
  const obter = (nome) => {
    const limpo = texto(nome).trim();
    if (!limpo) return null;
    const chave = norm(limpo);
    if (porNorm.has(chave)) return porNorm.get(chave);
    let id = `${prefixo}_${slug(limpo)}`, n = 2;
    while (usados.has(id)) id = `${prefixo}_${slug(limpo)}-${n++}`;
    usados.add(id);
    const ent = { id, name: limpo, created_at: agora, archived_at: arq.has(chave) ? agora : null };
    porNorm.set(chave, ent);
    saida.push(ent);
    return ent;
  };
  nomes.forEach(obter);
  arquivados.forEach(obter);
  return { obter, saida };
}

/**
 * @param {object} v1 estado no formato 1.0 (já limpo pelo app ou lido de uma cópia de segurança)
 * @param {{hoje: string, agora: string}} ctx `hoje` AAAA-MM-DD e `agora` em ISO UTC, informados por quem chama
 */
export function migrarParaV2(v1, ctx) {
  if (detectarFormato(v1) === 'v2') return structuredClone(v1);
  if (detectarFormato(v1) !== 'v1') throw new Error('Formato de dados não reconhecido.');
  const { hoje, agora } = ctx;
  if (!ehData(hoje) || Number.isNaN(Date.parse(agora))) throw new Error('migrarParaV2 precisa de `hoje` e `agora` válidos.');

  const out = estadoVazio();
  const base = out.config;
  out.config = {
    name: texto(v1.name), hora: texto(v1.hora) || base.hora, dias: Array.isArray(v1.dias) && v1.dias.length === 7 ? v1.dias.map((d) => d === true) : base.dias,
    atrapalha: lista(v1.atrapalha).filter(Number.isInteger), lembrete: v1.lembrete === true, theme: texto(v1.theme) || base.theme,
    onboarded: v1.onboarded === true, welcomed: v1.welcomed === true,
    tips: v1.tips && typeof v1.tips === 'object' && !Array.isArray(v1.tips) ? { ...v1.tips } : {}, lastBackup: texto(v1.lastBackup), lastNotified: texto(v1.lastNotified)
  };

  const itens = objetos(v1.items), tarefas = objetos(v1.tasks);
  const pessoas = criarEntidades('pe', lista(v1.people).map(texto), [], agora);
  const temas = criarEntidades('te', lista(v1.temas).map(texto), lista(v1.temasArq).map(texto), agora);

  const tarefaDoItem = new Map();
  tarefas.forEach((t) => { if (texto(t.itemId) && !tarefaDoItem.has(t.itemId)) tarefaDoItem.set(t.itemId, t); });
  const itemIds = new Set(itens.filter((i) => texto(i.id)).map((i) => i.id));
  const usadas = new Set(); // tarefas absorvidas por um assunto existente

  const novoAssunto = (campos) => ({
    id: '', original_text: '', text: '', created_at: agora, updated_at: agora, status: 'inbox', next_action: null,
    person_id: null, topic_id: null, due_at: null, reminder_at: null, resume_at: null, source: 'migration',
    ai_suggestion: null, ai_confidence: null, confirmed_at: null, completed_at: null, archived_at: null, deleted_at: null,
    focus: false, local_version: 1, server_version: null, legado: null, ...campos
  });

  itens.forEach((i) => {
    const t = texto(i.text);
    if (!texto(i.id) || !t.trim()) return;
    const criado = ehData(i.created) ? meioDia(i.created) : agora;
    const pe = pessoas.obter(i.person), te = temas.obter(i.tema);
    const tarefa = i.status === 'tarefa' ? tarefaDoItem.get(i.id) : null;
    if (tarefa) usadas.add(tarefa);
    const acao = ACAO_POR_TIPO[i.type] || null;
    const adiado = ehData(i.snoozeUntil) && i.snoozeUntil > hoje ? i.snoozeUntil : null;
    const a = novoAssunto({
      id: i.id, original_text: t, text: t, created_at: criado, updated_at: criado,
      person_id: pe ? pe.id : null, topic_id: te ? te.id : null,
      legado: { status: texto(i.status), type: texto(i.type), person: texto(i.person), tema: texto(i.tema), snoozeUntil: texto(i.snoozeUntil), doneDate: texto(i.doneDate), created: texto(i.created), focus: i.focus === true }
    });
    const fim = ehData(i.doneDate) ? meioDia(i.doneDate) : criado;
    switch (i.status) {
      case 'novo': a.status = 'inbox'; break;
      case 'resolvido': a.status = 'done'; a.next_action = acao; a.completed_at = fim; a.updated_at = fim; break;
      case 'solto': a.status = 'discarded'; break;
      case 'tarefa':
        // D-009: tarefa pendente vira assunto em andamento com ação Fazer; concluída (ou já limpa da lista) vira concluído.
        if (tarefa && tarefa.done !== true) { a.status = 'in_progress'; a.next_action = 'do'; a.updated_at = fim; }
        else { a.status = 'done'; a.next_action = acao; a.completed_at = fim; a.updated_at = fim; }
        break;
      default: // 'aberto'
        if (i.type === 'esperando') { a.status = 'waiting'; a.resume_at = adiado; }
        else if (adiado) { a.status = 'scheduled'; a.next_action = acao; a.resume_at = adiado; }
        else { a.status = 'in_progress'; a.next_action = acao; }
        a.focus = i.focus === true;
    }
    out.assuntos.push(a);
  });

  // D-009: tarefa sem assunto de origem vira um novo assunto (id derivado, para a migração ser repetível).
  const ids = new Set(out.assuntos.map((a) => a.id));
  tarefas.forEach((t) => {
    if (usadas.has(t)) return;
    const tx = texto(t.text);
    if (!texto(t.id) || !tx.trim()) return;
    const criado = ehData(t.created) ? meioDia(t.created) : agora;
    let id = `t_${t.id}`;
    while (ids.has(id)) id += '_';
    ids.add(id);
    const feito = t.done === true;
    out.assuntos.push(novoAssunto({
      id, original_text: tx, text: tx, created_at: criado, updated_at: criado, status: feito ? 'done' : 'in_progress', next_action: 'do', completed_at: feito ? criado : null,
      legado: { tarefa: { id: t.id, text: tx, done: feito, created: texto(t.created), itemId: texto(t.itemId), itemExistia: itemIds.has(t.itemId) } }
    }));
  });

  out.pessoas = pessoas.saida;
  out.temas = temas.saida;
  out.migracao = { de: 'v1', para: VERSAO_MODELO, em: agora, assuntos_v1: itens.length, tarefas_v1: tarefas.length };
  return out;
}
