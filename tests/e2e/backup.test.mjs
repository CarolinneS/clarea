// C4 · Restaurar uma cópia adulterada não pode executar código
// Os testes usam um marcador inofensivo (window.__m = 1) no lugar de código real.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const MARCADOR = '"><img src=x onerror="window.__m=1">';

const casos = [
  ['type', () => estadoBase([assunto('ok', { focus: true, type: 'fazer' + MARCADOR })]), 'S0.5 · C4'],
  ['id', () => estadoBase([assunto('ok', { focus: true, id: 'a' + MARCADOR })]), 'S0.5 · C4'],
  ['dias', () => estadoBase([assunto('ok')], { dias: [MARCADOR, true, true, true, true, false, false] }), 'S0.5 · C4'],
  ['hora', () => estadoBase([assunto('ok')], { hora: '18:00' + MARCADOR }), 'S0.5 · C4'],
  ['texto', () => estadoBase([assunto('<img src=x onerror="window.__m=1">', { focus: true, person: '<img src=x onerror="window.__m=1">' })]), false]
];

for (const [campo, montar, todo] of casos) {
  test(`cópia com código no campo "${campo}" não executa`, todo ? { todo } : {}, async () => {
    const { contexto, pagina } = await novaPagina(amb);
    await pagina.goto(amb.url);
    await pagina.waitForSelector('#file-in', { state: 'attached' });
    await pagina.setInputFiles('#file-in', { name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(montar())) });
    await pagina.waitForTimeout(600);
    await pagina.evaluate(() => { const b = document.querySelector('[data-to="perfil"]'); if (b) b.click(); });
    await pagina.waitForTimeout(400);
    assert.equal(await pagina.evaluate(() => window.__m === 1), false, 'o código embutido na cópia foi executado');
    await contexto.close();
  });
}

test('uma cópia normal é restaurada', async () => {
  const { contexto, pagina } = await novaPagina(amb);
  await pagina.goto(amb.url);
  await pagina.waitForSelector('#file-in', { state: 'attached' });
  const copia = estadoBase([assunto('Item da cópia', { focus: true })]);
  await pagina.setInputFiles('#file-in', { name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(copia)) });
  await pagina.waitForSelector('text=Item da cópia', { timeout: 4000 });
  await contexto.close();
});
