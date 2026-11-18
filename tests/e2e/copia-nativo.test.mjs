// P-017 · Salvar uma cópia dentro do Capacitor (Android): arquivo no cache + folha de compartilhar
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const base = () => estadoBase([assunto('Ligar para o contador')], { tips: { anotar: true, 'clear-intro': true, hoje: true, historico: true } });
const falsoCapacitor = (falhaShare, semRegisterPlugin = false) => `
  window.__chamadas = [];
  const fabrica = (nome) => ({
      addListener: () => Promise.resolve({ remove() {} }),
      writeFile: (o) => { window.__chamadas.push(['writeFile', o]); return Promise.resolve({ uri: 'file:///cache/' + o.path }); },
      share: (o) => { window.__chamadas.push(['share', o]); return ${falhaShare ? "Promise.reject(new Error('Share canceled'))" : 'Promise.resolve({})'}; },
    });
  window.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true };
  if (${semRegisterPlugin}) { window.Capacitor.Plugins = { Filesystem: fabrica('Filesystem'), Share: fabrica('Share'), App: fabrica('App') }; }
  else { window.Capacitor.registerPlugin = fabrica; }`;

async function abrirPerfil(pagina) {
  await pagina.click('header .me');
  await pagina.waitForSelector('#perfil-nome');
}

test('no Android: grava o JSON no cache e abre a folha de compartilhar', async () => {
  const { contexto, pagina } = await novaPagina(amb, base());
  await contexto.addInitScript(falsoCapacitor(false));
  await pagina.goto(amb.url);
  await abrirPerfil(pagina);
  await pagina.click('[data-act="export"]');
  await pagina.waitForSelector('text=Cópia pronta');
  const ch = await pagina.evaluate(() => window.__chamadas);
  assert.equal(ch[0][0], 'writeFile');
  assert.match(ch[0][1].path, /^clarea-copia-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(ch[0][1].directory, 'CACHE');
  const json = JSON.parse(ch[0][1].data);
  assert.equal(json.app, 'clarea');
  assert.ok(JSON.stringify(json).includes('Ligar para o contador'));
  assert.equal(ch[1][0], 'share');
  assert.match(ch[1][1].files[0], /^file:\/\/\/cache\/clarea-copia-/);
  assert.equal(pagina.errosJs.length, 0);
  await contexto.close();
});

test('no Android: se a pessoa cancelar, não diz que salvou nem marca a cópia como feita', async () => {
  const { contexto, pagina } = await novaPagina(amb, base());
  await contexto.addInitScript(falsoCapacitor(true));
  await pagina.goto(amb.url);
  await abrirPerfil(pagina);
  await pagina.click('[data-act="export"]');
  await pagina.waitForSelector('text=Cópia cancelada');
  assert.ok(await pagina.locator('text=nenhuma ainda').count());
  await contexto.close();
});

test('no navegador: continua baixando o arquivo como antes', async () => {
  const { contexto, pagina } = await novaPagina(amb, base());
  await pagina.goto(amb.url);
  await abrirPerfil(pagina);
  const [baixado] = await Promise.all([pagina.waitForEvent('download'), pagina.click('[data-act="export"]')]);
  assert.match(baixado.suggestedFilename(), /^clarea-copia-/);
  await contexto.close();
});

test('no Android real a ponte só expõe Capacitor.Plugins (sem registerPlugin): a cópia também funciona', async () => {
  const { contexto, pagina } = await novaPagina(amb, base());
  await contexto.addInitScript(falsoCapacitor(false, true));
  await pagina.goto(amb.url);
  await abrirPerfil(pagina);
  await pagina.click('[data-act="export"]');
  await pagina.waitForSelector('text=Cópia pronta');
  assert.equal((await pagina.evaluate(() => window.__chamadas))[1][0], 'share');
  await contexto.close();
});

test('no app sem os plugins de arquivo, avisa em vez de fingir que salvou', async () => {
  const { contexto, pagina } = await novaPagina(amb, base());
  await contexto.addInitScript(`window.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true, Plugins: {} };`);
  await pagina.goto(amb.url);
  await abrirPerfil(pagina);
  await pagina.click('[data-act="export"]');
  await pagina.waitForSelector('text=não encontrou os recursos de arquivo');
  assert.ok(await pagina.locator('text=nenhuma ainda').count());
  await contexto.close();
});
