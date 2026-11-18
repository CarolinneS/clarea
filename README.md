# Clarea · versão 1.0.15

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
2. Aumente a versão nos **três** lugares, sempre com o mesmo número: `VERSAO` no `index.html`, `version` no `package.json` e `VERSAO` no `sw.js` (como `clarea-1.0.15`). Um teste automático avisa se algum ficar diferente.
3. Envie para o GitHub. Quem já tem o app instalado recebe a versão nova ao abrir o app (às vezes é preciso fechar e abrir de novo).

## O que mudou na 1.0.15

- **"Pular este" agora deixa o assunto para depois.** Antes ele tirava o assunto da caixa de entrada e o contava como organizado, sem nenhuma classificação. Agora ele continua como anotação nova, **não** conta como organizado, aparece no resumo como "ficou para depois" e volta no próximo "Clarear o dia". **Desfazer anterior** também funciona depois de pular.
- Sem mudança de dados nem de backup.

## O que mudou na 1.0.14

- **Listas longas mostram 50 por vez**, com o botão **Mostrar mais** (Histórico, "Ver anotações" no Hoje, a lista de Anotar e "Seguindo de dias anteriores"). Em Anotar aparecem as 50 mais novas, e "Mostrar anotações mais antigas" traz as outras.
- **Busca melhorada** (agora em `src/busca.js`, testada separadamente): ignora maiúsculas e acentos, aceita **várias palavras em qualquer ordem** (por exemplo "contrato marina"), acha também pelo texto original, pela pessoa, pelo tema e pelo tipo, e mostra a quantidade de resultados. Os resultados vêm do mais recente para o mais antigo.
- Sem mudança de dados nem de backup.

## O que mudou na 1.0.13

- **"Apagar todos os dados deste aparelho" agora pede uma confirmação clara.** O primeiro toque abre um cartão que diz quantos assuntos serão apagados e que **não dá para desfazer**, com três botões: **Salvar uma cópia primeiro**, **Apagar tudo** e **Cancelar**. Sair da tela também cancela.
- Ao restaurar uma cópia, o aviso diz quantos assuntos do aparelho serão substituídos.
- Apagar uma anotação continua imediato, com **Desfazer** por 8 segundos.

## O que mudou na 1.0.12

- **Anotações com várias linhas.** O campo de Anotar (e o de editar) agora cresce conforme você escreve. Colar um texto com várias linhas guarda tudo **como um único assunto**, com as quebras de linha. Nas listas o texto mostra até 4 linhas; ao tocar, abre inteiro.
- **Enter:** no computador, Enter guarda e Shift+Enter quebra a linha. No celular, Enter quebra a linha e o botão de enviar guarda.
- **Limite de 10.000 caracteres por anotação.** Acima disso o app avisa, não grava e **não corta** o texto.
- Resumos copiados (pauta e resumo da semana) continuam com uma linha por assunto: as quebras viram espaço.
- Correção só de teste: um teste do Hoje usava a data em UTC e falhava depois das 21h no Brasil.

## O que mudou na 1.0.11

- **Pessoa só aparece quando o texto cita alguém.** No "Clarear o dia" e na edição do assunto, o bloco Pessoa some se a anotação não mencionar ninguém (por exemplo "Estudar capítulo 3 de Biologia"). Se citar, ele vem já sugerido para você confirmar ou corrigir.
- A detecção ficou mais rígida: vale `@nome`, pessoa já cadastrada, título (Dr, Dra, Prof...), "com Nome" e verbos de contato ("ligar, avisar, cobrar, enviar... para Nome"). Palavras como "de Biologia", "para Prova" ou "a Conta" deixaram de virar pessoa. Para ligar uma pessoa que o app não reconheceu, escreva `@nome` na anotação.
- "Por pessoa" (Hoje), "por pessoa" (Resumo) e "Pessoas" (Perfil) só aparecem quando existe pelo menos uma pessoa. Sem pessoas, o Perfil mostra só "Temas".

## O que mudou na 1.0.10

- No Hoje, as anotações para clarear voltaram a aparecer só como quantidade ("Você tem N anotações para clarear"), com o botão Clarear o dia. A opção **Ver anotações** abre a lista, com editar e apagar, e **Ocultar anotações** fecha.

## O que mudou na 1.0.9

- No Hoje, um cartão com as anotações para clarear (na 1.0.10 ele passou a vir recolhido).
- O texto que você digita em Anotar e não salva fica guardado no aparelho e volta ao reabrir o app. Some ao salvar e em "Apagar tudo".
- A tela Anotar ganhou o botão Voltar, que leva ao Hoje.
- "Dia claro" passou a "Dia clareado".

## O que mudou na 1.0.8

- O app passou a usar o modelo de dados 2.0 (D-012). Na primeira abertura, os dados da versão anterior são trazidos uma única vez para o banco novo (`clarea-v2`); o banco antigo não é alterado.
- Cada ação (anotar, resolver, amanhã, deixar pra lá, foco, editar, apagar, juntar pessoas e temas) grava só o registro afetado. Duas abas ou aparelhos em uso não se sobrescrevem.
- **Saiu o "Virar tarefa" e a seção Tarefas** (D-009). Tarefas antigas aparecem como assuntos Em andamento com ação Fazer.
- A cópia de segurança agora sai no formato 2. Ainda é possível restaurar cópias antigas (formato 1).
- "Apagar tudo" apaga o banco novo e o antigo.
- Se o banco novo não abrir, o app mostra os dados antigos em memória e avisa para salvar uma cópia.

## O que mudou na 1.0.7

- Sem mudança visível. Entraram os casos de uso do modelo 2.0 (`src/casos.js`: anotar, organizar, resolver, adiar, deixar pra lá, foco, apagar, renomear/juntar pessoa e tema, desfazer), identificadores UUID (`src/id.js`), os campos de dia local (`created_day`, `completed_day`) e a gravação por mudança no armazenamento (banco `clarea-v2` passa à versão 2, com atualização testada). Ainda **não estão ligados ao app**: a ligação é a E1.4b (D-012).

## O que mudou na 1.0.6

- Sem mudança visível. Entrou a biblioteca Dexie 4.4.7 (pasta `vendor/`, guardada no repositório, sem CDN) e o módulo de armazenamento do modelo 2.0 (`src/armazenamento.js`), com a importação única dos dados 1.0 e cópia automática deles antes de migrar. Ainda **não estão ligados ao app**: o app continua usando o armazenamento antigo até a E1.4.

## O que mudou na 1.0.5

- Sem mudança visível. Foram criados o modelo de dados 2.0 (`src/modelo.js`) e a migração do formato 1.0 (`src/migracao.js`), com as regras das decisões D-009 e D-010. Ainda **não estão ligados ao app**: ficam só testados, com cópias de segurança fictícias (`tests/fixtures/backups/`), até a E1.3.

## O que mudou na 1.0.4

- Sem mudança visível. As regras (datas, sugestões, foco, progresso e textos prontos) saíram do `index.html` para a pasta `src/`, onde são testadas isoladamente (E1.1). O app precisa ser aberto por um endereço (como o do GitHub Pages), não direto pelo arquivo.

## O que mudou na 1.0.3

- Tela Hoje mais leve (Opção C): cartão de progresso compacto com o anel sempre visível, "Foco de hoje" como título, letras um pouco menores, sem bolha de pessoa nos assuntos e dica discreta no fim da tela.
- "Editar" aparece só dentro do assunto aberto. "Virar tarefa" continua disponível, como link discreto.

## O que mudou na 1.0.2

- A fonte Atkinson Hyperlegible, feita para leitura fácil, passa a fazer parte do app (a pasta `fonts/` não tinha sido enviada, e o app usava uma fonte padrão do celular). Licença livre (SIL OFL), em `fonts/OFL.txt`.

## O que mudou na 1.0.1 (estabilização)

- O app abre e instala sem internet, com ícones próprios (antes, os ícones não existiam).
- Cada anotação é gravada na hora; fechar o app logo depois não perde nada.
- Duas abas abertas se atualizam sozinhas, sem apagar o que está sendo digitado.
- O texto digitado não some ao tocar em tipo, pessoa ou tema, nem ao sair do app e voltar.
- Cópias de segurança são conferidas antes de restaurar e não executam código.
- Apagar uma anotação e limpar tarefas concluídas têm **Desfazer** (8 segundos).

## Limites desta versão

- **Dados só no aparelho.** Trocar de celular ou limpar os dados do navegador apaga tudo. Use **Perfil › Salvar uma cópia** de vez em quando.
- **Lembrete do Clarear o dia** só chega com o app aberto ou usado há pouco tempo. O lembrete garantido (push) entra com o servidor, na Fase 3.
- **Sem login, IA, voz ou integrações.** Ficam para as próximas fases, como está no mapa de funcionalidades.

## Testes automáticos

Os testes só servem para quem desenvolve; não fazem parte do app publicado.

- **No GitHub:** a cada envio e a cada pull request, a aba **Actions** roda os testes sozinha.
- **No computador** (precisa do Node 22 ou mais novo): `npm install`, depois `npx playwright install chromium` e `npm test`.

Testes marcados como **TODO** são problemas já conhecidos, ligados à etapa que vai corrigi-los (por exemplo, `E4`). Eles aparecem na lista, mas não bloqueiam. Quando a correção entra, a marca `todo` é removida do teste, e ele passa a bloquear caso o problema volte.
