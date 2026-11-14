// Ajudantes dos testes de ponta a ponta: sobem o app localmente, abrem o navegador
// e permitem preparar e ler os dados guardados no aparelho (IndexedDB).
import { chromium } from 'playwright';
import { iniciarServidor } from './server.mjs';

export async function abrirAmbiente() {
  const servidor = await iniciarServidor(0);
  const navegador = await chromium.launch({
    // Localmente dá para apontar para um Chrome já instalado: CHROME_PATH=/caminho/do/chrome
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox']
  });
  return {
    url: servidor.url,
    navegador,
    async fechar() { await navegador.close(); await servidor.fechar(); }
  };
}

// Abre uma página nova num contexto limpo (sem dados, sem service worker) em tamanho de celular.
// Se `estado` for informado, ele é gravado no IndexedDB antes de o app abrir.
export async function novaPagina(amb, estado) {
  const contexto = await amb.navegador.newContext({ viewport: { width: 390, height: 844 } });
  const pagina = await contexto.newPage();
  pagina.errosJs = [];
  pagina.requisicoesExternas = [];
  pagina.on('pageerror', (e) => pagina.errosJs.push(e.message));
  pagina.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(amb.url) && !u.startsWith('data:') && !u.startsWith('blob:')) pagina.requisicoesExternas.push(u);
  });
  // O app abre de forma assíncrona (banco de dados): ao abrir ou recarregar o app, espera ele terminar de abrir.
  const eApp = (u) => u === amb.url || u.startsWith(amb.url + '?') || u.startsWith(amb.url + 'index.html');
  const ir = pagina.goto.bind(pagina), recarregar = pagina.reload.bind(pagina);
  pagina.goto = async (u, o) => { const r = await ir(u, o); if (eApp(u)) await pagina.waitForSelector('body[data-pronto]'); return r; };
  pagina.reload = async (o) => { const r = await recarregar(o); if (eApp(pagina.url())) await pagina.waitForSelector('body[data-pronto]'); return r; };
  if (estado) await gravarEstado(amb, pagina, estado);
  return { contexto, pagina };
}

// Grava o estado como o app faz: banco `clarea`, store `kv`, chave `estado`.
export async function gravarEstado(amb, pagina, estado) {
  await pagina.goto(amb.url + 'manifest.webmanifest'); // qualquer arquivo da mesma origem
  await pagina.evaluate((st) => new Promise((ok, erro) => {
    const r = indexedDB.open('clarea', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onerror = () => erro(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(st, 'estado');
      tx.oncomplete = () => { r.result.close(); ok(); };
    };
  }), estado);
}

// Lê os assuntos guardados no banco do modelo 2.0 (`clarea-v2`, tabela `assuntos`), na ordem de criação.
// Devolve cada um já com os nomes que os testes usam (text, status da tela, focus) mais o registro original em `v2`.
// Devolve null se não houver nada guardado.
const STATUS_TELA = { inbox: 'novo', in_progress: 'aberto', waiting: 'aberto', scheduled: 'aberto', done: 'resolvido', discarded: 'solto', archived: 'solto' };
export async function lerAssuntos(pagina) {
  const lista = await pagina.evaluate(() => new Promise((ok) => {
    const q = indexedDB.open('clarea-v2');
    q.onerror = () => ok(null);
    q.onsuccess = () => {
      if (!q.result.objectStoreNames.contains('assuntos')) { q.result.close(); ok(null); return; }
      const g = q.result.transaction('assuntos').objectStore('assuntos').getAll();
      g.onsuccess = () => { q.result.close(); ok(g.result); };
    };
  }));
  if (!lista || !lista.length) return null;
  return lista.sort((a, b) => a.ordem - b.ordem).map((a) => ({ id: a.id, text: a.text, status: STATUS_TELA[a.status], focus: a.focus, v2: a }));
}

// Lê as configurações guardadas no banco do modelo 2.0 (tabela `meta`, chave `config`).
export function lerConfig(pagina) {
  return pagina.evaluate(() => new Promise((ok) => {
    const q = indexedDB.open('clarea-v2');
    q.onerror = () => ok(null);
    q.onsuccess = () => {
      if (!q.result.objectStoreNames.contains('meta')) { q.result.close(); ok(null); return; }
      const g = q.result.transaction('meta').objectStore('meta').get('config');
      g.onsuccess = () => { q.result.close(); ok(g.result ? g.result.valor : null); };
    };
  }));
}

export const textos = (itens) => (itens || []).map((i) => i.text);

// Estado já "pronto para usar" (passeio e dicas concluídos), para os testes irem direto ao ponto.
export function estadoBase(items = [], extra = {}) {
  return Object.assign({
    app: 'clarea', v: 1, name: 'Teste', hora: '18:00', dias: [true, true, true, true, true, false, false],
    atrapalha: [], lembrete: false, theme: 'light', onboarded: true, welcomed: true,
    tips: { anotar: true, 'clear-intro': true, hoje: true, historico: true },
    lastBackup: '', lastNotified: '', items, tasks: [], people: [], temas: [], temasArq: []
  }, extra);
}

let contador = 0;
export function assunto(text, extra = {}) {
  return Object.assign({
    id: 'teste' + (++contador), text, created: '2026-11-10', status: 'aberto', type: 'fazer',
    person: '', tema: '', snoozeUntil: '', doneDate: '', focus: false
  }, extra);
}

// Digita uma anotação no Anotar e confirma com Enter.
export async function anotar(pagina, texto) {
  await pagina.fill('#new-line', texto);
  await pagina.press('#new-line', 'Enter');
}
