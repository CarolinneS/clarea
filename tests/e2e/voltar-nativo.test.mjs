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

test('Voltar fecha o cartão de edição, várias vezes seguidas', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Comprar remédios', { focus: true })], { tips: { anotar: true, 'clear-intro': true, hoje: true, historico: true } }));
  await contexto.addInitScript(comoAndroid);
  await pagina.goto(amb.url);
  for (let n = 0; n < 4; n++) {
    await pagina.click('.focus.open button:text-is("Editar")');
    await pagina.waitForSelector('text=Editar assunto');
    await pagina.goBack();
    await pagina.waitForFunction(() => !document.body.innerText.includes('Editar assunto'));
  }
  assert.deepEqual(pagina.errosJs, []);
  await contexto.close();
});

test('com o plugin App presente, o Voltar é decidido por ele', async () => {
  const { contexto, pagina } = await novaPagina(amb, base());
  await contexto.addInitScript(`window.__voltar = null; window.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true,
    registerPlugin: () => ({ addListener: (n, f) => { window.__voltar = f; return Promise.resolve({ remove() {} }); }, exitApp: () => { window.__saiu = true; } }) };`);
  await pagina.goto(amb.url);
  await pagina.click('nav [data-act="go"][data-to="anotar"]');
  await pagina.waitForSelector('#new-line');
  await pagina.evaluate(() => window.__voltar());
  await pagina.waitForSelector('nav [aria-current="page"]:has-text("Hoje")');
  await pagina.evaluate(() => window.__voltar());
  await pagina.waitForSelector('text=Toque em voltar de novo para sair.');
  assert.equal(await pagina.evaluate(() => !!window.__saiu), false);
  await pagina.evaluate(() => window.__voltar());
  assert.equal(await pagina.evaluate(() => !!window.__saiu), true);
  await contexto.close();
});
