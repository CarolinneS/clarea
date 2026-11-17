// Spike do Capacitor (P-017): a pasta www/ precisa ter tudo que o app usa offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepararWww } from '../../scripts/preparar-www.mjs';

test('www/ contém todos os arquivos que o service worker guarda para funcionar offline', () => {
  const saida = mkdtempSync(join(tmpdir(), 'clarea-www-'));
  try {
    prepararWww(saida);
    const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
    const caminhos = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter((c) => c && !c.endsWith('/'));
    assert.ok(caminhos.length > 10, 'achou a lista do service worker');
    for (const c of caminhos) assert.ok(existsSync(join(saida, c)), `faltou em www/: ${c}`);
    assert.ok(existsSync(join(saida, 'index.html')));
  } finally { rmSync(saida, { recursive: true, force: true }); }
});

test('capacitor.config.json usa o identificador provisório de teste e a pasta www', () => {
  const cfg = JSON.parse(readFileSync(new URL('../../capacitor.config.json', import.meta.url), 'utf8'));
  assert.equal(cfg.appId, 'app.clarea.teste', 'o identificador definitivo da loja ainda não foi decidido (P-005)');
  assert.equal(cfg.webDir, 'www');
});
