// Prepara a pasta `www/` que o Capacitor empacota no app Android.
// O Clarea não tem etapa de build (D-006): aqui só se COPIAM os arquivos que o app publicado usa.
// Uso: node scripts/preparar-www.mjs [pasta-de-saída]   (padrão: www)
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ARQUIVOS = ['index.html', 'sw.js', 'manifest.webmanifest', 'icons', 'fonts', 'src', 'vendor'];

export const MARCA = 'versão ${VERSAO}</p>';

// `build` (opcional) identifica o APK na tela Perfil, para saber exatamente qual versão está instalada.
export function prepararWww(saida = join(raiz, 'www'), build = process.env.APK_BUILD) {
  rmSync(saida, { recursive: true, force: true });
  mkdirSync(saida, { recursive: true });
  for (const item of ARQUIVOS) {
    const origem = join(raiz, item);
    if (!existsSync(origem)) throw new Error(`Arquivo do app não encontrado: ${item}`);
    cpSync(origem, join(saida, item), { recursive: true });
  }
  if (build) {
    const arq = join(saida, 'index.html');
    const html = readFileSync(arq, 'utf8');
    if (!html.includes(MARCA)) throw new Error('Rodapé de versão não encontrado em index.html');
    writeFileSync(arq, html.replace(MARCA, `versão \${VERSAO} · APK #${build}</p>`));
  }
  return saida;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const saida = prepararWww(process.argv[2] ? resolve(process.argv[2]) : undefined);
  console.log(`Pasta pronta: ${saida}`);
}
