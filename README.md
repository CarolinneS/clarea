# Clarea · versão 1.0 (MVP)

> Escreva como pensa. O Clarea organiza no fim do dia.

App de gestão de atividades para profissionais com TDAH. Funciona no navegador, pode ser instalado na tela inicial do celular e usado sem internet. Os dados ficam só no aparelho de quem usa.

## O que tem nesta pasta

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | O app inteiro: telas, regras e visual |
| `manifest.webmanifest` | Nome, cores e ícones para instalar como app |
| `sw.js` | Guarda o app no aparelho para funcionar sem internet |
| `icons/` | Ícones do app |
| `fonts/` | Fonte Atkinson Hyperlegible (você coloca os arquivos, veja o passo 1) |

## Passo 1 · Colocar a fonte (opcional, recomendado)

1. Abra https://fonts.google.com/specimen/Atkinson+Hyperlegible e clique em **Get font** e depois em **Download all**.
2. Abra o arquivo baixado (.zip) e procure os arquivos `AtkinsonHyperlegible-Regular.ttf` e `AtkinsonHyperlegible-Bold.ttf` (podem estar na raiz do .zip ou numa pasta `static`).
3. Copie os dois para a pasta `fonts/` deste projeto, sem mudar os nomes.

Sem esses arquivos, o app funciona normalmente com a fonte do sistema.

## Passo 2 · Testar no computador

O modo sem internet e a instalação só funcionam com o app servido por um endereço `http://localhost` ou `https://`. Para testar:

- **Com Python:** abra o terminal na pasta do projeto e rode `python -m http.server 8000`. Depois abra http://localhost:8000 no navegador.
- **Com VS Code:** instale a extensão **Live Server**, clique com o botão direito no `index.html` e escolha **Open with Live Server**.

Abrir o `index.html` com dois cliques também funciona para olhar as telas, mas sem modo offline nem instalação.

## Passo 3 · Publicar no GitHub Pages (grátis)

1. No GitHub, abra o repositório do Clarea (ou crie um novo, público, chamado `clarea`).
2. Envie todos os arquivos desta pasta para a raiz do repositório, mantendo as pastas `icons/` e `fonts/`.
3. Vá em **Settings › Pages**. Em **Build and deployment**, escolha **Deploy from a branch**, a branch `main` e a pasta `/ (root)`. Clique em **Save**.
4. Em 1 ou 2 minutos, o endereço aparece no topo da mesma página, no formato `https://SEU-USUARIO.github.io/clarea/`.

Mensagem de commit sugerida:

```
feat: MVP do Clarea como app instalável (Anotar, Clarear o dia, Hoje)
```

## Passo 4 · Instalar no celular

- **Android (Chrome):** abra o endereço, toque no menu **⋮** e em **Instalar app** (ou **Adicionar à tela inicial**). Segurando o ícone instalado, aparece o atalho **Anotar**.
- **iPhone (Safari):** abra o endereço, toque em **Compartilhar** e em **Adicionar à Tela de Início**. No iPhone, as notificações só funcionam com o app instalado assim (iOS 16.4 ou mais novo).

## Como publicar uma atualização

1. Altere os arquivos.
2. Em `sw.js`, aumente a versão na primeira linha útil: `clarea-v1` vira `clarea-v2`.
3. Envie para o GitHub. Quem já tem o app instalado recebe a versão nova ao abrir o app (às vezes é preciso fechar e abrir de novo).

## Limites desta versão

- **Dados só no aparelho.** Trocar de celular ou limpar os dados do navegador apaga tudo. Use **Perfil › Salvar uma cópia** de vez em quando.
- **Lembrete do Clarear o dia** só chega com o app aberto ou usado há pouco tempo. O lembrete garantido (push) entra com o servidor, na Fase 3.
- **Sem login, IA, voz ou integrações.** Ficam para as próximas fases, como está no mapa de funcionalidades.

## Testes automáticos

Os testes só servem para quem desenvolve; não fazem parte do app publicado.

- **No GitHub:** a cada envio e a cada pull request, a aba **Actions** roda os testes sozinha.
- **No computador** (precisa do Node 22 ou mais novo): `npm install`, depois `npx playwright install chromium` e `npm test`.

Testes marcados como **TODO** são problemas já conhecidos, ligados à etapa que vai corrigi-los (por exemplo, `S0.3`). Eles aparecem na lista, mas não bloqueiam. Quando a correção entra, a marca `todo` é removida do teste, e ele passa a bloquear caso o problema volte.
