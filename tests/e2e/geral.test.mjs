// Privacidade (RNF-05/06), erros de JavaScript e volume
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto, anotar } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

test('uma sessão normal não faz requisições externas nem gera erros de JavaScript', async () => {
  const estado = estadoBase([assunto('A', { focus: true, person: 'Ana' })], { people: ['Ana'] });
  const { contexto, pagina } = await novaPagina(amb, estado);
  await pagina.goto(amb.url);
  await pagina.waitForSelector('#nav:not([hidden])');
  for (const destino of ['anotar', 'historico', 'perfil']) {
    await pagina.click(`[data-to="${destino}"]`);
    await pagina.waitForTimeout(150);
  }
  assert.deepEqual(pagina.requisicoesExternas, []);
  assert.deepEqual(pagina.errosJs, []);
  await contexto.close();
});

test('com 5.000 assuntos o app abre e captura em tempo razoável', async () => {
  const itens = [];
  for (let k = 0; k < 5000; k++) {
    itens.push(assunto(`Assunto número ${k} com um texto de tamanho comum`, {
      status: k < 4000 ? 'resolvido' : k < 4900 ? 'aberto' : 'novo',
      doneDate: k < 4000 ? '2026-11-01' : '',
      person: ['Ana', 'Bruno', 'Carla', ''][k % 4],
      tema: ['Alpha', 'Operações', ''][k % 3]
    }));
  }
  const { contexto, pagina } = await novaPagina(amb, estadoBase(itens, { people: ['Ana', 'Bruno', 'Carla'], temas: ['Alpha', 'Operações'] }));
  const inicio = Date.now();
  await pagina.goto(amb.url + '?tela=anotar');
  await pagina.waitForSelector('#new-line');
  const abrirMs = Date.now() - inicio;
  const capturaMs = await pagina.evaluate(() => {
    document.getElementById('new-line').value = 'nova';
    const t = performance.now();
    document.getElementById('composer').requestSubmit();
    return performance.now() - t;
  });
  // Limites folgados de propósito: servem para pegar degradações grandes, não variações de máquina.
  assert.ok(abrirMs < 5000, `abrir levou ${abrirMs} ms`);
  assert.ok(capturaMs < 1000, `capturar levou ${Math.round(capturaMs)} ms`);
  await contexto.close();
});

test('a fonte do projeto (Atkinson Hyperlegible) é carregada e usada', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('A', { focus: true })]));
  await pagina.goto(amb.url);
  await pagina.waitForSelector('#nav:not([hidden])');
  const r = await pagina.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].filter((f) => f.family.includes('Atkinson')).map((f) => f.status);
    return { faces, regular: document.fonts.check('16px "Atkinson Hyperlegible"'), negrito: document.fonts.check('700 16px "Atkinson Hyperlegible"') };
  });
  assert.ok(r.faces.length >= 2 && r.faces.every((s) => s === 'loaded'), `faces: ${JSON.stringify(r.faces)}`);
  assert.equal(r.regular && r.negrito, true);
  assert.deepEqual(pagina.requisicoesExternas, []);
  await contexto.close();
});
