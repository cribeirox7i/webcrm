# WebCRM — Design System

> Convenções de UI do frontend (`frontend/src/`). Objetivo: manter as telas visualmente e
> interativamente consistentes conforme o app cresce — cada tela nova deve seguir o que
> já está registrado aqui antes de inventar um padrão novo. Este documento descreve o que
> **já existe implementado**; não é uma proposta, é o inventário do que o código faz hoje.

## Fundamentos visuais

### Paleta de cores (`index.css`, variáveis CSS em `:root`)

| Uso | Variável |
|---|---|
| Cor de marca (Evertec, laranja) | `--accent` / `--accent-soft` (fundo suave) / `--accent-hover` |
| Sucesso / ativo / em dia / líquido | `--green` / `--green-soft` |
| Erro / cancelado / atrasado / bruto | `--red` / `--red-soft` |
| Neutro (fundo hover, badge sem cor própria) | `--gray-soft` |
| Texto padrão / texto de título | `--text` / `--text-h` |
| Borda fraca / borda forte (inputs, cards) | `--border` / `--border-strong` |
| Fundo da página / fundo de superfície (card, modal, th) | `--bg` / `--surface` |
| Sidebar (sempre escura, não muda no dark mode) | `--sidebar-bg` / `--sidebar-text` / `--sidebar-text-active` |
| Raio de borda padrão de toda a UI | `--radius` (3px — bordas retas, não arredondadas) |

Todas (exceto sidebar) têm variante dark mode automática via
`@media (prefers-color-scheme: dark)`. **Nunca usar hexadecimal direto num componente ou
CSS novo** — sempre `var(--nome)`, senão a tela quebra o dark mode.

Texto "esmaecido" (labels, subtítulos, contagem de linhas) não tem variável própria —
convenção é `color: var(--text); opacity: 0.65–0.8`, não uma cor nova. Não existe
`--text-muted` no projeto — se você já viu essa variável referenciada em algum CSS, é bug
(foi corrigido em `.row-actions-group-label` em 2026-08-10; se aparecer de novo, é uma
variável nunca definida).

### Tipografia

- Fonte base: `"Segoe UI", system-ui, Roboto, sans-serif` (variável `--sans`), 13.5px,
  `line-height: 1.45`. Compacta de propósito — grids densas cabem mais linha sem rolar.
- `h1`/`h2` usam `--text-h` (mais escuro/contrastado que `--text`), `font-weight: 600`.
- Título da topbar (`.app-topbar h1`): 18px. Título de dashboard (`.dashboard-header h1`): 22px.
- Não existe hierarquia de `h3`+ fora dos cards do dashboard do cliente
  (`.dashboard-card h3`: 13px, uppercase, letter-spacing).

### Layout do shell

```
.app-shell (grid 224px 1fr, 100vh, overflow:hidden)
├── .sidebar (fixa, escura, nav + logo)
└── .app-content (flex column, 100vh)
    ├── .app-topbar (título da página / breadcrumb, 1 linha, nunca rola)
    └── main → .page (max-width 1400px, centralizado, flex column, flex:1)
```

**Regra de ouro herdada da leva do DataGrid**: a página inteira nunca rola
(`html, body { overflow-x: hidden }`, shell/topbar/sidebar com `flex-shrink: 0`) — só a
área de conteúdo rolável específica (`.table-scroll`, `.consumo-grupo-list` etc.) rola,
sempre com `min-height: 0` em toda a cadeia de flexbox pais até lá. Se uma tela nova
"vazar" e a página toda rolar, o bug quase certamente é um `min-height: 0` faltando em
algum container intermediário — não adicionar `overflow` na página como gambiarra.

### Breadcrumb / título da página

Controlado por hook, não por componente: `usePageTitle(["Financeiro", "Faturamento", mês])`
(`PageTitleContext.tsx`) empurra o título pra cima até `App.tsx`, que renderiza na
`.app-topbar`. O hook restaura o título padrão da aba ao desmontar. Não existe mais um
componente `Breadcrumb.tsx` — foi substituído por esse hook porque telas de drill-in ficam
várias camadas abaixo na árvore, sem acesso direto ao estado da topbar.

## Estrutura de uma página de listagem

Toda tela de listagem (Clientes, URLs, Produtos, Servidores, Pessoas, Fornecedores,
Contatos, Portfólio Completo, sub-telas do Financeiro) segue o mesmo esqueleto:

```tsx
<div className="page">
  <StatCards stats={[...]} />
  {loadError && <div className="banner-error">...</div>}
  <DataGrid ... />
  {editing && <XyzForm ... />}
</div>
```

- **`StatCards`** (`StatCards.tsx`): cards de indicador fixos no topo (`tone`:
  `accent|green|red|gray`, bolinha `.stat-dot-{tone}` + valor grande + label pequeno).
  Sempre 2 a 4 cards; primeiro card geralmente é o total (`tone="accent"`).
- **`banner-error`**: erro de carregamento, com botão "Tentar de novo" inline — nunca um
  `alert()` de load, só pra falhas de submit/delete (ver Erros abaixo).
- **`DataGrid`**: ver seção própria.
- **Formulário em modal**: `editing` no estado é `Entidade | null | "new"` (ou só
  `Entidade | null` quando a tela não cria, só edita — ex. `PrecoClienteForm`). `"new"`
  abre o form vazio; um objeto abre populado; `null` fecha.

### Erros e confirmações

- Falha ao **carregar** a lista: `banner-error` + botão "Tentar de novo" (chama `loadAll`
  de novo), não trava a tela.
- Falha ao **salvar/excluir**: `alert()` simples com a mensagem de erro da API
  (`(err as Error).message`). Não há toast/snackbar no projeto.
- Exclusão: sempre `confirm("Excluir ... ?")` antes de chamar a API — nunca excluir direto
  no clique do botão.
- Regra de negócio que impede uma ação (ex.: excluir atividade agregadora com filhos):
  `alert()` explicando o motivo, **antes** do `confirm()` de exclusão — não deixa o usuário
  confirmar uma ação que vai falhar.

## Grid clicável (padrão oficial, 2026-08-10)

**Decisão**: quando uma linha de grid tem uma tela de detalhe/drill-in associada (ex.:
abrir o dashboard do cliente, abrir o cronograma de um projeto, abrir o analítico de um
consumo), **a linha inteira é clicável** — não um campo específico estilizado como link.

**Por quê**: o padrão anterior (nome do cliente em laranja/negrito/sublinhado, o resto da
linha em texto normal) criava inconsistência entre telas — a tela de Projetos já nasceu
com a linha inteira clicável (sem nenhum campo destacado), e olhando as duas competindo
lado a lado ficou claro que o modelo de "linha inteira" é o melhor: mais área de clique,
sem exigir que o usuário ache o campo "certo" pra clicar, e sem precisar de uma classe de
cor/peso de fonte especial só pra sinalizar "isso é clicável".

**Como aplicar**:
- `DataGrid` (`frontend/src/components/DataGrid.tsx`): passe `onRowClick={(row) => ...}`.
  A linha ganha `cursor: pointer` automaticamente (classe `.clickable-row`, aplicada pelo
  próprio componente quando `onRowClick` está presente).
- **Nenhuma célula deve ter estilo de link** (sem `color: var(--accent)`, negrito ou
  sublinhado num campo específico pra indicar "clique aqui"). O texto de todas as colunas
  usa a tipografia padrão da grid.
- **Botões de ação dentro da linha** (`renderActions`, ícones, "Editar"/"Excluir" etc.)
  precisam de `onClick={(e) => e.stopPropagation()}` no container
  (`<div className="row-actions" onClick={...}>`), senão o clique no botão também dispara
  a navegação da linha.
- Pra tabelas que **não** usam o componente `DataGrid` (ex.: `ConsumoMesPage.tsx`, que
  renderiza uma `<table>` própria por ser um relatório agrupado, não uma grid genérica),
  aplique manualmente `onClick` na `<tr>` e a classe utilitária `.clickable-row` (definida
  em `index.css`) — sem estilizar nenhuma célula como link.
- A classe antiga `.link-button` foi removida do `index.css` (ficou sem uso depois dessa
  padronização) — não reintroduzir esse padrão.

**Referência de implementação**: `PortfolioPage.tsx` (linha inteira abre
`CronogramaDetalhadoPage`) é o modelo canônico. `ClientesPage.tsx` (abre
`ClienteDashboardPage`) e `ConsumoMesPage.tsx` (abre `ConsumoAnaDetalhePage`) foram
migradas pra esse mesmo padrão na mesma leva.

**Exceção deliberada**: `FinanceiroPage.tsx` continua com botões de texto explícitos
("Preços", "Carteira", "Consumo", "Faturamento") em vez de linha clicável — cada linha
daquela grid tem **múltiplos** destinos de drill-in diferentes, então não existe um único
alvo natural de clique pra linha inteira. Botões de ação continuam sendo a escolha certa
quando há mais de um destino por linha (ver `.row-actions-columns`/`.row-actions-group`
abaixo).

## `DataGrid.tsx` — grid genérica

Ponto de entrada padrão pra qualquer tabela nova. Só usar uma `<table>` própria quando o
layout for genuinamente não-tabular (relatório agrupado do Consumo, mini-tables do
dashboard do cliente).

Recursos embutidos: busca client-side, filtros em dropdown (`DataGridFilter`, opções
derivadas automaticamente dos dados), sort por coluna (clique no `<th>`), resize de coluna
(`columnResizeMode: onChange`), virtualização de linhas (`@tanstack/react-virtual`,
`estimateSize: 38` — **toda linha tem 38px fixos**, cuidado ao colocar conteúdo que precise
de mais altura), export XLS/CSV/PDF/compartilhar (ícones no toolbar, ver "Exportação"
abaixo), truncagem por `mask-image` (fade na borda direita da célula, nunca
`text-overflow: ellipsis` seco — ver `.cell-content`).

Props menos óbvias:
- `align?: "left"|"right"|"center"` por coluna — usar `"right"` pra tudo que é dinheiro/
  número, `"center"` pra datas.
- `rowClassName?: (row) => string` — className extra por linha (ex.: `.row-grupo` nas
  linhas agregadoras do WBS).
- `defaultFilterValues?: Record<string,string>` — pré-seleciona um filtro ao montar (ex.:
  Portfólio Completo abre já filtrado em `port_status: "ANDAMENTO"` — projetos concluídos/
  cancelados só aparecem se o usuário trocar o filtro).
- `onExportPdf?: () => void` — sobrescreve o ícone padrão "Exportar PDF" da toolbar com uma
  exportação customizada (ex.: o PDF com capa do Cronograma, ver "Exportação").
- `hideToolbar` — omite busca/filtro/export/contagem; usar em grids pequenas embutidas num
  card (ex.: mini-grids do dashboard do cliente).
- `actionsWidth` — largura da coluna de ações; para 1 grupo de botões ~150-260px, para
  2 grupos lado a lado (`.row-actions-columns`) ~450-460px.

## Ações de linha (padrão oficial, 2026-08-10)

**Decisão**: todo botão de ação inline de linha (dentro de `renderActions`) é
**quadrado, só ícone, sem texto** — o nome da ação vira `title` (tooltip do navegador ao
passar o mouse), nunca um label visível. Antes disso a convenção era mista (algumas grids
tinham botão de texto "Editar"/"Excluir", outras já usavam ícone) — padronizado pra ícone
em todas.

**Como aplicar**:
- Todo botão dentro de `<div className="row-actions">` ou `.row-actions-group` é
  `<button className="icon-btn" title="Nome da ação" aria-label="Nome da ação">` com um
  ícone de `icons.tsx` dentro — nunca texto solto como filho do botão.
- **Sempre** `title` **e** `aria-label` iguais ao nome da ação (tooltip visual +
  acessibilidade, já que não há texto visível).
- Exclusão usa `className="icon-btn danger"` (mantém o vermelho no hover — ver
  `.icon-btn.danger:hover` no CSS, que existe justamente pra isso não virar laranja como
  os outros ícones no hover) + `TrashIcon`.
- `actionsWidth` do `DataGrid` fica bem mais estreito que na era dos botões de texto —
  regra de bolso: `~40px por ícone + 6px de gap`, mais ~10px de padding lateral (ex.: 2
  ícones ≈ 90px, 3 ícones ≈ 110-130px).
- **Múltiplos destinos por linha** (ex.: Financeiro: Preços/Carteira vs. Preços/Consumo/
  Faturamento): `.row-actions-columns` com 2+ `.row-actions-group` (rótulo maiúsculo
  pequeno — esse sim continua texto, é label de seção, não de ação — + ícones, separados
  por borda vertical). Usar só quando a linha genuinamente tem mais de um fluxo de
  destino — senão, prefira linha clicável (ver seção acima).
- Botão desabilitado com `title` explicando o motivo (não só `disabled`, sempre com
  tooltip) quando a ação depende de uma condição de negócio — ex. `+ Adicionar` desabilitado
  em projeto concluído/cancelado, `Abrir pasta` desabilitado quando não há URL cadastrada.
  Isso vale tanto pra botão de texto quanto pra ícone.

**Ícone por ação (convenção — reusar, não inventar um novo pra mesma ação em tela nova)**:
Editar → `EditIcon`; Excluir → `TrashIcon` (+ `.danger`); abrir link/pasta externa →
`ExternalLinkIcon`; gerar/abrir PDF (relatório, cronograma) → `PdfIcon`; exportar CSV →
`CsvIcon`; drill-in "Preços" → `TagIcon`; "Carteira" → `WalletIcon`; "Consumo" →
`ChartIcon`; "Faturamento" → `InvoiceIcon`.

**Exceção**: os únicos botões inline que continuam com texto são os que não são "ações de
linha" no sentido de `renderActions` — ex. `+ Adicionar`/`+ Novo cliente` (`toolbarExtra`,
fora da linha, ação de página) e os botões de alerta (`.alert-btn`, que já têm uma contagem
numérica junto e não caberiam só em ícone).

## Badges e indicadores

- `<span className="badge">` — rótulo neutro (ex.: tipo A/T do cronograma antes de ter sido
  ocultado; ainda válido pra outros enums sem cor própria).
- `<span className="badge badge-{status.toLowerCase()}">` — cor por status quando o valor
  já é um enum conhecido. Classes existentes: `.badge-ativo` (verde), `.badge-inativo`/
  `.badge-bloqueado`/`.badge-excluido` (vermelho), `.badge-nao-utiliza` (cinza),
  `.badge-liquido` (verde), `.badge-bruto` (laranja/accent). **O slug da classe precisa ser
  sem acento/espaço** (`nao-utiliza`, não `NÃO UTILIZA`) — className com espaço quebra em
  duas classes CSS separadas e o estilo nunca aplica (bug real já corrigido uma vez).
- `<span className="pace-dot pace-dot-{green|red}">` — bolinha de status colorida sem
  badge cheio, pra indicadores binários bom/mau. Usada em Projetos (`lib/pace.ts`,
  `paceDoPortfolio`) e no Cronograma Detalhado (`corDesvio`, versão simplificada sem a
  cascata de status — só olha o sinal do desvio).
- `.stat-dot-{tone}` (accent/green/red/gray) — só dentro de `StatCards`, tem halo
  (`box-shadow` com o "-soft") que `.pace-dot` não tem (mais discreto, uso inline em tabela).

## Botões

- Padrão: borda cinza, hover fica laranja (`border-color`/`color: var(--accent)`).
- `.primary` — fundo laranja sólido, texto branco. Ação principal da tela (`+ Adicionar`,
  `Salvar` no form).
- `.danger` — texto vermelho (borda cinza, vira vermelha no hover). Só `Excluir`.
- `.icon-btn` — quadrado 30×30px, ícone SVG centralizado, mesmo hover laranja + fundo
  `--accent-soft`. Usado no toolbar de export e em ações de linha compactas.
- `.alert-btn` — botão de alerta contextual (ex.: "⚠ Clientes Inativos (15)" na Tabela de
  Preços/Consumo) — fundo/borda vermelha suave, vira vermelho sólido quando `.active`,
  `disabled` quando a contagem é zero.
- `.toggle-group` — par de botões tipo segmented control (usado no seletor A/T do
  Cronograma) — botão ativo vira `.toggle-active` (fundo laranja sólido).
- Todo `button:disabled` fica com `opacity: 0.55` e `cursor: not-allowed` automaticamente
  (regra global, não precisa repetir por componente).

## Formulários e modais

- Todo form roda dentro de `.modal-backdrop` (overlay escuro) > `.modal` (card branco,
  460px, `.modal-wide` pra 760px quando tem mais campos). Fecha no clique fora
  (`onClick={onCancel}` no backdrop, com `e.stopPropagation()` no form pra não fechar ao
  clicar dentro).
- Cada campo é um `.form-row` (label pequeno esmaecido acima do input).
- Padrão de arquivo: `XyzForm.tsx` exporta `XyzFormValues` (todo campo como `string`, até
  os numéricos/datas — conversão de tipo fica em `valuesToPayload`) + duas funções puras:
  `toFormValues(entidade | null): XyzFormValues` e
  `valuesToPayload(values): Record<string, unknown>`. O componente em si só gerencia
  `useState(() => toFormValues(entidade))` e chama `onSubmit(values)`.
- Campo de referência (FK) com poucas opções fixas: `<select>` nativo. Com muitas opções
  (clientes, produtos — centenas/milhares): `SearchableSelect` (combobox com busca,
  `allowEmpty` controla se tem opção "(nenhum)").
- Campo somente-leitura dentro de um form editável (ex.: `cliente_status`, calculado por
  trigger): renderizar como `<span className="badge">`, não como input desabilitado.

## Tabelas fora do `DataGrid`

Usadas só quando o conteúdo não é uma grid simples linha=registro:

- **Mini-tables** (`.mini-table`, dentro de `.dashboard-card` ou `.consumo-grupo`) — pra
  listas pequenas embutidas num card (contatos/produtos do dashboard do cliente, detalhe
  de um grupo de consumo). `.mini-table-fixed` quando as colunas precisam de largura fixa
  (`table-layout: fixed`) pra não deixar uma coluna estreitar demais.
- `.row-alerta` — linha destacada em vermelho (ex.: consumo sem preço parametrizado) —
  usa alerta já calculado no backend/view, não recalculado na tela.
- `.row-grupo` — linha em negrito com fundo cinza, pra linhas agregadoras (soma/cabeçalho
  de grupo) dentro de uma tabela normal.

## Ícones (`icons.tsx`)

Todos SVG inline, sem lib externa. Convenção: `viewBox="0 0 24 24"`, `fill="none"`,
`stroke="currentColor"`, `strokeWidth="1.8"` (ou `"2"` pra ícones bem pequenos como
`ChevronRightIcon`), `strokeLinecap/strokeLinejoin="round"`. Tamanho: 18px pros ícones do
menu lateral, 15px pros ícones de ação/export (`XlsIcon`, `CsvIcon`, `PdfIcon`, `ShareIcon`,
`ExternalLinkIcon`, `EditIcon`), 16px pro `ChevronRightIcon`. `currentColor` é o que faz o
ícone herdar a cor do botão (inclusive no hover laranja).

## Exportação (`lib/export.ts`)

Toda grid tem os mesmos 4 ícones no toolbar: **XLS** (`exceljs`), **CSV** (`;` + BOM UTF-8,
pra abrir certo no Excel PT-BR), **PDF** (`jspdf` + `jspdf-autotable`, cabeçalho laranja
`fillColor: [217, 96, 15]` = `--accent` em RGB — jsPDF não lê variável CSS, o RGB é
hardcoded), **Compartilhar** (Web Share API com fallback pra download; gera CSV
**síncrono** de propósito, porque `navigator.share` exige estar dentro da janela de
"user activation" do clique — qualquer `await` antes do `share()` pode fazer o navegador
recusar silenciosamente).

Relatórios com formato fixo (fora do padrão genérico "cabeçalho + linhas") viram função
própria em `lib/export.ts` ou `lib/<nome>Pdf.ts`: `exportRelatorioConsumoPdf` (2 tabelas:
resumo + analítico), `exportCsvProtheus` (layout fixo pro import contábil),
`exportCronogramaPdf`/`gerarPdfCronograma` (capa com logo + resumo + tabela — modelo do
"Documento de Acompanhamento de Projeto"). Nesses casos o `onExportPdf` do `DataGrid`
substitui o botão genérico pelo customizado (ver Cronograma Detalhado).

## Formatação de dados (convenção, não helper compartilhado)

**Estado atual**: `formatMoney`/`formatDate`/`formatPercent` são reimplementadas como
função local em cada arquivo de página que precisa (não existe um `lib/format.ts`
compartilhado no frontend — isso é uma duplicação conhecida, não um padrão recomendado pra
copiar, mas é o que o código faz hoje). Se for extrair pra um util compartilhado, siga
exatamente estes formatos pra não mudar comportamento:
- **Moeda**: `v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })`.
- **Data**: campos vêm do banco como `"YYYY-MM-DD"`; conversão manual pra `dd/mm/yyyy`
  fazendo split na string (`iso.split("-")`), **nunca** `new Date(iso)` direto — evita bug
  de fuso horário (o Date do JS interpreta `"YYYY-MM-DD"` como UTC e pode voltar um dia
  dependendo do fuso do navegador).
- **Percentual**: valores são armazenados/calculados como fração `0–1` no banco/view;
  exibição multiplica por 100 (`(v * 100).toFixed(0/2) + "%"`) — variação de 0 ou 2 casas
  decimais dependendo da tela (Financeiro usa 2 casas, Cronograma usa 0).

## Admin (`/admin`, fora do shell principal)

Layout próprio (`.admin-shell`, não usa `.app-shell`/sidebar principal) — topbar com abas
(`.admin-nav`) em vez de sidebar lateral, porque é uma área de configuração separada, não
uma tela do fluxo operacional. Login por PIN (`.admin-login-card`, centralizado,
input grande com letter-spacing) — mecanismo **independente** do login do app principal
(ver seção abaixo), não são a mesma sessão.

**Índices (2026-08-28)**: a listagem/CRUD manual de índices econômicos fica em **Financeiro >
Índices** (submenu na sidebar, `IndicesPage.tsx`, lê a view `indices_calculados`). A aba
**Índices** do Admin (`IndicesSyncPage.tsx`) só tem o botão "Atualizar (Banco Central)" —
o sync com a API pública do BCB/SGS, que é operação de configuração/manutenção, não de fluxo
diário. Mesma divisão do `cart_mes` (CRUD no Admin, consumo no Financeiro), invertida aqui.

## Autenticação do app principal (`frontend/src/auth/`, 2026-08-11)

- `TrocarSenhaPage.tsx`/`DefinirSenhaPage.tsx` usam classes próprias
  (`.auth-shell`/`.auth-card`, `index.css`) — **não** são as mesmas classes do login do
  Admin (`.admin-login-shell`/`.admin-login-card`). Decidido numa leva posterior (ver
  "Leva PIN vs Senha" abaixo) para poder alargar/estilizar o login do app principal sem
  afetar a tela numérica do PIN do Admin, que tem necessidades visuais diferentes
  (input curto com letter-spacing).
- **`LoginPage.tsx` é a exceção do projeto — não segue o padrão de card do app.** Ela
  renderiza uma imagem de fundo em tamanho fixo (`login-bg.png`, 1459x814) dentro de
  `.auth-photo-frame` (`container-type: inline-size`) e posiciona o formulário em
  `position: absolute`, em **%**, por cima do retângulo branco desenhado na própria
  imagem. Classes `.auth-overlay-*`. Regras específicas dessa tela, importantes pra não
  quebrá-la:
  - **Todo dimensionamento e posicionamento usa `cqw`, nunca `px`/`cm`** (exceto os
    tamanhos de fonte dos títulos). O card encolhe junto com a viewport; unidade absoluta
    não encolhe e estoura a caixa (`overflow: hidden`), cortando o botão de Login em
    janelas estreitas — bug real já corrigido uma vez. Conversão usada quando o pedido vem
    em centímetros: **1cm = 2,59cqw** (frame de referência de 1459px).
  - **Deslocar o conteúdo é feito em bloco**, por `margin-top` no `.auth-overlay-header`,
    não somando margens em cada componente — assim as distâncias relativas entre logo,
    título, campos e botão não mudam. Pra mover **um** elemento sozinho sem arrastar o
    resto, usar `position: relative` + `top` (deslocamento visual), nunca margem negativa.
  - O card tem `overflow: hidden` e altura travada pelo desenho da imagem: **qualquer
    conteúdo novo precisa ser conferido com a mensagem de erro visível**, que é o pior caso
    de altura (comparar `scrollHeight` com `clientHeight` no navegador).
  - A marca é remontada em CSS quando não há logo configurada em Parâmetros Gerais: o PNG
    local só tem o cluster de pontos, então `.auth-overlay-logo-icon` recorta essa fatia e
    o wordmark "evertec" é **texto** (`.auth-overlay-brand-text`). Com
    `param_logo_claro_url` preenchido, o texto não é renderizado (assume-se que a imagem
    configurada já traz o wordmark).
  - Os campos desligam o `outline` global de foco (`outline: none` + troca da cor da
    borda), porque o anel laranja padrão por cima da borda lia como "borda dupla" no
    desenho dessa tela. **Isso vale só aqui** — não replicar em formulário novo, o outline
    é acessibilidade no resto do app.
- Qualquer campo de senha do app (login, trocar senha, definir senha, e o modal "Definir
  senha" do Admin) usa o componente `PasswordInput` (`frontend/src/components/PasswordInput.tsx`)
  em vez de um `<input type="password">` cru — embrulha o input com um botão de olho
  (mostrar/esconder, `EyeIcon`/`EyeOffIcon` em `icons.tsx`), classes `.password-input`/
  `.password-input-toggle`. Se uma tela nova precisar de campo de senha, é esse componente
  que se usa, não um input manual.
- `Sidebar.tsx` ganhou uma prop `footer?: ReactNode`, renderizada entre a navegação e o
  link de Administração (classe `.sidebar-user`, empurrada pro fundo com `margin-top: auto`)
  — usada hoje pra mostrar nome do usuário logado + botão "Sair". Se uma tela nova precisar
  de outro conteúdo fixo no fundo da sidebar, é essa prop que se usa, não um componente novo.
- Toda chamada de `api/client.ts` (o client genérico usado pelas telas do app principal)
  agora exige sessão válida no backend — `setAuthToken`/`setUnauthorizedHandler` cuidam de
  anexar o `Authorization` e de deslogar automaticamente numa resposta 401. Não precisa (e
  não deve) passar token manualmente por prop nas páginas, diferente do `adminClient.ts`
  (PIN mestre, mecanismo separado, token ainda passado explícito por parâmetro).
