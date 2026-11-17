// P-017 · Voltar do Android dentro do Capacitor
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

// Simula o app dentro do Capacitor (Android): o Voltar do aparelho vira "voltar" no histórico do WebView.
const comoAndroid = `window.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true };`;
const base = () => estadoBase([assunto('Ligar para o contador')], { tips: { anotar: true, 'clear-intro': true, hoje: true, historico: true } });

test('Voltar do Android: volta de tela, fecha cartão e em Hoje só sai no segundo toque', async () => {
  const { contexto, pagina } = await novaPagina(amb, base());
  await contexto.addInitScript(comoAndroid);
  await pagina.goto(amb.url);
  await pagina.click('nav [data-act="go"][data-to="anotar"]');
  await pagina.waitForSelector('#new-line');
  await pagina.goBack();
  await pagina.waitForSelector('nav [aria-current="page"]:has-text("Hoje")');
  // abre o Perfil e volta
  await pagina.click('header .me');
  await pagina.waitForSelector('#perfil-nome');
  await pagina.goBack();
  await pagina.waitForSelector('nav [aria-current="page"]:has-text("Hoje")');
  // em Hoje, o primeiro Voltar só avisa
  await pagina.goBack();
  await pagina.waitForSelector('text=Toque em voltar de novo para sair.');
  assert.deepEqual(pagina.errosJs, []);
  await contexto.close();
});

test('no navegador comum o Voltar não é alterado (sem entrada extra no histórico)', async () => {
  const { contexto, pagina } = await novaPagina(amb, base());
  await pagina.goto(amb.url);
  assert.equal(await pagina.evaluate(() => history.state), null);
  await contexto.close();
});
