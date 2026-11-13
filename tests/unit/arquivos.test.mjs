// C1 · Todo arquivo que o app, o manifest e o service worker pedem precisa existir no repositório.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '../..');
const ler = (f) => readFileSync(resolve(raiz, f), 'utf8');
const existe = (f) => existsSync(resolve(raiz, f));

test('ícones do manifest existem', { todo: 'S0.2 · C1: pasta icons/ não foi enviada' }, () => {
  const manifest = JSON.parse(ler('manifest.webmanifest'));
  const faltando = manifest.icons.map((i) => i.src).filter((s) => !existe(s));
  assert.deepEqual(faltando, []);
});

test('arquivos essenciais do service worker existem', { todo: 'S0.2 · C1' }, () => {
  const sw = ler('sw.js');
  const bloco = sw.match(/ESSENCIAIS\s*=\s*\[([\s\S]*?)\]/)[1];
  const arquivos = [...bloco.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  const faltando = arquivos.filter((f) => !existe(f));
  assert.deepEqual(faltando, []);
});

test('ícones citados no index.html existem', { todo: 'S0.2 · C1' }, () => {
  const html = ler('index.html');
  const refs = [...html.matchAll(/(?:href|src)="(icons\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 0);
  assert.deepEqual(refs.filter((r) => !existe(r)), []);
});
