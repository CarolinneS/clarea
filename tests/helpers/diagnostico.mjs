// Diagnóstico de abertura: abre o app no navegador escolhido (NAVEGADOR=webkit|chromium)
// e imprime tudo que der errado. Serve para achar a causa quando o app não abre num navegador.
import * as playwright from 'playwright';
import { iniciarServidor } from './server.mjs';

const motor = process.env.NAVEGADOR || 'chromium';
const servidor = await iniciarServidor(0);
const navegador = await playwright[motor].launch(motor === 'chromium' ? { args: ['--no-sandbox'] } : {});
const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
const pagina = await contexto.newPage();
const logs = [];
pagina.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
pagina.on('pageerror', (e) => logs.push(`[ERRO JS] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
pagina.on('requestfailed', (r) => logs.push(`[REQUISIÇÃO FALHOU] ${r.url()} ${r.failure()?.errorText}`));
pagina.on('response', (r) => { if (r.status() >= 400) logs.push(`[HTTP ${r.status()}] ${r.url()}`); });

await pagina.goto(servidor.url);
const pronto = await pagina.waitForSelector('body[data-pronto]', { timeout: 15000 }).then(() => true, () => false);
await pagina.waitForTimeout(1000);
const info = await pagina.evaluate(() => ({
  agente: navigator.userAgent,
  temStructuredClone: typeof structuredClone,
  temBroadcastChannel: typeof BroadcastChannel,
  temRandomUUID: typeof (crypto && crypto.randomUUID),
  temIndexedDB: typeof indexedDB,
  textoVisivel: document.body.innerText.slice(0, 200)
}));
console.log(`Navegador: ${motor}\nApp ficou pronto (data-pronto): ${pronto}`);
console.log(JSON.stringify(info, null, 2));
console.log(logs.length ? logs.join('\n') : '(nenhum erro nem aviso)');
await navegador.close(); await servidor.fechar();
process.exit(pronto ? 0 : 1);
