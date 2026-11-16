// D-014 · A pessoa só é perguntada quando o texto cita alguém.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const semDicas = { anotar: true, 'clear-intro': true, hoje: true, historico: true };
async function abrirClarear(texto) {
  const r = await novaPagina(amb, estadoBase([assunto(texto, { status: 'novo', type: '' })], { tips: semDicas }));
  await r.pagina.goto(amb.url);
  await r.pagina.click('[data-act="clear-intro"]');
  await r.pagina.click('[data-act="clear-start"]');
  return r;
}
const temPessoa = (pagina) => pagina.locator('.clear-card .label', { hasText: /^Pessoa$/ }).count();

test('Clarear o dia: texto de estudo não mostra o bloco Pessoa, nem "+ Outra"', async () => {
  const { contexto, pagina } = await abrirClarear('Estudar capítulo 3 de Biologia');
  assert.equal(await temPessoa(pagina), 0);
  assert.equal(await pagina.locator('[data-act="add"][data-field="person"]').count(), 0);
  assert.doesNotMatch(await pagina.locator('.why').innerText(), /nome|pessoa/i);
  await pagina.click('[data-act="clear-ok"]');
  await pagina.waitForSelector('body[data-pronto]');
  await contexto.close();
});

test('Clarear o dia: texto que cita alguém mostra o bloco Pessoa já sugerido', async () => {
  const { contexto, pagina } = await abrirClarear('Falar com Bruno sobre a prova');
  assert.equal(await temPessoa(pagina), 1);
  assert.equal(await pagina.locator('.clear-card .chip[aria-pressed="true"]', { hasText: 'Bruno' }).count(), 1);
  await contexto.close();
});

test('Hoje e Perfil: sem pessoas, nada de "Por pessoa" nem "Pessoas"', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Estudar Biologia', { focus: true, type: 'fazer' })]));
  await pagina.goto(amb.url);
  assert.equal(await pagina.locator('text=Por pessoa').count(), 0);
  assert.equal(await pagina.locator('text=Só você').count(), 0);
  await pagina.click('[data-act="go"][data-to="perfil"]');
  assert.equal(await pagina.locator('[data-act="go"][data-to="pessoas"]').innerText().then((t) => /^Temas/.test(t.trim())), true);
  await pagina.click('[data-act="go"][data-to="pessoas"]');
  assert.equal(await pagina.locator('text=Nenhuma pessoa ainda').count(), 0);
  assert.equal(await pagina.locator('.label', { hasText: /^Pessoas$/ }).count(), 0);
  await contexto.close();
});

test('Hoje: com pessoas, "Por pessoa" continua aparecendo', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Cobrar o contrato', { focus: true, person: 'Marina', type: 'retomar' })], { people: ['Marina'] }));
  await pagina.goto(amb.url);
  assert.equal(await pagina.locator('text=Por pessoa').count(), 1);
  await contexto.close();
});

test('Editar assunto: sem pessoa citada não mostra o bloco; com pessoa, mostra', async () => {
  for (const [texto, extra, esperado] of [['Estudar Biologia', {}, 0], ['Cobrar o contrato', { person: 'Marina', type: 'retomar' }, 1]]) {
    const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto(texto, { focus: true, ...extra })], { people: extra.person ? [extra.person] : [] }));
    await pagina.goto(amb.url);
    await pagina.click('.focus.open button:text-is("Editar")'); // o primeiro assunto do foco já abre sozinho
    await pagina.waitForSelector('#edit-item-text');
    assert.equal(await pagina.locator('.sheet .label', { hasText: /^Pessoa$/ }).count(), esperado, texto);
    await contexto.close();
  }
});
