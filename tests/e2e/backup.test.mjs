// C4 · Restaurar uma cópia adulterada não pode executar código
// Os testes usam um marcador inofensivo (window.__m = 1) no lugar de código real.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto, lerAssuntos, lerConfig } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const MARCADOR = '"><img src=x onerror="window.__m=1">';

const casos = [
  ['type', () => estadoBase([assunto('ok', { focus: true, type: 'fazer' + MARCADOR })])],
  ['id', () => estadoBase([assunto('ok', { focus: true, id: 'a' + MARCADOR })])],
  ['dias', () => estadoBase([assunto('ok')], { dias: [MARCADOR, true, true, true, true, false, false] })],
  ['hora', () => estadoBase([assunto('ok')], { hora: '18:00' + MARCADOR })],
  ['texto', () => estadoBase([assunto('<img src=x onerror="window.__m=1">', { focus: true, person: '<img src=x onerror="window.__m=1">' })])]
];

for (const [campo, montar] of casos) {
  test(`cópia com código no campo "${campo}" não executa`, async () => {
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

async function importar(copia, bytes) {
  const { contexto, pagina } = await novaPagina(amb);
  await pagina.goto(amb.url);
  await pagina.waitForSelector('#file-in', { state: 'attached' });
  await pagina.setInputFiles('#file-in', { name: 'copia.json', mimeType: 'application/json', buffer: bytes || Buffer.from(JSON.stringify(copia)) });
  await pagina.waitForTimeout(800);
  return { contexto, pagina };
}

test('cópia com campos fora do formato é limpa: valores inválidos viram padrão', async () => {
  const copia = estadoBase([
    assunto('Status estranho', { focus: true, status: 'hackeado', type: 'qualquer', created: 'ontem' }),
    assunto('Repetido A', { id: 'igual', focus: true }),
    assunto('Repetido B', { id: 'igual', focus: true }),
    null, 42, 'texto solto', { text: '   ' }
  ], { hora: '99:99', theme: 'neon', dias: [1, 2, 3], atrapalha: [0, 99, 'x'] });
  const { contexto, pagina } = await importar(copia);
  const itens = await lerAssuntos(pagina);
  const cfg = await lerConfig(pagina);
  assert.equal(itens.length, 3, 'só os 3 assuntos válidos entram');
  const status = itens.find((i) => i.text === 'Status estranho').v2;
  assert.equal(status.status, 'in_progress');
  assert.equal(status.next_action, null);
  assert.match(status.created_day, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Set(itens.map((i) => i.id)).size, 3, 'ids repetidos são refeitos');
  assert.equal(cfg.hora, '18:00');
  assert.equal(cfg.theme, 'light');
  assert.equal(cfg.dias.length, 7);
  assert.deepEqual(cfg.atrapalha, [0]);
  await contexto.close();
});

test('arquivo que não é cópia do Clarea é recusado e não muda nada', async () => {
  const { contexto, pagina } = await importar(null, Buffer.from('{"app":"outro","items":[]}'));
  const e = await pagina.evaluate(() => new Promise((res) => { const r = indexedDB.open('clarea'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('estado'); q.onsuccess = () => res(q.result || null); }; }));
  assert.equal(e, null);
  await contexto.close();
});

test('arquivo grande demais é recusado', async () => {
  const { contexto, pagina } = await importar(null, Buffer.alloc(11 * 1024 * 1024, 32));
  assert.ok((await pagina.evaluate(() => document.body.innerText)).includes('grande demais'));
  await contexto.close();
});

test('dados já guardados com código no campo "type" também são limpos ao abrir o app', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('ok', { focus: true, type: 'fazer' + MARCADOR })]));
  await pagina.goto(amb.url);
  await pagina.waitForTimeout(800);
  assert.equal(await pagina.evaluate(() => window.__m === 1), false);
  await contexto.close();
});
