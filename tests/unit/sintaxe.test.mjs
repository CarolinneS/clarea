// O JavaScript embutido no index.html e o service worker precisam ter sintaxe válida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const raiz = resolve(import.meta.dirname, '../..');

test('script do index.html tem sintaxe válida', () => {
  const html = readFileSync(resolve(raiz, 'index.html'), 'utf8');
  const partes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(partes.length >= 1, 'não achei <script> no index.html');
  partes.forEach((codigo, k) => assert.doesNotThrow(() => new vm.Script(codigo, { filename: `index.html#script${k + 1}` })));
});

test('sw.js tem sintaxe válida', () => {
  assert.doesNotThrow(() => new vm.Script(readFileSync(resolve(raiz, 'sw.js'), 'utf8'), { filename: 'sw.js' }));
});

test('manifest.webmanifest é um JSON válido com nome e ícones', () => {
  const m = JSON.parse(readFileSync(resolve(raiz, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.name, 'Clarea');
  assert.ok(Array.isArray(m.icons) && m.icons.length > 0);
});
