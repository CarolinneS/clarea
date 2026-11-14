// E1.3 · A biblioteca guardada no repositório é a que foi aprovada e não foi alterada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '../..');
const ler = (p) => readFileSync(resolve(raiz, p));

test('dexie.mjs confere com a soma SHA-256 registrada', () => {
  const [soma, nome] = ler('vendor/SHA256SUMS').toString().trim().split(/\s+/);
  assert.equal(nome, 'dexie.mjs');
  assert.equal(createHash('sha256').update(ler('vendor/dexie.mjs')).digest('hex'), soma, 'o arquivo mudou');
});

test('dexie.mjs é a versão 4.4.7, Apache-2.0, completo, e a licença acompanha', () => {
  const t = ler('vendor/dexie.mjs').toString('utf8');
  assert.match(t.slice(0, 600), /Version 4\.4\.7/);
  assert.match(t.slice(0, 600), /Apache License Version 2\.0/);
  assert.match(t, /export \{[^}]*Dexie\$1 as default[^}]*\};\s*(\/\/# sourceMappingURL=\S+\s*)?$/, 'final do arquivo completo');
  assert.match(ler('vendor/LICENSE-dexie.txt').toString(), /Apache License\s+Version 2\.0/);
  assert.ok(existsSync(resolve(raiz, 'vendor/README.md')));
});

test('o service worker guarda a biblioteca e o módulo de armazenamento para uso offline', () => {
  const sw = ler('sw.js').toString();
  assert.ok(sw.includes("'./vendor/dexie.mjs'"));
  assert.ok(sw.includes("'./src/armazenamento.js'"));
});
