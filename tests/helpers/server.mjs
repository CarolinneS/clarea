// Servidor estático mínimo para os testes, sem dependências.
// Uso direto: `npm run serve` e abrir http://localhost:8080
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.md': 'text/markdown; charset=utf-8'
};

export function iniciarServidor(porta = 0) {
  const servidor = createServer(async (req, res) => {
    try {
      const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let arquivo = normalize(join(RAIZ, caminho));
      if (!arquivo.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
      if ((await stat(arquivo).catch(() => null))?.isDirectory()) arquivo = join(arquivo, 'index.html');
      const corpo = await readFile(arquivo);
      res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(corpo);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
    }
  });
  return new Promise((ok) => servidor.listen(porta, '127.0.0.1', () => {
    ok({ url: `http://127.0.0.1:${servidor.address().port}/`, fechar: () => new Promise((f) => servidor.close(f)) });
  }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { url } = await iniciarServidor(Number(process.env.PORT) || 8080);
  console.log(`Clarea em ${url}`);
}
