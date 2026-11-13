// C1 / M1 · Comportamento do service worker, testado com um ambiente simulado (sem navegador).
// O sw.js real é carregado e executado com `caches`, `fetch` e `self` falsos.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const CODIGO = readFileSync(resolve(import.meta.dirname, '../../sw.js'), 'utf8');
const BASE = 'http://localhost/';
const abs = (u) => new URL(typeof u === 'string' ? u : u.url, BASE).href;

// `rede(url)` devolve Response, rejeita (sem internet) ou devolve uma promessa que nunca termina (rede lenta).
function criarSW(rede) {
  const lojas = new Map();
  const abrir = (nome) => {
    if (!lojas.has(nome)) lojas.set(nome, new Map());
    const dados = lojas.get(nome);
    return {
      async put(req, res) { dados.set(abs(req), res.clone()); },
      async add(req) { const res = await fetchFalso(req); if (!res.ok) throw new Error('status ' + res.status); dados.set(abs(req), res.clone()); },
      async addAll(lista) { for (const u of lista) await this.add(u); },
      async keys() { return [...dados.keys()]; }
    };
  };
  const fetchFalso = async (req) => rede(abs(req));
  const caches = {
    open: async (nome) => abrir(nome),
    keys: async () => [...lojas.keys()],
    delete: async (nome) => lojas.delete(nome),
    match: async (req) => { for (const dados of lojas.values()) { const r = dados.get(abs(req)); if (r) return r.clone(); } return undefined; }
  };
  const tratadores = {};
  const self = {
    location: new URL(BASE + 'sw.js'),
    addEventListener: (nome, fn) => { tratadores[nome] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} }
  };
  const contexto = vm.createContext({
    self, caches, fetch: fetchFalso, Response, Request, URL, Promise,
    setTimeout: (...a) => globalThis.setTimeout(...a), clearTimeout: (...a) => globalThis.clearTimeout(...a)
  });
  new vm.Script(CODIGO, { filename: 'sw.js' }).runInContext(contexto);

  const evento = (extra) => {
    const e = { waitUntil: (p) => { (e.pendentes ||= []).push(p); }, respondWith: (p) => { e.resposta = p; }, ...extra };
    return e;
  };
  return {
    lojas, caches, tratadores,
    async instalar() { const e = evento(); tratadores.install(e); await Promise.all(e.pendentes); },
    async ativar() { const e = evento(); tratadores.activate(e); await Promise.all(e.pendentes); },
    abrirPagina(url = BASE) { const e = evento({ request: { method: 'GET', url, mode: 'navigate' } }); tratadores.fetch(e); return e; },
    pedirArquivo(nome) { const e = evento({ request: { method: 'GET', url: BASE + nome, mode: 'no-cors' } }); tratadores.fetch(e); return e; }
  };
}

const ok = (corpo) => new Response(corpo, { status: 200 });
const nomeCache = () => CODIGO.match(/VERSAO\s*=\s*'([^']+)'/)[1];

test('instala mesmo quando ícones e fontes opcionais não existem', async () => {
  const sw = criarSW((url) => (/\/(icons|fonts)\//.test(url) ? new Response('', { status: 404 }) : ok('arquivo')));
  await sw.instalar();
  const guardados = await (await sw.caches.open(nomeCache())).keys();
  assert.ok(guardados.includes(BASE + 'index.html'), 'index.html deve estar guardado');
  assert.ok(guardados.includes(BASE + 'manifest.webmanifest'));
});

test('a instalação falha se um arquivo essencial não existir', async () => {
  const sw = criarSW((url) => (url.endsWith('manifest.webmanifest') ? new Response('', { status: 404 }) : ok('arquivo')));
  await assert.rejects(sw.instalar());
});

test('ao ativar, apaga os caches de versões antigas', async () => {
  const sw = criarSW(() => ok('x'));
  await sw.caches.open('clarea-v1');
  await sw.instalar();
  await sw.ativar();
  assert.deepEqual(await sw.caches.keys(), [nomeCache()]);
});

test('com internet, abre a versão nova e atualiza a cópia guardada', async () => {
  const sw = criarSW(() => ok('VERSÃO NOVA'));
  const e = sw.abrirPagina();
  assert.equal(await (await e.resposta).text(), 'VERSÃO NOVA');
  await Promise.all(e.pendentes);
  assert.equal(await (await sw.caches.match('./index.html')).text(), 'VERSÃO NOVA');
});

test('sem internet, abre a cópia guardada', async () => {
  let online = true;
  const sw = criarSW((url) => { if (!online) throw new Error('sem rede'); return ok('COPIA'); });
  await sw.instalar();
  online = false;
  const e = sw.abrirPagina();
  assert.equal(await (await e.resposta).text(), 'COPIA');
});

test('com internet lenta, usa a cópia guardada depois de ~3 segundos', async () => {
  let lenta = false;
  const sw = criarSW((url) => (lenta ? new Promise(() => {}) : ok('COPIA')));
  await sw.instalar();
  lenta = true;
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const e = sw.abrirPagina();
    let pronta = false;
    e.resposta.then(() => { pronta = true; });
    for (let k = 0; k < 20; k++) { await Promise.resolve(); mock.timers.tick(100); } // 2 s: ainda esperando
    assert.equal(pronta, false, 'não deve desistir antes do limite');
    for (let k = 0; k < 20; k++) { await Promise.resolve(); mock.timers.tick(100); } // 4 s: passou do limite
    assert.equal(await (await e.resposta).text(), 'COPIA');
  } finally { mock.timers.reset(); }
});

test('resposta de erro do servidor não substitui a cópia guardada', async () => {
  let falha = false;
  const sw = criarSW(() => (falha ? new Response('Erro do servidor', { status: 503 }) : ok('COPIA BOA')));
  await sw.instalar();
  falha = true;
  const e = sw.abrirPagina();
  assert.equal(await (await e.resposta).text(), 'COPIA BOA');
  await Promise.all(e.pendentes);
  assert.equal(await (await sw.caches.match('./index.html')).text(), 'COPIA BOA');
});

test('sem cópia guardada, devolve o que a internet respondeu', async () => {
  const sw = criarSW(() => new Response('Erro do servidor', { status: 503 }));
  const e = sw.abrirPagina();
  assert.equal((await e.resposta).status, 503);
});

test('outros arquivos: guarda respostas de sucesso e ignora erros', async () => {
  const sw = criarSW((url) => (url.endsWith('existe.png') ? ok('img') : new Response('', { status: 404 })));
  const bom = sw.pedirArquivo('existe.png');
  assert.equal(await (await bom.resposta).text(), 'img');
  const ruim = sw.pedirArquivo('ausente.png');
  assert.equal((await ruim.resposta).status, 404);
  const guardados = await (await sw.caches.open(nomeCache())).keys();
  assert.ok(guardados.includes(BASE + 'existe.png'), 'sucesso deve ser guardado');
  assert.ok(!guardados.includes(BASE + 'ausente.png'), 'erro 404 não pode ser guardado');
});

test('outros arquivos: sem internet e sem cópia, responde 504 sem quebrar', async () => {
  const sw = criarSW(() => { throw new Error('sem rede'); });
  const e = sw.pedirArquivo('qualquer.png');
  assert.equal((await e.resposta).status, 504);
});

test('pedidos de outros sites e métodos diferentes de GET não são interceptados', () => {
  const sw = criarSW(() => ok('x'));
  const outro = sw.pedirArquivo('x'); outro.resposta = undefined;
  const externo = { request: { method: 'GET', url: 'https://exemplo.com/a.js', mode: 'cors' }, waitUntil() {}, respondWith() { throw new Error('não deveria interceptar'); } };
  const post = { request: { method: 'POST', url: BASE + 'x', mode: 'cors' }, waitUntil() {}, respondWith() { throw new Error('não deveria interceptar'); } };
  assert.doesNotThrow(() => { sw.tratadores.fetch(externo); sw.tratadores.fetch(post); });
});
