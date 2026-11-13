// S0.7 · A versão do app é uma só: index.html, package.json, sw.js e README precisam concordar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '../..');
const ler = (f) => readFileSync(resolve(raiz, f), 'utf8');

const doPacote = JSON.parse(ler('package.json')).version;
const doHtml = ler('index.html').match(/const VERSAO = '([^']+)'/)?.[1];
const doSw = ler('sw.js').match(/const VERSAO = 'clarea-([^']+)'/)?.[1];
const doReadme = ler('README.md').match(/^# Clarea · versão (\S+)/m)?.[1];

test('a versão tem o formato número.número.número', () => {
  assert.match(doPacote, /^\d+\.\d+\.\d+$/);
});

test('index.html, sw.js e README mostram a mesma versão do package.json', () => {
  assert.equal(doHtml, doPacote, 'index.html');
  assert.equal(doSw, doPacote, 'sw.js (cache clarea-<versão>)');
  assert.equal(doReadme, doPacote, 'README.md (título)');
});
