// C1 · Todo arquivo que o app, o manifest e o service worker pedem precisa existir no repositório.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '../..');
const ler = (f) => readFileSync(resolve(raiz, f), 'utf8');
const existe = (f) => existsSync(resolve(raiz, f));

test('ícones do manifest existem', () => {
  const manifest = JSON.parse(ler('manifest.webmanifest'));
  const faltando = manifest.icons.map((i) => i.src).filter((s) => !existe(s));
  assert.deepEqual(faltando, []);
});

test('arquivos essenciais do service worker existem', () => {
  const sw = ler('sw.js');
  const bloco = sw.match(/ESSENCIAIS\s*=\s*\[([\s\S]*?)\]/)[1];
  const arquivos = [...bloco.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  const faltando = arquivos.filter((f) => !existe(f));
  assert.deepEqual(faltando, []);
});

test('ícones citados no index.html existem', () => {
  const html = ler('index.html');
  const refs = [...html.matchAll(/(?:href|src)="(icons\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 0);
  assert.deepEqual(refs.filter((r) => !existe(r)), []);
});

test('os ícones PNG têm o tamanho declarado no manifest', () => {
  const manifest = JSON.parse(ler('manifest.webmanifest'));
  for (const icone of manifest.icons) {
    const png = readFileSync(resolve(raiz, icone.src));
    assert.equal(png.subarray(1, 4).toString(), 'PNG', `${icone.src} não é PNG`);
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.equal(`${w}x${h}`, icone.sizes, `${icone.src}: tamanho real ${w}x${h}`);
  }
});

test('o ícone da tela inicial do iPhone tem 180x180', () => {
  const png = readFileSync(resolve(raiz, 'icons/apple-touch-icon.png'));
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, '180x180');
});

test('fontes citadas no index.html existem', () => {
  const html = ler('index.html');
  const refs = [...html.matchAll(/url\('(fonts\/[^']+)'\)/g)].map((m) => m[1]);
  assert.ok(refs.length >= 2, 'esperava ao menos Regular e Bold');
  assert.deepEqual(refs.filter((r) => !existe(r)), []);
});

test('arquivos opcionais do service worker existem (ícones e fontes)', () => {
  const sw = ler('sw.js');
  const bloco = sw.match(/OPCIONAIS\s*=\s*\[([\s\S]*?)\]/)[1];
  const arquivos = [...bloco.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  assert.deepEqual(arquivos.filter((f) => !existe(f)), []);
});

test('a licença da fonte acompanha os arquivos', () => {
  assert.ok(existe('fonts/OFL.txt'));
});
