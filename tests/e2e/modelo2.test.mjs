// E1.4b · O app agora usa o modelo 2.0 (D-012): abertura com importação única, ações gravadas por registro,
// cópia de segurança no formato 2, "Apagar tudo" em todos os bancos e alternativa sem banco.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAmbiente, novaPagina, estadoBase, assunto, lerAssuntos, lerConfig, textos } from '../helpers/app.mjs';

let amb;
before(async () => { amb = await abrirAmbiente(); });
after(async () => { await amb.fechar(); });

const hojeLocal = (pg) => pg.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
const por = (lista, t) => lista.find((i) => i.text === t).v2;
const abrirAntigo = (pg) => pg.evaluate(() => new Promise((ok) => { const q = indexedDB.open('clarea'); q.onsuccess = () => { if (!q.result.objectStoreNames.contains('kv')) { q.result.close(); ok(null); return; } const g = q.result.transaction('kv').objectStore('kv').get('estado'); g.onsuccess = () => { q.result.close(); ok(g.result || null); }; }; q.onerror = () => ok(null); }));

test('primeira abertura importa os dados do formato 1.0 uma única vez e deixa o banco antigo intacto', async () => {
  const v1 = estadoBase([
    assunto('Esperando a Ana', { focus: true, type: 'esperando', person: 'Ana' }),
    assunto('Cobrar o Paulo', { type: 'retomar', person: 'Paulo', tema: 'Obra' }),
    assunto('Anotado solto', { status: 'novo', type: '' }),
    assunto('Já resolvido', { status: 'resolvido', type: 'fazer', doneDate: '2026-11-12' })
  ], { name: 'Pessoa Teste', people: ['Ana', 'Paulo'], temas: ['Obra'] });
  const { contexto, pagina } = await novaPagina(amb, v1);
  await pagina.goto(amb.url);
  assert.ok(await pagina.locator('text=Esperando a Ana').count() >= 1);
  let a = await lerAssuntos(pagina);
  assert.deepEqual(textos(a), ['Esperando a Ana', 'Cobrar o Paulo', 'Anotado solto', 'Já resolvido']);
  assert.deepEqual([por(a, 'Esperando a Ana').status, por(a, 'Esperando a Ana').next_action], ['waiting', null]);
  assert.deepEqual([por(a, 'Cobrar o Paulo').status, por(a, 'Cobrar o Paulo').next_action], ['in_progress', 'chase']);
  assert.equal(por(a, 'Anotado solto').status, 'inbox');
  assert.deepEqual([por(a, 'Já resolvido').status, por(a, 'Já resolvido').completed_day], ['done', '2026-11-12']);
  assert.equal((await lerConfig(pagina)).name, 'Pessoa Teste');
  assert.deepEqual(await abrirAntigo(pagina), v1, 'banco antigo intacto');
  await pagina.reload();
  a = await lerAssuntos(pagina);
  assert.equal(a.length, 4, 'abrir de novo não importa de novo');
  assert.deepEqual(pagina.errosJs, []);
  assert.deepEqual(pagina.requisicoesExternas, []);
  await contexto.close();
});

test('tarefas do formato 1.0 viram assuntos Em andamento com ação Fazer, e a seção Tarefas não existe mais', async () => {
  const v1 = estadoBase([assunto('Virou tarefa', { status: 'tarefa', type: 'fazer', doneDate: '2026-11-12' })], {
    tasks: [{ id: 't1', text: 'Virou tarefa', done: false, created: '2026-11-12', itemId: null }, { id: 't2', text: 'Tarefa solta', done: false, created: '2026-11-11', itemId: '' }]
  });
  v1.tasks[0].itemId = v1.items[0].id;
  const { contexto, pagina } = await novaPagina(amb, v1);
  await pagina.goto(amb.url);
  const a = await lerAssuntos(pagina);
  assert.deepEqual([por(a, 'Virou tarefa').status, por(a, 'Virou tarefa').next_action], ['in_progress', 'do']);
  assert.deepEqual([por(a, 'Tarefa solta').status, por(a, 'Tarefa solta').next_action], ['in_progress', 'do']);
  assert.equal(await pagina.locator('.label:text-is("Tarefas")').count(), 0);
  assert.equal(await pagina.locator('text=Limpar concluídas').count(), 0);
  await contexto.close();
});

test('Resolvido, Amanhã e Deixar pra lá são gravados no modelo 2.0, sobrevivem a recarregar e têm Desfazer', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Um', { focus: true }), assunto('Dois', { focus: true }), assunto('Tres', { focus: true })]));
  await pagina.goto(amb.url);
  const hoje = await hojeLocal(pagina);
  const card = (t) => pagina.locator('.focus', { hasText: t });
  const acao = async (t, how) => {
    const c = pagina.locator('.focus', { hasText: t }).first(), b = c.locator(`[data-how="${how}"]`);
    if (!(await b.isVisible())) await c.locator('[data-act="expand"]').first().click();
    await b.click();
  };
  await acao('Um', 'resolvido');
  await acao('Dois', 'amanha');
  await acao('Tres', 'solto');
  await pagina.waitForTimeout(300);
  await pagina.reload();
  const a = await lerAssuntos(pagina);
  const u = por(a, 'Um'), d = por(a, 'Dois'), t = por(a, 'Tres');
  assert.deepEqual([u.status, u.completed_day, u.focus], ['done', hoje, false]);
  assert.deepEqual([d.status, d.resume_at > hoje], ['scheduled', true]);
  assert.equal(t.status, 'discarded');
  assert.equal(await card('Um').count(), 0);
  await contexto.close();
});

test('Desfazer volta o assunto ao estado de antes, também no banco', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Desfaço', { focus: true })]));
  await pagina.goto(amb.url);
  await pagina.click('.act.good');
  await pagina.click('#toast button:has-text("Desfazer")');
  await pagina.waitForTimeout(300);
  const v = (await lerAssuntos(pagina))[0].v2;
  assert.deepEqual([v.status, v.completed_day, v.focus], ['in_progress', null, true]);
  await contexto.close();
});

test('anotar, clarear o dia e editar gravam pessoa, tema e tipo; a caixa de entrada esvazia', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Falar com a Marina sobre o contrato', { status: 'novo', type: '' })], { tips: { anotar: true, 'clear-intro': true, hoje: true, historico: true } }));
  await pagina.goto(amb.url);
  await pagina.click('[data-act="clear-intro"]');
  await pagina.click('[data-act="clear-start"]');
  await pagina.click('[data-act="clear-ok"]');
  await pagina.waitForTimeout(300);
  const v = (await lerAssuntos(pagina))[0].v2;
  assert.equal(v.status, 'in_progress');
  assert.ok(v.confirmed_at);
  assert.equal(v.original_text, 'Falar com a Marina sobre o contrato');
  await contexto.close();
});

test('cópia de segurança sai no formato 2 e volta inteira numa instalação nova', async () => {
  const v1 = estadoBase([assunto('Aguardando o banco', { focus: true, type: 'esperando', person: 'Banco', tema: 'Casa' }), assunto('Fazer a lista', { type: 'fazer' })], { people: ['Banco'], temas: ['Casa'] });
  const { contexto, pagina } = await novaPagina(amb, v1);
  await pagina.goto(amb.url);
  await pagina.click('[data-act="go"][data-to="perfil"]');
  const [download] = await Promise.all([pagina.waitForEvent('download'), pagina.click('[data-act="export"]')]);
  const conteudo = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'));
  assert.equal(conteudo.app, 'clarea');
  assert.equal(conteudo.versao_modelo, 2);
  assert.equal(conteudo.assuntos.length, 2);
  assert.equal(conteudo.config.name, 'Teste');
  await contexto.close();

  const nova = await novaPagina(amb);
  await nova.pagina.goto(amb.url);
  await nova.pagina.waitForSelector('#file-in', { state: 'attached' });
  await nova.pagina.setInputFiles('#file-in', { name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(conteudo)) });
  await nova.pagina.waitForSelector('text=Aguardando o banco', { timeout: 4000 });
  const a = await lerAssuntos(nova.pagina);
  assert.deepEqual(a.map((x) => x.id), conteudo.assuntos.map((x) => x.id));
  assert.deepEqual([por(a, 'Aguardando o banco').status, por(a, 'Aguardando o banco').focus], ['waiting', true]);
  await nova.pagina.reload();
  assert.equal((await lerAssuntos(nova.pagina)).length, 2, 'continua lá depois de recarregar');
  assert.deepEqual(nova.pagina.errosJs, []);
  await nova.contexto.close();
});

const v2Base = () => ({
  app: 'clarea', formato: 'clarea', versao_modelo: 2, config: { name: 'X', hora: '18:00', dias: [true, true, true, true, true, false, false], atrapalha: [], lembrete: false, theme: 'light', onboarded: true, welcomed: true, tips: {}, lastBackup: '', lastNotified: '' },
  pessoas: [{ id: 'p1', name: 'Ana', created_at: '2026-11-10T12:00:00.000Z', archived_at: null }], temas: [], tarefas: [], eventos: [], migracao: null,
  assuntos: [{ id: 'a1', original_text: 'Item bom', text: 'Item bom', created_at: '2026-11-10T12:00:00.000Z', updated_at: '2026-11-10T12:00:00.000Z', created_day: '2026-11-10', completed_day: null, status: 'in_progress', next_action: 'do', person_id: 'p1', topic_id: null, due_at: null, reminder_at: null, resume_at: null, source: 'manual', confirmed_at: null, completed_at: null, archived_at: null, deleted_at: null, focus: true, ordem: 0, local_version: 1, server_version: null, legado: null }]
});
async function importarV2(copia) {
  const p = await novaPagina(amb);
  await p.pagina.goto(amb.url);
  await p.pagina.waitForSelector('#file-in', { state: 'attached' });
  await p.pagina.setInputFiles('#file-in', { name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(copia)) });
  await p.pagina.waitForTimeout(700);
  return p;
}

test('cópia no formato 2 válida é restaurada', async () => {
  const { contexto, pagina } = await importarV2(v2Base());
  assert.ok(await pagina.locator('text=Item bom').count() >= 1);
  await contexto.close();
});

const ADULTERADAS = {
  'estado inexistente': (c) => { c.assuntos[0].status = 'hackeado'; },
  'pessoa que não existe': (c) => { c.assuntos[0].person_id = 'fantasma'; },
  'id com código': (c) => { c.assuntos[0].id = 'a"><img src=x onerror="window.__m=1">'; },
  'datas inválidas': (c) => { c.assuntos[0].created_day = 'ontem'; },
  'assuntos que não é lista': (c) => { c.assuntos = { 0: 'x' }; }
};
for (const [nome, mexer] of Object.entries(ADULTERADAS)) {
  test(`cópia no formato 2 adulterada (${nome}) é recusada e não muda nada`, async () => {
    const c = v2Base(); mexer(c);
    const { contexto, pagina } = await importarV2(c);
    assert.ok((await pagina.evaluate(() => document.body.innerText)).includes('não parece ser uma cópia'));
    assert.equal(await lerAssuntos(pagina), null);
    assert.equal(await pagina.evaluate(() => window.__m === 1), false);
    await contexto.close();
  });
}

test('texto com HTML em cópia no formato 2 aparece como texto e não executa', async () => {
  const c = v2Base(); c.assuntos[0].text = '<img src=x onerror="window.__m=1">'; c.assuntos[0].original_text = c.assuntos[0].text; c.pessoas[0].name = '<b onmouseover="window.__m=1">Ana</b>';
  const { contexto, pagina } = await importarV2(c);
  await pagina.waitForTimeout(300);
  assert.equal(await pagina.evaluate(() => window.__m === 1), false);
  assert.equal(await pagina.locator('img[src="x"]').count(), 0);
  await contexto.close();
});

test('Apagar tudo limpa o banco novo e o banco antigo', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Vai embora', { focus: true })]));
  await pagina.goto(amb.url);
  assert.equal((await lerAssuntos(pagina)).length, 1);
  await pagina.click('[data-act="go"][data-to="perfil"]');
  await pagina.click('[data-act="reset"]');
  await pagina.click('[data-act="reset-ok"]');
  await pagina.waitForSelector('text=Tudo apagado');
  await pagina.waitForTimeout(400);
  assert.equal(await lerAssuntos(pagina), null, 'sem assuntos no banco novo');
  assert.equal(await abrirAntigo(pagina), null, 'sem estado no banco antigo');
  await pagina.reload();
  assert.equal(await pagina.locator('text=Vai embora').count(), 0, 'nada volta ao recarregar');
  await contexto.close();
});

test('se o banco novo não abrir, o app usa os dados antigos em memória e avisa', async () => {
  const { contexto, pagina } = await novaPagina(amb, estadoBase([assunto('Segue visível', { focus: true })]));
  await pagina.addInitScript(() => {
    const abrir = indexedDB.open.bind(indexedDB);
    indexedDB.open = (nome, ...r) => { if (nome === 'clarea-v2') throw new Error('sem banco'); return abrir(nome, ...r); };
  });
  await pagina.goto(amb.url);
  assert.ok(await pagina.locator('text=Segue visível').count() >= 1);
  await pagina.click('.act.good');
  assert.match(await pagina.textContent('#toast'), /Desfazer|Não consegui guardar/);
  assert.deepEqual(pagina.errosJs, []);
  await contexto.close();
});
