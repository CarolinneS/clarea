# vendor/

Bibliotecas de terceiros guardadas dentro do repositório, para o app funcionar offline e sem pedir nada a servidores externos (D-007).

## dexie.mjs

- **Biblioteca:** Dexie.js, um envoltório para o IndexedDB.
- **Versão:** 4.4.7 (cabeçalho do arquivo: "Mon Oct 19 2026").
- **Origem:** arquivo `dist/dexie.mjs` do pacote oficial `dexie` (npm), obtido por https://unpkg.com/dexie@4/dist/dexie.mjs.
- **Licença:** Apache-2.0 (`LICENSE-dexie.txt`).
- **Integridade:** a soma SHA-256 está em `SHA256SUMS`. Um teste automático falha se o arquivo mudar.

### Como atualizar
1. Baixe a nova versão oficial e substitua `dexie.mjs`.
2. Atualize `SHA256SUMS`, a versão acima e o teste de versão em `tests/unit/vendor.test.mjs`.
3. Rode os testes e faça um pull request.

Não edite o arquivo à mão.
