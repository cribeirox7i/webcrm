# WEBCRM - Status do Projeto

> Documento de retomada. Última atualização: **2026-08-31** - **Importar Consumo** novo (Admin >
> Financeiro, botão ao lado de Importar Carteira): sobe um GRUPO de arquivos xlsx/csv no mesmo
> layout (`ID_Produto;CNPJ;Data;quantidade;Detalhamento`) e faz três coisas juntas pro mês
> escolhido -- grava em `consumo_ana` (ID_Produto é direto o `produto_id`, CNPJ casa por
> normalização igual carteira), duplica TODAS as linhas de `precos_cliente` do mês mais recente
> que já tem preço pro mês novo, e cria uma linha-âncora de `faturamento` por cliente distinto
> que apareceu no consumo (os valores de faturamento continuam calculados ao vivo pela view
> `faturamento_detalhe`, nada novo armazenado ali). Reimportar o mesmo mês substitui as 3 tabelas
> inteiras. CNPJ/ID_Produto sem match ficam de fora, **agrupados** (não linha a linha -- um CNPJ
> se repete em centenas de linhas nesse arquivo) num relatório de simulação, com dropdown pra
> corrigir antes de confirmar. **Achado e corrigido durante o teste**: o parser de CSV, testado
> fora do navegador com decode `latin1` (só pra debugar), quebrou com um BOM UTF-8 no início do
> arquivo real (`consumo_analitico_PEP.csv`) -- confirmado que `File.text()` do navegador já tira
> o BOM sozinho (testado replicando o decode real via `TextDecoder`), mas um `startsWith("﻿")`
> defensivo foi adicionado mesmo assim, sem custo. `formatDate` (`FaturamentoMesPage.tsx`) também
> corrigido -- quebrava se `consumo_data` viesse com hora (a importação nova grava com hora, ex.
> "2026-07-27 15:52:48"). Ver "Leva Importar Consumo (consumo_ana + precos_cliente + faturamento)"
> no fim do arquivo. **Não testado contra o Postgres de produção nem no navegador** -- sem
> `DATABASE_URL` local, por política do projeto.
>
> Contexto anterior: 2026-08-31 - importação de carteira ganhou um
> segundo arquivo opcional (`.txt`/`.csv` com nome do arquivo + link/id do Google Drive, exportado
> à mão pelo usuário, sem integração com a API do Drive) pra preencher `cart_url_plan_analitica`
> (URL do botão "Planilha") durante a importação -- até aqui só jan-jun/2026 tinham essa URL,
> preenchida manualmente na migração inicial; jul/2026 ficou sem, e é o próximo mês a reimportar
> com o novo arquivo. Casamento por nome exato de arquivo; linha sem planilha correspondente na
> lista não trava a importação, só aparece num aviso antes de confirmar. **Achado e corrigido no
> meio do teste**: a fórmula do nome de arquivo (JS e a coluna gerada do banco) usava o campo
> errado (`cart_prod` em vez de `cart_db`) -- corrigida nos dois lados; falta rodar
> `backend/scripts/sql-2026-08-31-cart-nome-plan/02_corrigir_formula.sql` em produção antes de
> reimportar julho/2026 de verdade. **Verificado por `tsc --noEmit` (os dois lados) e teste de
> unidade da fórmula de nome de arquivo; não testado contra o Postgres de produção nem no
> navegador** (sem `DATABASE_URL` local, por política do projeto). Ver "Leva Link da planilha
> analítica na importação de carteira" no fim do arquivo.
>
> Contexto anterior: 2026-08-28 - (1) tela de **Índices** econômicos:
> submenu Financeiro > Índices (listagem + CRUD manual, lê a view `indices_calculados`) e aba
> Índices no Admin com botão "Atualizar (Banco Central)" que puxa IPCA/INPC/IGP-M/CDI/salário
> mínimo da API pública do BCB/SGS. Nomes padronizados: `IGMP`->`IGP-M`, `SALÁRIO`->`SALÁRIO
> MÍNIMO`. (2) campo `precos_cliente.pc_dat_ult_reajuste` (última data de reajuste) na grid +
> form da Tabela de Preços, com backfill do mês 07/2026. **Os 5 SQL de produção já foram
> aplicados no Supabase (2026-08-28): padronização OK, coluna criada, backfill = 1526 linhas
> `2026-05-05` + 847 `2026-07-05` (resto NULL), zero divergências. Falta só: `git push` no `main`
> (deploy Vercel), liberar o menu `indices` por usuário no Admin, e rodar Admin > Índices >
> "Atualizar agora".** Ver "Leva Tela de Índices + pc_dat_ult_reajuste" no fim do arquivo.
>
> Contexto anterior: 2026-08-27 - grid de Produtos trocou a coluna/
> filtro Área pela coluna Detalhe (`produto_detalhe`, ex. "BV PJ", "BV PJ PLUS") -- só a listagem,
> o campo Área continua no formulário de cadastro. Ver "Leva Ajuste na grid de Produtos" no fim do
> arquivo.
>
> Contexto anterior: 2026-08-27, cards de contagem (`StatCards`) no
> topo das telas de listagem ganharam interatividade: clicar num card filtra a grid abaixo por
> aquele valor (ex.: "Ativos" mostra só clientes ativos), clicar de novo desliga o filtro, e
> "Total" limpa. Aplicado em 8 telas que já tinham um filtro de dropdown correspondente ao campo
> do card (Clientes, Contatos, Pessoas, Servidores, URLs, Portfólio Completo, Admin > Carteira,
> Admin > Usuários) - o resto ficou de fora de propósito (cards de 1 só, ou cards que não são
> contagem de linha, ex. somas em dinheiro). Ver "Leva Cards de StatCards Clicáveis" no fim do
> arquivo pro critério completo e a lista do que não entrou.
>
> Contexto anterior: 2026-08-27, o resize manual de coluna (existe desde 2026-08-07) estava sendo
> anulado pelo mecanismo de "nunca rolar" adicionado em 2026-08-25: arrastar a borda de uma coluna
> competia com o auto-encolhimento a cada pixel, cancelando o gesto do usuário quase por inteiro.
> Corrigido: a partir do primeiro resize manual, o `DataGrid` para de forçar o encaixe automático
> (encolher/esticar) e passa a usar os tamanhos naturais -- pode passar da largura disponível, e
> aí a rolagem lateral volta a aparecer de propósito. O comportamento de abertura de tela (nunca
> rolar no estado original) continua igual. Ver "Leva Resize de Coluna vs. Auto-fit" no fim do
> arquivo.
>
> Contexto anterior a esse: 2026-08-26, 3 mudanças pedidas numa mensagem só (ver "Leva Cronograma,
> Modais Fixos e Dúvida de Segurança" no fim do arquivo): atividade tipo A do Cronograma parou de
> exigir Início/Término/% Atual (já eram ignorados pela view, o formulário que estava errado);
> todo modal do app principal parou de fechar ao clicar fora (generalizando o que o Admin já
> tinha); e uma dúvida do usuário sobre senha visível no DevTools, respondida (é normal, não é
> vulnerabilidade). Já commitado e enviado ao `main` (`2d16899`).
>
> **Pergunta sobre `port_fim` respondida (2026-08-26): manter `crono_replan` no cálculo.**
> Confirmado pelo usuário - a view `portfolios_progresso.port_fim` fica exatamente como está
> (`MAX` entre `crono_fim` e `crono_replan`, o que for mais tarde). Nenhuma mudança de código.
>
> Contexto anterior a esse: **piloto de responsividade mobile** (só a tela de Clientes, ver "Leva
> Responsividade Mobile - Piloto" no fim do arquivo, commit `478ff7b`).
>
> Contexto anterior a esse: auditoria de segurança #2
> (checklist de 22 itens), com um achado **crítico** corrigido: `usuario_sessoes` exposta pelo
> roteador genérico deixava qualquer usuário autenticado ler o token de sessão de todos os
> outros. Ver "Leva Auditoria de Segurança #2" no fim do arquivo.
>
> **Estado no fim da leva**: as 4 CHECK constraints de valor não-negativo estão **aplicadas e
> validadas em produção** (confirmado pela PARTE 0 do script, `convalidated = true` nas 4) - e como
> o `VALIDATE CONSTRAINT` varre a tabela inteira e passou, está **provado que o dado real de
> produção não tem valor negativo** nas colunas cobertas. As correções de código também **já estão
> em produção**: o push no `main` disparou deploy automático nos dois projetos Vercel, e os headers
> novos foram conferidos por `curl` nos dois domínios (`webcrm-mu.vercel.app` e
> `crmevertec.vercel.app`).
>
> **Nada pendente de decisão**: a linha de carteira sem cliente vinculado (`cart_id` 1980,
> R$ 111.062,52, `escfacil_webesc`) fica **como está**, por decisão do usuário - não excluir nem
> vincular. As constraints não afetam essa linha (CHECK passa com NULL).
>
> **Atenção**: as levas de 2026-08-16, 08-17 e 08-24 (Importação de Carteira, card Carteira no
> dashboard, modal de subgrid expandida, automação da data de bloqueio, campos novos de URL,
> colunas Responsável/Ambiente, DataGrid esticando colunas) **não estão registradas aqui** -
> conferir `git log` entre `3ca76dc` e `3aa51a6` se precisar do detalhe.

> Contexto anterior: 2026-08-14 (leva longa pós-migração pra
> Vercel/Supabase: favicon, correção de formatação numérica, sessão do Admin caindo em
> requisições paralelas, renomeação dos projetos Vercel, herdar permissões, migração de
> storage GCS→Supabase, otimização de cold start, CSV Protheus, bug crítico de botões mortos
> no DataGrid, máscara/obrigatoriedade de CNPJ, tela de Grupos Econômicos, recuperação de
> anexos perdidos e a funcionalidade de Importação de Carteira - ver "Leva Ajustes pós-migração:
> logo, storage, performance e importação de carteira" no fim do arquivo).

> Ainda existe uma seção "Funcionalidades no código não documentadas neste arquivo" mais abaixo,
> registrada em 2026-08-11 - cobre achados de sessões anteriores a essa data, não revisada de
> novo nesta leva.

## Resumo rápido pra retomar a sessão

**Pra rodar local**: backend precisa de `ADMIN_PIN` (mín. 6 caracteres) e `PORT=3101` no ambiente antes de `npm run dev` (senão sobe na porta 3000 padrão e o frontend, fixo em `VITE_API_URL=http://localhost:3101`, não encontra a API - ver `frontend/.env.development`). Sem `ADMIN_PIN`, gera um PIN aleatório novo a cada boot (log do backend mostra qual). Frontend agora tem porta **fixa em 5183** (`vite.config.ts`, `server.port: 5183, strictPort: true`) - antes "flutuava" pra qualquer porta livre. Backend agora só aceita chamadas de origem `http://localhost:5183` por padrão (`CORS_ORIGINS`, ver leva de CORS) - se mudar a porta do frontend em dev, precisa atualizar essa env var também.

**⚠️ Ao terminar de trabalhar, sempre encerrar os terminais do `npm run dev` (Ctrl+C), nunca só fechar a janela.** Acumular processos zumbis do backend foi a causa real de um "travamento" reportado numa sessão anterior (~22 processos `node` de sessões antigas nunca finalizados, todos disputando a porta 3101 e o arquivo SQLite ao mesmo tempo) - não era bug de código. **Voltou a acontecer em 2026-08-11** (5 processos acumulados no mesmo dia): dessa vez o efeito foi o backend **cair sozinho** ao reiniciar durante uma edição de arquivo, com a porta 3101 ficando sem nenhum listener. Se a API "sumir" do nada, conferir processos `node` do WebCRM antes de procurar bug no código.

**O app principal agora exige login** (e-mail + senha, sessão de 5 dias) e **esconde menu por permissão na Sidebar** - ver "Leva Login e Controle de Acesso" e "Leva CORS e Permissão por Menu" no fim do arquivo. Sem `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` configurados, o convite por e-mail não sai de verdade - o link fica só logado no console do backend e devolvido na resposta da API (o botão "Enviar E-mail" no Admin mostra o link num `alert()` nesse caso, pra copiar manualmente).

**Permissão por menu - hoje cobre leitura E escrita na API, não só a Sidebar** (corrigido em 2026-08-11, ver "Leva Auditoria de Segurança"): `enforceMenuPermission`/`bloqueado` (`backend/src/permissaoResource.ts`) checam `perm_leitura`/`perm_insercao`/`perm_edicao`/`perm_exclusao` em `GET/POST/PUT/DELETE` de `resource.ts` e nas rotas dedicadas de anexo. **Mas só pros recursos listados em `MENU_BY_RESOURCE`** (`clientes`, `contatos`, `propostas`, `urls`, `servidores`, `produtos`, `pessoas`, `fornecedores`, `forn_contratos`, `forn_pagadoria`, `anexos`, `precos_cliente`, `carteira`, `faturamento`, `portfolios`, `crono`) - recursos fora desse mapa (views, `list_*`, `cart_mes`, `indices_economicos`, `escala`, `resp`, `consumo_ana` etc.) continuam **sem checagem nenhuma** pra qualquer sessão de usuário válida. Isso é comportamento antigo, não uma regressão desta leva - só nunca tinha sido confirmado por auditoria até agora.

**⚠️ Login não diferencia maiúscula/minúscula no e-mail (desde 2026-08-11)**: a busca usa `COLLATE NOCASE`. Antes disso, digitar o e-mail com outra caixa devolvia o mesmo `"e-mail ou senha inválidos"` de senha errada - bug real que passou por "a senha não está sendo salva". Ver "Leva Bug: login case-sensitive no e-mail". Consequência a lembrar: **o `UNIQUE` de `user_mail` no SQLite continua case-sensitive**, então a guarda contra e-mail duplicado em caixa diferente vive no código (`POST /api/usuarios`), não no banco - um `INSERT` feito direto no SQLite (script de migração, por exemplo) fura essa proteção.

**Rate limiting nos logins (desde 2026-08-11)**: `POST /api/auth/login`, `POST /api/admin/login` e `POST /api/auth/esqueci-senha` agora limitam a **10 tentativas / 15 min por IP** (`backend/src/rateLimit.ts`, `express-rate-limit`), **cada rota com seu próprio contador** - não é um limite único compartilhado entre os três. Ver "Leva Auditoria de Segurança" pro porquê de serem independentes (achado real no meio da própria correção). Testando via `curl`/script em sequência, é fácil bater os 10 rapidinho - se um teste manual começar a devolver `429`, não é bug, é esperar a janela de 15 min ou reiniciar o backend (o contador é só em memória, zera no restart).

**Trocar a própria senha revoga as outras sessões (desde 2026-08-11)**: `POST /api/auth/trocar-senha` agora também `DELETE`a de `usuario_sessoes` qualquer sessão do usuário diferente da que fez a requisição. A sessão atual (a que trocou) continua válida - a pessoa não é deslogada na hora.

**Todas as telas do app principal já existem**: Clientes (+ dashboard do cliente + Contatos), URLs, Financeiro (Tabela de Preços / Carteira / Consumo / Faturamento, cada uma drill-in por mês a partir de `cart_mes`), Projetos (Portfólio Completo + drill-in Cronograma Detalhado, WBS completo com CRUD de atividade e PDF), Produtos, Servidores, Pessoas, Fornecedores. Admin (`/admin`, PIN separado, independente do login do app principal): Usuários (agora com senha/convite) + permissões por menu, Carteira (`cart_mes`).

**Design system registrado**: `DESIGN_SYSTEM.md` (raiz do projeto) - convenções de UI vivas (grid clicável, botões inline só-ícone com tooltip, paleta de cores, componentes reutilizáveis). Consultar antes de codar uma tela nova.

**Perguntas abertas / decisões sem confirmação explícita, revisar se necessário**:
1. Faturamento está como 4º botão irmão de Tabela de Preços/Carteira/Consumo em `FinanceiroPage.tsx` (o print antigo do usuário mostrava aninhado dentro de Consumo - nunca confirmado se era isso mesmo).
2. Botão "CSV Geral" (exportação em lote de todos os clientes) nunca implementado.
3. No ícone 📄 rápido da lista de Portfólio Completo, a extrapolação foi "gera o PDF do cronograma ali mesmo, sem precisar entrar no drill-in" - não confirmado explicitamente, só inferido do campo `port_pdf` existir como contador no schema.
4. Requisito de complexidade de senha ficou só em "mín. 8 caracteres" (backend e frontend) - sem exigir maiúscula/número/símbolo. Revisar se a política de senha da empresa exige mais que isso.
5. Backfill de permissões (leva de CORS/permissão) deu **acesso total** (todos os 9 menus, 4 flags) pros 12 usuários de teste existentes, pra ninguém ficar travado fora do app no dia em que isso foi ativado - é uma decisão minha, não pedida explicitamente; revisar/ajustar por usuário na tela de Permissões do Admin conforme o real controle de acesso desejado.
6. Título da tela de login: "WebCRM - Entrar" ficou em **19px**, não nos 24px pedidos pra label "Entrar" - o texto mais longo não cabe em 1 linha na largura do card e quebrava cortando o botão Login. Avisado ao usuário na hora; se 24px for requisito, precisa de outra solução (2 linhas de propósito ou texto mais curto). Ver "Leva Redesign da Tela de Login".
7. Tela de login, modo "Esqueci minha senha": o título virou **"Recuperar senha"** (18px) - texto encurtado por mim pra caber no card, não pedido pelo usuário.
8. Botão de login mantém `cursor: pointer` mesmo desabilitado (pedido explícito) - diverge do resto do app, onde `button:disabled` usa `cursor: not-allowed`. Só a tela de login tem essa exceção.
9. **4 pares de clientes com CNPJ duplicado no cadastro** (achado validando a importação de carteira): DHARTE SECURITIZADORA/AURA TECNOLOGIA, THP CAPITAL SECURITIZADORA/THP CAPITAL, CRX CREDITO/ORANGE EMPRESA SIMPLES, CREDISSIM/CREDITBEM SOLUCOES. Em cada par, um dos dois está com CNPJ errado no cadastro - não corrigido, só contornado na importação (heurística de nome mais parecido).
10. `clientes.cliente_tip_vlr` (regime de faturamento) ficou **opcional** por decisão do usuário, mesmo depois do CNPJ virar `NOT NULL` - 191 dos 601 clientes reais (32%) ainda sem esse campo preenchido.
11. Domínio antigo do frontend (`webcrm-wuah.vercel.app`) mantido como redirect pro novo (`crmevertec.vercel.app`), não removido - decisão consciente do usuário, evita link quebrado.
12. Modais fixos (não fecham ao clicar fora) só foram aplicados no Admin, a pedido explícito do usuário. Os modais do app principal (Clientes, URLs, Propostas etc.) continuam fechando ao clicar fora - se um dia pedirem o mesmo lá, são ~15 arquivos.

Detalhes completos de cada decisão/bug/teste, em ordem cronológica, a partir daqui ↓

## Tarefas rastreadas nesta sessão (lista de tasks não atravessa troca de sessão)

- [x] Scaffold Node.js/TypeScript Express backend
- [x] Build generic REST routes for tables and views
- [x] Smoke-test backend endpoints
- [x] Write Python import script (xlsx -> sqlite test data)
- [x] Run import and verify against backend

## Objetivo

Migrar o CRM hoje construído em Google AppSheet (com Google Sheets como banco) para uma aplicação própria, mantendo os volumes de dados atuais (abas com até ~200 mil linhas, telas que carregam 15-20 mil registros) sem gargalo, usando apenas ferramentas gratuitas.

## Arquitetura decidida

```
Navegador (cliente)
   |  HTTPS
   v
Firebase Hosting (frontend estático, free tier)
   |  API (fetch)
   v
Node.js + Express (TypeScript)  <-- VM Compute Engine e2-micro (free tier, sempre ligada)
   |  leitura/escrita
   v
SQLite (arquivo no disco da VM) <-- BANCO DEFINITIVO (não é mais cache do Sheets)
   |
   +-- sqlite-web (interface de DBA, acesso restrito, só você)
   +-- backup diário (.db) -> Cloud Storage
```

Decisões-chave:
- **SQLite é o banco definitivo**, não mais o Google Sheets (você é o único "DBA" hoje, ninguém mais edita a planilha diretamente - por isso valeu a pena abandonar o Sheets como fonte viva).
- **Linguagem do backend: Node.js/TypeScript** (mesma linguagem do Apps Script antigo, boa lib pra Sheets se precisar, hospedagem gratuita fácil).
- **Driver SQLite: `node:sqlite`** (nativo do Node 24, sem compilação - `better-sqlite3` foi tentado primeiro mas exige Visual Studio Build Tools que não estão instalados nesta máquina; `node:sqlite` resolveu sem fricção). Atenção: isso exige Node 22.5+ (idealmente Node 24) na VM de produção também.
- **Hospedagem**: Compute Engine `e2-micro` (free tier Google, sempre ligada, disco persistente) + Firebase Hosting pro frontend. Tudo na mesma conta/projeto Google Cloud (exige cartão cadastrado mesmo dentro do free tier - configurar alerta de orçamento).
- **Backup**: rotina própria (cron na VM copiando o `.db` pro Cloud Storage), já que abandonamos o backup automático do Google Sheets.
- **Admin do banco**: `sqlite-web` (interface web tipo planilha, rodando na mesma VM, acesso restrito).

## Arquivos já criados

Todos em `C:\Claude\WEBCRM\`:

| Arquivo | Conteúdo | Status |
|---|---|---|
| `schema.sql` | 27 tabelas (renomeações: `suites`→`produtos`, `server`→`servidores`, `index`→`indices_economicos`) | ✅ validado |
| `views.sql` | 9 views (agregações, self-joins, window functions que substituem fórmulas do Sheets) | ✅ validado |
| `triggers.sql` | Mantém `clientes.cliente_status` sincronizado a partir de `urls`/`servidores` | ✅ testado (9 cenários) |
| `backend/` | Projeto Node.js/TypeScript Express | ✅ rodando, testado com CRUD |
| `backend/src/db.ts` | Abre o SQLite, aplica schema/views/triggers automaticamente se o banco estiver vazio | ✅ |
| `backend/src/catalog.ts` | Introspecção do banco (`sqlite_master` + `PRAGMA table_info`) pra montar whitelist de tabelas/colunas/PK | ✅ |
| `backend/src/routes/resource.ts` | Rotas genéricas REST (GET lista paginada com filtro, GET por id, POST, PUT, DELETE) - tabelas com CRUD completo, views só leitura | ✅ testado |
| `backend/src/routes/meta.ts` | `GET /api/_meta` - lista recursos disponíveis | ✅ |

Testado manualmente: `POST/GET/PUT` em `clientes`, `GET` em view (`cliente_flags_resumo`), bloqueio de escrita em view (400), recurso inexistente (404).

## Migração de dados: onde paramos

**Importante**: a planilha `WEBCRM.xlsx` (produção real, ~14MB, baixada localmente em `C:\Users\carlos.anribeiro\Downloads\WEBCRM.xlsx`) **continua em produção e sendo alimentada**. A carga feita agora é **só massa de teste**, não a migração definitiva - quando for a hora do corte real, vamos precisar de um script de limpeza/carga mais cuidadoso (dados mais recentes, sem dados de teste misturados).

Script de importação: **[import_test_data.py](import_test_data.py)** (já salvo na raiz do projeto).

Ele lê o xlsx com `openpyxl` (`data_only=True`), mapeia cada aba pras colunas mantidas em `schema.sql` (descartando as que viraram VIEW/trigger/backend), limpa strings de erro do Sheets (`#NAME?`, `#REF!`, etc → NULL) e datas/horas → texto ISO, e insere na ordem certa de FK (`grupos_econ → clientes → produtos → servidores → ... → urls` [dispara os triggers] `→ pessoas` [FK off, hierarquia auto-referenciada] `→ ...`).

### Progresso da última execução ✅ completa

```
grupos_econ            <- grupos_econ            18 linhas
clientes               <- clientes               601 linhas
produtos               <- suites                  70 linhas
servidores             <- server                  56 linhas
list_resp_crono        <- list_resp_crono         10 linhas
list_tip_resp          <- list_tip_resp           24 linhas
list_url_status        <- list_url_status          4 linhas
usuarios               <- usuarios                12 linhas
usuarios_permissoes    <- usuarios                23 linhas
indices_economicos     <- index                  601 linhas
fornecedores           <- fornecedores            18 linhas
urls                   <- urls                  2429 linhas
pessoas                <- pessoas                300 linhas
ferias_marcacao        <- ferias_marcacao        359 linhas (1 linha-lixo ignorada)
contatos               <- contatos               500 linhas
cart_mes               <- cart_mes                19 linhas
precos_cliente         <- precos_cliente       22312 linhas
consumo_ana            <- consumo_ana         256329 linhas
faturamento            <- faturamento            340 linhas
carteira               <- carteira              5488 linhas
resp                   <- resp                   729 linhas
escala                 <- escala                  24 linhas
portfolios             <- port                    19 linhas
crono                  <- crono                  799 linhas
propostas              <- propostas                62 linhas
forn_contratos         <- forn_contratos          21 linhas
forn_pagadoria         <- forn_pagadoria         533 linhas
anexos                 <- anexos                  49 linhas

Total: 291.749 linhas em 26 tabelas
```

Banco de teste gerado: ~55 MB (`backend/data/webcrm.sqlite`). Endpoints testados manualmente contra esse volume (`consumo_ana` 256k linhas, `precos_cliente` 22k linhas): resposta paginada em ~9ms, sem gargalo.

### Modelo de `usuarios`: resolvido

A aba `usuarios` não é uma linha por pessoa - é uma linha por (pessoa, tabela que ela pode editar); o mesmo email se repete por `user_tabela`. Decisão tomada: **normalizar em duas tabelas**.

- `usuarios` (1 linha por pessoa, `user_mail` único: `user_id, user_nome, user_mail, user_pin, user_status`)
- `usuarios_permissoes` (N:N, `PRIMARY KEY (user_id, user_tabela)`: `user_id, user_tabela, user_acesso`)

Implementado em `schema.sql` + função dedicada `load_usuarios()` em `import_test_data.py` (dedup por email+tabela - a planilha tinha 2 linhas 100% duplicadas).

Efeito colateral encontrado e corrigido no mesmo passo: o loader genérico agora pula (e avisa) qualquer linha que fique com coluna `NOT NULL` vazia após a limpeza - achamos 1 linha-lixo em `ferias_marcacao` (id 0, datas na época do Excel 1900) que sem isso quebrava o import.

## Capacidade estimada (discutido, não implementado)

Projeção pra ~15 usuários / 1-1,5 milhão de linhas (baseada nos ~55 MB / 292 mil linhas medidos):

- Banco `.db` estimado: ~190-280 MB - folgado nos 30 GB de disco grátis da VM.
- SQLite/índices/RAM da e2-micro: sem gargalo esperado nesse volume.
- Egress de rede (1 GB/mês grátis, América do Norte → fora): mais apertado, mas deve caber - monitorar quando o uso real começar.
- **Risco real identificado**: backup diário do `.db` sem rotação estoura o free tier do Cloud Storage (~5 GB) em 2-3 semanas nesse tamanho de banco. A rotina de backup (item 6 abaixo) precisa nascer com política de retenção (ex.: manter só os últimos 7-14 dias via lifecycle rule do bucket).

## Frontend (em andamento)

`frontend/` - Vite + React + TypeScript, `@tanstack/react-table` v8 (sort) + `@tanstack/react-virtual` v3 (virtualização de linhas). **Atenção**: `npm install @tanstack/react-table` sem pin de versão instala a v9 (ainda alpha/preview, API totalmente diferente - `createCoreRowModel` em vez de `getCoreRowModel`/`useReactTable`); fixamos em `^8`.

Tela **Clientes** implementada e testada de ponta a ponta contra o backend (`backend/src/routes/resource.ts`):
- Lista virtualizada das 601 linhas de teste, sort por coluna, busca client-side (nome/CNPJ/grupo/responsável) - decisão: a API só filtra por igualdade exata (`col=valor`), sem `LIKE`, então a busca carrega a lista inteira (API aguenta até 20 mil linhas/request) e filtra no navegador; TanStack Virtual renderiza só as linhas visíveis.
- Mostra o nome do grupo econômico (join client-side com `grupos_econ`, não existe FK expandida na API).
- `cliente_status` é somente leitura no form (mantido por TRIGGER em `urls`/`servidores`, não é input manual - ver `triggers.sql`).
- Criar/editar via modal (`POST`/`PUT`), excluir via `DELETE` com confirmação.
- Testado no navegador (Vite dev server, porta 5183, contra backend na 3101): criar, editar, buscar e o `DELETE` (via chamada direta, já que `window.confirm()` é bloqueado em navegador automatizado de teste - funciona normal em uso real) - tudo OK.

Arquivos: `frontend/src/api/client.ts` (wrapper REST genérico), `frontend/src/api/types.ts`, `frontend/src/components/ClientesPage.tsx`, `frontend/src/components/ClienteForm.tsx`. Config de API: `frontend/.env.development` (`VITE_API_URL=http://localhost:3101`).

Tela **URLs** implementada no mesmo padrão (2.429 linhas de teste), com um componente novo e reutilizável: `frontend/src/components/SearchableSelect.tsx` - combobox de busca (texto + lista filtrada) usado pros campos de referência (`cliente_id`, `produto_id`, `server_id`), já que essas tabelas têm centenas/milhares de linhas e um `<select>` nativo não escala. `url_status` usa `<select>` nativo normal (só 4 valores fixos, vem de `list_url_status`). Resolve nome de cliente/produto/servidor via join client-side, igual ao grupo econômico em Clientes. Testado igual: criar (com o combobox), listar, buscar - tudo OK.

Navegação por abas simples adicionada em `App.tsx` (sem router ainda, só `useState`) - cresce conforme mais telas entrarem.

### UI redesenhada (mais moderna/compacta)

A pedido do usuário, layout trocado pra um padrão sidebar + cards de KPI + tabela compacta (referência: dashboard estilo "Library Management System"). Mudanças em `frontend/src/index.css` (reescrito) + componentes novos:

- `frontend/src/components/Sidebar.tsx` - nav lateral fixa (220px), item ativo com fundo `--accent-soft`.
- `frontend/src/components/icons.tsx` - ícones SVG inline simples (sem lib de ícones externa).
- `frontend/src/components/StatCards.tsx` - cards de indicador (total/ativos/inativos etc.), usados no topo de `ClientesPage` e `UrlsPage`.
- `App.tsx` reestruturado: `sidebar` + `app-content` (topbar com título da página + `main`), grid `220px 1fr`.
- Fonte-base reduzida (13.5px), linhas de tabela mais compactas, paleta com tons "soft" pros badges/stat-dots (`--accent-soft`, `--green-soft`, `--red-soft`).
- **Bug encontrado e corrigido nesse passo**: badge de status com valor de duas palavras (`NÃO UTILIZA`) gerava uma className com espaço (`badge-não utiliza`), que o navegador quebra em duas classes CSS separadas - o estilo nunca aplicava. Corrigido gerando slug sem acento/espaço (`nao-utiliza`) em `UrlsPage.tsx`.

### Rebrand executivo + DataGrid genérico (2026-08-07)

A pedido do usuário: visual mais "executivo" (bordas retas, alto contraste, paleta derivada de laranja) + um conjunto de regras obrigatórias pra **todas** as grids do sistema. Decisão importante: o usuário colou uma logo real de uma empresa terceira (Evertec) como referência - como não dá pra extrair o arquivo original de uma imagem colada no chat, e rebrandear um CRM interno de crédito com a marca de uma fintech de pagamentos não relacionada seria arriscado sem confirmação clara (e essa mesma sessão já teve um anexo trocado antes), optamos por **não usar aquele nome/logo**: criamos uma marca abstrata própria (cluster de pontos em SVG, `frontend/src/components/BrandMark.tsx`) na paleta laranja, mantendo o nome "WebCRM". Se um arquivo de logo oficial (svg/png em disco) for fornecido depois, é só trocar o `BrandMark`.

**Paleta/estilo** (`frontend/src/index.css`, reescrito): `--accent` laranja (`#d9600f` claro / `#e8730f` escuro), sidebar com fundo escuro sólido (antes era clara), `--radius: 3px` em vez de 8-14px, bordas com `--border-strong` pra mais contraste. Fonte-base mantida compacta (13.5px).

**Regras de grid aplicadas globalmente** (todas via um componente novo e reutilizável `frontend/src/components/DataGrid.tsx`, usado agora por `ClientesPage` e `UrlsPage`):
1. Nunca rola a página inteira - `html/body { overflow-x:hidden }`, `.app-shell`/`.app-content` com `height:100vh; overflow:hidden`, sidebar e topbar fixos (`flex-shrink:0`), só `.table-scroll` rola (vertical **e** horizontal, já que colunas redimensionadas podem passar da largura da tela).
2. Sem truncagem "seca": células usam `mask-image` (fade/esmaecido) em vez de `text-overflow: ellipsis` - conteúdo que não cabe esmaece na borda direita da célula, não corta abruptamente.
3. Resize de coluna: feature nativa do TanStack Table v8 (`columnResizeMode: "onChange"`), handle arrastável (`.col-resizer`) na borda direita de cada `<th>`. Testado via simulação de mousedown/mousemove/mouseup (280px → 380px).
4. Ordenação por coluna: mantida (já existia).
5. Filtros dos 3 campos principais: prop `filters` do `DataGrid` - dropdowns com opções únicas derivadas dos dados (Clientes: status/grupo/responsável; URLs: status/produto/servidor).
6. Campo de busca: mantido, agora dentro do `DataGrid` (prop `searchValue`).
7. Exportar PDF/XLS: `frontend/src/lib/export.ts`, botões no toolbar da grid. **Decisão de segurança**: o pacote `xlsx` (SheetJS) tem vulnerabilidade de alta severidade sem correção no npm (prototype pollution + ReDoS) - trocado por `exceljs` (só um aviso moderado indireto via `uuid`, sem exploit aplicável ao nosso uso). PDF via `jspdf` + `jspdf-autotable`. Ambos testados (XLS gerou `.xlsx` via download; PDF gerou blob de 838KB `application/pdf`).

Arquivos novos: `DataGrid.tsx`, `Sidebar` atualizado, `BrandMark.tsx`, `lib/export.ts`. `ClientesPage.tsx`/`UrlsPage.tsx` reescritos pra usar o `DataGrid` (o `SearchableSelect` e os forms de criar/editar não mudaram).

### Ajustes finos no DataGrid (2026-08-07, mesma sessão)

A pedido do usuário:
1. Exportar XLS/PDF virou botões-ícone discretos com borda (`.icon-btn`, `frontend/src/components/icons.tsx` - `XlsIcon`/`PdfIcon`), no canto superior direito da grid. O botão "+ Novo" (`toolbarExtra`) é sempre o item mais à direita, na mesma linha.
2. Cards de totalização, toolbar (busca/filtros/export/novo) e cabeçalho da grid agora **nunca rolam** - só as linhas. Isso exigiu conter a altura em cadeia (`main` → `.page` → `.datagrid` → `.table-scroll`, todos `flex` com `min-height: 0`) em vez de deixar `main` rolar a página inteira.

**Bug real encontrado nesse passo**: `thead th` tinha `position: sticky` e, três linhas depois, `position: relative` sobrescrevendo - o sticky nunca funcionou de verdade (só não tinha sido percebido porque antes a página inteira rolava, mascarando o problema). Corrigido removendo a duplicata. Testado: `scrollTop` de 1500px na grid mantém cabeçalho e totalização com a mesma posição em tela.

### Logo real da Evertec aplicada (2026-08-07)

Usuário confirmou ser funcionário da Evertec (autorização pra usar a marca) e passou a URL do arquivo oficial (`https://files.openstartups.net/.../evertec.jpg`). Baixado (permissão pedida e concedida antes), fundo branco removido via script Python/Pillow (threshold suave por "brancura" do pixel, preserva anti-aliasing das bordas dos pontos/texto - não altera nenhum pixel de conteúdo, só adiciona alpha) e salvo como `frontend/src/assets/evertec-logo.png` (1024x512, transparente). `Sidebar.tsx` agora renderiza essa imagem direto (removido o `BrandMark.tsx` abstrato criado antes, que ficou obsoleto). CSS: `.sidebar-logo` tem fundo branco + padding, porque o wordmark cinza da logo foi desenhado pra fundo claro e não teria contraste direto na sidebar escura - isso é só um "card" ao redor, a imagem em si não foi tocada além da transparência.

### Logo da Evertec trocada por um arquivo oficial mais limpo (2026-08-07)

Usuário mandou uma URL de um arquivo oficial melhor (`https://companieslogo.com/img/orig/EVTC_BIG.D-f2992a32.png`) pra substituir a logo aplicada na sessão anterior. Baixado (30KB), inspecionado com Pillow antes de processar: essa versão só tem o símbolo de pontos (sem wordmark "evertec" em texto) num canvas 1523x307 quase todo vazio, com uma faixa branca *opaca* atrás dos pontos (não transparente, apesar do PNG já ter canal alfa no resto do canvas).

Removida a faixa branca com o mesmo método já documentado antes (limiar suave por "brancura" do pixel - só altera o canal alfa, nunca a cor -- preserva o anti-aliasing das bordas dos pontos) e recortado pro bounding box do conteúdo (1523x307 → 348x331, sem a faixa vazia enorme à direita). Substituído `frontend/src/assets/evertec-logo.png`.

Como essa versão não tem wordmark em texto (só os pontos coloridos), o "card" branco que existia por trás da logo na sidebar (`.sidebar-logo { background: #fff; padding: ... }`, necessário antes porque o wordmark cinza precisava de fundo claro) não faz mais sentido - os pontos têm contraste suficiente direto no fundo escuro da sidebar. Removido esse fundo/padding forçado; `.sidebar-logo` agora só limita a largura (84px) e centraliza.

### Cinco telas de cadastro novas: Contatos, Produtos, Servidores, Pessoas, Fornecedores (2026-08-07)

Reaproveitando 100% o padrão existente (`DataGrid`, `SearchableSelect`, `StatCards`, form em modal) - nenhuma mudança na API ou no `DataGrid` foi necessária. Arquivos novos: `ContatoForm/ContatosPage`, `ProdutoForm/ProdutosPage`, `ServidorForm/ServidoresPage`, `PessoaForm/PessoasPage`, `FornecedorForm/FornecedoresPage`, mais os respectivos ícones em `icons.tsx` e as entradas em `App.tsx`/`Sidebar`. `api/types.ts` ganhou os tipos `Fornecedor`, `Pessoa`, `Contato` e os campos completos de `Produto`/`Servidor` (antes só tinham os campos usados no join de `UrlsPage`).

- **Pessoas** é a tela mais complexa: hierarquia auto-referenciada (`pessoa_diretor/ger_exec/ger/lider`) resolvida com 4 `SearchableSelect` que excluem a própria pessoa da lista (evita ciclo direto pessoa→si mesma; não valida ciclos indiretos, ex. A líder de B líder de A - não apareceu na base de teste, mas é uma lacuna conhecida caso apareça na migração real).
- **Contatos** segue o mesmo padrão de `UrlsPage` (FK única pra `clientes` via `SearchableSelect`).
- **Produtos/Servidores/Fornecedores** são CRUD simples sem FK.
- Testado ponta a ponta: as 5 telas carregam sem erro de console contra o banco de teste (601 clientes, 300 pessoas, 70 produtos, 56 servidores, 18 fornecedores); ciclo completo de criar (`POST` com hierarquia preenchida via combobox) → aparecer na grid e nos contadores → excluir (`DELETE` direto via fetch, já que `window.confirm()` trava em navegador automatizado - mesma ressalva já registrada para URLs/Clientes) → total volta ao normal, tudo confirmado via rede (`201`/`204`) e reload.

**Decisão de escopo**: `precos_cliente` (22k linhas) e `consumo_ana` (256k linhas) ficaram de fora desta rodada de propósito - `consumo_ana` excede o `MAX_LIMIT` de 20 mil linhas/request da API (`backend/src/routes/resource.ts`), então a tela dela vai precisar de um padrão novo (paginação ou filtro server-side por cliente) antes de reaproveitar o `DataGrid` como está; não faz sentido resolver isso na mesma leva das telas simples.

### Dashboard do cliente, submenu de Contatos e admin de usuários/permissões (2026-08-07)

A pedido do usuário, três entregas nesta rodada:

1. **Dashboard do cliente** (`frontend/src/components/ClienteDashboardPage.tsx`): clicar no nome do cliente na grid (`ClientesPage`, coluna `cliente_nome` virou `<button className="link-button">`) abre uma tela com o nome em destaque, grupo econômico, CNPJ, badge de status, totalizadores (contatos/URLs/produtos vinculados) e dois quadros - CONTATOS e PRODUTOS/URLS (cada um com join client-side pra nome de produto/servidor, igual ao resto do app). Sem router novo: `App.tsx` guarda `selectedClienteId` e troca `ClientesPage` por `ClienteDashboardPage` no mesmo slot da aba "Clientes"; clicar em "Clientes" na sidebar sempre reseta pra lista.
2. **Contatos como submenu de Clientes**: `Sidebar.tsx` ganhou suporte a `NavItem.children` (indentado, sem colapsar - só 1 filho por enquanto). `Contatos` saiu do nível raiz e passou a aparecer só embaixo de "Clientes".
3. **Admin de usuários com login por PIN** (`frontend/src/admin/`, rota `/admin`, fora do shell principal - acessível por um link discreto no fim da sidebar): três decisões confirmadas com o usuário antes de codar -
   - **PIN mestre fixo** (não vinculado a um usuário da tabela `usuarios`): variável de ambiente `ADMIN_PIN` no backend (mín. 6 caracteres). Se não definida, o servidor gera um PIN aleatório a cada boot e imprime no log (`[admin] PIN gerado só para esta execução: ...`) - **precisa definir `ADMIN_PIN` de verdade antes de ir pra produção**, senão o PIN muda a cada restart do backend.
   - **Sessão persistente**: login gera um token de sessão (aleatório, gerado uma vez por boot do backend) guardado no `localStorage` do navegador (`webcrm_admin_token`); sobrevive a reload, cai automaticamente pro login se o token ficar inválido (ex.: backend reiniciou), tem botão "Sair".
   - **Permissões por tabela incluídas já**: além do CRUD de usuário (nome/e-mail/PIN de uso interno/status), cada usuário tem uma tela de permissões (`UsuarioPermissoesPage`) pra conceder/alterar/remover acesso por tabela (grava em `usuarios_permissoes`, níveis `LEITURA`/`EDICAO` - meu palpite razoável, sem enum definido no schema original; ajustar se o usuário quiser outros nomes).

   **Achado técnico**: `usuarios_permissoes` tem PK composta (`user_id, user_tabela`), que as rotas genéricas de `resource.ts` não sabem tratar (`PUT`/`DELETE /:resource/:id` assumem PK de 1 coluna - pra essa tabela, `catalog.ts` detecta o PK errado como só `user_id`, o que faria um DELETE por id apagar *todas* as permissões do usuário, não uma tabela específica). Resolvido com rotas dedicadas (`backend/src/routes/permissoes.ts`, montadas em `/api/usuarios_permissoes/:userId/:tabela`) em vez de tentar generalizar `resource.ts` pra PK composta.

   **Segurança**: `/api/usuarios` e `/api/usuarios_permissoes` (todos os métodos) agora exigem `Authorization: Bearer <token>` via middleware `requireAdmin` - antes desta mudança, qualquer um com acesso à API via REST conseguia listar todos os PINs de usuário sem autenticação nenhuma (a tela de admin não seria o único jeito de bypassar, já que a API genérica não tinha guarda). As demais tabelas continuam sem autenticação (fora do escopo pedido).

   Testado ponta a ponta: login com PIN correto/incorreto, bloqueio 401 sem token, criar/editar/excluir usuário, conceder/alterar/remover permissão (PUT e DELETE com PK composta), token inválido após restart do backend cai pro login automaticamente, logout limpa o token.

### Menu Financeiro: Tabela de Preços, Carteira e Consumo (2026-08-07)

A pedido do usuário, que descreveu a tela equivalente do AppSheet (cards por mês da tabela `cart_mes`, cada um com botões CARTEIRA/CONSUMO/TABELA DE PREÇOS) e mandou prints reais pra eu conferir os números. Decisão do usuário: aqui não precisa ser cards, pode ser grid - reaproveitando `DataGrid`/`StatCards` como todo o resto do app.

- **`FinanceiroPage.tsx`**: grid com uma linha por `cart_mes` (usa a view `cart_mes_resumo`, que já calculava `qtd_itens_carteira`/`qtd_itens_consumo` - só nunca tinha sido exposta em tela). Cada linha tem 3 botões que abrem uma tela cheia (drill-in, mesmo padrão do dashboard de cliente), filtrada por `cart_mes_id`: **Tabela de preços**, **Carteira**, **Consumo**.
- **`TabelaPrecosPage.tsx`** + `PrecoClienteForm.tsx`: CRUD completo de `precos_cliente` (a única tabela de FK simples que ainda não tinha tela) filtrado pro mês do drill-in.
- **`CarteiraMesPage.tsx`**: grid só leitura de `carteira` filtrado pro mês, com totalizadores (valor/PDD/operações).
- **`ConsumoMesPage.tsx`**: relatório agrupado (não é CRUD) - a parte mais delicada da leva.

  **Como a fórmula do "Consumo" foi confirmada**: o usuário mandou prints da tela real do AppSheet com números concretos (cliente `42.049.072/0001-73`, franquia R$1.200, 3 linhas de detalhe). Cruzei esses números com os dados da base de teste e confirmei a regra batendo em 5 casos diferentes antes de escrever qualquer código: cada linha de detalhe é uma linha de `precos_cliente` (produto = `produtos.produto_nome`, detalhe = `produtos.produto_detalhe`); o cabeçalho agrupa por (cliente, `produtos.produto_grupo`) - a mesma chave de pool de franquia que a view `precos_cliente_mes_atual` já usa pra faturamento (`pc_mes_atu_vlr_liq_consumo`). Fórmula do grupo: `FRANQUIA = Σ franquia das linhas`, `CONSUMO = Σ (consumo do mês × valor unitário)` (= `pc_mes_atu_vlr_exced` de cada linha), `TOTAL = MAX(FRANQUIA, CONSUMO)`, `EXCEDENTE = MAX(0, CONSUMO − FRANQUIA)`. Nenhuma view/tabela nova foi necessária - tudo já vinha calculado em `precos_cliente_mes_atual`, só nunca tinha sido agrupado em tela.

  **Bug real encontrado e corrigido no meio do teste**: a view `precos_cliente_mes_atual` **não repassa** as colunas cruas de `precos_cliente` (ex.: `pc_vlr_franquia` vira `pc_mes_atu_vlr_franquia`; `pc_dat_ini/fim_vigencia` não aparecem na view de forma alguma) - o tipo TS que eu tinha escrito (`PrecosClienteMesAtual extends PrecosCliente`) assumia que essas colunas existiam com o nome antigo, e como a API simplesmente não retornava esse campo, o valor caía em `undefined`/`null` sem erro nenhum - a franquia aparecia sempre como R$0,00 mesmo quando o banco tinha R$1.200 gravado. Só percebi comparando os números renderizados com os prints reais do usuário (bateu tudo, exceto a franquia). Corrigido: o tipo `PrecosClienteMesAtual` não estende mais `PrecosCliente` (reflete só as colunas que a view de fato expõe), e `ConsumoMesPage` busca `precos_cliente` cru em paralelo só pra pegar as datas de vigência (que a view não expõe). **Isso é um lembrete geral pra qualquer tela nova que consumir uma VIEW**: sempre conferir as colunas reais da view (`views.sql`), nunca assumir que uma view "estende" a tabela de origem.

  Validado com os prints reais do usuário: mesmo cliente/produto reproduziu FRANQUIA R$1.200,00 / CONSUMO R$9.436,95 / EXCEDENTE R$8.236,95 / TOTAL R$9.436,95, número por número.

### Cinco ajustes de UI + remoção de pc_dat_ini/fim_vigencia (2026-08-10)

A pedido do usuário, a partir de prints reais das telas:

1. **Dashboard do cliente**: as duas grids internas (`ClienteDashboardPage.tsx`, Contatos e Produtos/URLs) usavam `<table className="mini-table">` cru, sem mascaramento de overflow nem resize de coluna - texto de colunas longas sobrepunha a coluna vizinha. Trocado pelo componente `DataGrid` padrão do projeto. Como essas grids são pequenas e embutidas num card (sem espaço pra toolbar de busca/filtro/export), o `DataGrid` ganhou uma prop nova `hideToolbar` que omite toolbar e contagem de linhas, mantendo resize + mask-image.
2. Label "Código GitHub" (`ClienteForm.tsx`) renomeado pra "Código Protheus" - só o texto exibido, a coluna `cliente_cod_github` no banco não mudou de nome.
3. **Bug real encontrado**: a tela Consumo (`ConsumoMesPage.tsx`) parecia "não carregar nada" (só linhas cinzas, sem texto) mas os dados estavam certos - `.consumo-grupo` tinha `overflow: hidden` dentro de um flex container em coluna (`.consumo-grupo-list`); por spec CSS, um item flex com overflow diferente de `visible` tem tamanho mínimo automático igual a zero, então com ~1000 grupos o flexbox colapsava cada card pra ~2px de altura, escondendo o conteúdo. Corrigido com `flex-shrink: 0` no `.consumo-grupo`.
4. Dropdowns de filtro do `DataGrid` (`.datagrid-filter select`) cresciam até a largura da maior opção (ex.: nomes de grupo econômico longos), quebrando a barra de filtros em duas linhas. Fixado em `width: 170px`.
5. Nova aba **Carteira** no Admin (`/admin`) - `CartMesAdminPage.tsx` + `CartMesForm.tsx`, CRUD completo de `cart_mes` (ano/mês + vigência ativa), reaproveitando `DataGrid`. `AdminApp.tsx` ganhou nav com abas (Usuários / Carteira) - o topbar/shell que antes vivia dentro de `UsuariosAdminPage` subiu pro `AdminApp`, que agora é o dono do layout compartilhado.

**Simplificação de schema pedida pelo usuário**: `precos_cliente.pc_dat_ini_vigencia`/`pc_dat_fim_vigencia` foram removidas (`schema.sql`, `import_test_data.py`, `PrecosCliente` em `types.ts`, colunas em `TabelaPrecosPage.tsx`/`ConsumoMesPage.tsx`, campos em `PrecoClienteForm.tsx`) - o período já é identificado por `cart_mes_id`, essas datas eram redundantes pra exibição. **Isso tocou lógica de negócio em `views.sql`, não só telas**: `pc_vigencia_ativa` (usado por `faturamento_detalhe` pra somar só o que está "vigente") comparava `date('now')` com essas datas; passou a usar `cart_mes.cart_vigencia_ativa` (join por `cart_mes_id`) - semanticamente mais correto, já que "vigente" já é uma propriedade do mês, não precisava ser recalculado por linha. O pool de franquia por `produto_grupo` (que agrupava por `pc_dat_ini_vigencia`) passou a agrupar por `cart_mes_id`. Validado que `faturamento_detalhe` continua retornando valores reais (não zerou) e que o exemplo documentado acima (Consumo do cliente `42.049.072/0001-73`) ainda bate número a número após a migração.

Banco de teste (`backend/data/webcrm.sqlite`) migrado in-loco (`ALTER TABLE ... DROP COLUMN` + views recriadas) pra não precisar reimportar 291k linhas - script descartável, não ficou salvo no projeto. **Numa migração real (produção) isso precisa ir num script de migração versionado.**

**Segundo ajuste pedido na mesma leva**: tela Consumo só mostra grupos com `Total > 0` (grupos 100% zerados - sem franquia nem consumo no mês - deixaram de aparecer). Caiu de ~1024 grupos renderizados (a maioria zerada) pra ~122 com movimento real.

### Drill-in de analítico (consumo_ana) + exportar CSV/compartilhar padrão (2026-08-10)

Duas entregas pedidas na mesma leva:

1. **`ConsumoAnaDetalhePage.tsx`**: clicar no "Detalhe" de uma linha na tela Consumo (`ConsumoMesPage.tsx`) abre o analítico bruto de `consumo_ana`, filtrado pela FK composta `cliente_id + produto_id + cart_mes_id` (a API genérica já suporta múltiplos filtros AND por query string, não precisou de rota nova no backend). Drill-in no mesmo padrão das outras telas (`onBack`, `DataGrid`). Testado com um caso real: 1.807 registros de SMS de um cliente/produto/mês, carregados corretamente.
2. **Exportar CSV e Compartilhar como padrão de toda grid**: perguntei ao usuário antes de implementar (não havia precedente de "compartilhar" no projeto) - confirmado: Web Share API (`navigator.share`) com fallback automático pra download se o navegador não suportar (comum em desktop sem contexto seguro), aplicado a **todo** `DataGrid.tsx` (não só Consumo). `lib/export.ts` ganhou `exportToCsv` (CSV com `;` e BOM UTF-8 pra abrir certo no Excel PT-BR) e `shareExport` (gera o xlsx e chama `navigator.share({files})`, testado o fallback quando `navigator.share` é `undefined`). Como `ConsumoMesPage.tsx` não usa `DataGrid` (é um relatório agrupado, não uma grid tabular), replicou-se a mesma toolbar de 4 botões manualmente ali, exportando os grupos exibidos.

### Leva grande de 12 ajustes (2026-08-10, mesmo dia)

A pedido do usuário, numa única leva grande:

1. **Bug real corrigido no botão Compartilhar**: sempre baixava o XLSX em vez de abrir o menu de compartilhamento. Causa: `shareExport` fazia `await` na geração do XLSX (ExcelJS é assíncrono) antes de chamar `navigator.share` - esse `await` consumia a janela de "user activation" do clique original, que a Web Share API exige pra funcionar; quando ela expira, `canShare`/`share` falham silenciosamente e o código cai no fallback de download. Corrigido gerando um **CSV síncrono** (sem await) e chamando `navigator.share` o mais perto possível do clique; se `canShare` não existir, tenta compartilhar assim mesmo antes de desistir pro download. `lib/export.ts`.
2. **Tabela de Preços**: removido o botão Excluir (só Editar). No form de edição (`PrecoClienteForm.tsx`), Cliente e Produto agora são somente leitura (badge) quando `pc` já existe - só ficam editáveis (`SearchableSelect`) ao criar um preço novo.
3. **Índice de reajuste virou dropdown**: campo `pc_cod_index` era texto livre, virou `<select>` com as opções reais que já existem em `indices_economicos` (`IGMP`, `IPCA`, `SALÁRIO` - confirmado consultando os valores distintos da tabela antes de codar, inclusive o "IGMP" com essa grafia mesmo, sem ser "IGP-M").
4. **Breadcrumbs nas subtelas**: novo componente `Breadcrumb.tsx` (`items.join(" » ")`) substituindo o `<h1>` solto nas telas drilled-in - `ClienteDashboardPage` ("Clientes » {nome}"), `TabelaPrecosPage`/`CarteiraMesPage`/`ConsumoMesPage` ("Financeiro » {tela} » {mês}"), `ConsumoAnaDetalhePage` ("Financeiro » Consumo » {mês} » Analítico").
5. **Dois alertas na tela Consumo**: botões "⚠ Consumo sem valor" e "⚠ Dados incompletos" (contagem no próprio botão, desabilitado se zero), abrindo modal com a lista. "Sem valor" reaproveita `pc_alerta_preco` (já calculado em `precos_cliente_mes_atual`, era só nunca exposto em tela); "Dados incompletos" é `precos_cliente` cru filtrado por `pc_dat_niver IS NULL OR pc_cod_index IS NULL` (~4.3k linhas no mês de teste - a massa de teste nunca teve esses campos preenchidos de verdade).
6. **Filtro por SKU na tela Consumo**: dropdown novo; como o agrupamento é por (cliente, produto_grupo) e um grupo pode ter várias linhas com SKUs diferentes, o filtro atua nas **linhas dentro de cada card** (esconde o card inteiro só se nenhuma linha bater o SKU) - os totais do cabeçalho do card continuam refletindo o grupo inteiro, não o subconjunto filtrado (decisão de design, documentada aqui pra não parecer inconsistência).
7. **Design system - alinhamento**: `DataGridColumn` ganhou `align?: "left"|"right"|"center"`, aplicado no `<th>` e no `.cell-content`. Todos os campos monetários (`CarteiraMesPage`, `TabelaPrecosPage`) viraram `align: "right"`, campos de data `align: "center"` (`CarteiraMesPage`, `ConsumoAnaDetalhePage`). A tela Consumo não usa `DataGrid` (tabela crua) - mesma coisa via classes utilitárias novas `.text-right`/`.text-center` em `index.css`.
8. **Larguras do mini-table de Consumo**: `table-layout: fixed` (`.mini-table-fixed`) com percentuais explícitos - Detalhe 42% (evita quebra de linha), SKU/Transações 13%, Franquia/Vlr unit. 16% cada (antes eram largas o suficiente pra empurrar o Detalhe pra uma coluna estreita e quebrar o texto, ver print do usuário).
9. **Admin: permissões por menu substituindo permissões por tabela**: modelo antigo (`usuarios_permissoes`, 1 nível de acesso por tabela crua do banco) **trocado inteiro** por `usuarios_permissoes_menu` (`user_id, menu_key, perm_leitura, perm_insercao, perm_edicao, perm_exclusao`, 4 flags independentes por menu). Lista canônica de menus em `frontend/src/menus.ts` (precisa ficar em sincronia manual com os ids de `App.tsx`/`NAV_ITEMS` - não há import cruzado ainda). Nova tela `UsuarioPermissoesMenuPage.tsx` (grid de checkboxes, 1 PUT-upsert por toggle via rota dedicada `PUT /api/usuarios_permissoes_menu/:userId/:menuKey`, já que é PK composta). **Import de teste ajustado**: a aba `usuarios` da planilha tinha uma coluna `user_tabela` que não tem mapeamento direto pra `menu_key`, então `import_test_data.py` parou de tentar popular permissões automaticamente - ficam todas zeradas (todo menu oculto) até configurar manualmente no Admin.
   **Limitação conhecida e não resolvida nesta leva**: a regra "menu sem nenhuma das 4 permissões fica oculto" só está implementada como *tela de configuração* no Admin - o app principal (Clientes/URLs/Financeiro/etc.) **não tem login nem sessão de usuário**, então não há como a Sidebar hoje saber "qual usuário está navegando" pra esconder menus de verdade. Aplicar essa regra em produção exige construir autenticação pro app principal (não só pro `/admin`), o que não foi pedido nem feito aqui - fica como próximo passo natural.
10. **Logo definitiva da Evertec aplicada sem nenhum processamento de imagem** (a pedido explícito do usuário - dessa vez a imagem já vem com fundo transparente e wordmark, diferente da versão anterior que precisou de remoção de fundo branco). Baixada de `companieslogo.com/img/orig/EVTC_BIG.D-f2992a32.png` (1523×307, RGBA) e usada tal como veio. Só a **largura do container CSS** (`.sidebar-logo`) mudou de 84px pra 170px, porque essa versão é bem mais larga (tem o wordmark "evertec" junto, a versão anterior era só os pontos) - isso não altera a imagem, só o espaço que ela ocupa na sidebar.

Migração no banco de teste: `usuarios_permissoes` dropada, `usuarios_permissoes_menu` criada (script descartável, mesmo padrão das migrações anteriores desta sessão - não ficou salvo no projeto).

### Correções na mesma leva: título na topbar, alertas sem popup (2026-08-10, mesmo dia)

O usuário corrigiu o que tinha sido entendido nos itens 4 e 5 acima:

1. **Breadcrumb pra primeira linha de verdade**: o `<h1>` de breadcrumb (item 4 acima) ficava dentro do corpo da página (`dashboard-header`), abaixo do título estático da topbar ("Financeiro", "Clientes" etc.) - o pedido era o breadcrumb aparecer **na própria linha da topbar**, substituindo esse título estático. Trocado o componente `Breadcrumb.tsx` por um hook (`usePageTitle`, em `frontend/src/PageTitleContext.tsx`) que usa Context pra empurrar o título pra cima até o `App.tsx`, que é quem renderiza a topbar - necessário porque as telas com breadcrumb (`TabelaPrecosPage`, `CarteiraMesPage`, `ConsumoMesPage`, `ConsumoAnaDetalhePage`, `ClienteDashboardPage`) ficam bem abaixo na árvore de componentes, várias sem acesso direto ao estado da topbar. O hook restaura o título padrão da aba (`TITLES[tab]`) automaticamente ao desmontar (`useEffect` cleanup), então "Voltar" sempre volta pro título certo.
2. **Alertas de Consumo pararam de ser popup**: agora clicar num alerta na tela Consumo **navega pra Tabela de Preços** já filtrada nos itens daquele alerta (com um banner "Mostrando N item(ns) do alerta... [Limpar filtro]"), pra poder editar o preço ali mesmo. Os mesmos 2 botões de alerta (com contagem) foram replicados na própria `TabelaPrecosPage` (reaproveita as mesmas contagens localmente, sem precisar vir de Consumo). Fiação: `FinanceiroPage.tsx` ganhou um campo `alerta` no estado de drill e uma função passada pra `ConsumoMesPage` (`onAbrirAlertaPrecos`) que troca o drill pra `"precos"` já com esse alerta.
3. **Consumo sem valor aparece direto no resultado orgânico, em vermelho**: além do botão de alerta, qualquer linha de `precos_cliente_mes_atual` com `pc_alerta_preco = 'S'` (transação > 0 e valor unitário parametrizado = 0) agora aparece destacada em vermelho (`.row-alerta`) na lista normal de grupos da tela Consumo - inclusive forçando o grupo a aparecer mesmo que o total do grupo seja zero (antes esses grupos ficavam escondidos pelo filtro "só total > 0" da leva anterior; a regra virou "total > 0 OU tem alguma linha em alerta").

### Mais 4 ajustes: 3º alerta, Carteira (2026-08-10, mesmo dia)

1. **Tabela de Preços**: removido o botão "+ Novo preço" (e todo o caminho de criação manual - `PrecoClienteForm.tsx` só sabe mais editar; `editing` deixou de aceitar `"new"`). Preço só nasce pelo import/carga real.
2. **Carteira**: `cart_emprestimos_mes` ("Concessões no mês") é financeiro - virou `align: right` + `formatMoney`. `cart_qtd_mes` ("Operações no mês") é inteiro - `align: right` + `toLocaleString("pt-BR")` (separador de milhar). **Só esses dois campos** - "Operações" (`cart_qtd`, sem "no mês") não foi tocado por não ter sido pedido, mesmo sendo um campo parecido.
3. **Botão "Planilha" por linha na Carteira**: `cart_url_plan_analitica` (URL de planilha do Google Sheets, já existia na tabela `carteira` desde o schema original mas nunca tinha sido exposta em tela) agora abre em nova aba (`window.open`, `noopener,noreferrer`) via botão na coluna de ações; fica desabilitado quando a URL é nula (boa parte da massa de teste não tem essa URL preenchida, mas há linhas reais com link de planilha real). Tipo `Carteira` em `types.ts` ganhou o campo.
4. **Terceiro alerta + renomeação dos outros dois**: `AlertaKey`/`ALERTA_LABEL` centralizados em `TabelaPrecosPage.tsx` (importados por `ConsumoMesPage`/`FinanceiroPage` pra não duplicar o tipo). Nomes finais: **Clientes Inativos** (cliente com `cliente_status != 'ATIVO'` e algum consumo `> 0` no mês - 25 casos no mês de teste), **Clientes sem Indexador** (antes "Dados incompletos") e **Consumo sem Preço** (antes "Consumo sem valor"). **Mudança de escopo na renomeação**: o alerta antigo "Dados incompletos" verificava `pc_dat_niver IS NULL OR pc_cod_index IS NULL`; como o novo nome é especificamente sobre indexador, estreitei pra checar só `pc_cod_index IS NULL` - deixei de olhar `pc_dat_niver`. Fiz essa escolha sem confirmar com o usuário porque o nome novo deixa isso implícito, mas vale revisar se a intenção era manter as duas condições.

Nenhuma migração de banco necessária nesta leva (`cart_url_plan_analitica` já existia no schema, só nunca tinha sido lida pelo frontend).

### Nova tela Faturamento + reverteu escopo do alerta de indexador (2026-08-10, mesmo dia)

1. **Revertido**: o usuário confirmou que "Clientes sem Indexador" deve continuar checando `pc_dat_niver IS NULL OR pc_cod_index IS NULL` (as duas condições), não só o indexador - voltou ao comportamento de antes da renomeação (item 4 da leva anterior). `TabelaPrecosPage.tsx` e `ConsumoMesPage.tsx`.
2. **Nova tela `FaturamentoMesPage.tsx`** (drill-in a partir de Financeiro, 4º botão ao lado de Tabela de Preços/Carteira/Consumo - `Financeiro » Faturamento » {mês}`), sobre a view `faturamento_detalhe` (soma por **cliente**, sem quebra por produto - a view já era assim, só nunca tinha tela). Colunas: Competência, Cliente, CNPJ, CNPJ Faturamento, Vencimento NFE, Valor Líquido, Valor Bruto, Número NFE, Número RPS, Observações. **`fat_flag_csv` removido da tabela `faturamento`** (schema.sql + banco de teste migrado + `import_test_data.py`) - só tinha uso interno no AppSheet, a pedido do usuário.
3. **Editar**: `FaturamentoForm.tsx`, só libera `fat_num_nfe`/`fat_num_rps`/`fat_obs` (cliente/mês/vencimento somem como somente leitura, mesmo padrão do `PrecoClienteForm.tsx`).
4. **Botão "Relatório" (PDF) por linha**: gera um PDF com 2 tabelas - resumo por produto do cliente no mês (Produto/Detalhe/Quantidade/Valor Líquido/Valor Bruto + linha TOTAL, usando `pc_mes_atu_vlr_final_liq/brt` de `precos_cliente_mes_atual`, que bateu exatamente com o exemplo real que o usuário anexou) e o analítico completo (`consumo_ana` do cliente no mês, todas as linhas - por isso o PDF de referência tinha 32 páginas). Novo helper `exportRelatorioConsumoPdf` em `lib/export.ts`.
5. **Botão "CSV Protheus" por linha**: formato fixo `CGC;NATUREZA;ITEM;COD_PROD;QUANTIDADE;VALOR_UNIT;CENTRO DE CUSTO;COND_PAG;MENSAGEM` (`;`, decimal com ponto, sem BOM - confirmado com o usuário que é o formato exigido pelo import contábil). Mapeamento confirmado: `CGC` = CNPJ de faturamento sem pontuação, `COD_PROD` = `produto_sku`, `COND_PAG` = `fat_cod_venc_protheus`, `MENSAGEM` = nome do produto. **`NATUREZA` ("10201"), `ITEM` ("01"), `QUANTIDADE` ("01") e `CENTRO DE CUSTO` ("111909400") são constantes fixas** (perguntei antes de implementar - não vêm de nenhuma coluna do banco, confirmado com o usuário). **Decisão sem confirmação explícita, revisar se necessário**: `VALOR_UNIT` usa `pc_mes_atu_vlr_final_liq` (líquido, não bruto) e o CSV só inclui linhas com `pc_vigencia_ativa = 'S'` (mesmo filtro que a view usa pra somar `fat_vlr_liq/brt`) - o relatório PDF (item 4) não tem esse filtro, mostra o mês inteiro independente de vigência.
6. Novo helper `exportCsvProtheus` em `lib/export.ts`.

**Decisão de navegação sem confirmar**: coloquei Faturamento como 4º botão irmão de Tabela de Preços/Carteira/Consumo em `FinanceiroPage.tsx` (`Financeiro » Faturamento » {mês}`). O print que o usuário anexou mostrava um breadcrumb "Financeiro > Consumo > Faturamento" (aninhado dentro de Consumo) e um botão "CSV Geral" no topo que não implementei - não estavam na descrição em texto do pedido, só no print, então tratei o print principalmente como referência de colunas. Avisar se a intenção era realmente aninhar sob Consumo ou incluir exportação geral (todos os clientes de uma vez).

Migração no banco de teste: `ALTER TABLE faturamento DROP COLUMN fat_flag_csv` (a view `faturamento_detalhe` usa `f.*`, então não precisou ser recriada).

## Próximos passos (em ordem)

1. Definir `ADMIN_PIN` de verdade (variável de ambiente) antes de qualquer uso fora do ambiente de teste local. **Atualização 2026-08-11**: em dev ele está fixado como `123456` em `C:\Claude\.claude\launch.json` (valor descartável, escolhido pela assistente só pra o PIN parar de mudar a cada restart nesta máquina) - continua **obrigatório** trocar por um PIN forte via variável de ambiente antes de qualquer deploy.
2. ~~Construir login/sessão de usuário pro app principal~~ **feito**. ~~Esconder menu por permissão na Sidebar~~ **feito** (ambos ver "Leva Login e Controle de Acesso" / "Leva CORS e Permissão por Menu"). ~~Enforcement de permissão no backend~~ **feito, incluindo leitura** (auditado e corrigido em 2026-08-11 - ver "Leva Auditoria de Segurança"): `enforceMenuPermission`/`bloqueado` cobrem `GET/POST/PUT/DELETE`. **Falta ainda**: expandir `MENU_BY_RESOURCE` (`backend/src/permissaoResource.ts`) pros recursos que ficaram de fora (views, `list_*`, `cart_mes`, `indices_economicos`, `escala`, `resp`, `consumo_ana` etc.) se a intenção for controlar acesso a esses dados também - hoje eles continuam sem checagem nenhuma pra qualquer sessão de usuário válida, comportamento antigo mantido de propósito nesta correção (não fazia parte do escopo pedido).
3. Configurar `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` de verdade antes de usar o convite por e-mail em produção - sem isso, o link só aparece no console do backend e no `alert()` do Admin (funcional pra copiar manualmente, mas não escala pra usuários reais).
4. Configurar `CORS_ORIGINS` com a(s) URL(s) real(is) de produção antes do deploy - hoje o default é só `http://localhost:5183` (dev local); sem ajustar isso, o frontend em produção não vai conseguir chamar a API.
4. Os 12 usuários da massa de teste (`usuarios`, importados do AppSheet) não têm `user_senha_hash` - precisam de um convite (`POST /api/usuarios/:id/convite`) antes de conseguirem logar no app principal. Na migração real, decidir se todo usuário existente recebe convite de uma vez ou sob demanda.
5. `consumo_ana` - única tabela que ainda falta tela via CRUD; precisa de paginação/filtro server-side antes disso (256k linhas, acima do `MAX_LIMIT` de 20 mil linhas/request da API).
6. `pc_totalizador` (string de relatório, nunca implementado, ver `schema.sql`) - candidato natural pra próxima rodada de extração de regras do AppSheet. (`port_pace` **já foi implementado** - ver leva "Projetos/PMO".)
7. Desenhar o script de limpeza/carga da migração **real** (produção) - separado do `import_test_data.py`, que é só massa de teste. Planilha real (`WEBCRM.xlsx`) continua em produção e sendo alimentada; precisa de limpeza mais cuidadosa (dados atuais, sem mistura de teste) na hora do corte. **Plano combinado com o usuário (2026-08-11)**: quando ele extrair uma planilha nova (mesma estrutura do `WEBCRM.xlsx` usado de modelo, mas com dados reais atuais), a assistente vai adaptar o script de carga pra esse arquivo, **apagar e recriar só a base local de teste** (`backend/data/webcrm.sqlite`, não há nada em produção ainda - sem risco de perda de dado real) e recarregar, validando contra números reais que o usuário conseguir conferir (mesmo padrão já usado pra validar Consumo/Faturamento). Sem previsão de data - "mais adiante" no planejamento do usuário.
8. Hospedagem: VM e2-micro + Firebase Hosting + sqlite-web + backup **com rotação/retenção** (ver risco acima). Ao configurar o Firebase Hosting, lembrar de uma regra de rewrite (`"**" -> "/index.html"`) pra rota `/admin` **e** `/definir-senha` funcionarem em produção como funcionam no Vite dev server.
9. Script de migração **real** de produção também vai precisar trazer `cliente_tip_vlr` (regime Bruto/Líquido, hoje só na massa de teste via backfill heurístico) e confirmar com o usuário os 70 clientes de teste que tinham `pc_tip_vlr` divergente entre linhas de preço (ver leva "Regime de faturamento") - na base real pode ter o mesmo problema.

## Leva Financeiro/Faturamento + Projetos (PMO) + Design System (2026-08-10, mesmo dia, sessão longa)

Continuação direta da leva anterior de Faturamento, na mesma sessão/dia - várias rodadas de ajustes pedidas em sequência.

### Financeiro: colunas Carteira/Consumo e totais

1. **Ações da linha do Financeiro viraram 2 grupos** (`.row-actions-columns` + `.row-actions-group`, classes novas em `index.css`): "CARTEIRA" (Preços/Carteira) e "CONSUMO" (Preços/Consumo/Faturamento), com rótulo de grupo em texto pequeno - em vez de 4 botões soltos, já que cada grupo representa um fluxo de drill-in diferente.
2. **"Itens de carteira/consumo" trocado por "Total de carteira/consumo"**: `cart_mes_resumo` (views.sql) ganhou `total_carteira` (`SUM(cart_vlr)`) e `total_consumo` (mesma regra de pool por `produto_grupo` já usada em `precos_cliente_mes_atual` - `MAX(franquia agrupada, consumo agrupado)`, não soma simples, senão contaria franquia em duplicidade).

### Faturamento: coluna "Valor a Faturar" + regime movido pro cliente

3. **Nova coluna "Valor a Faturar"** na grid de Faturamento - se o cliente é BRUTO usa `fat_vlr_brt`, se LIQUIDO usa `fat_vlr_liq`, com tag (badge laranja/verde) e card totalizador. Regra do Pace/regime confirmada olhando os dados reais de teste.
4. **Regime (`pc_tip_vlr`) movido de `precos_cliente` pra `clientes.cliente_tip_vlr`** - decisão do usuário pra impedir um cliente com produtos em regimes diferentes (era possível antes, por engano, já que o campo era por linha de preço). `views.sql` (`precos_cliente_mes_atual` agora faz `JOIN clientes` pra ler o regime), `ClienteForm.tsx` ganhou o campo, `PrecoClienteForm.tsx`/`TabelaPrecosPage.tsx` perderam. **Achado real ao reimportar a massa de teste**: 70 clientes tinham `pc_tip_vlr` divergente entre linhas de preço diferentes - o `import_test_data.py` (`backfill_cliente_tip_vlr`) ficou com o primeiro valor encontrado por cliente, critério arbitrário que precisa ser revisto na migração real (item 7 de "Próximos passos").

### Módulo novo: Projetos (PMO) - Portfólio Completo + Cronograma Detalhado (WBS)

Schema já existia de sessão anterior (`portfolios`, `crono`, views `portfolios_progresso`/`crono_calculado`) mas sem UI nenhuma e sem a regra de `port_pace`. Construído nesta leva a partir de prints reais do AppSheet (tela de portfólio + WBS + form de nova atividade + PDF de acompanhamento de projeto):

5. **Regra do "Pace" confirmada com dados reais** (`lib/pace.ts`): cruzando 9 IDs de um print do usuário contra a massa de teste, bateu 100% a cascata - `CANCELADO` → label "CANCELADO" (verde se desvio ≥0, vermelho se <0); `CONCLUÍDO` → "HOLD" (sempre verde); qualquer outro status → "EM DIA" (desvio ≥0) ou "ATRASADO" (desvio <0). No nível de atividade (Cronograma Detalhado) só existe a bolinha verde/vermelha pelo sinal do desvio, sem rótulo traduzido (`corDesvio`) - o AppSheet original não tinha rótulo ali, só a cor.
6. **`PortfolioPage.tsx`** (Portfólio Completo): grid com ID/Tipo/Cliente/Projeto/PM/Início/Término/%Atual/%Estimado/%Desvio/Status/Pace, `PortfolioForm.tsx` em modal. Linha inteira clicável abre `CronogramaDetalhadoPage.tsx` (WBS) - sem botão de chevron dedicado (removido depois, ver item 13).
7. **`CronogramaDetalhadoPage.tsx`** (WBS): grid com linhas agregadoras (`crono_tipo = 'A'`) em negrito (`.row-grupo`), ordenada por grupo/tópico (não pela ordem de inserção), ícones de link só nas linhas com `crono_demanda_1/2/3` preenchidos (confirmado com o usuário que é exatamente isso), `CronoForm.tsx` pro CRUD de atividade.
8. **PDF "Documento de Acompanhamento de Projeto"** (`lib/cronogramaPdf.ts` + `exportCronogramaPdf` em `lib/export.ts`): capa com logo Evertec + cor laranja (`--accent`) no lugar do verde/logo Dimensa do modelo original que o usuário anexou, resumo do projeto, tabela do cronograma. Ícone 📄 na lista e botão de export na grid do Cronograma geram o mesmo PDF e incrementam `port_pdf` (contador, já existia no schema sem uso - inferido como "quantas vezes o PDF foi salvo").
9. Nav item novo "Projetos" em `App.tsx`/`Sidebar.tsx` (ícone `ProjetosIcon`), rota própria, sem tela intermediária.

### Ajustes pedidos depois de ver o módulo de Projetos funcionando

10. Coluna "Tipo" (A/T) ocultada na grid do WBS (informação redundante com o negrito das linhas agregadoras).
11. **Exclusão de atividade agregadora bloqueada quando tem filhos** - `handleDelete` em `CronogramaDetalhadoPage.tsx` verifica se existe outra linha com o mesmo `crono_grupo` antes de deixar excluir (alerta explicando o motivo, antes do `confirm()`).
12. **Botão "Salvar Cronograma" removido** - o ícone padrão "Exportar PDF" da toolbar do `DataGrid` agora aceita um `onExportPdf` que sobrescreve o export genérico; usado pra gerar o mesmo PDF com capa em vez do export plano.
13. Chevron "Ver cronograma detalhado" removido da lista de Portfólio Completo - redundante já que a linha inteira é clicável (`onRowClick`, prop nova do `DataGrid`).
14. **Badges de status coloridos**: `CONCLUÍDO` verde, `CANCELADO` cinza, `ANDAMENTO` amarelo - precisou de uma cor nova no design system (`--yellow`/`--yellow-soft`, com variante dark mode).
15. **Filtro padrão "ANDAMENTO"** na tela de Portfólio (`defaultFilterValues`, prop nova do `DataGrid` pra pré-selecionar um dropdown de filtro ao montar) - projetos concluídos/cancelados só aparecem se o usuário trocar o filtro manualmente.
16. **"+ Adicionar" bloqueado** em projetos `CONCLUÍDO`/`CANCELADO` (`disabled` + `title` explicando o motivo) - restrição só de UI, sem constraint no banco, seguindo o mesmo padrão já usado em outras regras de negócio do app (ex.: Tabela de Preços não permite criar preço manual).
17. **Título "Projetos" sem breadcrumb** (`App.tsx`/`CronogramaDetalhadoPage.tsx`) - o usuário achou "Projetos » Portfólio Completo" redundante na tela raiz.

### Padronização "linha clicável" (todas as grids com drill-in)

18. **Removido o padrão de link estilizado** (nome do cliente em laranja/negrito/sublinhado - `.link-button`, classe agora deletada do CSS por ficar sem uso) em favor de **linha inteira clicável**, igual ao que Projetos já tinha - aplicado também em `ClientesPage.tsx` (abre `ClienteDashboardPage`) e `ConsumoMesPage.tsx` (abre `ConsumoAnaDetalhePage`, tabela própria fora do `DataGrid`, usa `onClick` na `<tr>` + classe `.clickable-row`). Botões de ação dentro da linha precisam de `onClick={(e) => e.stopPropagation()}` no container, senão o clique no botão também navega.
19. `DESIGN_SYSTEM.md` criado (raiz do projeto) pra registrar esse e outros padrões - ver seção própria abaixo.

### Bug real: `faturamento_detalhe` não filtrava por `cart_mes_id`

20. As subqueries de `fat_vlr_liq`/`fat_vlr_brt` na view `faturamento_detalhe` somavam **todas** as linhas de `precos_cliente_mes_atual` com `pc_vigencia_ativa = 'S'` pra aquele cliente, sem filtrar pelo mês da própria linha de faturamento. Como só existe 1 `cart_mes` vigente por vez, isso "parecia" certo enquanto se navegava só no mês vigente - mas abrir Faturamento de um mês fechado mostrava o valor do mês vigente (errado) e o CSV Protheus (que filtra certo, por `cart_mes_id`) saía vazio. **Corrigido**: adicionado `AND pcm.cart_mes_id = f.cart_mes_id` nas duas subqueries, e removido o filtro `pc_vigencia_ativa = 'S'` (redundante/prejudicial uma vez escopado por mês - zerava o faturamento histórico de qualquer mês não-vigente). Mesmo filtro também removido do CSV Protheus no frontend. Migrado no banco de teste; validado comparando os 4 meses de faturamento do mesmo cliente (antes idênticos por engano, depois cada mês com valor distinto e coerente).

### Ajustes finos na grid e no PDF de Faturamento

21. Coluna "Tipo" (Bruto/Líquido) separada da coluna "Valor a Faturar" (antes um badge + valor na mesma célula, com `<span>` aninhado dentro do `.cell-content` do `DataGrid` - causava linhas mais altas que o padrão de 38px da virtualização). Coluna "Competência" removida (já aparece no título da página via `usePageTitle`). "Vencimento NFE" ganhou `cell` formatando `dd/mm/yyyy` (antes mostrava a string ISO crua).
22. **PDF "Relatório" (detalhamento de consumo) reformulado** (`exportRelatorioConsumoPdf`): capa com logo Evertec (mesmo helper `addCoverPage`, compartilhado com o PDF do cronograma); título quebrado em 2 linhas (competência / cliente+CNPJ, evitando estourar a margem); quadro resumo filtra só itens com `valorAFaturar > 0` e mostra uma coluna "Valor a Faturar" (pela regra do cliente) em vez de Líquido/Bruto separados; quadro analítico sem coluna ID, datas completas `dd/mm/aaaa` (antes só `dd/mm`, bug do helper `toDDMM`), coluna Produto mais larga; numeração "Página X de Y" em todas as páginas (`addPageNumbers`, também adicionado ao PDF do cronograma que não tinha).
23. **Alertas ficam verdes quando a contagem é zero** (`TabelaPrecosPage.tsx`/`ConsumoMesPage.tsx`, classe `.alert-btn.zero` - sem isso o botão desabilitado ficava vermelho meio-apagado mesmo quando "tudo certo").

### Padronização de botões inline (ícone + tooltip, todas as telas)

24. **Todo botão de ação de linha (`renderActions`) virou quadrado 30×30px, só ícone, com `title`/`aria-label`** - antes era uma mistura (algumas grids com texto "Editar"/"Excluir", outras já com ícone). Aplicado nas 13 telas com `renderActions`: Clientes, Contatos, URLs, Produtos, Servidores, Pessoas, Fornecedores, Tabela de Preços, Carteira, Faturamento, Financeiro, Cronograma Detalhado (Portfólio já estava assim). Ícones novos em `icons.tsx`: `TrashIcon` (Excluir), `TagIcon` (Preços), `WalletIcon` (Carteira), `ChartIcon` (Consumo), `InvoiceIcon` (Faturamento).
25. **Bug real encontrado no teste**: `actionsWidth` das grids com 3+ botões estava calculado só pela largura dos ícones, sem contar o padding do container `.row-actions` (12px de cada lado) - o flexbox encolhia os botões pra ~24px em vez de 30px. Recalculado (fórmula documentada no design system: `n*30 + (n-1)*6 (gap) + 24 (padding)`).
26. **`.icon-btn.danger:hover` adicionado** - sem essa regra o botão Excluir ficava laranja (cor padrão de hover do `.icon-btn`) em vez de continuar vermelho; `.icon-btn.danger:hover` tem 3 classes de especificidade CSS (0,3,0) contra 2 do `.icon-btn:hover` (0,2,0), então sempre ganha independente da ordem no arquivo.
27. `DESIGN_SYSTEM.md` expandido pra cobrir todo o padrão de UI existente (não só a regra de linha clicável): paleta de cores, tipografia, layout do shell, estrutura de página de listagem, `DataGrid` (props menos óbvias), ações de linha, badges, botões, formulários/modais, tabelas fora do `DataGrid`, ícones, exportação, formatação de dados (documentada como duplicação conhecida, não padrão recomendado pra copiar), Admin. **Bug real achado na auditoria**: `.row-actions-group-label` usava `var(--text-muted)`, variável que nunca foi definida em lugar nenhum do CSS - corrigido pra `var(--text); opacity: 0.75`, mesmo padrão já usado em `.stat-label`/`.form-row label`.

### "Servidor travando" no Cronograma Detalhado - causa raiz não era bug de código

28. Investigação (views/rotas testadas via `curl`, todas respondendo em milissegundos mesmo sem filtro e no projeto com mais linhas) não achou nada de errado no código. Causa real: **~22 processos `node` zumbis** acumulados desde 04/08 em sessões anteriores nunca finalizadas corretamente (`npm run dev` do backend, várias instâncias empilhadas disputando a porta 3101 e o arquivo SQLite ao mesmo tempo). Higienizado (só os processos do WebCRM, sem tocar em processos de outros projetos do usuário - ArenaApp/CalculaCredito tinham o mesmo problema, não tratado por estar fora do escopo). Fixada a porta do Vite em 5183 (`vite.config.ts`) pra não ficar "flutuando" dependendo do que já estivesse ocupado. **Lição registrada no topo do "Resumo rápido"**: sempre encerrar os terminais do `npm run dev` (Ctrl+C) em vez de só fechar a janela.

## Leva Login e Controle de Acesso (2026-08-11)

Pedido do usuário depois de uma auditoria de segurança informal (5 problemas comuns de app com IA - RLS, controle de acesso no front, IDOR, segredos hardcoded, XSS/sanitização). A auditoria achou que o app principal **não tinha nenhuma autenticação** - qualquer tabela de negócio (financeiro, clientes) respondia sem token pra quem alcançasse a API na rede, e o CORS estava totalmente aberto (`cors()` sem allowlist). Esta leva resolve a parte de autenticação; CORS **continua aberto** (não foi pedido nesta leva, ver nota no fim desta seção).

**Duas decisões confirmadas com o usuário antes de codar**:
1. Envio de e-mail: SMTP ainda não configurado - implementar o código pronto pra receber `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` via variável de ambiente, com fallback: sem SMTP configurado, o link de convite só é logado no console do backend e devolvido na resposta da API (não trava o fluxo, só não manda o e-mail de verdade ainda).
2. O PIN mestre do `/admin` continua **separado e independente** do novo login de usuário do app principal - não foi unificado.

### Modelo de dados

`usuarios` ganhou 4 colunas: `user_senha_hash` (formato `salt:hash` em hex, nunca texto puro), `user_deve_trocar_senha` (força troca no primeiro acesso - sempre 1 ao criar um usuário), `user_convite_token`/`user_convite_expira_em` (link de "definir senha", prova que o usuário tem acesso à caixa de entrada cadastrada). Tabela nova `usuario_sessoes` (`sessao_token` PK, `user_id`, `criado_em`, `expira_em`, com `ON DELETE CASCADE` - sem isso, excluir um usuário com sessão ativa dava erro de FK constraint, achado durante o teste). Migrado no banco de teste via `ALTER TABLE`/`CREATE TABLE` direto (script descartável, mesmo padrão de sempre).

### Backend

- **Hash de senha**: `backend/src/authCrypto.ts`, `crypto.scryptSync` nativo do Node (sem dependência externa tipo `bcrypt`, que exige compilar módulo nativo - mesmo raciocínio que already levou a escolher `node:sqlite` em vez de `better-sqlite3`). Comparação com `crypto.timingSafeEqual` (evita timing attack).
- **Senha provisória**: gerada automaticamente ao criar um usuário (`generateProvisionalPassword`, charset sem caracteres ambíguos tipo `0`/`O`), devolvida **uma única vez** na resposta da API de criação - nunca fica armazenada em texto puro, nunca é reexibida depois.
- **E-mail**: `backend/src/email.ts` (`nodemailer`, adicionado como dependência nova do backend - não precisa compilar nada). Sem `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`, cai no fallback de log + a API ainda devolve o link na resposta (usado pelo botão "Enviar E-mail" do Admin pra mostrar o link num alerta, copiável manualmente).
- **Sessão**: `backend/src/mainAuth.ts` - token opaco (não é JWT, não tem segredo pra assinar/vazar), guardado em `usuario_sessoes`, validade de `SESSION_TTL_DIAS` (padrão 5) a partir do login. `requireUserAuth` - o middleware que passou a proteger **todas as rotas do app principal** - considera a sessão inválida se: não existe, expirou por tempo, **ou** o usuário não está mais `ATIVO` (join com `usuarios` a cada requisição) - ou seja, desabilitar um usuário revoga o acesso **na próxima requisição dele**, mesmo com sessão "válida" ainda dentro do prazo. Testado e confirmado (ver seção de testes abaixo).
- **PIN de admin e login de usuário são independentes, mas convivem na mesma pipeline**: `requireAdmin` (já existia) agora seta `req.isAdmin = true`; `requireUserAuth` deixa passar direto se `req.isAdmin` já for true. Isso permite que `/api/usuarios`/`/api/usuarios_permissoes_menu` continuem exigindo **só** o PIN mestre (nunca aceitam sessão de usuário comum) enquanto todo o resto da API (`/api/clientes`, `/api/financeiro`, etc.) passa a exigir sessão de usuário válida.
- **Rotas novas**: `backend/src/routes/auth.ts` (`POST /login`, `POST /logout`, `GET /me`, `POST /trocar-senha`, `GET /convite/:token`, `POST /convite/:token/definir-senha` - este último já loga automaticamente, devolvendo token de sessão pronto, sem precisar de um segundo passo de login). `backend/src/routes/usuarios.ts` (rotas dedicadas que sobrescrevem parte do genérico: `POST /` gera senha provisória + hash; `POST /:id/convite` gera token de convite e chama o e-mail).
- **Dois achados de segurança corrigidos durante a implementação** (não pedidos explicitamente, mas óbvios dado o contexto):
  1. `resource.ts` ganhou uma lista de colunas protegidas (`PROTECTED_COLUMNS`) que nenhum PUT/POST genérico consegue escrever, mesmo autenticado - sem isso, um PUT genérico em `/api/usuarios` conseguiria sobrescrever `user_senha_hash` de qualquer usuário direto (bypass total do sistema de senha).
  2. `resource.ts` ganhou uma lista de colunas redigidas (`REDACTED_COLUMNS`) que nunca voltam numa resposta JSON - sem isso, todo `GET /api/usuarios`/`GET /api/usuarios/:id` devolvia o **hash da senha** de todos os usuários no corpo da resposta (não é a senha em si, mas ainda é uma credencial que não deveria estar exposta ao frontend/rede).

### Frontend

- `frontend/src/auth/` - `AuthContext.tsx` (estado global: usuário logado, `mustChangePassword`, token em `localStorage`), `LoginPage.tsx`, `TrocarSenhaPage.tsx` (bloqueia o resto do app até trocar), `DefinirSenhaPage.tsx` (rota pública `/definir-senha?token=...`, landing do link de convite).
- `api/client.ts` (o client genérico usado por **todas** as telas do app principal) passou a anexar `Authorization: Bearer <token>` automaticamente em toda chamada (`setAuthToken`), e a chamar um handler de logout automático em qualquer resposta 401 (`setUnauthorizedHandler`) - sessão expirada ou usuário desabilitado em outra aba desloga sozinho na próxima chamada.
- `main.tsx` ganhou uma 3ª rota (além de `/admin` e o app normal): `/definir-senha`, renderizada fora do `App.tsx` (mesmo padrão do `AdminApp.tsx`).
- `App.tsx`: se não logado → `LoginPage`; se logado mas com troca de senha pendente → `TrocarSenhaPage`; senão, shell normal. `Sidebar.tsx` ganhou um `footer` (nome do usuário + botão "Sair").
- **Admin** (`UsuariosAdminPage.tsx`): novo botão "Enviar E-mail" por linha (chama o convite, mostra `alert()` com "e-mail enviado" ou o link pra copiar, dependendo se o SMTP está configurado); modal novo mostrando a senha provisória uma única vez depois de criar um usuário.

### Testado ponta a ponta (via `curl` no backend e depois via navegador)

Sem token → 401 em rota do app principal; criar usuário → senha provisória devolvida (sem hash na resposta); gerar convite → `enviado:false` + link (SMTP não configurado) + log no console; abrir o link → valida token, mostra nome/e-mail; definir senha → login automático, sessão de 5 dias criada (`expiraEm` bateu exatamente 5 dias a partir de hoje); acessar dado do app principal com a sessão nova → 200; login por e-mail/senha (depois de já ter senha definida) → funciona; **desabilitar o usuário** → sessão antiga passa a dar 401 imediatamente **e** um novo login com e-mail/senha certo também é recusado; logout → volta pra tela de login; refresh de página → sessão persiste (via `localStorage` + `GET /me` na montagem). Sem erros de console em nenhum passo.

**Nota de segurança que fica de fora desta leva, registrada pra não esquecer**: o CORS do backend continua totalmente aberto (`app.use(cors())` sem allowlist, `backend/src/server.ts`) - a auditoria já tinha apontado isso, e o login resolve "quem pode ler os dados" mas não "de que origem a requisição pode vir". Não foi pedido nesta leva; recomendação registrada é restringir pra uma allowlist (ex.: só a URL do frontend em produção) quando o deploy real acontecer.

## Leva CORS e Permissão por Menu (2026-08-11, mesmo dia da leva de Login)

Continuação direta da leva anterior - os dois itens que tinham ficado de fora explicitamente ("CORS continua aberto" e "esconder menu por permissão ainda não foi feito").

### CORS

`backend/src/server.ts`: `cors()` sem opções (aceitava qualquer origem) virou `cors({ origin(...) })` com allowlist via `CORS_ORIGINS` (env var, lista separada por vírgula). Sem a variável definida, cai no default `http://localhost:5183` (só dev local). Requisição sem header `Origin` (curl, server-to-server, health check) passa direto - quem decide autenticação é `requireAdmin`/`requireUserAuth`, não o CORS. **Decisão de implementação**: o callback do `origin` nunca usa `throw`/`callback(new Error(...))` pra recusar - só `callback(null, false)`, que faz o Express simplesmente omitir o header `Access-Control-Allow-Origin` (o navegador bloqueia a leitura da resposta do lado dele) em vez de devolver um 500 com stack trace pra quem tentar de uma origem não permitida. Testado com `curl -X OPTIONS` simulando `Origin: http://evil.com` vs `Origin: http://localhost:5183` - confirmado que só a segunda recebe o header.

### Permissão por menu na Sidebar

- **Endpoint novo self-service**: `GET /api/auth/minhas-permissoes` (`routes/auth.ts`, exige sessão de usuário normal, **não** PIN de admin) - devolve as próprias permissões do usuário logado. Antes só existia `usuarios_permissoes_menu` via API genérica, que exige PIN de admin (não dá pra um usuário comum consultar as próprias permissões por ali).
- `frontend/src/menus.ts` (`MENUS`, lista canônica) estava **desatualizada** - faltava a chave `"projetos"` (o menu Projetos/PMO foi adicionado numa leva anterior e ninguém tinha sincronizado essa lista, exatamente o risco que o comentário do arquivo já alertava: "precisa ficar em sincronia manual com os ids de App.tsx/NAV_ITEMS - não há import cruzado ainda"). Corrigido.
- `AuthContext.tsx`: depois de qualquer forma de login (login normal, restaurar sessão do `localStorage` ao abrir o app, ou o login automático da tela de convite), busca `minhas-permissoes` e guarda como `Set<string>` dos `menu_key` com `perm_leitura = 1` (`menusPermitidos`). Fica `null` enquanto ainda não carregou (evita a Sidebar "piscar" mostrando tudo e depois escondendo).
- `App.tsx`: `NAV_ITEMS` é filtrado por `menusPermitidos` antes de virar `items` da `Sidebar` - item de topo escondido se o próprio `id` não estiver no set; item filho (hoje só "Contatos" dentro de "Clientes") filtrado independente do pai. Se a aba selecionada não estiver mais permitida (ex.: era a aba padrão "Clientes" mas o usuário não tem permissão nela), troca automaticamente pra primeira aba permitida. Se o usuário não tiver **nenhum** menu permitido, mostra uma tela dedicada ("Sem acesso a nenhuma tela... fale com o administrador") em vez de um app vazio confuso.
- **Backfill necessário e feito**: a massa de teste tinha `usuarios_permissoes_menu` **zerada pra todo mundo** (registrado desde a leva que criou essa tabela - "ficam todas zeradas até configurar manualmente no Admin"). Sem um backfill, ativar esse filtro agora esconderia **todos os menus de todos os usuários** no mesmo instante em que o recurso fosse ligado - ninguém, incluindo o próprio usuário, conseguiria navegar em nada. Rodado um script (descartável, mesmo padrão de sempre) concedendo permissão total (4 flags, nos 9 menus) pros 12 usuários de teste existentes. **Isso foi uma decisão minha pra não travar o ambiente, não um pedido explícito** - a expectativa é que o Admin ajuste isso por usuário na tela de Permissões conforme o controle de acesso real desejado.

### Testado

CORS: origem permitida recebe o header, origem não permitida não recebe (preflight `OPTIONS` simulado via `curl` pras duas). Permissão por menu: criado um usuário de teste com permissão de leitura só em `clientes`+`urls` (via SQL direto, mais rápido que passar pela tela de Permissões pra um teste pontual) - login desse usuário mostrou a Sidebar só com "Clientes" e "URLs" (sem "Contatos" como filho, já que não foi concedido), e a aba inicial abriu em "Clientes" corretamente. **Achado confirmado e já documentado no Resumo Rápido**: esse mesmo usuário, com o token de sessão dele, ainda conseguiu chamar `GET /api/produtos` direto (retornou dados normalmente) - ou seja, a permissão por menu hoje é **só visual/de navegação**, não bloqueia a API. Usuários e sessões de teste (`Restrito QA`) removidos do banco depois do teste.

## Sobre extrair regras de negócio do AppSheet original

O usuário tentou me dar acesso ao editor do AppSheet (URL do app: ver histórico da conversa) pra eu navegar e ler fórmulas/automações direto. Não deu pra conectar via extensão "Claude in Chrome" nesta sessão (extensão instalada e logada, mas a ponte não conectou - não investigado a fundo, pode ser incompatibilidade de ambiente). Caminho que funcionou na prática: o usuário navega no próprio Chrome (já logado) e descreve a regra em texto e/ou manda prints com números reais; a regra é confirmada cruzando esses números com a base de teste local antes de codar (foi assim que a fórmula do Consumo acima foi validada). Vale repetir esse padrão pras próximas regras a extrair.

## Pendências/achados que precisam de validação sua (já resolvidos ao longo da sessão, registrados aqui por histórico)

- ✅ `contato_sign`/`contato_liberacred`: corrigido - checam URL ativa do produto (SIGN/LIBERACRED), não `cliente_status` (bug da fórmula original).
- ✅ `pc_mes_atu_vlr_liq_consumo`: confirmado - franquia é agrupada por `produto_grupo` (contrato cobre múltiplos módulos com uma franquia só), cobra o maior entre franquia agrupada e consumo agrupado.
- ✅ `ferias`/`ferias_marcacao`: normalizado como VIEW (`ferias_calendario`), não tabela física.
- ✅ `pc_vlr_unit`: valor fixo gravado (default 2.06), sem fórmula.
- ⏳ **Novo, ainda em aberto**: modelo de `usuarios` (ver seção acima).

## Leva PIN vs Senha (2026-08-11, mesmo dia das levas de Login/CORS)

O usuário reportou um bug pelo Admin: editou o campo "PIN" de um usuário (o seu próprio) esperando que isso definisse a senha de login, depois tentou entrar no app principal com esse valor e recebeu "e-mail ou senha inválidos". Também notou o valor parcialmente visível na grid (mascarado só nos 2 últimos caracteres) e assumiu que deveria estar criptografado.

**Diagnóstico** (`grep -rn "user_pin"` em todo `backend/src`/`frontend/src`): `user_pin` é um campo **legado da importação do AppSheet**, sem nenhum uso em lógica real - só é lido/gravado nas duas telas do Admin (`UsuarioForm.tsx`, grid de `UsuariosAdminPage.tsx`) e no tipo `Usuario`. Não tem relação nenhuma com `user_senha_hash` (a senha de login de verdade, já armazenada via `scrypt` desde a "Leva Login e Controle de Acesso" e já redigida de toda resposta de API pelo `REDACTED_COLUMNS` de `resource.ts`). O bug do usuário era esperado: ele mudou um campo sem relação com login, então o login continuou exigindo a senha real (ainda não definida). O mascaramento parcial que ele viu é só uma máscara de exibição client-side (`maskPin`) sobre um valor em texto puro mesmo - não fazia sentido criptografar um campo que não protege nada; a correção certa era deixar claro que esse campo não é a senha.

**Correções implementadas**:
1. **Campo PIN esclarecido, não removido** (ainda pode ter uso interno desconhecido de alguém na empresa): label em `UsuarioForm.tsx` virou "PIN interno (legado - não é a senha de login)" com placeholder explicando que a senha se define pelo botão "Definir senha" na grid; coluna da grid (`UsuariosAdminPage.tsx`) renomeada pra "PIN (legado)".
2. **Novo endpoint `PUT /api/usuarios/:id/senha`** (`backend/src/routes/usuarios.ts`) - admin define a senha de login **direto**, sem precisar do fluxo de convite por e-mail (útil quando o usuário não tem acesso à própria caixa de entrada no momento). Grava o hash via `hashPassword`, e **revoga todas as sessões abertas** desse usuário (`DELETE FROM usuario_sessoes WHERE user_id = ?`) - evita que uma sessão antiga continue válida com a senha trocada por fora. Não zera `user_deve_trocar_senha` (permanece como estava) - decisão implícita, não confirmada com o usuário: se o admin define a senha, o dono da conta ainda é forçado a trocá-la no próximo login (mesma garantia de "só o dono final decide a senha real" que já existia pro fluxo de convite). Front: botão "Definir senha" novo em `renderActions` da grid, abre modal com `PasswordInput` (novo/confirmar) + botão "Gerar senha" (gera uma aleatória de 12 caracteres client-side via `crypto.getRandomValues`, charset sem caracteres ambíguos).
3. **Componente `PasswordInput`** (`frontend/src/components/PasswordInput.tsx`) - input de senha com botão de olho (mostrar/esconder, ícones novos `EyeIcon`/`EyeOffIcon` em `icons.tsx`). Passou a ser usado em **todo** campo de senha do sistema: `LoginPage`, `TrocarSenhaPage`, `DefinirSenhaPage`, e o modal novo "Definir senha" do Admin - nenhuma tela usa mais `<input type="password">` cru.
4. **Login redesenhado**: `LoginPage.tsx`/`TrocarSenhaPage.tsx`/`DefinirSenhaPage.tsx` ganharam classes próprias (`.auth-shell`/`.auth-card`, `index.css`) - **deliberadamente separadas** de `.admin-login-shell`/`.admin-login-card` (a tela de PIN do Admin continua com o visual antigo, centralizado/compacto, feito pra um input numérico curto - alargar aquele padrão pra caber e-mail+senha teria distorcido a tela do PIN). Card mais largo (400px), inputs maiores.
5. **"Esqueci minha senha"** - `POST /api/auth/esqueci-senha` (`backend/src/routes/auth.ts`), rota pública. Resposta **sempre genérica** (`{"ok": true}`), independente de o e-mail existir/estar ativo ou não - evita que o endpoint sirva pra descobrir quais e-mails estão cadastrados (enumeração). Quando o e-mail existe e está ativo, gera e envia o mesmo tipo de convite que o Admin dispararia manualmente. **Refatoração**: a lógica de gerar+enviar convite (antes só dentro de `usuarios.ts`) foi extraída pra `backend/src/convite.ts` (`gerarEEnviarConvite`), compartilhada agora pelo botão "Enviar E-mail" do Admin **e** por este endpoint novo - evita ter duas cópias da mesma lógica de token/expiração/e-mail. Link novo na `LoginPage` ("Esqueci minha senha") alterna pra esse modo sem navegar pra outra rota.

**Lição de ferramenta registrada**: `tsc --noEmit` passando não é suficiente pra confirmar que um JSX está sintaticamente OK pro Vite - um `placeholder="...\"...\"..."` (aspas duplas escapadas dentro de atributo JSX com aspas duplas) passou no `tsc` mas quebrou o HMR do Vite/esbuild (tela em branco, erros em cascata de `createRoot`). Corrigido trocando pra `placeholder={'... "..." ...'}` (string JS com aspas simples). Verificação de JSX com aspas dentro de atributos precisa ser confirmada no navegador, não só pelo type-checker.

**Testado** (via `curl` no backend + navegador): "Definir senha" no Admin gera senha aleatória, salva, `curl POST /api/auth/login` com a nova senha confirma sucesso (`mustChangePassword: true`, sessão de 5 dias); "Esqueci minha senha" com e-mail real e com e-mail inexistente devolvem resposta idêntica; token de convite novo gravado no banco; página `/definir-senha?token=...` renderiza corretamente com os 2 campos de senha e olho funcionando (confirmado via inspeção do DOM, alternando `type="password"`↔`"text"`); zero erros de console numa aba nova do navegador em todo o fluxo.

**Estado prático deixado no ambiente de teste**: a senha de login do usuário Carlos Ribeiro foi trocada durante o teste (via "Definir senha", senha aleatória gerada) e `mustChangePassword` continua `true` - ou seja, ele será forçado a definir sua própria senha no próximo login (tela "Troca de senha obrigatória"), ou pode usar "Esqueci minha senha" a qualquer momento pra gerar um link novo (sem SMTP configurado ainda, o link só aparece no console do backend - pedir pra eu recuperar se precisar antes de configurar o SMTP de verdade).

**Atualização no mesmo dia - campo PIN legado removido de vez**: o usuário confirmou que não tem uso pra esse campo, então em vez de só relabeled ele foi **excluído** (não só escondido): coluna `user_pin` removida de `usuarios` (`schema.sql` + `ALTER TABLE ... DROP COLUMN` no banco de teste), campo removido de `UsuarioForm.tsx` (form) e `UsuariosAdminPage.tsx` (coluna da grid + `maskPin`), tipo `Usuario` (`types.ts`) e `import_test_data.py` (`load_usuarios` não lê/insere mais essa coluna). `tsc --noEmit` limpo em backend e frontend; testado no navegador (grid e modal de edição sem o campo, zero erro de console). **Atenção pra migração real**: a planilha `WEBCRM.xlsx` de produção ainda tem a coluna `user_pin` na aba `usuarios` - o script de carga real (item 7 de "Próximos passos") só precisa ignorá-la, nenhuma ação adicional.

## Leva Redesign da Tela de Login (2026-08-11, sessão posterior às levas de Login/CORS/PIN)

Redesign visual da tela de login do app principal (`frontend/src/auth/LoginPage.tsx` +
`frontend/src/index.css`), pedido em **4 rodadas sucessivas de feedback** a partir de prints
(um mockup de tela de login e um print de referência de cor). Nenhuma mudança de backend,
de fluxo de autenticação ou de qualquer outra tela nesta leva - só apresentação do login.

### Ponto de partida

A tela já usava (de uma leva anterior **não registrada neste arquivo**, ver seção
"Funcionalidades no código não documentadas") uma imagem de fundo `frontend/src/assets/login-bg.png`
(1459x814: faixa laranja com bolhas + foto de uma pessoa em escritório + um retângulo branco
vazio desenhado à esquerda), com o formulário real posicionado em `position: absolute` por cima
desse retângulo branco, medido em % do arquivo pra escalar junto com a imagem
(`.auth-photo-frame` com `container-type: inline-size`, tudo dimensionado em `cqw`).

### Rodada 1 - 8 ajustes

Três decisões confirmadas com o usuário antes de codar:
1. **Manter a foto de fundo** - o mockup mostrava só o fundo abstrato de bolhas, sem a pessoa;
   confirmado que a foto continua e o mockup vale como referência de estilo do card, não do fundo.
2. **Não incluir os botões "Continuar com e-mail" e "Primeiro Acesso"** que apareciam no mockup -
   o fluxo continua sendo E-mail + Senha + botão Login.
3. **Cor do 2º print identificada visualmente** (usuário autorizou aproximação em vez de informar
   o hex) - é o navy `#1f2937`, que já existia no design system como `--sidebar-bg`. **Nenhuma
   variável de cor nova foi criada**, conforme a regra do `DESIGN_SYSTEM.md` de nunca usar
   hexadecimal direto em componente novo.

Ajustes aplicados:
1. **Logo "para fundo claro"**: o arquivo `frontend/src/assets/evertec-logo.png` (versão em uso
   desde a leva de 2026-08-10) é **só o cluster de pontos laranja, sem wordmark**, num canvas
   1523x307 quase todo transparente à direita. Em vez de baixar/processar um arquivo novo, a
   marca foi remontada em CSS: `.auth-overlay-logo-icon` é um container quadrado com
   `overflow: hidden` que mostra só a fatia esquerda do PNG (onde os pontos ficam) e o wordmark
   virou **texto** (`.auth-overlay-brand-text`, "evertec" em `var(--accent)`, peso 600).
   **Importante**: quando o parâmetro `param_logo_claro_url` (Parâmetros Gerais do Admin) está
   preenchido, o texto "evertec" **não** é renderizado - assume-se que a logo configurada já
   traz o wordmark. Só o fallback local mostra o texto.
2. **Container branco reduzido em 15%** (mantido centralizado dentro do retângulo branco original
   da imagem) - depois **revertido na rodada 3**, ver lá.
3. **Título "Entrar" em 24px** abaixo da logo (`.auth-overlay-title`).
4. **Separador horizontal** abaixo do título (`.auth-overlay-separator`, `border-top` com
   `var(--border-strong)`).
5. **Borda única nos campos**. **Diagnóstico**: a "borda dupla" que o usuário via não era uma
   borda - era a regra global `input:focus { outline: 2px solid var(--accent); outline-offset: 1px }`
   (`index.css`, seção de inputs), que desenha um anel laranja *por fora* da borda do input.
   Corrigido só no escopo do login (`outline: none` + troca da cor da própria borda no foco),
   **sem tocar na regra global** - as outras telas do app continuam com o outline de acessibilidade.
6. **Espaçamento vertical aumentado** entre campos, link e botão.
7. **Cor aplicada** (borda do card, botão, bordas dos campos, textos) = `var(--sidebar-bg)`.
8. Resultado aproximado do mockup mantendo a foto.

Também nesta rodada: a tela de "Esqueci minha senha" (mesmo componente, modo `esqueci`) recebeu
o mesmo cabeçalho (logo + título + separador). O título dela ficou **"Recuperar senha"** com
classe própria `.auth-overlay-title-sm` (18px) - com o texto original "Esqueci minha senha" em
24px ele quebrava em 3 linhas e empurrava o botão pra fora do card (`overflow: hidden`).

### Rodada 2 - 6 ajustes

1. **Borda preta do card removida** (o `border: 2px solid var(--sidebar-bg)` posto na rodada 1).
2. **Cursor do botão Login**: passava a "proibido" quando desabilitado (regra global
   `button:disabled { cursor: not-allowed }`). A pedido explícito do usuário, o botão do login
   mantém `cursor: pointer` mesmo desabilitado - só a opacidade indica o estado. Sobrescrito
   apenas em `.auth-overlay-submit:disabled` (especificidade 0,2,0 vence a global 0,1,1),
   **sem `!important` e sem mexer na regra global** dos outros botões do app.
3. **Botão Login descido 1cm** (depois ajustado pra 2cm na rodada 4).
4. **Título e componentes abaixo da logo descidos 0,5cm** (depois substituído pelo deslocamento
   único da rodada 3).
5. **Logo 20% maior** (ícone `1.7cqw`→`2.04cqw`, texto `1.35cqw`→`1.62cqw`).
6. **Label "Entrar" → "WebCRM - Entrar"**.
   **Efeito colateral resolvido sem confirmação explícita**: esse texto é bem mais longo e, nos
   24px originais, quebrava em 2 linhas dentro da largura estreita do card (largura calibrada
   pelo retângulo branco da imagem, não dá pra alargar sem sair do desenho) e **cortava o botão
   Login pra fora da caixa**. Resolvido com uma classe extra `.auth-overlay-title-webcrm` (19px)
   aplicada só a esse texto - `.auth-overlay-title` continua 24px pra qualquer título curto.
   **Avisado ao usuário; se a exigência for 24px literais, precisa de outra abordagem** (quebrar
   em 2 linhas de propósito, ou encurtar o texto).

### Rodada 3 - reposicionamento em bloco + tamanho da mensagem de erro

Feedback: "a logomarca ficou muito em cima e embaixo ficou sobrando espaço; baixar todos os
componentes 1,5cm mantendo a distância entre eles" + "a letra de e-mail ou senha inválidos está
muito pequena".

1. **Deslocamento passou a ser único, não por componente**: as margens separadas (0,5cm no título
   + 1cm no botão, das rodadas anteriores) foram **removidas** e trocadas por um único
   `margin-top` no `.auth-overlay-header`. Como o card é um flex column, mover o cabeçalho move
   todo o resto junto **sem alterar as distâncias relativas** - que era exatamente a queixa
   ("mantendo distância entre eles").
2. **Card voltou ao tamanho original** (a redução de 15% da rodada 1 foi desfeita: `top` 20.49%→15.23%,
   `height` 59.63%→70.15%) - sem isso o deslocamento de 1,5cm não cabia e o botão era cortado.
3. **Mensagem de erro aumentada**: `.auth-overlay-card .form-error` saiu de `0.65cqw` (praticamente
   ilegível) pra `clamp(11px, 1.3cqw, 13px)` + `line-height: 1.3`. Ganhou também
   `margin-top: -1cqw` pra cancelar o próprio `gap` do flex: a mensagem só aparece depois de uma
   tentativa de login, e sem esse cancelamento ela empurrava o botão pra fora do card no momento
   em que surgia.
4. **`gap` do card reduzido** (`1.1cqw` → `0.7cqw`) pra abrir espaço - informado ao usuário como
   efeito colateral aceito.

### Rodada 4 - ajuste fino isolado + correção de responsividade

Feedback: "subir a logo 0,7cm, NÃO MEXER NOS CAMPOS; baixar o botão login 2,0cm, NÃO MEXER EM
NADA ALÉM DA LOGO E DO BOTÃO".

1. **Logo subiu 0,7cm sozinha** - feito com `position: relative; top: -1.81cqw` em
   `.auth-overlay-brand`. **Deslocamento visual de propósito, não margem**: margem negativa
   encolheria o fluxo e arrastaria título e campos junto, que era justamente o que não podia
   acontecer.
2. **Botão Login desceu 2,0cm** (`margin-top` no `.auth-overlay-submit`, substituindo o 1cm).
3. **Bug de responsividade encontrado e corrigido nesse passo**: com os deslocamentos escritos em
   `cm` (unidade **absoluta**) o layout quebrava em janelas estreitas - o card é dimensionado em
   % do frame e encolhe junto com a viewport, mas centímetros não encolhem; medido 66px de
   overflow numa janela de 735px de largura, com o **botão Login sumindo por completo**
   (`overflow: hidden`). Em tela cheia (frame nos 1459px reais) cabia exatamente, então o
   problema só aparecia em janela reduzida. **Corrigido convertendo todos os deslocamentos
   pedidos em cm pra `cqw`**, na proporção da imagem em tamanho real:
   **1cm = 37.8px = 2.59cqw** (frame de referência 1459px). Valores finais: header `3.89cqw`
   (=1,5cm), logo `-1.81cqw` (=-0,7cm), botão `5.18cqw` (=2cm). Em tela cheia a posição é
   idêntica à pedida; em janelas menores tudo escala junto e nada é cortado.
   **Regra pra próximas mudanças nesta tela: não usar `cm`/`px` pra posicionamento aqui - usar
   `cqw` com essa conversão**, senão o bug volta.

### Classes CSS novas (todas em `index.css`, escopo `.auth-overlay-*`)

`.auth-overlay-header` (bloco logo+título+separador, dono do deslocamento geral),
`.auth-overlay-brand` (linha da marca), `.auth-overlay-logo-icon` (recorte do PNG),
`.auth-overlay-brand-text` (wordmark em texto), `.auth-overlay-title` (24px),
`.auth-overlay-title-webcrm` (19px, só pro "WebCRM - Entrar"), `.auth-overlay-title-sm` (18px,
"Recuperar senha"), `.auth-overlay-separator`.

### Testado

Navegador, nas duas telas (Login e Recuperar senha) e em dois tamanhos de viewport (735px e
1480px de largura): campo em foco com borda única, cursor `pointer` confirmado via
`getComputedStyle` no botão desabilitado, `scrollHeight` vs `clientHeight` do card conferidos a
cada rodada pra garantir que nada é cortado (inclusive **com a mensagem de erro visível**, o pior
caso de altura), login inválido renderizando o erro legível sem empurrar o botão pra fora, e zero
erros de console (os únicos 401 no console são do `GET /api/parametros` antes de logar, esperado).

## Leva Bug: login case-sensitive no e-mail (2026-08-11, mesma sessão do redesign)

### Sintoma reportado

"Quando eu renovo a senha e entro no sistema, ele me obriga a trocar a senha - até aí ok. Mas
quando tento logar a segunda vez, ele dá senha inválida. Parece que não está salvando a senha
que eu renovo."

### Diagnóstico - a senha *estava* sendo salva

Antes de mexer em qualquer código, o fluxo inteiro foi reproduzido duas vezes com um usuário
descartável (`qa.repro@teste.local`, criado e removido do banco de teste ao fim):

- **Via `curl`**: senha definida → `POST /api/auth/login` (200, `mustChangePassword: true`) →
  `POST /api/auth/trocar-senha` (204) → `POST /api/auth/login` com a senha nova (200). Passou.
- **Via navegador, pela UI real**: login → tela "Troca de senha obrigatória" → troca → entrou no
  app → "Sair" → login com a senha nova. Passou. Conferido direto no SQLite depois da troca:
  `user_deve_trocar_senha = 0` e o hash validando contra a **senha nova** (`scrypt`) e não contra
  a antiga.

Ou seja: `POST /api/auth/trocar-senha`, `PUT /api/usuarios/:id/senha` e
`POST /api/auth/convite/:token/definir-senha` **gravam corretamente**. O relato de "não salva"
era um sintoma, não a causa.

### Causa raiz

`POST /api/auth/login` procurava o usuário com `WHERE user_mail = ?` - comparação **exata** de
texto no SQLite, ou seja, **case-sensitive**. Se o cadastro tem `fulano@empresa.com.br` e o
usuário digita `Fulano@empresa.com.br` (ou o autofill do navegador/teclado do celular capitaliza
a primeira letra), a linha simplesmente não é encontrada.

E, como a mensagem de erro é **genérica de propósito** (`"e-mail ou senha inválidos"`, escolha
registrada na leva de Login pra não permitir enumerar quais e-mails existem), o caso "e-mail com
caixa diferente" fica **indistinguível de "senha errada"** - daí a leitura de que a senha nova
não tinha sido salva. Confirmado empiricamente: `QA.Repro@Teste.Local` + senha **correta** → 401;
`qa.repro@teste.local` + a **mesma** senha → 200.

Espaços em volta do e-mail já eram tolerados (`email.trim()` desde a leva original); só a caixa
não era.

### Correções (`backend/src/routes/auth.ts`, `backend/src/routes/usuarios.ts`)

1. **`POST /api/auth/login`** passou a buscar com `WHERE user_mail = ? COLLATE NOCASE`.
   Justificativa: e-mail não diferencia maiúscula/minúscula na prática - o domínio nunca
   diferencia (RFC) e nenhum provedor real trata a parte local como case-sensitive.
2. **`POST /api/auth/esqueci-senha`** tinha exatamente o mesmo problema, com um sintoma ainda pior:
   como a resposta é sempre `{"ok": true}`, digitar o e-mail em outra caixa fazia o link de
   redefinição **nunca ser gerado, sem nenhum erro visível** pro usuário. Mesma correção.
3. **`POST /api/usuarios`** (criar usuário no Admin) passou a recusar e-mail que já exista
   ignorando a caixa (`400 "já existe um usuário com esse e-mail"`). Motivo: o `UNIQUE` de
   `user_mail` no SQLite **é case-sensitive**, então sem essa guarda daria pra cadastrar
   `Fulano@x.com` e `fulano@x.com` como usuários distintos - e aí o login com `COLLATE NOCASE`
   viraria uma loteria entre os dois. Verificado que a base de teste **não tem** nenhuma
   duplicata desse tipo hoje (query de conferência rodada antes da mudança).

**Não foi alterado**: a busca por token de convite (é por token, não por e-mail), o
armazenamento do e-mail (continua gravado exatamente como digitado, sem normalizar pra
minúsculas - só a *comparação* mudou), e a mensagem genérica de erro (continua sendo a mesma pros
dois casos, de propósito).

### Testado

`QA.Repro@Teste.Local`, `QA.REPRO@TESTE.LOCAL` e `qa.repro@teste.local` com a senha correta →
todos 200; senha errada → 401; e-mail inexistente → 401 (mesma mensagem, sem vazar a diferença);
"Esqueci minha senha" com o e-mail em caixa diferente → gera o token de convite no banco
(conferido direto no SQLite). Usuário de teste, sessões e permissões dele removidos do banco
depois; as 12 contas reais de teste ficaram intactas.

### Higiene de ambiente feita na mesma leva

1. **5 processos de backend zumbis** (`tsx watch`, criados às 14:42, 15:08, 15:41, 16:05 e 19:11
   do mesmo dia) estavam vivos ao mesmo tempo disputando a porta 3101 - **exatamente o problema
   já documentado no topo deste arquivo**. Eles colidiram ao reiniciar durante a edição do
   `auth.ts` e **derrubaram o backend no meio do teste** (porta sem nenhum listener). Todos
   encerrados; ficou **um único** processo. Nenhum processo de outro projeto foi tocado.
2. **`C:\Claude\.claude\launch.json`** (arquivo global de servidores de preview, fora do projeto)
   ganhou duas entradas novas, `webcrm-backend` (porta 3101) e `webcrm-frontend` (porta 5183),
   pra o backend/frontend poderem ser iniciados e testados no navegador direto pela ferramenta.
   O `C:\Claude\WebCRM\.claude\launch.json` do projeto já tinha entradas equivalentes, mas não é
   o arquivo que a ferramenta lê nesta configuração.
3. **`ADMIN_PIN=123456` e `PORT=3101` fixados na entrada `webcrm-backend`** desse `launch.json`.
   O `PORT` é obrigatório (sem ele o backend sobe na 3000 e o frontend não acha a API). O
   `ADMIN_PIN` fixo resolve, **só em dev**, o incômodo do PIN aleatório novo a cada restart.
   **⚠️ `123456` é um valor de desenvolvimento local, escolhido por mim, e não pode ir pra lugar
   nenhum além desta máquina** - continua valendo o item 1 de "Próximos passos" (definir um PIN
   forte por variável de ambiente antes de qualquer uso fora do ambiente local).

## Leva Auditoria de Segurança (checklist de 20 itens, 2026-08-11, mesma sessão do bug de login)

### Pedido

O usuário trouxe uma checklist externa de 20 vulnerabilidades (alinhada ao OWASP Top 10 - SQL
Injection, Broken Authentication, SSRF, BOLA/Mass Assignment, CORS, dependências, upload,
rate limiting, logs sensíveis, redirects, deserialização, criptografia, interfaces de
debug/admin expostas, integridade de software, SSTI, session fixation, security misconfiguration,
XXE, CSRF, prompt injection/LLM) e pediu validação se o WebCRM está seguro em relação a ela.

### Método - leitura de código real, não resposta de memória

Cada um dos 20 itens foi checado contra o código de fato, não assumido:
- Todo `backend/src` lido (routes, `permissaoResource.ts`, `mainAuth.ts`, `adminAuth.ts`,
  `authCrypto.ts`, `storage.ts`, `email.ts`, `catalog.ts`, `server.ts`).
- `grep` dirigido no frontend por `dangerouslySetInnerHTML`, `.innerHTML =`, `document.write`,
  chamadas de LLM/IA, `jsonwebtoken`/JWT, parser de XML, `res.redirect`/redirect controlado pelo
  usuário, cookies/`SameSite` - nenhum encontrado.
- `npm audit` roda de verdade em `backend/` e `frontend/` (não citado de memória).
- `.gitignore`/presença de `.env` conferidos (projeto ainda não é repositório git - sem risco de
  segredo comitado hoje).

### Achados reais (4 corrigidos nesta leva)

1. **`GET` genérico sem checagem de permissão nenhuma** (`resource.ts`) - `GET /:resource` e
   `GET /:resource/:id` não passavam por `enforceMenuPermission`, só `POST`/`PUT`/`DELETE`
   passavam. Qualquer sessão de usuário válida lia qualquer tabela do mapa de permissões
   (`clientes`, `pessoas`, `financeiro` etc.) mesmo sem `perm_leitura` - a Sidebar escondia a
   *navegação*, não a API por trás. **Corrigido**: as duas rotas ganharam
   `enforceMenuPermission("perm_leitura", "resource")`.
2. **Download de anexo/proposta sem checagem nenhuma** (`anexos.ts:67`, `propostaAnexo.ts:61`) -
   rotas dedicadas (bypassam o genérico) que não chamavam `bloqueado()`, diferente do
   upload/exclusão ao lado, que já chamavam. Qualquer sessão válida gerava link assinado (GCS)
   pra baixar o anexo de **qualquer** cliente/fornecedor. **Corrigido**: as duas passaram a
   chamar `bloqueado(req, res, <menu>, "perm_leitura")` antes de gerar o link.
3. **Nenhum rate limiting em lugar nenhum** - `POST /api/auth/login`, `POST /api/admin/login`
   (PIN mestre) e `POST /api/auth/esqueci-senha` aceitavam tentativas ilimitadas. **Corrigido**:
   `backend/src/rateLimit.ts` (novo, `express-rate-limit`), 10 tentativas / 15 min por IP.
   **Bug real encontrado no meio da própria correção**: a primeira versão exportava **uma única
   instância** de limiter reaproveitada nas 3 rotas - como o `express-rate-limit` guarda o
   contador por IP dentro da própria instância, isso significava que uso normal de
   `/auth/login` consumia o mesmo orçamento de `/admin/login` e `/esqueci-senha` vindos do mesmo
   IP (ex.: um escritório inteiro atrás do mesmo IP corporativo fazendo login normal já travaria
   o PIN de admin pra todo mundo). Descoberto testando via `curl` em sequência: a 4ª chamada já
   virou `429`, não a 10ª. Corrigido com uma fábrica (`novoLoginRateLimiter()`) que cria uma
   instância nova - e portanto um contador independente - por rota
   (`loginRateLimiter`/`adminLoginRateLimiter`/`esqueciSenhaRateLimiter`).
4. **Trocar a própria senha não revogava outras sessões** (`POST /api/auth/trocar-senha`) - só o
   reset feito *pelo admin* (`PUT /api/usuarios/:id/senha`) já fazia
   `DELETE FROM usuario_sessoes`; o self-service não. Se um token antigo tivesse vazado, trocar a
   senha por essa mesma sessão não invalidava o token vazado rodando em outro lugar. **Corrigido**:
   a rota agora também `DELETE`a de `usuario_sessoes` toda sessão do usuário **diferente** da que
   fez a própria requisição (mantém a sessão atual viva - não desloga quem acabou de trocar).

### Riscos baixos identificados, não corrigidos (aceitos por ora, registrados pra não esquecer)

- **Dependências**: `npm audit` real mostrou 5 vulns *moderate* no backend e 2 no frontend, todas
  indiretas (`uuid`, via `@google-cloud/storage`/`exceljs`), sem exploit aplicável ao uso do app -
  mesma avaliação já feita antes pro `exceljs` (ver leva do DataGrid). Sem correção sem downgrade
  (`npm audit fix --force` trocaria `@google-cloud/storage`/`exceljs` por versões majors antigas).
  Sem CI/CD no projeto ainda pra automatizar essa checagem.
- **Comparação de PIN/token de admin não é constant-time** (`adminAuth.ts`: `pin !== ADMIN_PIN`,
  `token !== SESSION_TOKEN`, comparação `!==` simples em vez de `crypto.timingSafeEqual`, diferente
  do que já é feito pra senha em `authCrypto.ts`). Risco teórico de timing attack, prático
  baixíssimo (token de 24 bytes aleatórios; PIN agora também protegido por rate limit).
- **Erros de banco vazam `err.message` pro JSON de resposta** (`resource.ts:133,175`,
  `usuarios.ts:47`) - não é stack trace, mas pode revelar nome de tabela/coluna interna (ex.:
  `"NOT NULL constraint failed: clientes.cliente_nome"`) pra quem provocar um erro de escrita.
- **PIN de admin e link de convite (com token) são impressos no console** quando `ADMIN_PIN`/SMTP
  não estão configurados - *desenho intencional* já documentado (leva de Login), mas isso não
  pode ir pra um log persistente/agregado em produção. Log atual do backend (`server.log`)
  conferido: não tinha nada sensível no momento da auditoria.
- **Upload sem validação de magic bytes** - aceita o `mimetype` que o cliente declarar. Mitigado
  bastante por já estar fora do webroot (GCS) e ser servido com `Content-Disposition: attachment`
  (nunca inline) - risco residual baixo, não corrigido nesta leva.

### Sem problema, verificado (não assumido)

SQL Injection (prepared statements + identificadores validados via `catalog`/regex em todo
`resource.ts`), SSRF (nenhuma chamada de rede com URL vinda do usuário), CORS (allowlist real,
sem `*`, sem credentials), Unvalidated Redirects/Deserialização insegura/SSTI/XXE (nenhum desses
padrões existe no código - sem template engine, sem parser XML, só JSON), CSRF (autenticação via
`Authorization: Bearer`, não cookie - sem credencial ambiente pra um site malicioso anexar),
Session Fixation (`createSession` sempre gera token novo no login, nunca reaproveita um
pré-existente), Prompt Injection/LLM (não há integração com LLM neste app), XSS via React (sem
`dangerouslySetInnerHTML`/`.innerHTML =`/`document.write` em todo o frontend).

### Testado (via `curl` + navegador, com usuários/anexos descartáveis removidos ao fim)

Usuário com permissão só em "clientes": `GET /api/clientes` → 200, `GET /api/pessoas` → **403**
(era 200 antes da correção #1) - testado lista e por-id. Download de anexo de fornecedor sem
permissão em "fornecedores" → **403** (era 200 com link assinado válido antes da correção #2).
PIN de admin continua passando direto por tudo isso (bypass preservado, `req.isAdmin`). Rate
limit: 10 tentativas de login liberadas, 11ª → `429`; confirmado que `/admin/login` e
`/esqueci-senha` continuam livres nesse mesmo momento (contadores independentes, depois do
segundo ajuste). Duas sessões do mesmo usuário: trocar a senha pela sessão A → sessão A continua
200 em `/me`, sessão B cai pra 401. App real (Clientes, Financeiro) testado no navegador com um
usuário de permissão total (mesmo padrão do backfill real) depois de todas as correções - carrega
normal, zero 403 inesperado, zero erro novo de console. `tsc --noEmit` limpo. Usuários de teste,
sessões, anexo e proposta de teste removidos do banco depois; as 12 contas reais ficaram intactas.

### Dependência nova

`express-rate-limit@^7.5.1` no backend - pacote puro JS, sem binário nativo pra compilar (mesma
linha de raciocínio já registrada pra `node:sqlite` no lugar de `better-sqlite3`).

## Funcionalidades no código não documentadas neste arquivo

Levantado em 2026-08-11 ao investigar o bug de login: existem coisas **implementadas e rodando**
que nenhuma leva deste documento descreve - provavelmente construídas em sessões que não
atualizaram o STATUS.md. Registrado aqui pra ninguém concluir que "não existe" só por ausência,
mas **sem detalhamento**: não fui eu que construí e não auditei o comportamento delas.

- **Enforcement de permissão por menu no backend** - `backend/src/permissaoResource.ts`
  (`enforceMenuPermission`, com um mapa `MENU_BY_RESOURCE` de tabela → `menu_key`). **Auditado e
  corrigido em 2026-08-11** (ver "Leva Auditoria de Segurança") - na época em que este bullet foi
  escrito só cobria escrita; agora cobre `GET` também. Segue faltando cobertura pra recursos fora
  do mapa (views, `list_*`, `cart_mes` etc.), de propósito, mesmo comportamento de antes.
- **Tela de Parâmetros Gerais no Admin** - `backend/src/routes/parametros.ts`,
  `frontend/src/admin/ParametrosGeraisPage.tsx`, `frontend/src/lib/parametros.ts`, com os campos
  `param_logo_escuro_url` (logo da barra lateral) e `param_logo_claro_url` (capa dos PDFs e, desde
  esta leva, a logo da tela de login). Consumida por `App.tsx`, `Sidebar.tsx`, `lib/export.ts` e
  `LoginPage.tsx`.
- **Imagem de fundo da tela de login** - `frontend/src/assets/login-bg.png` e as classes
  `.auth-shell-photo`/`.auth-photo-frame`/`.auth-photo-bg` (base sobre a qual a leva de redesign
  acima trabalhou).
- **Anexos e propostas** - `backend/src/routes/anexos.ts`, `backend/src/routes/propostaAnexo.ts`,
  `backend/src/storage.ts` (`@google-cloud/storage` e `multer` já estão no `package.json`), além
  do menu `propostas`/`pagadoria` referenciado no mapa de permissões.
- **`backend/src/routes/admin.ts` e `adminAuth.ts`** como arquivos próprios (o documento descreve
  o PIN mestre, mas não essa organização de arquivos).

## Leva Preparação de Deploy (2026-08-12)

A pedido do usuário, que vai criar a conta/projeto Google Cloud para seguir a arquitetura já
decidida (VM `e2-micro` + Firebase Hosting). Preparado o que não depende dessa conta ainda existir:

1. **`backend/.env.example`** - modelo das variáveis de produção (`PORT`, `ADMIN_PIN`,
   `CORS_ORIGINS`, `SMTP_*`, `SESSION_TTL_DIAS`), com o aviso de nunca usar o `123456` de dev.
2. **`backend/.gitignore`** - não existia (projeto ainda não é repositório git, mas fica pronto
   pra quando for). Exclui `node_modules`, `dist`, o `.sqlite`/`.sqlite-wal`/`.sqlite-shm` de dados
   e o `.env` real.
3. **`deploy/webcrm-backend.service`** - unit systemd pra supervisionar o backend na VM
   (`Restart=always`), resolvendo de forma definitiva o problema já documentado de processos
   `node` zumbis/backend caindo sem reiniciar. Espera `EnvironmentFile=/etc/webcrm/backend.env`
   (fora do repo, preenchido a partir do `.env.example`) e roda com `ProtectSystem=strict` +
   `ReadWritePaths` restrito à própria pasta de dados.
4. **`frontend/firebase.json`** + **`frontend/.firebaserc`** (placeholder `SEU_PROJECT_ID_AQUI`,
   trocar pelo ID real do projeto Firebase depois de criado) - inclui o rewrite `"**" ->
   "/index.html"` que já estava listado como pendente em "Próximos passos" (sem ele, `/admin` e
   `/definir-senha` quebram em produção).
5. **`frontend/.env.production`** - placeholder de `VITE_API_URL`, lido automaticamente pelo Vite
   em `npm run build`; trocar pela URL pública real do backend antes do primeiro deploy.

**Bug real encontrado ao validar o build de produção** (`npm run build` roda `tsc -b` completo, o
que o `npm run dev` do Vite nunca executa): `frontend/src/lib/export.ts` chamava
`doc.internal.getNumberOfPages()`, API que existia em versões antigas do `jsPDF` - na v4 (já
fixada no `package.json`) o método migrou pra `doc.getNumberOfPages()` direto, sem passar por
`internal`. Nunca dava erro em dev porque o Vite/esbuild não é estrito sobre esse tipo de checagem
e a função só é chamada de fato ao gerar um PDF com número de página (Faturamento/Cronograma) - o
`tsc -b` do build de produção pegou na hora. Corrigido (uma linha). **Lição**: builds de produção
(`tsc -b`/`vite build`) precisam ser testados de verdade antes do deploy, não só o dev server -
esse bug ficaria invisível até o primeiro deploy real.

Build de produção validado ponta a ponta depois da correção: `backend` (`tsc -p .` → `dist/`) e
`frontend` (`tsc -b && vite build` → `dist/`, ~1.8MB de bundle principal - aviso de chunk grande do
Vite, não bloqueia, candidato a otimização futura via `dynamic import()`) limpos, sem erro. Saídas
de build removidas depois (não fazem parte do repo, são geradas no deploy real).

**Ainda depende da conta Google ser criada**: provisionar a VM, instalar Node 22.5+, copiar
backend pra `/opt/webcrm/backend`, criar `/etc/webcrm/backend.env` com valores reais (a partir do
`.env.example`), instalar o unit systemd, criar o projeto Firebase e rodar `firebase deploy` no
frontend com a URL real do backend em `.env.production`.

## Leva Deploy Real (2026-08-12, mesmo dia da preparação)

Conta Google criada pelo usuário; projeto GCP `webcrm-505318`. Deploy de ponta a ponta executado
nesta leva, com vários problemas reais resolvidos no caminho (registrados abaixo pra não repetir).

**Infra provisionada**:
- VM `webcrm-backend` (`e2-micro`, `us-east1-b`, Ubuntu 24.04 LTS Minimal amd64, disco permanente
  **padrão** de 30GB - não o "equilibrado"/SSD, que fica fora do free tier). IP externo promovido a
  **estático**: `34.138.41.74`.
- Programação de snapshot automática (`default-schedule-1`, criada por padrão pelo Console)
  desvinculada do disco via `gcloud compute disks remove-resource-policies` (o botão "Excluir" da
  UI não funciona enquanto o disco estiver em uso - precisa desvincular primeiro).
- Backend rodando como serviço systemd (`webcrm-backend.service`, `deploy/webcrm-backend.service`
  no repo) - `Restart=always`, usuário dedicado `webcrm`, `ProtectSystem=strict` +
  `ReadWritePaths` restrito a `/opt/webcrm/app/backend/data`.
- **HTTPS via Caddy** (`/etc/caddy/Caddyfile`, na própria VM) fazendo proxy reverso de `443` pra
  `localhost:3101`, com certificado Let's Encrypt automático. Domínio usado: **nip.io**
  (`34.138.41.74.nip.io`, resolve pro IP estático sem precisar de conta/DNS próprio) -
  **solução temporária**, trocar por um domínio de verdade quando disponível (só re-configurar o
  `Caddyfile` com o novo domínio e atualizar `VITE_API_URL`/`CORS_ORIGINS`).
- Código versionado: **repositório Git criado nesta leva** (`github.com/cribeirox7i/webcrm`,
  privado). VM clona via **deploy key** (SSH, só leitura, sem dar acesso de escrita nem à conta
  pessoal do usuário).
- Frontend publicado: **`firebase deploy --only hosting`**, projeto `webcrm-505318` →
  `https://webcrm-505318.web.app`.

### Bugs reais encontrados e corrigidos no processo

1. **Build de produção do frontend estava quebrado** (`npm run dev` nunca detecta isso, só
   `tsc -b` do build real): `frontend/src/lib/export.ts` usava `doc.internal.getNumberOfPages()`,
   API que migrou pra `doc.getNumberOfPages()` direto na v4 do `jsPDF` (já instalada). Corrigido
   antes de qualquer deploy - **lição confirmada na prática**: sem testar o build de produção,
   esse erro só apareceria no primeiro deploy real.
2. **`226/NAMESPACE` no systemd**: `ReadWritePaths=/opt/webcrm/app/backend/data` apontava pra uma
   pasta que não existia (Git não versiona pastas vazias; `.gitignore` só exclui os arquivos
   `.sqlite` de dentro dela, não a pasta). `systemd` recusa montar a sandbox se o caminho não
   existir. Corrigido criando a pasta manualmente antes do primeiro start.
3. **`tsc: not found` no build do backend na VM**: `npm install` sem `--include=dev` pulou as
   `devDependencies` (onde fica o `typescript`) - o build de produção precisa delas mesmo em prod,
   já que compila TS→JS na própria VM (não há etapa de CI separada). Corrigido com
   `npm install --include=dev`.
4. **`ADMIN_PIN` corrompido no `/etc/webcrm/backend.env`**: tentativas sucessivas de editar a
   variável via `nano`/`sed` (a sessão SSH do navegador teve problema de edição interativa,
   "texto não editável") deixaram a linha com **três valores concatenados na mesma linha, sem
   quebra de linha** - incluindo o placeholder original `escolha-um-pin-forte-aqui` ainda
   presente. Resolvido reescrevendo o arquivo inteiro de uma vez via `tee <<'EOF'` (heredoc,
   idempotente, sem depender de editor interativo) - **abordagem recomendada pra esse tipo de
   arquivo daqui pra frente**, já que evita exatamente esse tipo de corrupção. PIN final gerado
   sem caracteres especiais (`openssl rand -base64 12 | tr -dc 'A-Za-z0-9'`) pra evitar problemas
   de escaping em comandos futuros.
5. **Confusão Cloud Shell vs. SSH da VM**: comandos de instalação do Caddy (`apt-get install`,
   `systemctl`) foram tentados no **Cloud Shell** (máquina temporária do Google, sem `systemd`) em
   vez da sessão SSH da própria VM - erro `System has not been booted with systemd as init system`.
   Não é bug de configuração, só ambiente errado; resolvido reidentificando qual terminal é qual
   (Cloud Shell só pra comandos `gcloud`, SSH da VM pra tudo que instala/configura software nela).
6. **Fluxo de login do Firebase CLI, duas tentativas falhas antes de funcionar**: a primeira
   (`firebase login` rodado pela própria ferramenta do agente) gerou um link, mas o processo que
   guarda o `code_verifier` (PKCE) morreu antes do código ser colado de volta - completar o login
   numa invocação separada (`firebase login <code>`) sempre falha nesse caso ("Unable to
   authenticate using the provided code"). Resolvido rodando `firebase login --no-localhost` **do
   início ao fim no mesmo terminal interativo do usuário** (não da ferramenta do agente, que não
   sustenta uma sessão interativa esperando input no meio da execução).

### Verificado depois do deploy

Sem erro de CORS no console do navegador acessando `https://webcrm-505318.web.app` (só um `401`
esperado de `GET /api/parametros` antes do login, comportamento já documentado). Tela de login
renderizou completa (fundo, logo, campos, botões). `curl https://34.138.41.74.nip.io/health`
respondendo `{"ok":true}` de fora da VM, confirmando HTTPS/Caddy/systemd funcionando em conjunto.

### Ainda pendente antes de abrir para usuários reais

- **SMTP não configurado** - convite/recuperação de senha só loga link no console da VM.
- **Domínio nip.io é provisório** - trocar por domínio próprio quando disponível (some domínio
  formal também deixaria o certificado Let's Encrypt mais robusto/confiável para os usuários).
- **Dados ainda são só massa de teste** - migração real (item 7 de "Próximos passos", mais acima
  neste documento) continua pendente; **não convidar usuários reais antes dessa migração**, ou a
  massa de teste seria confundida com dados reais.
- **Backup do banco pra Cloud Storage** - ainda não configurado (risco de perda se a VM tiver
  problema; o disco padrão da VM não é backup).
- Revisar o backfill de permissão "acesso total" dado aos 12 usuários de teste antes de qualquer
  usuário real ganhar acesso.

## Leva Bloqueio de acesso mobile (2026-08-12, mesmo dia do deploy)

**Achado ao testar o site publicado num navegador de celular**: o WebCRM nunca teve layout
responsivo (confirmado revendo `index.css` - o único `@media` existente no projeto inteiro era
pra dark mode; layout do app shell é fixo em desktop por design, ver regra nº1 do
`DESIGN_SYSTEM.md` sobre nunca rolar a página inteira, pensada pra sidebar+grid de desktop). Em
tela de celular o app quebra de forma inutilizável. Isso nunca foi pedido nem discutido
explicitamente - decisão implícita desde o início do projeto, herdada do AppSheet original visto
sempre em desktop.

**Decisão do usuário**: não construir responsividade agora (fica pra um projeto futuro, se algum
dia for necessário) - só **bloquear o acesso em telas estreitas** com um aviso, em vez de deixar a
UI quebrada visível.

**Implementado**: `frontend/index.html` ganhou uma `div#mobile-block` estática (fora da árvore
React, sempre presente no HTML) com o aviso "O WebCRM foi desenvolvido para uso em computador.
Acesse por um desktop ou notebook." `frontend/src/index.css` ganhou um `@media (max-width: 767px)`
que esconde `#root` (a aplicação React inteira) e mostra esse aviso em tela cheia. **Decisão de
implementação**: ficar fora da árvore React e não depender de nenhuma rota específica foi
proposital - cobre `/` (app principal), `/admin` e `/definir-senha` de uma vez só, sem duplicar a
lógica em cada entry point (`App.tsx`, `AdminApp.tsx`, `DefinirSenhaPage.tsx`).

Testado no navegador: 375px (celular) mostra só o aviso, sem nenhum elemento do app visível;
1280px (desktop) comporta-se normalmente, sem regressão. Build de produção limpo, publicado no
Firebase Hosting (`firebase deploy --only hosting`).

## Leva Migração VM/SQLite → Vercel/Supabase (2026-08-12, sessão longa)

A pedido do usuário, decidido depois da fricção real de manter a VM (systemd, Caddy, domínio
bloqueado por proxy corporativo, sem responsividade) - mesma arquitetura já usada com sucesso no
projeto Sugeridor. Branch dedicada `migration/postgres-vercel`, nada tocado na VM/Firebase
enquanto isso. Plano completo em 10 fases, aprovado via plan mode antes de codar.

**Fases 1-6 (schema + backend inteiro assíncrono)** - ver detalhe nos commits da branch:
`schema.pg.sql`/`views.pg.sql`/`triggers.pg.sql` (Postgres, com `citext` pro e-mail, triggers
`plpgsql` consolidados, colunas geradas via `substring`/`position` em vez de `strftime`/`instr`);
`db.ts`/`catalog.ts` reescritos pra `pg` + `information_schema`; **todo** o backend (`resource.ts`,
`mainAuth.ts`, `permissaoResource.ts`, `auth.ts`, `usuarios.ts`, `anexos.ts`, `propostaAnexo.ts`,
`parametros.ts`, `permissoes.ts`, `convite.ts`) convertido pra `async`/`await`, `$n` placeholders,
`RETURNING *`. Testado de ponta a ponta contra um projeto Supabase descartável (`webcrm-scratch`)
via `curl` e depois pelo navegador de verdade - login, CRUD genérico, permissões, troca de senha
transacional, unicidade case-insensitive.

**Bug real de ambiente encontrado nesta leva**: `cmd.exe`/`launch.json` - `set ADMIN_PIN=123456 &&`
inclui o **espaço antes do `&&`** no valor da variável (`"123456 "`, com espaço), então a
comparação exata do PIN nunca batia. Corrigido removendo o espaço antes de cada `&&` no
`launch.json` global (`C:\Claude\.claude\launch.json`). Lição: nunca deixar espaço entre o valor
de um `set` e o `&&` seguinte nesse tipo de comando encadeado.

### Fase 7 - migração de dados reais (não massa de teste)

Primeira tentativa foi migrar a massa de teste (SQLite local) pro Supabase - **abortada a pedido
do usuário** ao encontrar 306 URLs com `cliente_id = 0` (sentinela sem cliente correspondente).
Usuário preferiu fornecer a planilha real de produção (`WEBCRM_PROD.xlsx`, mesma estrutura de 34
abas do `WEBCRM.xlsx` original) em vez de migrar dado de teste.

**Levantamento de integridade referencial na planilha real** (script descartável, não ficou no
repo) antes de tocar em qualquer dado:
- `urls.cliente_id`: 306/2429 linhas com sentinela `0` (mesmo padrão da massa de teste - confirma
  que é um problema real da fonte, não um artefato do teste).
- `carteira.cliente_id`: 1/5488 linha com o mesmo sentinela.
- `resp.cliente_id`: 6/729 linhas referenciando clientes `196/50/615/623`, que **não existem mais**
  na aba `clientes` (diferente do sentinela - referência genuinamente quebrada, cliente foi
  excluído e a linha de `resp` não foi limpa junto).
- `resp.pessoa_id`: 1/729 linha referenciando pessoa `8`, que também não existe mais.
- Todas as tabelas financeiras críticas (`precos_cliente`, `consumo_ana`, `faturamento`) vieram
  **100% limpas** - nenhum órfão.

**Decisões tomadas com o usuário** (`AskUserQuestion`, não assumidas):
1. `urls`/`carteira` com `cliente_id = 0` → migrar com `cliente_id = NULL` de verdade (não manter
   o sentinela inválido). Exigiu relaxar `NOT NULL` dessas duas colunas em `schema.pg.sql`.
2. `resp` com `cliente_id`/`pessoa_id` órfão (7 linhas) → **não migrar** essas linhas.

**Bug real de schema encontrado só com dado real** (massa de teste nunca expôs):
`carteira.cart_emprestimos_mes` ("Concessões no mês") continha valores como `40787103.09` e até
uma célula com o valor digitado como texto formatado (`"R$ 1.631.651,25"`) - é claramente um
campo monetário, mas o schema original (herdado do SQLite, `schema.sql`) o define como `INTEGER`.
O `STATUS.md` já documentava esse campo como financeiro (leva "Financeiro/Faturamento... Carteira",
acima) - só o tipo da coluna nunca bateu com a intenção. Corrigido pra `NUMERIC(14,2)` em
`schema.pg.sql`. O script de carga (`backend/scripts/migrate_prod_xlsx_to_pg.py`) ganhou um parser
de moeda BR (`"R$ 1.234,56"` → `1234.56`) pra não perder esse valor real.

**`backend/scripts/migrate_prod_xlsx_to_pg.py`** (novo, Python + `psycopg2`, reaproveita a lógica
de limpeza de `import_test_data.py` - tokens de erro do Excel, datas ISO, `NOT NULL` pós-limpeza -
mas grava direto no Postgres via `execute_values` em lote de 1000 linhas, não linha a linha
(`executemany` puro chegou a ficar tempo demais nos 256 mil registros de `consumo_ana` - corrigido
antes de rodar contra o volume real)). Roda depois de `apply-schema.ts`. Também corrige a
sequence do `IDENTITY` de cada tabela ao final (senão o próximo INSERT via app colidiria com IDs
migrados) e trata `float` inteiro do Excel (`1.0`) → `int` (Postgres, diferente do SQLite, não
aceita literal `1.0` implícito numa coluna `INTEGER`).

**Bug real de FK auto-referenciada**: `pessoas` (hierarquia `pessoa_diretor/ger_exec/ger/lider`)
falhava ao inserir via `psycopg2` porque cada linha é um `INSERT` separado (diferente do multi-row
`VALUES (...), (...)` usado no script Node de teste) - uma pessoa cujo diretor ainda não tinha
sido inserido violava a FK na hora. Corrigido tornando essas 4 FKs `DEFERRABLE INITIALLY DEFERRED`
em `schema.pg.sql` - a checagem passa a rodar só no `COMMIT` da transação, quando todas as 300
pessoas já existem.

**Resultado final**: 291.747 linhas em 26 tabelas migradas pro Supabase `webcrm-scratch`, validado
depois (não só a carga em si): valor de moeda BR parseado corretamente (`1631651.25`), 306 URLs
com `cliente_id NULL` como decidido, `cliente_status` recalculado pelos triggers durante a carga
(233 `ATIVO` / 368 `INATIVO` - distribuição real, não zerada), colunas geradas (`pessoa_grupo`,
`pessoa_whatsapp`) computando certo em nomes/telefones reais.

`WEBCRM_PROD.xlsx` **nunca deve ir pro Git** - `.gitignore` da raiz ganhou `*.xlsx` nesta leva.

### Fase 8/9 - deploy no Vercel + teste do preview publicado

O projeto Supabase que vínhamos chamando de "scratch" (`db.biuhklwctvvvbwajnxnk`) **é o
definitivo** - usuário já tinha criado como tal, os 291.747 registros da Fase 7 já são dados
reais de produção. Connection string do **pooler** (porta 6543, obrigatória pro Vercel -
conexão direta esgotaria sob serverless) obtida e testada antes de configurar o Vercel.

**`backend/api/index.ts`** (novo) + **`backend/vercel.json`** (rewrite catch-all
`/(.*) -> /api/index`): adaptador serverless, exporta a app Express direto (Vercel aceita uma
app Express como handler). **`backend/src/server.ts`**: `app.listen()` só roda fora do Vercel.

**Bug real encontrado**: a checagem original (`require.main === module`) não funciona como
esperado dentro do bundler serverless do Vercel - causava `FUNCTION_INVOCATION_FAILED` em toda
requisição. Corrigido usando `process.env.VERCEL` (variável que o Vercel sempre define), mais
confiável nesse contexto.

**Tentativa de monorepo multi-serviço abandonada**: o recurso mais novo do Vercel (`vercel.json`
na raiz com `"services": {...}`) criou mais confusão do que ajudou - o serviço "frontend"
declarado nunca expôs uma URL própria de forma clara. Voltamos pro modelo de **2 projetos Vercel
separados** (cada um com "Root Directory" apontando pra `backend`/`frontend` na configuração do
próprio projeto, sem `vercel.json` na raiz do repo) - mais simples e é o que o plano original já
recomendava. `frontend/vercel.json` ganhou o rewrite de SPA (`/(.*) -> /index.html`).

**Outros achados/erros reais no caminho** (nenhum de código, todos de configuração/operação):
1. Botão "Redeploy" da interface do Vercel redeployou a branch errada (`main`, código antigo)
   mais de uma vez - sem querer, ao clicar na linha errada da lista de Deployments. Resolvido
   evitando esse botão: `git commit --allow-empty` + `git push` dispara um deploy novo e
   inequívoco da branch certa.
2. Variáveis de ambiente (`DATABASE_URL`/`ADMIN_PIN`/`CORS_ORIGINS`/`VITE_API_URL`) salvas só pro
   ambiente **Production** por padrão - nosso deploy é **Preview** (branch não-default), então
   nada chegava na função. Corrigido configurando cada variável também pro ambiente Preview
   (`Settings → Environments → Preview`, caminho que evitou um dropdown de múltipla-seleção que
   não estava clicável na UI).
3. `VITE_API_URL` foi salvo com o texto `VITE_API_URLhttps://...` (nome da variável colado junto
   do valor, dentro do campo Value) - o app tentava resolver isso como caminho relativo à própria
   origem do frontend. Corrigido deixando só a URL no campo Value.
4. **Deployment Protection** (SSO do Vercel) bloqueava qualquer acesso não-autenticado a deploys
   de Preview por padrão (erro 302 pra `vercel.com/sso-api`) - desativado (`Settings → Deployment
   Protection → Require Log In` desligado) nos dois projetos, só pra viabilizar teste externo via
   `curl`/navegador automatizado durante esta fase.

**Testado de ponta a ponta, com dados reais de produção**, via `curl` e depois pelo navegador de
verdade: login admin (PIN), criar/consultar usuário real (e-mails `@totvs.com.br` migrados),
CRUD genérico em `clientes` (601 registros reais, nomes/CNPJs verdadeiros) com enforcement de
permissão (200 com `perm_leitura`, 403 sem), e **login completo pela UI** com uma usuária real
(Vanessa Affonso) - caiu corretamente na tela de "Troca de senha obrigatória", confirmando que
frontend (Vercel) → backend (Vercel) → Postgres (Supabase) funcionam juntos de ponta a ponta.
Credenciais de teste geradas durante a validação foram trocadas por senhas aleatórias descartadas
ao final (permissão de teste também revogada) - nenhum acesso de teste deixado ativo no banco real.

**URLs de preview usadas durante a validação** (branch `migration/postgres-vercel`):
- Backend: `https://webcrm-git-migration-postgres-vercel-webcrm.vercel.app`
- Frontend: `https://webcrm-wuah-git-migration-postgres-vercel-webcrm.vercel.app`

## Fase 10 - Virada de produção (2026-08-13, mesma sessão da migração)

**Domínio**: mantido `.vercel.app` (gratuito, decisão do usuário - sem domínio próprio por
enquanto). **Deployment Protection**: deixada desligada nos dois projetos (app já tem seu
próprio login/permissão; decisão do usuário).

**Merge**: `migration/postgres-vercel` → `main` (fast-forward, sem conflito). Push pra `main`
disparou deploy de **Production** automaticamente nos dois projetos Vercel (branch de produção
default).

**Bug real encontrado na virada**: o build de Production do frontend saiu usando a URL **antiga
da VM** (`https://34.138.41.74.nip.io`) - `VITE_API_URL` nunca tinha sido configurado pra
Production no painel do Vercel (só Preview), então caiu no valor comitado em
`frontend/.env.production` (a config da Fase 8/9, apontando pra VM que estávamos justamente
decomissionando). Corrigido atualizando esse arquivo pra `https://webcrm-mu.vercel.app` (URL de
Production do backend) - decisão de manter isso **no código**, não só no painel do Vercel, pra
não repetir o mesmo tipo de confusão de configuração manual já visto nesta migração.
`CORS_ORIGINS` de Production do backend (sem arquivo de fallback, só painel) configurado pra
`https://webcrm-wuah.vercel.app` (URL de Production do frontend).

**Validado em produção real** (não só preview): CORS preflight com `Access-Control-Allow-Origin`
correto, bundle do frontend com a URL certa do backend, e login completo pela UI com usuária real
(Vanessa Affonso) - mesmo teste da Fase 9, repetido contra as URLs de produção definitivas.
Senha de teste trocada por aleatória descartável ao final, mesma disciplina das fases anteriores.

**URLs de produção definitivas**:
- Backend: `https://webcrm-mu.vercel.app`
- Frontend: `https://webcrm-wuah.vercel.app`
- Banco: Supabase (projeto `webcrm`, connection pooler em produção)

**Decomissionamento da infra antiga** (a pedido do usuário): projeto GCP `webcrm-505318`
encerrado por completo (IAM e administrador → Configurações → Encerrar) - isso removeu de uma
vez a VM (`webcrm-backend`), o IP estático, o disco, a regra de firewall **e** o Firebase
Hosting (estava hospedado dentro do mesmo projeto GCP). Confirmado que a VM já não responde
(timeout) minutos depois do encerramento - o Google mantém os dados por ~30 dias antes da
exclusão definitiva (rede de segurança padrão deles, não é possível pular), mas os recursos
pagos/em execução já pararam imediatamente. Conta Google/Gmail em si **mantida** (decisão
explícita do usuário - só o projeto GCP foi encerrado, não a conta).

**Migração completa**: SQLite/VM/Caddy/Firebase Hosting → Postgres (Supabase)/Vercel, com dados
reais de produção, testada de ponta a ponta, VM antiga desligada. Repositório 100% em `main`.

## Leva Ajustes pós-migração: logo, storage, performance e importação de carteira (2026-08-13/14)

Sessão longa, sequência de pedidos avulsos do usuário depois da virada de produção pra
Vercel/Supabase. Registrando em ordem cronológica de commit (`git log --oneline` na branch
`main`, do primeiro ao último desta leva: `e38dd09` até `e8801a1`).

### Favicon, formatação numérica e ajustes visuais (`e38dd09`, `e6fa547`, `dd377f2`)

- **Favicon trocado** pro logo real da Evertec (baixado de `companieslogo.com`, dots laranja,
  fundo já vinha transparente) - antes era o SVG placeholder padrão do Vite.
- **Bug real de formatação encontrado e corrigido**: telas monetárias (ex. Financeiro) mostravam
  o valor bruto sem máscara (`69738.40832800` em vez de `R$ 69.738,41`). Causa: o driver `pg`
  devolve colunas `NUMERIC` como **string**, não `number` - `formatMoney`/`toLocaleString` (já
  implementado certo em ~10 telas) virava no-op silencioso, porque `String.prototype.toLocaleString`
  ignora as opções de formatação. Corrigido de uma vez só em `backend/src/db.ts` com
  `types.setTypeParser(1700, parseFloat)` (OID 1700 = numeric), sem tocar em nenhuma tela.
  **Lição pra qualquer bug futuro parecido** ("número não formata"/"mostra string bruta"): suspeitar
  primeiro do tipo de dado vindo do Postgres, não da lógica de formatação.
- Título da aba do navegador trocado do placeholder padrão do Vite (`frontend`) pra `WebCRM`.
- **Zoom padrão de 80%** aplicado no app inteiro, a pedido do usuário (`html { zoom: 80%; }` em
  `index.css`). Achado real no processo: zoom no `#root` (em vez de no `<html>`) deixava uma faixa
  em branco de ~20% da altura, porque `100vh` (usado por `.app-shell`/`.app-content`) é calculado
  contra o viewport real quando o zoom não está no elemento raiz - todo `calc(100vh / 0.8)` (e
  similares em `vw`) no CSS existe por causa disso; qualquer `vh`/`vw` novo em telas futuras
  precisa da mesma compensação, ou vai sobrar/faltar espaço.

### Sessão do Admin caindo em requisições paralelas (`69b9909`)

**Bug real, achado testando "Marcar todas as permissões"**: `SESSION_TOKEN` (PIN mestre) era
gerado com `crypto.randomBytes` no carregamento do módulo (`backend/src/adminAuth.ts`) - em
serverless (Vercel), cada instância/cold start reexecuta esse código, gerando um token
**diferente por instância**. Rajadas de requisições paralelas (a tela de permissões dispara uma
chamada por menu de uma vez) podiam cair em instâncias com tokens diferentes do que o login
gerou, devolvendo 401 e derrubando a sessão do admin no frontend. Corrigido tornando o token
determinístico (hash do `ADMIN_PIN`), idêntico em qualquer instância que compartilhe a mesma env
var. **Consequência pro futuro**: se o `ADMIN_PIN` mudar (rotação), toda sessão de admin aberta
em qualquer navegador é invalidada - efeito esperado, não bug.

### Renomeação dos projetos Vercel e novo domínio (sem commit, mudança só no painel)

A pedido do usuário, pra ficar mais fácil de identificar:
- Backend: projeto **`webcrm`** → **`webcrm_back`**. Domínio **não mudou** (renomear o projeto na
  Vercel não troca o domínio `.vercel.app` já atribuído) - continua `https://webcrm-mu.vercel.app`.
- Frontend: projeto **`webcrm-wuah`** → `evertec` → **`webcrm_from`** (renomeado duas vezes).
  Domínio novo **`https://crmevertec.vercel.app`** - precisou ser adicionado manualmente em
  Settings → Domains (renomear o projeto sozinho não gera esse domínio). Domínio antigo
  (`webcrm-wuah.vercel.app`) mantido como redirect pro novo, não removido.
- `CORS_ORIGINS` do backend (Production + Preview, painel Vercel) atualizado pra
  `https://crmevertec.vercel.app`. `frontend/.env.production` (`VITE_API_URL`) **não precisou
  mudar**, já que só o domínio do frontend mudou, não o do backend.
- **`ADMIN_PIN` foi rotacionado** depois (painel Vercel, Production + Preview) - precisou de um
  deploy novo (`git commit --allow-empty && git push`) pra pegar, já que a Vercel não reaplica
  env var em deploys já existentes. Efeito colateral confirmado: invalidou toda sessão de admin
  aberta (ver acima).

### Herdar permissões, paginação do Consumo e migração de storage pra Supabase (`94842b4`)

- **Admin > Usuários > Permissões**: dropdown "Herdar de" copia as 4 permissões de todos os menus
  de outro usuário de uma vez, sem precisar marcar linha por linha.
- **Financeiro > Consumo**: `api.listAll()` (novo, em `frontend/src/api/client.ts`) pagina
  automaticamente por `offset` em vez de confiar no `limit` fixo de 20 mil linhas/request do
  backend - `consumo_ana` de um cliente com muita transação num mês podia estourar esse limite e
  cortar dados silenciosamente. Aplicado em `ConsumoAnaDetalhePage.tsx`/`ConsumoMesPage.tsx`.
- **Upload de anexos migrado de Google Cloud Storage pra Supabase Storage** (mesmo projeto que já
  hospeda o Postgres) - o GCS ficou órfão desde a decomissão do projeto GCP na migração anterior,
  então upload/download estavam **desligados em produção** sem ninguém perceber até agora.
  `backend/src/storage.ts` reescrito pro cliente `@supabase/supabase-js` (`SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY`, nunca a `anon`/`publishable` key - essa não tem permissão de
  escrita). Nova tabela `parametros_storage_menu` (menu_key → pasta no bucket) + tela **Admin >
  Armazenamento** deixam a pasta configurável sem precisar de deploy. Bucket `anexos`, privado,
  criado manualmente no painel Supabase (não existe automação pra isso).
- **Recuperação dos anexos de propostas perdidos** na decomissão do GCS: os valores gravados em
  `proposta_anexo`/`anexo_arquivo` nunca foram, de fato, caminhos nossos (GCS ou Supabase) - eram
  um resquício bruto da estrutura interna do AppSheet (`Files/Propostas/<id>.proposta_anexo...`,
  `APPSHEET/data/<appid>/propostas/...`), nunca resolvidos por nenhuma migração anterior. Os
  arquivos reais sobreviveram no Google Drive original do usuário, sincronizado localmente via
  Google Drive para Desktop (múltiplas contas montadas em letras de unidade diferentes - a conta
  certa foi achada procurando pelo nome do projeto, `I:\Meu Drive\WEBCRM\Files\`). Scripts
  `backend/scripts/report-propostas-anexo.ts` (leitura) e `recover-propostas-anexo.ts` (upload +
  update, modo simulação por padrão) - **34 de 34 propostas recuperadas** com sucesso, rodado pelo
  usuário no próprio terminal (o agente não roda `--apply` em produção, só o usuário).

### Otimização de cold start (`b8dbb44`)

**Bug de performance real**: `loadCatalog()` (`backend/src/catalog.ts`) fazia 1 consulta pra
listar tabelas + **2 consultas POR TABELA** (colunas + PK) num loop sequencial - com as ~40
tabelas/views atuais, ~81 idas e vindas ao Postgres toda vez que uma instância nova do backend
"acordava" no Vercel (cold start, comum no plano Hobby, que desliga a função sem tráfego), **antes
de responder qualquer request**. Causa provável do "às vezes demora 5-7 segundos" reportado pelo
usuário. Reduzido pra 3 consultas totais (medido: 452ms contra produção, vs. potencialmente vários
segundos antes). Bônus: `GET /:resource` (`resource.ts`) rodava a query de dados e o `COUNT(*)` em
sequência; agora em paralelo (`Promise.all`).

### CSV Protheus, seleção múltipla e cache de logo (`e7fa0d7`)

- **Bug real no CSV Protheus** (Financeiro > Faturamento): gerava uma linha por item de
  `precos_cliente_mes_atual` do cliente inteiro no mês (duplicando produtos, ex. 6 linhas
  idênticas do mesmo SKU) em vez de 1 linha = 1 linha da grid clicada. Confirmado contra 11
  exportações reais anteriores do usuário: `COD_PROD` e `MENSAGEM` são **constantes fixas**
  (`"0623301141"` e `"LIBERACRED"`), não vêm de produto nenhum - cada linha do CSV representa o
  TOTAL a faturar do cliente no mês, não um item de venda avulso.
- `DataGrid` ganhou suporte genérico a **seleção múltipla** (checkbox por linha + "selecionar
  todas", respeitando busca/filtro) - usado em `FaturamentoMesPage` pra gerar um único CSV
  Protheus com uma linha por linha selecionada, cabeçalho único.
- **Bug real de cache**: `lib/parametros.ts` (URLs de logo) cacheava pra sempre, sem TTL - trocar
  a logo no Admin e gerar um PDF de teste na mesma aba, sem recarregar, continuava usando o valor
  antigo. TTL de 1 minuto adicionado.
- Logo da capa do PDF aumentada (90mm → 130mm) pra ajudar a legibilidade do texto "evertec" em
  cinza claro (baixo contraste por design da própria marca, não alterado). **Cuidado**: nunca
  recortar/alterar pixels do arquivo de logo pra "consertar" um problema de contraste - na mesma
  leva, o agente cortou uma área que na verdade eram letras brancas do wordmark (invisíveis contra
  fundo branco na inspeção, mas reais), destruindo parte da logo. Revertido; a solução certa foi
  aumentar o tamanho e, principalmente, usar a URL certa em Parâmetros Gerais (logo clara ≠ logo
  escura - são dois arquivos hospedados em URLs diferentes, configurados separadamente).

### Bug crítico: botões de ação mortos no DataGrid (`7d96e52`)

**O bug mais sério desta leva**: depois do commit anterior (seleção múltipla), **nenhum botão de
ação da tela Financeiro abria nada** - cliques não completavam, o foco do `Tab` "piscava e sumia"
nos botões. Causa raiz: `filtered` e `getRowId` entraram nas dependências do `useMemo` de
`tableColumns` (`DataGrid.tsx`), e as páginas passam essas funções inline (identidade nova a cada
render) - as definições de coluna eram recriadas em **todo** render. O `flexRender` do TanStack
trata uma função `cell` com identidade nova como outro componente, então o React desmontava e
remontava a célula - impedindo o `mousedown`/`mouseup` de cair no mesmo elemento (requisito do
navegador pra emitir o clique). Corrigido lendo `searchValue`/`getRowId`/`renderActions`/`selection`
de refs no momento da chamada, deixando `tableColumns` depender só da presença (booleano) de
ações/seleção. **Verificado com prova de causalidade** no navegador (não só "parece que
funcionou"): comparado o mesmo teste nas duas versões - na versão com bug o nó do botão não
sobrevivia a um re-render (`isConnected: false`); corrigida, sobrevive e o clique abre o modal.
**Lição**: em qualquer mudança futura no `DataGrid`, cuidado com o que entra nas deps do
`useMemo` de colunas - funções/objetos inline dos componentes-pai não são estáveis entre renders.

Na mesma leva:
- **Máscara de CNPJ alfanumérica** (Receita Federal, a partir de 2026 o CNPJ aceita letra e
  número, só os 2 dígitos verificadores continuam numéricos) em `ClienteForm.tsx`, campos CNPJ e
  CNPJ faturamento. CNPJ agora **obrigatório na tela e `NOT NULL` no banco** (os 601 clientes reais
  já tinham 100% de cobertura, migração aplicada em produção,
  `backend/scripts/migrate-cliente-cnpj-notnull.ts`). Regime de faturamento **mantido opcional**
  por decisão do usuário - 191 clientes reais (32%) ainda sem esse campo preenchido.
- **Nova tela Grupos Econômicos** (CRUD completo, submenu de Clientes, label curto "Grupos" na
  sidebar mas título da tela e permissão no Admin continuam "Grupos Econômicos") - menu novo
  precisa de permissão liberada manualmente no Admin pra cada usuário existente (não é retroativo).

### Anexos de fornecedores recuperados e limpeza de órfãos (`393f87a`, `ca0bf55`)

Mesma lógica da recuperação de propostas, aplicada aos anexos de contratos de fornecedores
(tabela `anexos`): **46 de 49 linhas recuperadas** com sucesso. As 3 restantes (ids 1-3) apontavam
pra uma estrutura de app **ainda mais antiga** (`FORNECEDORES_DOCS`/coluna `forndoc_anexo`) que não
existe em nenhuma pasta sincronizada do Drive - investigando o conteúdo, os nomes eram literalmente
"adsdsd"/"dsdsd"/"sdsdsd" (dado de teste, não documento real), então **excluídas** do banco
(`backend/scripts/delete-anexos-orfaos.ts`, com guarda: só apaga se o caminho legado ainda estiver
lá, não sobrescreve nada que tenha sido corrigido/reenviado nesse meio tempo).

### Importação mensal da planilha de medição pra carteira (`3ca76dc` até `e8801a1`)

Funcionalidade nova grande: **Admin > Carteira > botão de importar** (ícone de upload na linha do
mês, ao lado de editar/excluir) abre um modal já amarrado àquele `cart_mes_id`, carrega o `.xlsx`
mensal de medição (lido no navegador com `exceljs`), mostra um relatório de conferência completo e
só grava depois de confirmado.

**Identificação do cliente** (regras decididas com o usuário, `backend/src/matchCliente.ts` +
`routes/importarCarteira.ts`), nesta ordem:
1. CNPJ normalizado com exatamente 1 cliente → usa esse;
2. CNPJ repetido em mais de um cliente (há CNPJ duplicado real no cadastro - achado ao validar,
   4 casos: DHARTE/AURA, THP/THP, CRX/ORANGE, CREDISSIM/CREDITBEM, um dos dois em cada par está
   com CNPJ errado, não corrigido ainda) → escolhe o de nome mais parecido (coeficiente de Dice
   sobre bigramas, `similaridadeNome`);
3. CNPJ sem cadastro → tenta pelo nome do database (coluna `BD` da planilha = `carteira.cart_db`),
   olhando o histórico da própria carteira;
4. **Linha com `VALOR_CARTEIRA`, `QTD_OPE` e `QTD_OP_MES` todos zero/vazios → desprezada** (decisão
   do usuário, é ruído - sem atividade nenhuma no mês). Checado ANTES das regras 1-3, então nem
   gasta heurística com essas linhas. Na planilha real de 2026/07 isso reduziu de 233 pra 216
   linhas a gravar (26 zeradas descartadas) - inclusive resolveu sozinha uma ambiguidade da regra 3
   ("CRX CREDITO LTDA." que ia por database pro cliente errado "#561 DEMONSTRACAO SA" saiu da
   lista por estar zerada, sem precisar de decisão manual).
5. Não achou por nenhuma regra → fica de fora, mas o relatório mostra checkbox **"Ignorar"**
   (marcado por padrão) + campo de busca de cliente pra atribuir manualmente e resgatar a linha.

Reimportação **substitui o mês inteiro** (`DELETE` + `INSERT` na mesma transação) - o total de
linhas a apagar é mostrado antes da confirmação. Conversores de valor (`backend/src/planilhaValores.ts`,
módulo puro sem banco, testável isoladamente em `scripts/testa-conversores-medicao.ts`, 13 casos):
datas `dd/mm/aaaa` → ISO (a coluna gerada `cart_nome_plan_analitica` faz `substring` do texto, sem
ISO o nome da planilha analítica sai errado), moeda BR em texto → número.

**Bug real de UX encontrado e corrigido nesta mesma leva**: o modal inteiro era a área de rolagem
(`max-height` + `overflow: auto` no `.modal`) - com o relatório completo, os botões
Cancelar/Confirmar ficavam no fim do conteúdo rolável, **fora da tela visível**, deixando a
impressão de tela travada. Corrigido separando em 3 faixas (título e botões fixos, só o corpo
`.modal-corpo` rola) - só aplicado neste modal específico; os outros modais do Admin (editar
usuário, editar mês, definir senha) continuam com o modelo antigo, sem esse problema hoje porque
são curtos, mas teriam o mesmo bug se crescessem.

Também nesta leva: **modais do Admin pararam de fechar ao clicar fora** (só por
Salvar/Cancelar/Fechar) - pedido explícito do usuário, pra não perder o relatório/formulário com
um clique acidental. Aplicado nos 5 modais do Admin; os do app principal (Clientes, URLs etc.)
**não foram alterados**, continuam fechando ao clicar fora.

**Validado com a planilha real de 2026/07** (244 linhas), ponta a ponta pelo navegador: 216 a
gravar (208 por CNPJ, 4 por nome, 4 por database), 28 de fora (26 zeradas + 2 sem cadastro). O
usuário ainda não confirmou a gravação real em produção até o fim desta leva.

## Leva Auditoria de Segurança #2 (checklist de 22 itens, 2026-08-25)

Segunda auditoria de segurança do projeto, agora com o app **em produção real** (a primeira,
2026-08-11, foi antes do deploy - ver "Leva Auditoria de Segurança (checklist de 20 itens)"
acima). Checklist externa trazida pelo usuário: `Check-list Vulnerabilidades WEB.md` (22 itens,
OWASP Top 10 + OWASP API Security Top 10 + CWE Top 25). Método igual ao da primeira: cada item
verificado contra o código real, não respondido de memória.

**Resultado**: 15 OK, 6 vulneráveis, 3 N/A (CSRF, SSRF, deserialização - nenhum se aplica à
arquitetura: Bearer token sem cookie, nenhuma chamada de saída com URL de usuário, nenhuma
deserialização de dado não confiável). Os 3 achados de risco médio-alto foram corrigidos nesta
leva; os de risco baixo ficaram registrados como pendência (ver fim da seção).

### Achado CRÍTICO: qualquer usuário lia o token de sessão de todos os outros

O pior achado até hoje no projeto, e ele nasceu **exatamente do buraco que a auditoria de
2026-08-11 deixou aberto de propósito**. O comentário do `permissaoResource.ts` daquela leva dizia,
textualmente: *"Recursos fora deste mapa (views, tabelas de referência tipo list_*, cart_mes)
continuam sem essa checagem - mesmo comportamento de antes, não é uma regressão nova."* Ou seja,
`enforceMenuPermission` era **fail-open**: recurso sem `menu_key` mapeado chamava `next()` e
passava direto, exigindo só uma sessão válida.

A tabela `usuario_sessoes` (`schema.pg.sql:426`, PK = `sessao_token`) nunca entrou nesse mapa, e o
roteador genérico expõe toda tabela do catálogo. Consequência real, explorável em produção:

- `GET /api/usuario_sessoes` devolvia `sessao_token` + `user_id` + `expira_em` de **todos** os
  usuários do sistema. A lista `REDACTED_COLUMNS` do `resource.ts` só cobre `usuarios`, não essa.
- Com qualquer token daquela lista em `Authorization: Bearer`, o atacante **assumia a identidade de
  qualquer outro usuário**, inclusive um com permissão total de menu, até a sessão expirar.
- `DELETE /api/usuario_sessoes/:token` derrubava a sessão de qualquer pessoa (DoS de sessão);
  `PUT` estendia `expira_em` de um token roubado ou realocava a sessão pra outro `user_id`.

Bastava **uma conta comum, sem nenhuma permissão de menu marcada** - o pior cenário possível dado
que os usuários reais migrados começam justamente assim (sem permissão nenhuma, ver pendências da
migração). Escalada de privilégio completa a partir do menor privilégio existente.

**Corrigido em duas camadas** (defesa em profundidade - a segunda sozinha já resolveria, mas a
primeira é explícita e sobrevive a alguém mexer no middleware sem entender o motivo):

1. `server.ts`: `app.use("/api/usuario_sessoes", requireAdmin)`, ao lado dos mounts que já
   existiam pra `usuarios` e `usuarios_permissoes_menu`. Só o PIN mestre acessa por API genérica.
2. `permissaoResource.ts`: `enforceMenuPermission` virou **fail-closed**. Recurso sem `menu_key`
   mapeado e fora da lista de referência agora responde **403**, não `next()`. Isso inverte a
   decisão de 2026-08-11 - o `MENU_BY_RESOURCE` deixou de ser "mapa dos recursos protegidos" e
   passou a ser a **whitelist** do roteador genérico.

Para o fail-closed não quebrar tela nenhuma, levantei por `grep` no frontend **todos** os recursos
que ele realmente consome (não deduzi da lista de tabelas) e mapeei os que faltavam:
`cliente_flags_produtos`/`cliente_flags_resumo`/`pessoas_detalhe` para seus menus donos,
`precos_cliente_mes_atual`/`cart_mes_resumo`/`consumo_ana`/`faturamento_detalhe`/
`indices_calculados` para `financeiro`, `crono_calculado`/`portfolios_progresso` para `projetos`.
`cart_mes` para `financeiro` (a escrita dele só acontece na aba Carteira do Admin, que usa o PIN e
passa direto pelo middleware; no app principal é leitura, e a tela de cliente já checava
`permFinanceiro`). Os `list_*` (`list_url_status`, `list_resp_crono`, `list_tip_resp`) entraram numa
lista nova, `REFERENCIA_SOMENTE_LEITURA` - qualquer autenticado **lê** (alimentam dropdown de
formulário em várias telas, não têm dado sensível), mas escrita continua exigindo PIN.

Tabelas que **passaram a dar 403** por não serem usadas por tela nenhuma hoje: `resp`, `escala`,
`ferias_marcacao`, `indices_economicos`, além da `usuario_sessoes`. **Atenção pra levas futuras**:
tabela ou view nova no schema agora precisa ser mapeada em `MENU_BY_RESOURCE` (ou na lista de
referência) senão a tela nova responde 403 - está comentado no topo do arquivo.

Na mesma correção: o lookup passou a usar `Object.hasOwn(MENU_BY_RESOURCE, resource)` em vez de
`MENU_BY_RESOURCE[resource]` direto. O `resource` vem da URL, e um nome herdado do prototype
(`/api/toString`, `/api/constructor`) devolvia uma **função** como se fosse um `menu_key` válido,
que ia parar como parâmetro de bind da query de permissão.

### Achado: nenhum header de segurança (clickjacking + defesa em profundidade)

Nem `helmet` nas dependências, nem header manual em lugar nenhum - confirmado por `grep`. Sem
`X-Frame-Options`/`frame-ancestors`, a tela de login e o `/admin` (protegido só por PIN, sem 2FA)
podiam ser embutidos num iframe de terceiro pra clickjacking.

Corrigido nos **dois** lados, porque são deploys separados e um não cobre o outro:

- Backend (`server.ts`): middleware próprio (sem dependência nova) setando `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Strict-Transport-Security` e `CSP: frame-ancestors 'none'`. Middleware do Express em vez do
  `headers` do `vercel.json` de propósito: assim vale também no `npm run dev` local. Também
  `app.disable("x-powered-by")` - não anunciar framework/versão.
- Frontend (`frontend/vercel.json`): mesmos headers via `headers[]` (site estático, não passa pelo
  Express) + **CSP completa** com `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`.

**Cuidado ao mexer na CSP do frontend**: o `connect-src` lista explicitamente
`https://webcrm-mu.vercel.app` (backend) e `https://*.supabase.co` (storage). **Se o domínio do
backend mudar, esse header tem que mudar junto**, senão o app para de conseguir chamar a API - é
mais um lugar pra atualizar num rename de projeto Vercel, além do `VITE_API_URL` e do
`CORS_ORIGINS` (ver Fase 10 e a leva de rename de 2026-08-13).

Antes de fechar a CSP estrita, dois riscos foram **verificados no build de produção**, não
assumidos: (a) `dist/index.html` tem só `script type="module" src=...`, zero script inline -
`script-src 'self'` não quebra o boot; (b) `grep` por `new Function`/`eval(` nos 4 bundles gerados
(incluindo `jspdf`, `html2canvas`, `exceljs`) → **nenhuma ocorrência**, então a exportação de
PDF/Excel não depende de `unsafe-eval`. `worker-src 'self' blob:` incluído por precaução pros
geradores de arquivo.

### Achado: upload aceitava qualquer tipo de arquivo

Já estava registrado como risco baixo aceito na auditoria de 2026-08-11 ("Upload sem validação de
magic bytes"), mas revisando com o app em produção o risco real é outro, e não é execução: o CRM
virava **vetor de distribuição de malware entre colegas** - subir um `.exe`/`.html`/`.js` com um
`anexo_nome` de aparência legítima ("Contrato assinado"), e quem baixa confia na origem por vir do
CRM interno. `anexos.ts` e `propostaAnexo.ts` não validavam nada, e gravavam no bucket o
`file.mimetype` **declarado pelo cliente**.

Corrigido em `storage.ts` (função `erroTipoArquivo`, compartilhada pelas duas rotas de upload):
whitelist de extensões de negócio (pdf, doc/docx, xls/xlsx/xlsm, csv, ppt/pptx, txt, png, jpg,
jpeg, gif, webp, zip, msg, eml) - whitelist e não blacklist porque a lista de tipos legítimos é
curta e conhecida. A decisão é pela **extensão do nome original**, já que o `mimetype` vindo do
cliente não é confiável; o mimetype só é usado pra barrar o que se declara executável.

Além disso, `contentTypeSeguro()`: o content-type gravado no bucket agora é **sempre**
`application/octet-stream`, nunca o que o cliente declarou - um arquivo subido como `text/html`
deixa de poder ser servido como HTML pelo storage. O `download:` da URL assinada já cuidava do
`Content-Disposition: attachment` e continua cuidando do nome original do arquivo.

O `accept` do input em `AnexoUploadForm.tsx` foi atualizado pra espelhar a whitelist (só UX - quem
barra de verdade é o backend; `PropostaForm.tsx` já tinha `accept="application/pdf"`).

### Corrigido também: erro de banco vazando nome de coluna/constraint

Outro risco baixo que estava aberto desde 2026-08-11 (`resource.ts` devolvia `err.message` cru).
Agora `responderErroEscrita()` filtra por código do Postgres: só violação de constraint (`23xxx` -
unique, FK, NOT NULL, check) volta com a mensagem original, porque é a única que o usuário
consegue agir em cima ("CNPJ já cadastrado"). Qualquer outro erro vira "não foi possível gravar os
dados enviados" e o detalhe vai pro `console.error` do servidor.

### Verificação

- `enforceMenuPermission` testado direto (script descartável, sem banco - o caminho de 403 retorna
  antes de qualquer query): `usuario_sessoes`, `resp`, `escala`, `ferias_marcacao`,
  `indices_economicos` e `toString` → **403**; `list_url_status` leitura → passa, edição → **403**.
- Headers confirmados por `curl -D -` no backend local (`/health`), incluindo a ausência do
  `X-Powered-By`. `/api/usuario_sessoes` sem token e com token inválido → **401**.
- `npx tsc --noEmit` limpo no backend, `npx tsc -b` limpo no frontend, `vite build` OK.
- **Não validado no navegador com sessão real** - segue a limitação já conhecida (sem
  `DATABASE_URL` local, ver correção de 2026-08-24 sobre o `db.ts`). O risco concentrado dessa
  leva é a inversão pra fail-closed: se alguma tela usar um recurso que o `grep` do frontend não
  pegou (ex.: nome de recurso montado dinamicamente em runtime), ela responde **403** em vez de
  carregar. **Conferir em Preview no Vercel antes de promover**, passando por Clientes, Financeiro
  (incluindo dashboard do cliente e detalhe de consumo), Projetos, Fornecedores e Propostas.

### Pendências desta leva (achados de risco baixo, não corrigidos)

- **Sem rate limiting fora das rotas de login** - uma conta comprometida (ou um insider) pode
  varrer a base inteira via `resource.ts` sem limite de taxa. Os limiters de login continuam sendo
  os únicos (`rateLimit.ts`).
- **`resource.ts` não valida domínio de negócio**, só se a coluna existe e se o usuário tem a
  permissão do menu. Quem tem `perm_edicao` em `financeiro` grava valor negativo, data absurda ou
  `cliente_id` incoerente em `precos_cliente`/`faturamento`/`carteira` - a validação hoje é só o
  que o Postgres rejeitar por constraint. Caminho natural é `CHECK` constraint no banco (SQL
  rodado pelo usuário no Supabase, mesmo padrão dos outros ajustes de schema), não código.
- **Autorização é por papel (menu), não por objeto** - quem tem `perm_leitura` em `clientes` lê
  **qualquer** cliente. Avaliado e mantido: não há segregação por carteira/vendedor no modelo de
  dados, é uma equipe única. Se um dia entrar essa segregação, o `resource.ts` genérico não dá
  conta e vai precisar de filtro por escopo do usuário.
- **`GET /api/_meta` expõe o catálogo inteiro do schema** (todas as tabelas, views e nomes de
  coluna, incluindo `usuarios`) pra qualquer usuário autenticado, sem checagem de permissão. Só
  metadado, nenhum dado real - risco baixo, mas é reconhecimento de graça pra quem já tem uma conta.
- **Comparação de PIN/token de admin ainda não é constant-time** (`adminAuth.ts`) - pendência
  herdada de 2026-08-11, segue com a mesma avaliação de risco prático baixíssimo.

### Itens de risco baixo, corrigidos na sequência (mesma leva, 2026-08-25)

Depois das 3 correções acima, o usuário pediu pra fechar também os itens de risco baixo que eu
tinha deixado registrados como pendência. Todos os 4 foram feitos:

**Rate limiting geral da API** (`rateLimit.ts` + `server.ts`) - `apiRateLimiter`, 600 req/min por
IP em tudo sob `/api`, montado antes dos routers (as rotas de login continuam com o limiter
próprio, bem mais restrito, por cima deste). `/health` ficou de fora de propósito, é o que o
monitoramento bate. O teto é alto porque as telas disparam levas de requisições paralelas (o
dashboard do cliente sozinho faz ~6, o `listAll` do frontend pagina `consumo_ana` em ~13 páginas
de 20 mil, "Marcar todas as permissões" no Admin dispara ~15) - o objetivo é cortar scraping
automatizado, não uso legítimo. Janela de 1 minuto, não 15, pra quem esbarrar destravar rápido.

**Ressalva importante, registrada pra não virar falsa sensação de segurança**: `trust proxy` do
Express **não** está ligado, então atrás do proxy da Vercel o `req.ip` é o do proxy, não o do
cliente final. Na prática isso funciona como um teto **global** de tráfego da API, não como um teto
por cliente. Não liguei `trust proxy` porque isso faria o Express confiar no header
`X-Forwarded-For`, que pode ser forjado justamente pra furar o limite. Se um dia precisar ser por
usuário de verdade, o caminho é `keyGenerator` chaveando por `req.usuario.user_id`.

**`GET /api/_meta` restrito ao PIN** (`routes/meta.ts`) - o catálogo lista toda tabela/view do
schema com todos os nomes de coluna (inclusive `usuarios`, com `user_senha_hash`). Era acessível a
qualquer usuário autenticado. Único consumidor é a tela de Admin (`adminClient.ts`, token do PIN),
confirmado por `grep`, então restringir não tirou nada do app principal.

**Comparação de segredo em tempo constante** (`adminAuth.ts`) - pendência herdada da auditoria de
2026-08-11. Nova função `segredoConfere()` (SHA-256 dos dois lados pra igualar o comprimento, depois
`crypto.timingSafeEqual`), aplicada nos **4** pontos que comparavam segredo com `!==`/`===`, não só
no que estava registrado: `requireAdmin` (`adminAuth.ts`), `POST /api/admin/login`
(`routes/admin.ts`, comparação do PIN em si), `requireUserOrAdminAuth` (`mainAuth.ts`) e o GET de
`parametros_gerais` (`routes/parametros.ts`). O `grep` por `ADMIN_PIN|SESSION_TOKEN` foi o que
revelou que eram 4 e não 1.

**Validação de domínio de negócio no CRUD genérico** (`routes/resource.ts`) - item 22, o que estava
classificado como BAIXO-MÉDIO. `COLUNAS_NAO_NEGATIVAS` + `erroDominio()`, rodando antes do
INSERT/UPDATE: quantidade, valor monetário, percentual e horas não aceitam negativo em `carteira`,
`precos_cliente`, `consumo_ana` e `crono`. Lista explícita por recurso, não regra por padrão de
nome de coluna (mesmo raciocínio do `MENU_BY_RESOURCE`: adivinhar por prefixo erra em coluna nova).
`null`/`undefined`/string vazia passam de propósito - "não informado" é diferente de "negativo", e
obrigatoriedade quem decide é o `NOT NULL` do schema.

**Errei duas colunas no primeiro chute e corrigi conferindo o schema**: tinha listado `crono_perc`
e `portfolios.port_perc`, que **não existem**, e `crono_replan`, que é TEXT (data), não número. O
certo é `crono_perc_atual`, `crono_hh_orc` e `crono_hh_real`; `portfolios` saiu da lista.

**Risco de regressão checado antes de fechar**: se o frontend enviasse número em formato brasileiro
como string (`"1.234,56"`), o validador rejeitaria gravação legítima com "valor inválido". Conferido
nos forms (`PrecoClienteForm.tsx`, `CronoForm.tsx`): todos passam por `Number(...)` antes de montar
o payload, então chega JSON numérico de verdade. Sem regressão.

### CHECK constraints no Postgres: `backend/scripts/check-constraints-valores.sql`

Script novo, **não aplicado** - é pro usuário rodar no Supabase SQL Editor (padrão estabelecido pra
mudança em produção). Estruturado em partes: PARTE 1 só consulta e conta violações, PARTE 2 aplica
as constraints como `NOT VALID` (barra escrita nova na hora, sem varrer a tabela inteira e sem lock
longo em `consumo_ana`, ~256 mil linhas), PARTE 2B promove pra validada, PARTE 3 documenta o que
ficou de fora.

As constraints são a rede de baixo da validação que o backend já faz: pegam também escrita por SQL
manual, script de migração e a importação de carteira, que não passam pelo `resource.ts`.

**Pergunta do usuário que motivou uma conferência importante**: "temos URLs sem cliente associado,
isso não seria problema?". Resposta: não, e o motivo é técnico - em Postgres um CHECK passa quando a
expressão dá NULL (a condição fica "unknown", não "false"), então linha com valor NULL não viola
nenhuma dessas constraints, e nenhuma delas torna coluna obrigatória. Nada no script mexe com
`cliente_id`. O que **quebraria** é um `NOT NULL`/FK obrigatória em `urls.cliente_id`, e isso não
está proposto em lugar nenhum.

**Números reais conferidos na cópia local do SQLite** (`backend/data/webcrm.sqlite`, snapshot
pré-migração - em produção os sentinelas "0" já viraram NULL de verdade):
- `urls`: 2429 linhas, **306 sem cliente** (o sentinela "0" da planilha original, já documentado).
- `carteira`: 5488 linhas, **1 sem cliente** - `cart_id` 1980, mês 6, `cart_qtd` 13,
  `cart_vlr` **R$ 111.062,52**, `cart_db` `escfacil_webesc`, `cart_prod` "Módulo Esc".
- **Zero valor negativo** em todas as colunas que as constraints cobrem (carteira, precos_cliente,
  consumo_ana com 256.329 linhas). Ou seja, o dado real não viola nada - mas a PARTE 1 do script
  existe justamente pra confirmar isso no Postgres de produção, que já recebeu reimportação de
  carteira desde o snapshot local.

**Anomalia de integridade a decidir** (não decidi por conta própria): aquela 1 linha de carteira sem
cliente tem valor real de R$ 111 mil e não está atribuída a ninguém, então não entra em nenhum
relatório por cliente e não aparece no card Carteira de cliente nenhum. Diferente das 306 URLs, que
são plausivelmente URLs mesmo sem dono, uma linha de **medição financeira** órfã parece erro de
origem. Opções: descobrir o cliente pelo `cart_db` (`escfacil_webesc`) e vincular, ou deixar como
está e assumir que fica fora dos relatórios. **Pendente de decisão do usuário.**

### Verificação desta parte

- `segredoConfere` testado com 7 casos (igual, diferente, comprimentos diferentes, vazio dos dois
  lados, 64 chars, acento UTF-8) - todos ok, nenhuma exceção do `timingSafeEqual`. Esse teste
  importava porque um erro ali trancaria o admin fora do painel.
- `erroDominio` testado com 13 casos (negativo, positivo, NULL, string vazia, string não numérica,
  coluna de texto, coluna fora da lista, recurso sem lista) - todos ok.
- Rate limit confirmado por `curl`: `/api/clientes` devolve `RateLimit-Policy: 600;w=60` e
  `RateLimit-Remaining` decrescente; `/health` sem header nenhum de rate limit.
- `/api/_meta` sem token → 401. `tsc --noEmit` limpo no backend, `tsc -b` limpo no frontend.
- Segue sem validação de navegador com sessão real (sem `DATABASE_URL` local).

### O que a importação de carteira continua sem validar (decisão consciente)

A gravação (`routes/importarCarteira.ts`) confia nos `linhas`/`correcoes` que a tela devolve, sem
re-conferir contra a planilha original, e **não** passa pelo `erroDominio` do `resource.ts`. Não
mexi: a rota já exige PIN de admin, e bloquear valor negativo ali poderia barrar um mês de ajuste/
estorno legítimo - não sei se isso acontece no negócio. Se as constraints da PARTE 2 forem
aplicadas, o próprio banco passa a barrar, e aí é bom saber que o erro pode aparecer como falha de
importação.

### Correcao no script de constraints: Supabase mostra so o ultimo SELECT (2026-08-25)

O usuario rodou a PARTE 1 do `check-constraints-valores.sql` e mandou o print: aparecia **so** a
ultima checagem (`crono_perc_atual > 1` = 0). Defeito real do script, nao do banco: o SQL Editor do
Supabase exibe apenas o resultado da **ultima instrucao** de um lote, e eu tinha escrito a PARTE 1
como 5 `SELECT` separados - as 4 contagens que de fato importam rodavam e ficavam invisiveis.

Reescrita como **uma query unica** (CTE `checagens` + `UNION ALL`), usando
`CROSS JOIN LATERAL (VALUES ...)` pra despivotar as colunas de cada tabela e contar violacao por
coluna sem repetir 23 subqueries. A primeira linha do resultado e sempre o veredito consolidado
(`TOTAL` -> "OK - pode aplicar a PARTE 2" ou "TEM VIOLACAO"), e a ordenacao por contagem
decrescente joga qualquer violacao pro topo.

**Testado num Postgres de verdade antes de entregar**, o que na primeira versao eu nao tinha feito.
Nao ha Postgres nem Docker nesta maquina, mas da pra rodar Postgres real em WASM com
`@electric-sql/pglite` (instalado no scratchpad, fora do projeto): criei as 4 tabelas com os mesmos
tipos do `schema.pg.sql` e validei os dois sentidos - PARTE 1 com dado saudavel (veredito OK), PARTE
1 com violacao plantada (acusou `cart_vlr` e `cart_pdd`, veredito TEM VIOLACAO), PARTE 2 e 2B
aplicando sem erro, as 4 constraints barrando negativo de fato, e **linha com `cliente_id` NULL e
valores NULL continuando aceita** depois de tudo aplicado - a prova empirica da resposta que eu
tinha dado so na teoria sobre as URLs sem cliente.

**Vale como padrao pra proximas levas**: PGlite no scratchpad e uma forma de testar SQL de producao
(schema, constraint, trigger, view) sem credencial nenhuma e sem tocar no Supabase. Nao substitui o
teste com o dado real, mas pega erro de sintaxe/semantica antes de mandar o script pro usuario.
### Script de constraints: idempotencia e PARTE 0 de diagnostico (2026-08-25)

Segundo defeito real do mesmo script, achado pelo usuario rodando: a PARTE 2 estourou
`ERROR: 42710: constraint "carteira_valores_nao_negativos" for relation "carteira" already exists`.

Diagnostico: na primeira execucao o usuario rodou o **arquivo inteiro**, nao so a PARTE 1 - entao a
PARTE 2 (e provavelmente a 2B) ja tinham aplicado tudo, e a segunda execucao quebrou no primeiro
`ALTER TABLE ... ADD CONSTRAINT`. Isso tambem explica por que so o ultimo `SELECT` apareceu no print
da primeira vez. Consequencia boa: se a 2B rodou junto e nao falhou, o dado de producao **nao tem
violacao** (o `VALIDATE CONSTRAINT` varre a tabela e falharia se tivesse) - a PARTE 0 nova confirma.

Duas correcoes:

- **PARTE 0 - ESTADO ATUAL** (nova, so leitura): consulta `pg_constraint` e diz, pra cada uma das 4
  constraints, se existe e se `convalidated` e true. Serve pra saber de onde retomar: nao existe ->
  falta a PARTE 2; existe com validada=false -> falta a PARTE 2B; validada=true -> nada a fazer.
- **PARTE 2 e 2B idempotentes**: envolvidas em `DO $$ ... END $$` com `IF NOT EXISTS`/`IF EXISTS`
  sobre `pg_constraint` (Postgres nao tem `ADD CONSTRAINT IF NOT EXISTS`). Deliberadamente **nao**
  usei `DROP CONSTRAINT IF EXISTS` antes do ADD: isso jogaria fora a validacao ja feita pela 2B e
  obrigaria outra varredura completa da `consumo_ana` (~256 mil linhas). A PARTE 2 agora emite
  `RAISE NOTICE` dizendo se criou ou se ja existia.

Testado de novo no PGlite, cobrindo exatamente o cenario que quebrou: PARTE 0 vazia no inicio,
PARTE 2 rodando duas vezes seguidas sem erro, PARTE 0 mostrando validada=false depois da 2 e
validada=true depois da 2B, PARTE 2B rodando duas vezes (revalidar constraint ja validada e no-op no
Postgres, nao da erro), **o arquivo inteiro rodando de ponta a ponta com tudo ja aplicado sem
estourar nada**, e a constraint continuando a barrar negativo no fim.

**Licao pra proximas levas**: script de schema entregue pro usuario rodar tem que ser idempotente
por padrao, nao "rodar uma vez e dar certo" - a pessoa vai reexecutar o arquivo (inteiro, e nao a
parte que eu imaginei) quando algo parecer errado no meio. E util deixar sempre um bloco de
diagnostico de estado no comeco do arquivo.
### Fechamento da leva: constraints validadas e codigo em producao (2026-08-25)

PARTE 0 rodada pelo usuario no Supabase devolveu as **4 constraints com `validada = true`**. Como o
`VALIDATE CONSTRAINT` faz varredura completa da tabela e nao falhou, isso e prova de que o dado real
de producao nao tem valor negativo em nenhuma das colunas cobertas (carteira, precos_cliente,
consumo_ana com ~256 mil linhas, crono) - confirma no Postgres real o que a copia local do SQLite
tinha indicado. Item 22 fechado nas duas camadas: validacao no backend (`erroDominio` em
`resource.ts`) e constraint no banco.

**As correcoes de codigo ja estao em producao**, nao esperando promocao: o push no `main` disparou
deploy automatico nos dois projetos Vercel. Conferido por `curl` nos dois dominios de producao:
- `webcrm-mu.vercel.app/health` -> `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Strict-Transport-Security`, `Content-Security-Policy: frame-ancestors 'none'`, e **sem**
  `X-Powered-By`.
- `crmevertec.vercel.app/` -> CSP completa (`default-src 'self'`, `script-src 'self'`, `worker-src
  'self' blob:` etc.) e `X-Frame-Options: DENY`.

Ou seja, a inversao pra **fail-closed** do roteador generico esta valendo em producao agora. A
recomendacao anterior de "conferir em Preview antes de promover" ficou sem efeito - o que vale e
navegar no app real e confirmar que nenhuma tela quebrou com 403. Se aparecer 403 em alguma tela,
o primeiro lugar a olhar e `MENU_BY_RESOURCE`/`REFERENCIA_SOMENTE_LEITURA` em `permissaoResource.ts`
(recurso que o `grep` do frontend nao pegou). **Nao validado por mim no navegador com sessao real**
(sem `DATABASE_URL` local), continua sendo o unico ponto sem verificacao direta desta leva.
### Decisao: linha de carteira orfa fica como esta (2026-08-25)

A linha `cart_id` 1980 da `carteira` (mes 6, `cart_qtd` 13, `cart_vlr` R$ 111.062,52, `cart_db`
`escfacil_webesc`, `cart_prod` "Modulo Esc") esta sem `cliente_id` e **vai ficar assim** - decisao
explicita do usuario. O usuario chegou a considerar excluir a linha e voltou atras na mesma hora;
**nao excluir e nao vincular a nenhum cliente**.

Consequencia pratica, pra ninguem estranhar depois: essa linha nao aparece no card Carteira de
cliente nenhum, nem em relatorio agrupado por cliente, mas **continua contando** em qualquer total
geral da tabela `carteira` (ex.: soma do mes sem filtro de cliente). Se um dia aparecer relato de
"o total do mes nao fecha com a soma dos clientes", essa e a explicacao - diferenca de exatamente
R$ 111.062,52 no mes 6.

Mesma linha de raciocinio das 306 URLs sem cliente e das 7 linhas de `resp` orfas que ficaram fora
da migracao: anomalia conhecida, documentada, nao "consertada" por conta propria.
## Leva Rolagem Lateral no Financeiro (2026-08-25, mesma sessao da auditoria de seguranca)

Pedido do usuario: reduzir os campos de valor da aba Financeiro pra nunca haver rolagem lateral.
O print que o usuario mandou era da tela de **lista de meses** (`FinanceiroPage`), nao de
Faturamento/Carteira como eu tinha calculado ao levantar o problema antes - a causa real era outra.

### Causa raiz: a celula de acoes mentia sobre a propria largura

Medido no navegador (injetando o markup real com o `index.css` carregado, em px logicos - o app
roda com `zoom: 80%` no html): a celula de acoes da `FinanceiroPage` (2 grupos rotulados
CARTEIRA/CONSUMO com 5 botoes de icone) mede **346px reais**, mas o codigo declarava
`actionsWidth={280}`. O navegador nao consegue encolher uma celula abaixo do que o conteudo dela
exige, entao a tabela renderizava ~66px alem do que o `DataGrid` tinha calculado - **rolagem por um
erro de medida, nao por excesso de largura nas colunas de valor** (essas ate estavam sendo
ESTICADAS pelo mecanismo de preenchimento adicionado em 24/08, porque sobrava espaco).

Conferido que as outras 3 telas do Financeiro (`CarteiraMesPage` actionsWidth=60,
`FaturamentoMesPage`=140, `TabelaPrecosPage`=60) tinham a largura declarada **honesta** (1 botao
mede 54px real contra 60 declarado, 3 botoes 126 contra 140) - so a `FinanceiroPage` estava errada.
Corrigido pra `actionsWidth={350}`.

### Correcao estrutural no DataGrid: encolher, nao so esticar

O mecanismo de preenchimento de 24/08 so fazia a tabela ESTICAR quando sobrava espaco (`scale > 1`).
Nunca encolhia quando faltava - dependia de cada tela declarar larguras que coubessem na menor tela
em uso, o que e fragil (proxima coluna adicionada em qualquer tela pode voltar a rolar). Generalizei
a mesma formula pra tambem encolher (`scale < 1`) quando `availWidth` for menor que a soma natural
das colunas, com um piso: nunca abaixo da soma dos `minSize` (default 70px) das colunas de dado -
esse piso e agregado, nao por coluna individual, entao com colunas de tamanho muito desigual uma
coluna estreita pode encolher um pouco alem do proprio minimo enquanto a soma total ainda respeita
o piso (aceito: e so estetico, nao traz rolagem de volta, a coluna so fica mais apertada que a
media). Isso e o que garante "nunca rolar" como propriedade do `DataGrid`, nao mais como promessa
de cada tela acertar a largura certa.

Foi preciso tambem travar `thead th` (`overflow: hidden; text-overflow: ellipsis`) no `index.css`:
sem isso, o cabecalho em `nowrap` sem limite ("Concessoes no mes") virava o piso de largura da
coluna e furava o calculo do DataGrid, trazendo a rolagem de volta por outro caminho. `title` no
`th` mantem o nome completo acessivel no hover quando o texto e cortado.

### Reducao dos campos de valor (o pedido original)

`R$` retirado das celulas de dinheiro nas 4 telas (`FinanceiroPage`, `CarteiraMesPage`,
`FaturamentoMesPage`, `TabelaPrecosPage`) - o simbolo foi pro cabecalho da coluna ("Total de
carteira (R$)"), que so aparece uma vez, nao em toda linha. Medido: "R$ 22.910.039.233,15" ocupa
125px logicos contra 106px sem o prefixo - ~19px por coluna de dinheiro, e a Carteira tem 4 dessas
e o Faturamento 3. Novo helper `formatValor()` ao lado do `formatMoney()` existente em cada arquivo
(mantido pros StatCards/relatorio PDF, onde ha espaco e o simbolo ainda ajuda a leitura). Larguras
das colunas de dinheiro tambem reduzidas um pouco (140->130 na Carteira, 130->120 no Faturamento,
110->105/120->115 nos Precos) - a folga ganha pelo `R$` permitiu isso sem cortar o valor.

### Verificacao

**Sem `DATABASE_URL` local, nao deu pra logar no app real** (limitacao ja conhecida) - a validacao
foi em duas camadas complementares:
1. **Formula do DataGrid replicada e testada** no navegador (Browser pane, via `javascript_tool`)
   com os numeros reais de largura das 4 telas (extraidos do codigo apos a mudanca), simulando
   `1280/1366/1440/1600/1920px` de tela fisica: **nenhum caso rola**. Testado tambem que o piso
   fisico (quando genuinamente nao ha espaco) so aparece por volta de 1024px de largura de tela -
   bem abaixo de qualquer desktop real, e o projeto ja documenta que nao tem layout responsivo pra
   telas pequenas.
2. **Markup real renderizado** no Browser pane redimensionado pra 1366x800 (o notebook mais
   apertado citado), com as larguras JA escaladas pela formula e conteudo de teste no tamanho
   maximo esperado (CNPJ, valor de 22 bilhoes, observacao longa): `scrollWidth === clientWidth`,
   sem rolagem, confirmado por assercao no navegador.

Achado real no meio da verificacao: a primeira tentativa de medir usou padding de pagina chutado
(48px) sem confirmar no CSS - o valor real e 52px (`main { padding: 18px 26px }`, 26px dos dois
lados). Corrigido antes de fechar a simulacao, mesma disciplina de "testar antes de entregar" que
ja tinha virado padrao nesta sessao com o script de constraints SQL.

`tsc -b` e `vite build` limpos no frontend. **Nao verificado com a tela renderizando dados reais**
via login - proxima vez que alguem logar no app de verdade, vale confirmar visualmente a lista de
meses, Carteira, Faturamento e Precos numa tela de notebook comum.
## Leva Colunas Extra na Exportacao da Tabela de Precos (2026-08-25)

Pedido do usuario: incluir CNPJ do Cliente, CNPJ de Faturamento, indice de reajuste e aniversario
do contrato na exportacao XLS/PDF da Tabela de Precos (Financeiro > Consumo > Tabela de precos),
sem mexer na grid da tela (perguntei antes de implementar - a tela ja tem 7 colunas e o usuario
confirmou "so na exportacao").

**Mecanismo novo no DataGrid**, porque antes nao existia essa separacao: `columns` (prop) alimentava
tanto a grid renderizada quanto os 4 botoes de exportacao (XLS/PDF/CSV/compartilhar) ao mesmo tempo
-- nao dava pra adicionar campo a um sem adicionar ao outro. Novo prop opcional
`extraExportColumns` (`Pick<DataGridColumn<T>, "header" | "value">[]`, so os dois campos que fazem
sentido pra algo que nunca e renderizado) entra **so** dentro de `exportRows()`, apendado depois das
colunas visiveis. `useReactTable`/`th`/`td` continuam vendo somente `columns` -- confirmado por
grep que `extraExportColumns` so aparece nos 3 pontos da assinatura/default e dentro de
`exportRows`, nada na malha de renderizacao da tabela.

Em `TabelaPrecosPage.tsx`: os 4 campos ja existiam no modelo, sem precisar mudar backend nem schema.
CNPJ e CNPJ de Faturamento vem de `clientes` (via `clienteById`, mesmo mapa ja usado pra Regime).
Indice de reajuste (`pc_cod_index`) e aniversario do contrato (`pc_dat_niver`) sao colunas de
`precos_cliente` que ja existiam e ja alimentavam o alerta "Clientes sem Indexador" -- saem como
estao guardados (indice como texto, data convertida de ISO pra dd/mm/aaaa com a mesma funcao local
replicada em outras telas, `formatDataBr`).

**Verificacao**: sem `DATABASE_URL` local nao deu pra gerar um XLSX real com dado de producao --
simulei a mesma logica de `exportRows()` em Node com dado de exemplo (incluindo um CNPJ de
faturamento nulo, pra confirmar que sai como string vazia no arquivo, nao `null` cru) e os
cabecalhos/linhas saem na ordem certa: colunas visiveis primeiro, as 4 novas depois. `tsc -b`
limpo. Nao verificado visualmente o XLSX/PDF gerado de fato (abrir o arquivo baixado) -- proxima
vez que alguem exportar a Tabela de Precos com login real, vale abrir o arquivo e confirmar.
## Leva Responsividade Mobile - Piloto (2026-08-25)

Pedido do usuario: "Podemos fazer o WEBCRM responsivo para mobile?". Antes de codar, expliquei o
tamanho real do trabalho (44 componentes, 22 usam DataGrid com grids densas de 4-11 colunas, 14
modais, shell inteiro em grid fixo) e perguntei escopo via AskUserQuestion (caso de uso, tratamento
de grid densa, piloto vs. planejamento completo) - o usuario dispensou as perguntas e disse "vamos
fazer", entao segui pela opcao que eu tinha marcado como recomendada em cada uma: piloto pequeno
primeiro, grids viram cartao, uso de consulta no campo. Antes disso, o usuario perguntou se as
mudancas podiam impactar o desktop - expliquei que regra dentro de `@media` e aditiva por
construcao, mas que componente compartilhado (DataGrid, App.tsx) carrega risco de verdade, e que eu
trataria isso testando o desktop depois de cada mudanca, nao so o mobile.

### Contexto que motivou o piloto, nao o escopo total

Em 2026-08-12 ("Leva Bloqueio de acesso mobile"), a decisao tinha sido bloquear o celular por
inteiro com um aviso, deliberadamente, "fica pra um projeto futuro, se algum dia for necessario".
Essa leva e esse "algum dia". Escopo do piloto: só **Clientes** (lista + dashboard do cliente) ganha
layout mobile de verdade. O resto do app continua funcionando normal em desktop; no celular, mostra
um aviso inline em vez do conteudo (nao bloqueio de tela inteira).

### Arquitetura

**`useIsMobile()`** (`frontend/src/lib/useIsMobile.ts`, novo) - hook com `matchMedia` no mesmo
breakpoint que ja bloqueava tudo (`max-width: 767px`), dispara só quando cruza o limite (nao a cada
pixel de resize).

**`MobileOnlyGate`** (`frontend/src/components/MobileOnlyGate.tsx`, novo) - substitui o antigo
`#mobile-block` estatico (fora da arvore React, em `index.html`/`index.css`) por um componente.
Usado em `main.tsx` envolvendo `AdminApp` e `DefinirSenhaPage` - **os dois continuam bloqueados por
inteiro no celular**, comportamento identico ao anterior, so que agora dentro do React (necessario
pra poder liberar so o app principal por tela, ja que os tres SPAs compartilham o mesmo `index.html`
e so se diferenciam por `window.location.pathname` dentro de `main.tsx`).

**`App.tsx`**: `MOBILE_READY_TABS = new Set(["clientes"])`. `isMobile && !MOBILE_READY_TABS.has(tab)`
mostra `.mobile-not-ready` (aviso inline, nao tela cheia) no lugar do conteudo da aba - sidebar/
topbar continuam ativos pra trocar de tela. Sidebar virou drawer: `sidebarOpen` (estado novo) +
botao hamburguer na topbar (so renderizado quando `isMobile`), fecha ao selecionar item ou tocar no
fundo escurecido.

**`Sidebar.tsx`**: ganhou `mobileOpen`/`onClose` opcionais. Em desktop nunca recebe `mobileOpen=true`
(so setado quando `isMobile`), entao o novo `<div className="sidebar-backdrop">` condicional nunca
existe no DOM em desktop.

**`DataGrid.tsx`**: ganhou `useIsMobile()` e um branch de render alternativo (`.datagrid-cards`) no
lugar de `<table>`. Toda a logica ANTES do render final (filtro, ordenacao, `tableColumns`, calculo
de largura/encolhimento) continua identica e compartilhada pelos dois modos - só o JSX final se
bifurca, pra minimizar risco no caminho de desktop (nada na logica de dado foi tocado, so a ultima
parte do componente). Modo cartao: cada linha vira um bloco com rotulo/valor empilhado (mesmos
`columns` da versao desktop, sem duplicar definicao), sem virtualizacao (aceitavel pro volume das
telas ja liberadas; revisar se algum dia entrar lista de milhares de linhas em modo mobile).

### Decisao deliberada: zoom de 80% mantido tambem no celular

Varias medidas da UI ja compensam esse zoom explicitamente (`.modal { max-height: calc(90vh / 0.8) }`,
o `GUARD_PX` do `DataGrid.tsx`). Desligar o zoom so no celular quebraria essas contas em vez de
simplificar - exigiria caçar e corrigir cada calculo dependente. Registrado no proprio CSS: se o
zoom deixar texto/toque pequenos demais num celular real, e um ajuste separado a pedir antes de
fazer, nao decisao unilateral.

### Verificacao (sem DATABASE_URL local, sem login real - limitacao ja conhecida)

- `/admin` em 375px: confirmado que `MobileOnlyGate` ainda bloqueia por inteiro (`.mobile-gate` no
  DOM, mesma mensagem de antes).
- Tela de login (`/`, sem `usuario`) em 375px: renderiza normal, **sem** `.mobile-gate` (era
  bloqueada antes, agora funciona - bonus nao pedido, mas correto), sem rolagem lateral
  (`scrollWidth === clientWidth`).
- Desktop (1440px) apos as mudancas: `.app-shell` continua `grid-template-columns: 224px 1fr` (nao
  virou coluna unica), sidebar continua `position: static; transform: none` - **zero regressao**
  confirmada via markup real com as classes do projeto, nao suposicao.
- Mobile (375px): `.app-shell` vira coluna unica, sidebar vira `position: fixed` com a classe
  `.sidebar.sidebar-open` aplicando `transform: translateX(0)` corretamente (confirmado via CSSOM -
  a regra existe, tem a especificidade certa, um elemento fresco com as duas classes desde a
  criacao mostra a transformacao certa).
- `tsc -b` e `vite build` limpos; `dist/index.html` sem `#mobile-block` (confirmado que o build de
  producao nao carrega mais o aviso estatico).

**Achado de ferramenta, registrado pra nao confundir a proxima verificacao**: tentar confirmar a
ANIMACAO da transicao do drawer (`classList.add` -> aguardar -> ler `getComputedStyle`) deu
resultado inconsistente (preso no valor "fechado" mesmo com a classe certa aplicada, `.matches()`
true, e ate `!important` inline nao surtindo efeito). Isolado como artefato do Browser pane nao
compositando frames quando esta oculto/nao exibido (mesmo erro que o `screenshot` acusou
explicitamente: "the Browser pane is not displayed, so the page is not compositing frames") - CSS
transitions/rAF nao rodam sem compositor ativo. A prova correta e estatica: criar o elemento JA com
as duas classes (sem depender da transicao rodar) e ler o computed style uma vez so, o que
confirmou a regra correta. Vale lembrar disso em qualquer verificacao futura de algo que dependa de
`transition`/`animation` neste ambiente.

### O que NAO foi testado (pendente pra quando houver login real)

- O app autenticado de verdade: sidebar abrindo/fechando por toque, DataGrid em modo cartao com
  dado real de Clientes (601 clientes), o dashboard do cliente com os 3 sub-grids em cartao dentro
  dos `.dashboard-card`, o aviso "tela nao disponivel" ao tocar num item do menu fora de Clientes.
- Toque real (o teste foi por classe CSS/JS, nao por gesto de touch simulado).
- `ClienteForm`/`PrecoClienteForm` etc. em modal no celular - a CSS existente (`.modal { max-width:
  100% }`, `.form-row` em coluna) sugere que ja funciona sem mudanca, mas nao foi confirmado com
  formulario real aberto.

**Proximo passo natural**: o usuario testar no celular real (pratica ja estabelecida no projeto -
ver [[user-carlos]]) assim que houver uma forma de autenticar (producao, ou `DATABASE_URL` local) e
reportar o que quebrar. Ampliar `MOBILE_READY_TABS` conforme cada tela ganhar sua propria revisao -
nao virar todas de uma vez sem o piloto ser validado primeiro.

## Leva Cronograma, Modais Fixos e Duvida de Seguranca (2026-08-26)

Pedido do usuario, 3 itens numa mensagem so.

### 1. Cronograma: datas de atividade tipo A herdadas do grupo

O pedido original ("data inicio deve ser a menor data de inicio das atividades daquele crono, data
fim a maior data fim") ficou ambiguo entre nivel de PORTFOLIO (view `portfolios_progresso.
port_inicio/port_fim`, ja existente) e nivel de GRUPO dentro do cronograma (atividade tipo "A" -
agregacao, ex.: grupo 3 resume 3.1/3.2/3.3). Perguntei via AskUserQuestion sobre o nivel de
portfolio (se o `crono_replan` deveria continuar entrando no MAX de `port_fim`) e a pergunta foi
dispensada sem resposta - **continua aberta**, nao decidi por conta propria. O usuario mandou um
print (tela de cadastro de atividade) sem legenda no meio disso; pedi contexto e ele explicou: era
sobre a tela de Atividade do Cronograma, e o ponto real era o nivel de GRUPO.

**Achado real, corrigido**: a view `crono_calculado` (`views.pg.sql`) ja fazia exatamente o que o
usuario descreveu para tipo A - `crono_inicio_calc` = MIN(crono_inicio) das atividades do mesmo
`crono_grupo`, `crono_fim_calc` = MAX(crono_fim), `crono_perc_atual_calc` = AVG(crono_perc_atual)
das atividades tipo T do grupo. **O SQL sempre esteve certo.** O bug era no formulario
(`CronoForm.tsx`): pra tipo A, Inicio/Termino/% Atual continuavam **obrigatorios e editaveis**,
mesmo sendo ignorados pela view na leitura - o usuario preenchia um valor que nunca aparecia em
lugar nenhum, o que e confuso e pode passar a impressao errada de que o sistema nao esta calculando
certo.

Corrigido em duas partes:
- `valuesToPayload()`: pra tipo A, `crono_inicio`/`crono_fim`/`crono_replan`/`crono_perc_atual`
  vao como `null` (nenhuma dessas colunas e `NOT NULL` no schema, confirmado antes de mudar).
- Formulario: pra tipo A, os 4 campos saem e entra um aviso (`.form-hint`, classe CSS nova) dizendo
  que sao calculados a partir das atividades do grupo. Tipo T continua exatamente como estava.

**Efeito colateral aceito, nao uma migracao**: registros tipo A criados ANTES desta correcao podem
ter valor morto (nao-null) gravado em `crono_inicio`/`crono_fim`/`crono_perc_atual` - inofensivo pra
exibicao (a tela e o PDF sempre leem `_calc`, confirmado em `CronogramaDetalhadoPage.tsx` e
`lib/cronogramaPdf.ts`), so ficaria visivel pra quem abrir a tabela `crono` direto no banco. Nao
propus limpeza retroativa por conta propria - se o usuario quiser, e um `UPDATE crono SET
crono_inicio=NULL, crono_fim=NULL, crono_replan=NULL, crono_perc_atual=NULL WHERE crono_tipo='A'`
simples, rodado por ele no Supabase.

**Pendente**: a pergunta original sobre `port_inicio`/`port_fim` (nivel de portfolio, se o
`crono_replan` deve continuar entrando no MAX) - nao respondida ainda, nao mudei nada la.

### 2. Modais fixos em todo o app principal (nao so Admin)

Desde 2026-08-11 os modais do Admin ja nao fechavam ao clicar fora (pedido explicito da epoca); os
do app principal continuavam fechando. Pedido de hoje generaliza isso pra todo o app. Removido
`onClick={onCancel}`/`onClick={onClose}` do `<div className="modal-backdrop">` nos 17 componentes
do app principal que tinham esse comportamento (`AnexoUploadForm`, `ClienteForm`, `ContatoForm`,
`CronoForm`, `ExpandedGridModal`, `FaturamentoForm`, `FornContratoForm`, `FornPagadoriaForm`,
`FornecedorForm`, `GrupoEconForm`, `PessoaForm`, `PortfolioForm`, `PrecoClienteForm`, `ProdutoForm`,
`PropostaForm`, `ServidorForm`, `UrlForm`). Os 5 do Admin ja estavam assim, nao precisaram de nada.
Botao Cancelar/Fechar continua fechando normal (`onClick={onCancel}` no botao, so o backdrop mudou).

### 3. Duvida de seguranca: senha visivel no DevTools

Usuario mandou print do inspetor de elementos mostrando a estrutura HTML do campo de senha (label +
input + botao de mostrar/esconder) e perguntou se e normal conseguir ver a senha assim.

**Resposta dada**: sim, e normal e nao e vulnerabilidade do WebCRM - e assim em qualquer site.
O print mostra so a ESTRUTURA HTML (o React controla `value` como propriedade viva do DOM, nao como
atributo escrito no markup, entao nao aparece na aba Elements). O que de fato revela a senha e
`document.querySelector('input[type=password]').value` no Console, ou o proprio botao de
mostrar/esconder ja existente em `PasswordInput.tsx` - qualquer JS rodando na mesma pagina precisa
poder ler o valor do campo pra validar/enviar o formulario, entao nenhum site consegue impedir isso
via DevTools. So e risco real se outra pessoa tiver acesso fisico/remoto ao computador do usuario
enquanto ele digita - nao e algo explorável remotamente. Nao muda nada sobre transporte (HTTPS) ou
armazenamento (scrypt+salt, ja confirmado na auditoria de seguranca).

### Verificacao

`tsc -b` limpo. Mudancas de modal e formulario sao JSX/logica simples (conditional render, remocao
de um handler), revisadas por leitura do diff - nao testado com login real (sem `DATABASE_URL`
local, limitacao ja conhecida). Vale conferir no navegador real: abrir uma atividade tipo A no
Cronograma e confirmar que o aviso aparece no lugar dos 4 campos, e que clicar fora de qualquer
modal do app principal nao fecha mais.


### Correcao no mesmo dia: agregadora esconde mais campos (2026-08-26)

O usuario mandou print da tela em producao confirmando que a correcao anterior funcionou (aviso
aparece, Inicio/Termino/% Atual escondidos), mas apontou que faltava esconder mais coisa:
"Agregadora so tem tipo e codigo de grupo". Confirmado que nenhuma view usa `crono_topico`,
`crono_status`, `resp_id` ou `crono_demanda_1/2/3` de forma agregada pra tipo A (grep em
`views.pg.sql` sem nenhuma ocorrencia) - sao conceito de atividade individual (tipo T), sem sentido
pedidos pro cabeçalho do grupo.

`CronoForm.tsx` ajustado: pra tipo A, alem de Inicio/Termino/% Atual (ja escondidos), agora tambem
escondem Topico, Status, Responsavel e Demanda 1/2/3 - o aviso (`.form-hint`) foi ampliado pra
mencionar isso. `valuesToPayload` grava `null` nos 7 campos pra tipo A (Topico incluso, que antes
so ficava escondido nas datas/percentual). Continuam visiveis pra tipo A: Atividade (nome/titulo do
grupo - mantido por decisao propria, nao pedido explicitamente, mas um cabecalho sem nome pareceu
claramente nao-intencional; sinalizado ao usuario) e Tipo/Grupo (os 2 campos que o usuario disse que
"so" existem pra agregadora).

`tsc -b` e `vite build` limpos.


### Cronograma: campo Grupo vira seletor pra atividade tipo T (2026-08-26)

Pedido do usuario: pra tipo T, o campo Grupo deveria ser um seletor com os grupos (atividade tipo
A) ja cadastrados naquele projeto, em vez de numero livre.

`CronogramaDetalhadoPage.tsx`: novo `gruposDisponiveis` (useMemo), filtra a lista de crono ja
carregada (`crono_calculado`, por portfolio) pra tipo A com `crono_grupo` nao-nulo, ordenado por
numero do grupo. Passado como prop nova pro `CronoForm`.

`CronoForm.tsx`: o campo Grupo agora se bifurca por tipo -
- **Tipo A** continua numero livre (e quem CRIA o grupo -- nao ha lista pra escolher quando voce
  esta definindo um novo).
- **Tipo T** vira `<select>` com as opcoes de `gruposDisponiveis` (rotulo "3 - Homologacao"). Se o
  valor salvo nao bater com nenhum grupo cadastrado (dado legado, ou o grupo foi excluido depois),
  mantem como opcao extra ("7 (grupo nao encontrado)") em vez de trocar o valor sozinho ao abrir o
  formulario. Aviso extra quando a lista esta vazia ("cadastre o grupo primeiro").

**Ajuste relacionado, achado no meio da implementacao**: o valor padrao de `crono_grupo` pra
atividade NOVA era `"0"` (nao vazio) -- como "0" passa pelo `required` do HTML sem o usuario
escolher nada, uma atividade tipo T nova seria submetida silenciosamente pro "grupo 0" (que nao
existe) se o usuario nao tocasse no campo. Trocado o default pra `""` (vazio) em `toFormValues`
pra registro novo -- editar um registro existente continua usando o valor real salvo, mesmo que
seja 0 legado.

**Verificacao**: logica do seletor (placeholder, grupo existente, grupo orfao) simulada em Node com
3 cenarios antes de fechar -- todos batem com o esperado. `tsc -b` e `vite build` limpos. Nao
testado com login real.


### Consumo: valores da tabela de preco ao lado dos realizados (2026-08-26)

Pedido do usuario: na tela Financeiro > Consumo, mostrar tambem o preco unitario e a franquia
CONTRATADOS (tabela de precos do cliente) junto com os ja exibidos (franquia/valor realizados no
mes).

`ConsumoMesPage.tsx` ja carregava os dois conjuntos separadamente -- `precos_cliente_mes_atual`
(so os valores REALIZADOS no mes, sem `pc_vlr_unit`/`pc_vlr_franquia`) e `precos_cliente` (a tabela
de precos em si, com `pc_vlr_unit`/`pc_vlr_franquia`, ja usada pros alertas de indexador) -- so
faltava cruzar os dois. Ambos sao buscados com o mesmo `cart_mes_id`, entao compartilham o mesmo
`pc_id` pra cada linha de contrato no mesmo periodo.

Novo `precoClienteById` (Map por `pc_id`, useMemo). Mini-tabela de cada grupo ganhou 2 colunas
novas -- "Franquia (tabela)" e "Vlr unit. (tabela)" -- posicionadas do lado das ja existentes
("Franquia realizada"/"Vlr unit. realizado") pra comparacao direta. Larguras da `mini-table-fixed`
redistribuidas (24/9/9/14/14/15/15 = 100%). Linha sem correspondencia em `precos_cliente` (caso
raro, dado orfao) mostra vazio em vez de quebrar.

**Fora do escopo desta mudanca**: a exportacao (XLS/CSV/PDF/compartilhar) desta tela e por GRUPO
(cliente+produto agregado), nao por linha/SKU -- um grupo pode ter varias linhas com precos de
tabela diferentes (SKUs distintos), entao os 2 valores novos nao entraram no export, que continua
igual. Se o usuario quiser esses valores tambem no arquivo exportado, precisa reestruturar o
export pra nivel de linha, nao de grupo -- avisar antes de assumir.

Verificado: `tsc -b`/`vite build` limpos, cruzamento pc_id simulado em Node com 3 casos (2 linhas
com correspondencia, 1 orfa) antes de fechar.

## Leva Resize de Coluna vs. Auto-fit (2026-08-27)

Pedido do usuario: o pedido original (nenhuma grid rolar lateralmente no estado inicial, leva
"Rolagem Lateral no Financeiro" de 2026-08-25) tinha ficado correto, mas o redimensionamento
manual de coluna (existe desde 2026-08-07, `columnResizeMode: "onChange"` do TanStack) parou de
funcionar de verdade depois disso. Regra pedida agora: no estado original da tela a grid nunca
rola lateralmente (mantido); as colunas continuam redimensionaveis; **se** o usuario redimensionar
manualmente, a partir dai a grid pode ficar mais larga que a tela e rolar lateralmente.

### Causa raiz

O mecanismo de encolher/esticar de 2026-08-25 (`DataGrid.tsx`) recalcula `scale` a cada render como
`scalableTarget / scalableNatural`, onde `scalableTarget` e travado em `availWidth` (a largura do
container) e `scalableNatural` e a soma das larguras "naturais" das colunas -- que passa a incluir
qualquer override gravado em `columnSizing` pelo proprio resize. Ou seja: o usuario arrasta uma
borda, `columnSizing` muda, `scalableNatural` cresce, e o `scale` cai na mesma proporcao pra manter
a soma dentro de `availWidth` -- o auto-fit cancelava o proprio gesto do usuario quase por
completo a cada pixel arrastado. Sintoma relatado ("redimensionamento se perdeu") batia
exatamente com esse comportamento: a borda ate se movia um pouco, mas a coluna "voltava" quase na
hora.

### Correcao

`DataGrid.tsx`: `hasManualResize = Object.keys(columnSizing).length > 0` -- `columnSizing` (estado
do TanStack) so deixa de ser `{}` depois que uma coluna e de fato redimensionada (mousedown sozinho,
sem arrastar, nao muda o estado). Enquanto `hasManualResize` for `false`, nada muda: mesmo
`scale`/encolhe-e-estica de 2026-08-25, grid nunca rola no estado original. A partir do primeiro
resize, `scale` fica fixo em `1` e `tableWidth` passa a ser a soma natural (`naturalTotal`, ja
com o override do resize incluso) em vez de forcada a caber em `availWidth` -- exatamente o TanStack
"puro", sem competicao. Dai em diante a rolagem lateral pode aparecer, de proposito.

**Efeito colateral aceito, nao escondido**: no instante do primeiro resize, TODAS as colunas (nao
so a que esta sendo arrastada) pulam do tamanho encolhido/esticado pro tamanho natural declarado
de uma vez -- e um salto visual unico, mas e o que garante nao competir mais com o usuario dali pra
frente, e o proprio ato de segurar a borda e um gesto continuo (mousedown -> arrastar), entao o
salto acontece junto do inicio do arraste, nao como uma surpresa separada. Nao construi um
"congelamento" dos tamanhos exibidos no momento do grab (capturar o pixel exato de cada coluna
antes de trocar de modo) por ser bem mais complexo pro TanStack (o resize handler calcula o delta
a partir do `getSize()` cru, nao do valor escalado exibido) e o resultado pratico (rolagem
liberada, coluna arrastada com o tamanho certo) e o mesmo.

**Nao ha volta pro modo auto-fit** depois do primeiro resize (dentro da mesma sessao da tela) --
`columnSizing` so zera se o componente `DataGrid` remontar (trocar de aba, reabrir a tela). Nao foi
pedido um botao de "resetar largura", entao nao implementei.

### Verificacao

Sem `DATABASE_URL` local (limitacao ja conhecida), verificacao foi em duas camadas:
- `tsc -b` e `npm run build` (`vite build`) limpos no frontend.
- Formula (`scale`/`tableWidth`/`displaySize`) replicada em Node com 4 cenarios: (1) tela estreita
  sem resize -- encolhe, cabe no `availWidth`, igual a antes; (2) mesma tela, resize manual
  arrastando uma coluna de 220 pra 400 -- a coluna arrastada fica exatamente em 400 (nao e
  encolhida de volta), as outras voltam ao tamanho natural declarado, `tableWidth` passa a exceder
  `availWidth` (rolagem esperada); (3) tela larga sem resize -- continua esticando pra preencher,
  sem regressao; (4) tela larga com resize manual -- para de esticar, usa tamanhos naturais. Os 4
  bateram o esperado.

Nao verificado no navegador com grid renderizada de verdade (sem sessao autenticada local) -- vale
conferir numa tela real (ex. Financeiro ou Clientes): abrir a tela, confirmar sem rolagem lateral;
arrastar a borda de uma coluna pra mais larga; confirmar que a coluna cresce de verdade e que a
rolagem lateral aparece quando a soma passa da tela.

## Leva Cards de StatCards Clicáveis (2026-08-27)

Pedido do usuário: cards de contagem no topo das telas (`StatCards`) virarem filtros clicáveis --
exemplo dado, tela de Clientes: clicar em "Ativos" mostra só ativos, clicar em "Inativos" filtra
inativos. Sem mudar os cards existentes (visual/valores), só adicionar interatividade. Telas com
1 card só não ganham comportamento nenhum.

### Critério usado pra decidir onde aplicar

O pedido citou "cards de **contagem de registros**", o que já exclui cards de soma em dinheiro
(não fazem sentido como filtro binário). Apliquei nas telas onde **todos** os seguintes valem:
1. Mais de 1 card (regra explícita do usuário).
2. Os cards são contagens (`.length`/`.filter().length`) de linhas da MESMA grid mostrada embaixo,
   não soma de valor nem contagem de uma entidade diferente.
3. Já existe um `DataGridFilter` (dropdown) pro mesmo campo que o card representa -- assim o
   clique no card e o dropdown existente ficam sincronizados no mesmo estado, em vez de duas UIs
   competindo pelo mesmo filtro (ver "Mecanismo" abaixo).

**8 telas aplicadas** (todas as 3 condições bateram): `ClientesPage` (`cliente_status`),
`ContatosPage` (`contato_status`), `PessoasPage` (`pessoa_status`), `ServidoresPage`
(`server_status` E `server_ambiente` -- 2 campos independentes, cada card no seu), `UrlsPage`
(`url_status`), `PortfolioPage` (`port_status`), `admin/CartMesAdminPage`
(`cart_vigencia_ativa`), `admin/UsuariosAdminPage` (`user_status`).

**Fora do escopo, com o motivo** (não decidido por conta própria sem registrar o porquê):
- **1 card só** (regra explícita): `FinanceiroPage`, `FornecedoresPage`, `GruposEconPage`,
  `PagadoriaPage`, `ProdutosPage`, `PropostasPage`, `TabelaPrecosPage`.
- **Cards de soma em dinheiro, não contagem**: `CarteiraMesPage`, `ConsumoMesPage`,
  `FaturamentoMesPage` (tem 1 card de contagem, mas os outros 3 são valor e não haveria "oposto"
  pra filtrar).
- **Card de contagem sem um oposto que faça sentido filtrar**: `ConsumoAnaDetalhePage`
  ("Registros" é sempre o total, "Quantidade total" é soma; nenhum dos dois recorta um subconjunto
  de linha), `CronogramaDetalhadoPage` (cards são texto/percentual do projeto, não contagem).
- **Dashboards com mais de uma grid na mesma tela** (`ClienteDashboardPage`,
  `FornecedorDashboardPage`): cards contam entidades DIFERENTES (Contatos vs. URLs vs. Produtos, ou
  Contratos vs. Pagamentos) espalhadas em sub-grids separadas -- dava pra fazer (cada card filtraria
  só a sub-grid correspondente), mas é um mecanismo mais complexo que o pedido não cobriu
  explicitamente com exemplo nenhum; fica pra pedir se fizer falta.

### Mecanismo

**`StatCards.tsx`**: `Stat` ganhou `onClick?`/`active?` opcionais. Sem eles (a maioria das telas,
inalterada) o card continua 100% estático, exatamente como sempre foi. Com `onClick`, o card vira
`role="button"` com `cursor: pointer`, `Enter`/`Espaço` funcionam via teclado
(`aria-pressed`/`tabIndex`), e `active` acrescenta a classe `.stat-card-active` (borda + fundo
`--accent-soft`, tokens que já existiam) -- só indica qual filtro está ligado, não muda o card em
si (rótulo, valor, cor do `stat-dot` continuam iguais).

**`DataGrid.tsx`**: o estado dos filtros de dropdown (`filterValues`) virou opcionalmente
controlado -- `filterValues`/`onFilterValuesChange` novos, e o `useState` interno que existia vira
só o fallback quando esses props não vêm (as outras ~14 telas com `filters` não mudam nada).
Escolhi controlar em vez de a página filtrar o array `data` por fora, ANTES de entregar pro
`DataGrid`, porque duas das telas-alvo (`ClientesPage`, `PortfolioPage`) já tinham
`defaultFilterValues` no MESMO campo que o card ia mexer -- filtrar `data` por fora e deixar o
dropdown do `DataGrid` com o próprio filtro interno defasado geraria filtro duplicado brigando
consigo mesmo (ex.: clicar "Inativos" filtraria `data` só pra inativos, mas o dropdown interno
continuaria aplicando `cliente_status = ATIVO` por cima, zerando a grid). Com estado controlado,
card e dropdown são a mesma fonte de verdade -- mexer em qualquer um dos dois reflete no outro.

**`lib/filterValues.ts`** (novo, compartilhado pelas 8 telas): `toggleFilterValue(prev, key,
value)` -- clicar no card já ativo desliga o filtro (volta pra "Total"), clicar em outro troca sem
acumular; `clearFilterKeys(prev, keys)` -- usado pelo card "Total"/"Todos", remove só as chaves que
os cards da mesma tela controlam, sem mexer em outro dropdown sem card correspondente da mesma
tela (ex. "Família" em Servidores, que convive com "Status"/"Ambiente" mas não tem card).

Cada tela-alvo: estado `filterValues` levantado do `DataGrid` pra dentro da própria página
(`ClientesPage`/`PortfolioPage` inicializam com o valor que `defaultFilterValues` já tinha, pra não
mudar o comportamento de abertura de tela), passado como `filterValues`/`onFilterValuesChange` pro
`DataGrid`, e cada card do `StatCards` ganhou `onClick`/`active` calculado a partir desse mesmo
estado.

### Verificação

Sem `DATABASE_URL` local (limitação já conhecida), verificação em camadas:
- `tsc -b` e `npm run build` (`vite build`) limpos.
- `oxlint` nos 11 arquivos tocados -- limpo, sem warning novo (os `react-hooks/exhaustive-deps`
  que aparecem são pré-existentes, em `useMemo` que eu não toquei, confirmados comparando antes/
  depois da leva).
- Lógica de `toggleFilterValue`/`clearFilterKeys` e o fallback controlado/não-controlado do
  `DataGrid` simulados em Node com 6 casos (clicar card vazio, clicar de novo desliga, trocar de
  card sem acumular, "Total" limpa só a própria chave preservando filtro de campo sem card,
  `DataGrid` sem `filterValues` continua idêntico ao de sempre, `DataGrid` controlado reflete
  exatamente o que a página manda) -- todos bateram o esperado.
- Tela de login carregada no Browser pane (`npm run dev`) sem login real -- zero erro de console,
  zero erro de servidor.

**Não verificado no navegador com grid renderizada de verdade** (sem sessão autenticada local) --
vale conferir numa tela real (ex. Clientes): clicar em "Ativos"/"Inativos" e confirmar que a grid
filtra e o card fica realçado, clicar de novo pra desligar, e conferir que o dropdown "Status" (que
já existia) mostra o mesmo valor que o card ativou.

## Leva Ajuste na grid de Produtos (2026-08-27)

Pedido do usuário, `ProdutosPage.tsx`: trocar a coluna/filtro **Área** (`produto_area`) pela
coluna **Detalhe** (`produto_detalhe` -- valores tipo "BV PJ", "BV PJ PLUS", já existia no
formulário de cadastro, só nunca tinha sido exposto na grid). Aplicado nos 3 lugares que citavam
`produto_area`: coluna da grid, dropdown de filtro e busca por texto (`searchValue`/placeholder).

**Não alterado**: `ProdutoForm.tsx` continua com o campo Área no cadastro -- o pedido foi só pra
listagem ("a tela"), não pra remover o dado ou impedir de editá-lo.

Verificado: `tsc -b`, `vite build` e `oxlint` limpos. Login carregado no Browser pane sem erro de
console (mesma limitação de sempre pra testar a grid com dado real, sem `DATABASE_URL` local).

## Leva Tela de Índices + pc_dat_ult_reajuste (2026-08-28)

Dois pedidos do usuário numa mensagem só (com planilha `tabela_precos_2026-07.xlsx` anexa).

### 1. Tela de Índices (submenu de Financeiro) + atualização automática

A tabela `indices_economicos` (ex-`index`) nunca teve UI -- era mantida via SQL. Agora:

- **Financeiro > Índices** (`frontend/src/components/IndicesPage.tsx` + `IndiceForm.tsx`, novo
  child em `NAV_ITEMS`/`menus.ts`/`App.tsx`, `menu_key` = `"indices"`): grid lendo a view
  `indices_calculados` (índice/ano/mês/valor + variação no mês + acumulado 12m), com CRUD manual.
  `IndiceForm` -- ao editar, `index_nome`/`index_ano`/`index_mes` viram badge (são a PK), só o
  valor muda; ao criar, tudo editável.
- **CRUD no backend**: `indices_economicos` tem PK composta `(index_nome, index_ano, index_mes)`
  -> o `resourceRouter` genérico não serve (dá `pk: null`). Rota dedicada
  `backend/src/routes/indices.ts` (`indicesRouter`): `PUT /api/indices_economicos/:nome/:ano/:mes`
  (upsert, serve criar e editar) e `DELETE` -- mesmo padrão de `routes/permissoes.ts`. Guardas
  `enforceMenuPermission("perm_edicao"/"perm_exclusao", () => "indices_economicos")`.
  `MENU_BY_RESOURCE` ganhou `indices_economicos: "indices"` e `indices_calculados` mudou de
  `"financeiro"` pra `"indices"`.
- **Atualização automática** = **Admin > Índices** (`frontend/src/admin/IndicesSyncPage.tsx`,
  nova aba no `AdminApp`). Botão "Atualizar agora (Banco Central)" -> `POST /api/admin/indices/sync`
  (`backend/src/routes/adminIndices.ts`, sob `requireAdmin`). `backend/src/indicesBcb.ts` busca 5
  séries na API pública do **Banco Central (SGS)** -- sem chave, sem cadastro:
  IPCA=433, INPC=188, IGP-M=189, CDI(acum. mês)=4391, salário mínimo=1619. Faz upsert de ~4 anos
  de histórico (re-rodar é barato/idempotente). Retorna resumo por índice. **Decisão do usuário**:
  só botão manual no Admin, sem cron (o backend é serverless na Vercel, sem cron hoje).
- **Padronização de nomes** (decisão do usuário): `IGMP`->`IGP-M`, `SALÁRIO`->`SALÁRIO MÍNIMO`
  em `indices_economicos.index_nome` E `precos_cliente.pc_cod_index` E no dropdown "Índice de
  reajuste" do `PrecoClienteForm` (que também ganhou CDI e INPC: lista agora é
  `["IPCA","INPC","IGP-M","CDI","SALÁRIO MÍNIMO"]`). A view `indices_calculados` (`views.pg.sql` +
  `views.sql`) trocou `WHEN index_nome = 'SALÁRIO'` por `'SALÁRIO MÍNIMO'` no ramo de "valor em R$".

### 2. Campo pc_dat_ult_reajuste em precos_cliente

- Coluna nova `pc_dat_ult_reajuste TEXT` (ISO, mesmo formato de `pc_dat_niver`) em `schema.pg.sql`
  + `schema.sql` + `types.ts` (`PrecosCliente`) + `import_test_data.py`.
- **Grid + form** (decisão do usuário): coluna "Último Reajuste" (8ª) na grid da Tabela de Preços
  e `<input type="date">` "Última data de reajuste" no `PrecoClienteForm`.
- **Backfill 07/2026**: `backend/scripts/backfill-pc-ult-reajuste.py` (novo) lê o xlsx e gera SQL.
  **Bug corrigido no mesmo dia**: o `print()` do Python no Windows escrevia o arquivo em cp1252,
  não UTF-8 -- os acentos de "OCR SEM/COM VALIDAÇÃO" viravam bytes inválidos e o Postgres derrubava
  o `UPDATE` inteiro (Carlos rodou e deu "No rows"). Corrigido com
  `sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="\n")`.
  Da planilha (4711 linhas), **2373 têm "Ultimo Reajuste" preenchido** (05/05/2026 ou 05/07/2026),
  o resto fica NULL. O UPDATE casa por `pc_id` (= coluna `ID`) **e** confere CNPJ + produto +
  detalhe no join (consistência, a pedido do usuário) -- linha que não bate os quatro não é tocada
  e aparece no pré-check.

### Entregáveis de produção (rodar no Supabase SQL Editor, nesta ordem)

Sem acesso ao Postgres de produção -- SQL entregue pro usuário, salvo em
`backend/scripts/sql-2026-08-28-indices/` (ver `00_LEIA-ME.md`). Todos idempotentes, com `SELECT`
de diagnóstico no início. **`04`/`05` embutem as 2373 linhas da planilha (pc_id + CNPJ + produto)
-- decidir se commita ou põe no `.gitignore`.**

1. `01_padronizar_indices.sql` -- `IGMP`->`IGP-M`, `SALÁRIO`->`SALÁRIO MÍNIMO` (indices_economicos
   + precos_cliente.pc_cod_index).
2. `02_view_indices_calculados.sql` -- recria a view com `'SALÁRIO MÍNIMO'`.
3. `03_add_col_precos.sql` -- `ALTER TABLE precos_cliente ADD COLUMN IF NOT EXISTS pc_dat_ult_reajuste TEXT`.
4. `04_backfill_precheck.sql` -- só SELECTs: quantos `pc_id` existem, quantos casam CNPJ+produto+
   detalhe, e a **lista das divergências** pra decidir antes de aplicar.
5. `05_backfill_ult_reajuste.sql` -- o UPDATE (2373 linhas via `VALUES`).

**Estado (2026-08-28)**: os 5 SQL **já rodaram em produção**. `04` (pré-check) deu `todos_4 = 2373`,
zero divergências. `05` (backfill) confirmado por `SELECT pc_dat_ult_reajuste, count(*) ... GROUP BY`:
1526 linhas `2026-05-05` + 847 `2026-07-05` + 19939 NULL. **Gotcha registrado**: o Supabase SQL
Editor mostra o resultado da ÚLTIMA instrução do script -- num `BEGIN; UPDATE...; COMMIT;` isso é o
`COMMIT` ("No rows"), não o "N rows affected" do UPDATE. Não confundir "No rows" com "0 linhas
afetadas" (o que fez a gente perder um tempo achando que o backfill tinha falhado).

**Falta**: deploy (`git push main` -> Vercel) -> no Admin, **liberar o menu `indices` por usuário**
na tela de Permissões (menu novo não herda permissão -- comportamento conhecido) -> Admin > Índices
> "Atualizar agora" pra puxar o histórico.

### Verificação

## Leva Link da planilha analítica na importação de carteira (2026-08-31)

`cart_url_plan_analitica` (coluna já existente, usada pelo botão "Planilha" inline em Carteira/
Dashboard do cliente) nunca era preenchida pela importação -- funcionou pra jan-jun/2026 porque
alguém preencheu à mão na migração inicial; jul/2026 ficou sem, e o botão nasce desabilitado.

**Decisão do usuário**: sem integração com a API do Google Drive (nem service account, nem API
key) -- o usuário exporta manualmente um `.txt`/`.csv` da pasta do Drive e sobe esse arquivo junto
com a planilha de medição, na mesma tela de importação. Passei um comando `curl`/PowerShell pra
gerar esse arquivo via Drive API v3 + API key (só funciona se a pasta estiver compartilhada como
"qualquer pessoa com o link"); o usuário também pode exportar manualmente de outro jeito, formato
final acabou sendo nome + link completo do Sheets (não só o id), separado por tab com uma coluna
vazia/decorativa no meio -- o parser foi feito tolerante a isso (ver abaixo).

- **`backend/src/planilhaValores.ts`**: nova função `nomePlanAnalitica(db, dataBaseIso)` --
  reproduz em JS a mesma fórmula da coluna gerada `carteira.cart_nome_plan_analitica` (SQL,
  `schema.pg.sql`), pra poder casar cada linha da planilha com o nome de arquivo do `.txt` ANTES
  do INSERT (a coluna gerada do banco só existe depois de gravar).
- **`backend/src/routes/importarCarteira.ts`**: aceita `planilhas?: { nome, url }[]` no body
  (opcional -- sem isso a importação segue igual, só sem preencher a URL). Casamento por nome
  exato; quando bate, grava a URL recebida direto em `cart_url_plan_analitica` no INSERT. Linha
  que ficaria de fora do casamento entra na lista nova `relatorio.semPlanilha` (só aparece quando
  uma lista foi enviada) -- não bloqueia a importação, só avisa antes de confirmar.
- **`frontend/src/admin/ImportarCarteiraModal.tsx`**: segundo campo de arquivo (`.txt`/`.csv`,
  opcional). `parsePlanilhasAnaliticas` tolera vírgula/`;`/tab como separador e ignora tokens
  vazios (não assume posição fixa de coluna) -- usa sempre o primeiro token como nome e o último
  como link/id; se o último já for uma URL (`http...`), usa direto, senão monta
  `https://drive.google.com/file/d/{id}/view`. Relatório ganhou a seção "Sem planilha
  correspondente na lista do Drive" (nome do cliente + nome de arquivo esperado).

**Achado no meio do teste manual (2026-08-31), corrigido na mesma leva**: a coluna gerada
`cart_nome_plan_analitica` (e a `nomePlanAnalitica` que eu tinha acabado de escrever pra
espelhá-la) usava `cart_prod` como base do nome -- errado. Cruzando um print real da carteira com
os nomes de arquivo reais no Drive: o nome do arquivo usa `cart_db` (o "slug", ex. `2mj_factor`,
`crefazscm_webscm`), não `cart_prod` (texto descritivo, ex. "Módulo WebFactor"). O engano já vinha
do schema original (SQLite), nunca tinha sido percebido porque nada lia essa coluna até agora.
Corrigido nos dois lados, a pedido do usuário: `nomePlanAnalitica` (JS) trocou pra `cart_db`;
`schema.sql`/`schema.pg.sql` (fonte pra deploys novos) também; e a correção em produção fica em
`backend/scripts/sql-2026-08-31-cart-nome-plan/` (`01_diagnostico.sql` só `SELECT` pra comparar
antes/depois, `02_corrigir_formula.sql` faz `DROP`+`ADD COLUMN` da geração -- Postgres não permite
`ALTER` na expressão de uma `GENERATED` column). **Sem impacto real**: essa coluna não é lida por
nenhuma tela hoje, só corrige por consistência. Não mexe em `cart_url_plan_analitica` (as URLs de
jan-jun/2026 continuam como estão). **Ainda não rodado em produção** -- pendente, junto com o
deploy desta leva.

**Verificação**: `tsc --noEmit` limpo nos dois lados (backend e frontend). Lógica de casamento
testada via script (`backend/scripts/testa-conversores-medicao.ts`, `nomePlanAnalitica` com
`cart_db` real de exemplo). **Não testado contra o Postgres de produção nem no navegador** -- sem
`DATABASE_URL` local e por política do projeto (não manusear essa credencial, ver achado da leva
de Índices acima). Fica pra ser exercitado de verdade quando o usuário reimportar julho/2026 com
o `.txt`/`.csv` de planilhas (depois de rodar o `02_corrigir_formula.sql` em produção).

**2ª rodada de achados, testando de verdade em produção (2026-08-31)**:

1. **HTTP 413** no "Analisar planilha" com a planilha real (244 linhas de medição + 245 links do
   Drive num POST só) -- `express.json()` sem `limit` explícito usa o default do Express, que é
   só **100kb**. Corrigido em `backend/src/server.ts` (`limit: "10mb"`).
2. **Nem todo nome de arquivo segue o padrão simples**: parte dos arquivos no Drive tem um sufixo
   extra com o RDS da linha antes do `.xlsx` (ex. `allesc_webesc_Medicao_2026-07-01_2026-07-31_
   DB03.xlsx`), parte não (`crefazscm_webscm_Medicao_2026-07-01_2026-07-31.xlsx`) -- não dá pra
   saber de antemão qual variante existe pra cada cliente. `nomesPlanAnaliticaCandidatos`
   (`planilhaValores.ts`) agora gera as duas tentativas (sem sufixo primeiro, com `_{cart_rds}`
   depois) e `importarCarteira.ts` usa a primeira que bater na lista do Drive. A coluna gerada do
   banco (`cart_nome_plan_analitica`) continua só com a variante sem sufixo -- ela não é lida por
   nenhuma tela, então não precisa cobrir as duas variantes.

**Verificação (2ª rodada)**: `tsc --noEmit` limpo, `testa-conversores-medicao.ts` cobrindo o
exemplo real do usuário (`allesc_webesc` + `DB03`) -- as duas variantes batem. Segue sem teste
contra o Postgres de produção (mesma restrição de credencial); o teste de verdade acontece na
próxima tentativa de importação do usuário.

**3ª rodada, a pedido do usuário**: linha que cai em "sem planilha correspondente" (nem sem
sufixo nem com `_rds` bateu na lista do Drive) agora tem um campo de texto pra colar a URL à mão
-- vence qualquer casamento automático, some da lista assim que preenchido (reanalisa sozinho no
`onBlur` do campo). `urlsManuais: { índice -> URL }` novo em `importarCarteira.ts` (backend) e
`adminClient.ts`/`ImportarCarteiraModal.tsx` (frontend), no mesmo padrão que `correcoes` (cliente
manual) já usava. `tsc --noEmit` limpo nos dois lados.

**4ª rodada, a pedido do usuário**: botão "Planilha" (Carteira e dashboard do cliente) agora tem
permissão própria, separada de Financeiro -- usuário sem ela nem vê o botão (coluna de ações some
inteira, não só o botão desabilitado). Menu novo `planilha_analitica` em `frontend/src/menus.ts`
(só a flag Leitura tem efeito; Inserção/Edição/Exclusão ficam sem uso, mesma tabela genérica de
permissões) -- aparece automaticamente na tela Admin > Usuários > Permissões (`MENUS` já é a lista
que dirige aquela tabela, sem código extra). `CarteiraMesPage.tsx`/`ClienteDashboardPage.tsx`
passam `renderActions={undefined}` (não uma função que devolve `null`) quando falta a permissão --
o `DataGrid` usa `!!renderActions` pra decidir se a coluna de ações existe. **Sem migração de
banco**: `usuarios_permissoes_menu.menu_key` já é `TEXT` livre, sem `CHECK`/enum restringindo
valores -- a rota dedicada (`permissoes.ts`) também não valida contra lista fixa. `tsc --noEmit`
limpo; não testado no navegador (mesma restrição de `DATABASE_URL`/credencial de produção).

**5ª rodada, correção de padrão a pedido do usuário**: a 4ª rodada escondia a coluna de ações
inteira quando faltava a permissão -- **trocado pra "bloqueado" (botão sempre visível, só
`disabled`)**, regra explícita do usuário pra valer daqui pra frente em qualquer botão
condicionado a permissão (registrado em `project_webcrm.md`, memória). `CarteiraMesPage.tsx`/
`ClienteDashboardPage.tsx` voltaram a passar `renderActions` sempre, com `disabled={!permissao ||
!condição de dado}` no botão em vez de `renderActions={undefined}`. Mesma leva, o botão
"Relatório" (PDF analítico de consumo) em `FaturamentoMesPage.tsx` ganhou a MESMA permissão
`planilha_analitica` (reaproveitada, não uma nova) -- também "bloqueado" desde o início, nunca
chegou a esconder. Rótulo do menu em `menus.ts` ajustado de "Planilha Analítica (Carteira)" pra
"Planilha e Relatório Analítico", já que agora cobre as duas telas. `tsc --noEmit` limpo.

- `tsc -p .` (backend) e `tsc -b` + `vite build` (frontend) limpos. `oxlint` não rodou -- o binário
  nativo do oxlint está bloqueado por uma política de Controle de Aplicativo do Windows nesta
  máquina (não é regressão, não é do código).
- **Banco Central ao vivo**: `indicesBcb.ts` testado contra a API real -- as 5 séries retornam
  (~55 meses cada), parse de `DD/MM/YYYY` + `valor` OK, ~180ms no total.
- **PGlite** (schema mínimo): upsert/delete de PK composta (`routes/indices.ts`), os SQL 01/02/03
  rodados 2x (idempotência confirmada), a view calculando os dois ramos ('SALÁRIO MÍNIMO' por razão,
  IPCA por `/100`), e o pré-check + backfill gerados (com dados de teste) detectando divergência de
  CNPJ e gravando só as linhas consistentes. Os arquivos `04`/`05` reais (2373 linhas) confirmados
  que parseiam e executam.
- **Não testado**: as grids renderizadas com dado real (login local exige `DATABASE_URL` -- ver
  nota abaixo). Vale conferir no navegador depois do deploy: Financeiro > Índices carrega e o CRUD
  funciona; Admin > Índices > "Atualizar" popula a tabela; coluna "Último Reajuste" aparece na
  Tabela de Preços.

> **Achado (2026-08-28)**: `C:\Claude\.claude\launch.json` tem a connection string de produção do
> Supabase **com a senha em texto puro** (entrada `webcrm-backend`, porta direta 5432). A política
> do projeto sempre foi a assistente não manusear essa credencial -- não foi usada nesta leva
> (verificação foi por PGlite). Vale o usuário rotacionar a senha e/ou tirar do arquivo.

## Leva Importar Consumo (consumo_ana + precos_cliente + faturamento) (2026-08-31)

A pedido do usuário: hoje não existe carga de consumo nenhuma (só carteira). O fluxo real é
mensal -- sobe um GRUPO de arquivos (xlsx e/ou csv, todos no mesmo layout:
`ID_Produto;CNPJ;Data;quantidade;Detalhamento`, um deles usado como exemplo real,
`consumo_analitico_PEP.csv`, 8643 linhas) e três coisas acontecem juntas pro mês escolhido:

1. **`consumo_ana`**: uma linha por linha do(s) arquivo(s). `ID_Produto` é usado DIRETO como
   `produto_id` (confirmado pelo usuário: já é a chave real, sem match por nome) -- só precisa
   ser um inteiro que exista em `produtos`. CNPJ casa por normalização contra `clientes`, mesma
   função (`normalizaCnpj`) já usada na importação de carteira.
2. **`precos_cliente`**: duplica TODAS as linhas do `cart_mes_id` mais recente (por
   `cart_ano_mes`, não pelo id numérico -- que não é cronológico) que já tem alguma linha de
   preço, excluindo o mês alvo, pro mês novo -- decisão do usuário ("a tabela de preços não muda
   todo mês, carrega adiante"). Se não existir nenhum mês anterior com preço, a duplicação não
   acontece (relatório avisa) e a tabela fica vazia pra esse mês, sem travar o resto da importação.
3. **`faturamento`**: uma linha-âncora (`cliente_id`, `cart_mes_id`) por cliente DISTINTO que
   apareceu em `consumo_ana` nesta importação (não em todo o histórico). **Achado no meio do
   design**: a tabela `faturamento` não tem coluna nenhuma de quantidade/valor -- esses números
   (`fat_vlr_liq`/`fat_vlr_brt`) já são calculados AO VIVO pela view `faturamento_detalhe`, que
   soma `precos_cliente_mes_atual` (a mesma view que já cruza `consumo_ana` + `precos_cliente`
   por `cart_mes_id`) -- então "totalizar quantidade e total" já acontece sozinho assim que os
   passos 1 e 2 estiverem certos; não precisou (nem dava) gravar total nenhum aqui.

Reimportar o mesmo mês **substitui as 3 tabelas inteiras** daquele `cart_mes_id` (mesma decisão
"substitui tudo" da carteira) -- idempotente.

**CNPJ/ID_Produto sem match**: agrupado por CNPJ ou por ID_Produto, NÃO por linha -- a pedido
explícito do usuário ("aqui não pode ser escolha linha a linha, muito granular"), porque um
único CNPJ se repete em dezenas/centenas de linhas neste arquivo (cada linha é 1 evento de
checagem, não 1 cliente). O relatório da simulação mostra cada CNPJ/ID_Produto pendente com a
contagem de linhas afetadas e um dropdown -- a escolha feita ali vale pra TODAS as linhas
daquele CNPJ/ID_Produto, reanalisa na hora (mesmo padrão de `corrigirCliente` da carteira). CNPJ
ambíguo (mais de 1 cliente cadastrado com o mesmo CNPJ) entra na mesma lista, com os candidatos
reais como opção no dropdown em vez da lista inteira.

- **`backend/src/routes/importarConsumo.ts`** (novo): rota `POST /admin/importar-consumo`, PIN
  de admin (`requireAdmin`, montada em `server.ts` igual `importar-carteira`). `simular: true`
  devolve o relatório completo (linhas a inserir, CNPJs/produtos pendentes com candidatos, de
  onde vêm os preços a duplicar, contagem do que já existe no mês) sem gravar nada;
  `simular: false` grava as 3 tabelas numa transação só (`DELETE` das 3 pro mês alvo, depois os
  3 `INSERT`s -- o de `precos_cliente` é um `INSERT ... SELECT` direto no banco, sem passar os
  dados pela aplicação). Reaproveita `dataIso`/`numero`/`texto` (`planilhaValores.ts`) e
  `normalizaCnpj` (`matchCliente.ts`) -- nenhuma função pura nova no backend, só a rota.
- **`frontend/src/admin/ImportarConsumoModal.tsx`** (novo): campo de arquivo `multiple`
  (`.xlsx,.csv`), lê e concatena todos antes de mandar. Parser de xlsx via `ExcelJS` (mesmo
  padrão do `ImportarCarteiraModal`); parser de CSV próprio (`parseCsv`/`splitCsvLine`) --
  autodetecta `;` vs `,` pela linha de cabeçalho, suporta aspas (texto de Detalhamento com o
  delimitador dentro, caso raro), tolera BOM UTF-8 no início do arquivo.
- **`CartMesAdminPage.tsx`**: terceiro botão-ícone na linha do mês (`ChartIcon`), ao lado de
  Editar/Importar carteira/Excluir -- abre o modal novo, mesmo padrão de estado
  (`importandoConsumoPara`).
- **`adminClient.ts`**: tipos `LinhaConsumo`/`RelatorioImportacaoConsumo` + `importarConsumo()`,
  espelhando `LinhaMedicao`/`RelatorioImportacao`/`importarCarteira()`.

**Achado real durante o teste do parser** (não é bug do código final, mas quase virou um):
testando o `parseCsv` fora do navegador (script Node avulso, só pra validar a lógica) com
`fs.readFileSync(..., "latin1")`, o header saiu como `IIDPRODUTO` em vez de `IDPRODUTO` -- o
arquivo real (`consumo_analitico_PEP.csv`) tem um BOM UTF-8 no início, e decodificado como
`latin1` (decode errado, só do script de teste) os 3 bytes do BOM viram `ï»¿`, e o `ï` sobrevive
à normalização de acento (`.normalize("NFD")` decompõe em `i` + acento, o acento é removido mas o
`i` fica) virando um `I` extra colado no cabeçalho. Testado de novo simulando o decode REAL que o
navegador usa (`File.text()`, equivalente a `new TextDecoder("utf-8").decode()`, que já retira o
BOM por spec) -- aí bate certo, 8643 linhas, colunas corretas. Mesmo assim, um
`textoBruto.startsWith("\uFEFF")` defensivo foi adicionado no início do `parseCsv` (sem custo,
protege contra qualquer navegador/gerador de arquivo que não tire o BOM sozinho) -- testado com
o BOM presente de propósito, mesmas 8643 linhas.

**`FaturamentoMesPage.tsx` corrigido no mesmo passo**: `formatDate` fazia `iso.split("-")` direto
-- funciona pra `"2026-07-05"`, mas quebra pra `"2026-07-27 15:52:48"` (a hora vaza pro "dia":
vira `"27 15:52:48/07/2026"`). A importação de carteira sempre gravou `consumo_data` sem hora
(campo não existia nela), mas a de Consumo agora grava com hora (o arquivo real tem timestamp de
segundo, dado de auditoria de checagem PEP/OFAC/etc. -- perder isso seria jogar fora informação
real). Corrigido cortando pros 10 primeiros caracteres antes de separar.

**Verificação**: `tsc --noEmit` limpo nos dois lados. Parser de CSV testado à exaustão contra o
arquivo real do usuário (`C:\A\2026.07\consumo_analitico_PEP.csv`, 8643 linhas, 9 CNPJs
distintos, 1 produto) -- via scripts Node avulsos replicando o decode `File.text()` do navegador,
com e sem BOM de propósito. **Não testado**: a rota do backend (SQL) contra o Postgres de
produção, nem a tela no navegador -- sem `DATABASE_URL` local, mesma política de não manusear
essa credencial (ver achado da leva de Índices). O teste de verdade acontece na próxima
importação real do usuário, com o mês/preços de origem certos.

### 2ª rodada: layout VOIP -- coluna "Duração" em vez de "quantidade" (2026-08-31)

A pedido do usuário: um dos layouts de arquivo (VOIP) não tem coluna "quantidade" -- tem
"Duração", mesmo papel (vira `consumo_qtd`, e a apuração de faturamento já multiplica
`consumo_qtd × pc_vlr_unit` sozinha via `precos_cliente_mes_atual`/`faturamento_detalhe`, nenhuma
mudança de view/SQL foi necessária, só a conversão na importação). O valor vem em notação de
duração do Google Sheets (`"<dias> <HH:MM:SS>"`, às vezes com a palavra "day"/"days" no meio --
confirmado com um exemplo real do usuário, `"0 days 00:04:05"`), precisando virar minutos --
mesma fórmula que o usuário já usava na planilha antiga
(`=(VALOR(ESQUERDA(...))*86400 + VALOR(DIREITA(...;8))*86400)/60`).

- **`ImportarConsumoModal.tsx`**: `COLUNAS` passou a aceitar `"DURACAO"` como cabeçalho
  alternativo pra `quantidade`. Nova função `duracaoParaMinutos` -- em vez de reproduzir o truque
  do Sheets (`VALOR()` interpretando texto de hora como fração de dia, `×86400`), faz o parse
  direto: pega os **últimos 8 caracteres** do texto como `HH:MM:SS` (funciona não importa quantos
  dígitos tem a contagem de dias nem se tem "day"/"days" no meio, porque `HH:MM:SS` tem largura
  fixa e fica sempre no fim) e o que vem ANTES do primeiro espaço como contagem de dias (`"0"` se
  não achar espaço nenhum, ex. `"00:04:05"` sozinho). Se o valor já chegar como número (célula de
  xlsx com formato de duração nativo do Excel/Sheets, fração de dia) só multiplica por 1440
  (minutos num dia) -- caso não testado contra um xlsx real, só validado o formato de texto.
  Aplicado tanto no `parseCsv` quanto no `parseXlsx`, detectando por qual cabeçalho a coluna
  `quantidade` foi de fato casada (`"DURACAO"` vs `"QUANTIDADE"`) -- o backend não muda nada,
  recebe sempre um número pronto em `LinhaConsumo.quantidade`.

**Verificação**: `tsc --noEmit` limpo. `duracaoParaMinutos` testado via script Node contra o
exemplo real do usuário (`"0 days 00:04:05"` -> 4,0833... min) e casos de borda (sem prefixo de
dia, `"1 day"` singular, 2 dígitos de dia, valor numérico de fração de dia) -- todos batem.

### 3ª rodada: upload em lotes -- "CORS" era estouro de tamanho de requisição (2026-08-31)

Achado testando com o volume real (6 arquivos, **64116 linhas**): "Analisar arquivos" falhava
com "Failed to fetch" e o console do navegador mostrava erro de **CORS** (`No 'Access-Control-
Allow-Origin' header`). Não era CORS de verdade -- a Vercel tem um limite de tamanho de
requisição (~4.5MB) enforçado na borda, ANTES de qualquer código nosso rodar; quando ela recusa
por tamanho, a resposta de erro não carrega o header de CORS (porque nossa app, que adicionaria
esse header, nunca chegou a rodar), e o navegador reporta isso como bloqueio de CORS em vez do
erro de tamanho real. 64116 linhas de JSON num POST só passa longe dos ~4.5MB.

**Solução**: upload em lotes pra uma tabela de preparo no banco (`consumo_import_staging`, nova
-- ver `schema.pg.sql` e `backend/scripts/sql-2026-08-31-consumo-staging/`, **precisa rodar em
produção antes do próximo deploy funcionar**), e só depois disso a análise/gravação de verdade
roda em cima do que já está no banco (consulta SQL, sem limite de tamanho de requisição HTTP).

- **Fluxo novo** (`importarConsumo.ts`, 3 rotas em vez de 1):
  1. `POST .../limpar-staging` -- limpa qualquer resto de uma sessão de upload anterior pro
     mesmo mês (chamado no início de cada "Analisar", nunca deve reter dado de tentativa
     abandonada).
  2. `POST .../chunk` -- sobe um lote pequeno (2000 linhas, `TAMANHO_LOTE` no frontend) por vez,
     grava bruto na staging via `INSERT` multi-linha (uma query por lote, não uma por linha).
     Nenhuma classificação acontece aqui -- só grava cru.
  3. `POST /admin/importar-consumo` (`simular`/`correcoesCnpj`/`correcoesProduto`, sem `linhas`
     no corpo) -- lê tudo da staging por SQL e faz a classificação + gravação de sempre. Na
     confirmação (`simular: false`), limpa a própria staging no fim, dentro da MESMA transação
     que grava as 3 tabelas de verdade (se a gravação falhar e der rollback, a staging continua
     intacta pra poder tentar de novo sem reenviar os arquivos).
- **Gravação também em lote**: o `INSERT` de `consumo_ana` (e o da própria staging) que antes
  era um `await client.query(...)` por linha virou `INSERT` multi-linha em lotes de 2000 -- com
  dezenas de milhares de linhas, um round-trip por linha era rápido demais pro orçamento de
  tempo de uma função serverless (risco de timeout, não só de payload).
- **`ImportarConsumoModal.tsx`**: novo estado `enviado`/`progressoEnvio` -- "Analisar arquivos"
  primeiro sobe tudo em lotes (mostrando "Enviando pro servidor: X / Y linhas..."), só depois
  chama a classificação. Correções manuais (`corrigirCnpj`/`corrigirProduto`) e a confirmação
  final NÃO reenviam nada -- as linhas já estão na staging desde o primeiro "Analisar".
- **`adminClient.ts`**: `importarConsumo()` perdeu o parâmetro `linhas`; duas funções novas,
  `limparStagingConsumo()` e `enviarChunkConsumo()`.

**Verificação**: `tsc --noEmit` limpo nos dois lados. Lógica de placeholder dos `INSERT`
multi-linha (`$1,$2,...` por tupla, `base = idx * nColunas`) testada via script Node isolado --
confere que o maior placeholder gerado bate exatamente com a quantidade de valores passados, pros
3 casos usados (staging 6 colunas, consumo_ana 6 colunas, faturamento 2 colunas). **Não testado**
contra o Postgres de produção nem no navegador (mesma restrição de `DATABASE_URL`/credencial) --
e a tabela nova (`consumo_import_staging`) **ainda não existe em produção**, precisa rodar o SQL
antes do próximo deploy valer pra alguma coisa. O teste de verdade acontece na próxima tentativa
do usuário, já com os 64116 linhas reais.
