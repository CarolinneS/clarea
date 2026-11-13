// PLA-03 / M6 · Contraste (WCAG 2.x) das cores definidas no index.html.
// Textos: mínimo 4,5:1. Contorno de campos e controles: mínimo 3:1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');

function variaveis(abertura) {
  const inicio = html.indexOf(abertura);
  assert.ok(inicio >= 0, `não achei o bloco ${abertura}`);
  const bloco = html.slice(inicio, html.indexOf('}', inicio));
  return Object.fromEntries([...bloco.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
}
const claro = variaveis(':root {');
const escuro = variaveis(':root[data-theme="dark"] {');

const luz = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const razao = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const TEXTOS = [
  ['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'],
  ['primary-ink', 'primary'], ['primary', 'bg'], ['primary', 'surface'], ['good', 'good-soft'],
  ['age-w', 'surface'], ['age-a', 'surface'], ['esp-fg', 'esp-bg'], ['ret-fg', 'ret-bg'], ['con-fg', 'con-bg'], ['cv-fg', 'cv-bg'], ['faz-fg', 'faz-bg']
];

for (const [nome, tema] of [['claro', claro], ['escuro', escuro]]) {
  test(`tema ${nome}: textos com contraste mínimo de 4,5:1`, () => {
    const falhas = TEXTOS.filter(([f, b]) => tema[f] && tema[b] && razao(tema[f], tema[b]) < 4.5)
      .map(([f, b]) => `${f} sobre ${b} = ${razao(tema[f], tema[b]).toFixed(2)}`);
    assert.deepEqual(falhas, []);
  });

  test(`tema ${nome}: contorno dos campos com contraste mínimo de 3:1`, { todo: 'E4 · M6: bordas dos campos abaixo de 3:1' }, () => {
    const r = razao(tema['line-strong'], tema.surface);
    assert.ok(r >= 3, `line-strong sobre surface = ${r.toFixed(2)}`);
  });
}
