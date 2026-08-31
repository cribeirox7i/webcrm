-- WEBCRM — schema SQLite (rascunho v1)
-- Convenções: datas em TEXT ISO-8601 (YYYY-MM-DD ou YYYY-MM-DD HH:MM:SS); dinheiro em REAL;
-- CNPJ em TEXT (tem zero a esquerda em alguns casos, não pode ser INTEGER).
--
-- O QUE FOI REMOVIDO EM RELACAO A PLANILHA (de propósito):
--   - Colunas que eram só VLOOKUP/XLOOKUP pra outra aba (ex: resp_nome, escala_mail,
--     produto_nome em precos_cliente, cliente_nome em port) -> viram JOIN na query, não coluna.
--   - Colunas de agregação (SOMASE/CONT.SE, ex: pc_mes_atu_*, fat_vlr_liq/brt,
--     port_perc_atual/estim, crono_*_calc, cart_desc, index_var_mes/acum_12m)
--     -> ficam de fora daqui, viram VIEW (próximo passo, depois que este schema for aprovado).
--   - Regra de negócio complexa (port_pace, crono_perc_esperado, pc_totalizador)
--     -> fica no código do backend, não no banco.
--   - contato_cred/sec/esc/liberacred/sign/regulatorio/geral -> dependiam de urls/clientes,
--     viram VIEW também.

PRAGMA foreign_keys = ON;

-- ============================================================
-- TABELAS DE DIMENSÃO (mestre / referência)
-- ============================================================

CREATE TABLE grupos_econ (
    grp_id      INTEGER PRIMARY KEY,
    grp_nome    TEXT NOT NULL
);

CREATE TABLE clientes (
    cliente_id              INTEGER PRIMARY KEY,
    grp_id                  INTEGER REFERENCES grupos_econ(grp_id),
    cliente_nome            TEXT NOT NULL,
    cliente_cnpj            TEXT,               -- formatado: 41.522.714/0001-47
    cliente_cnpj_fat        TEXT,               -- CNPJ usado no faturamento (pode diferir do principal)
    cliente_cnpj_number     TEXT,               -- só dígitos, mantém zero a esquerda
    cliente_status          TEXT DEFAULT 'INATIVO', -- mantido por TRIGGER em urls/servidores (ver triggers.sql) — não é input manual
    cliente_dat_bloqueio    TEXT,
    cliente_dia_venc_consumo    INTEGER,
    cliente_dia_venc_carteira   INTEGER,
    cliente_cod_github      TEXT,
    cliente_log             TEXT,               -- email de quem mantém o registro
    -- regime de faturamento (BRUTO/LIQUIDO) -- movido de precos_cliente.pc_tip_vlr pra cá
    -- pra não permitir um cliente com produtos em regimes diferentes (era possível
    -- antes, por engano, já que o campo era por linha de preço)
    cliente_tip_vlr         TEXT
);
CREATE INDEX idx_clientes_status ON clientes(cliente_status);
CREATE INDEX idx_clientes_grp ON clientes(grp_id);

CREATE TABLE pessoas (
    pessoa_id           INTEGER PRIMARY KEY,
    pessoa_nome         TEXT NOT NULL,
    pessoa_status       TEXT,
    pessoa_funcao       TEXT,
    -- pessoa_grupo: extrai a categoria (G/L/D/T) do início de pessoa_funcao. Só depende desta linha -> coluna gerada.
    pessoa_grupo        TEXT GENERATED ALWAYS AS (
        CASE
            WHEN instr(pessoa_funcao, ' ') = 0 THEN 'T'
            WHEN upper(substr(pessoa_funcao, 1, instr(pessoa_funcao, ' ') - 1)) = 'GERENTE' THEN 'G'
            WHEN upper(substr(pessoa_funcao, 1, instr(pessoa_funcao, ' ') - 1)) = 'COORDENADOR' THEN 'L'
            WHEN upper(substr(pessoa_funcao, 1, instr(pessoa_funcao, ' ') - 1)) = 'LIDER' THEN 'L'
            WHEN upper(substr(pessoa_funcao, 1, instr(pessoa_funcao, ' ') - 1)) = 'DIRETOR' THEN 'D'
            ELSE 'T'
        END
    ) VIRTUAL,
    pessoa_mail         TEXT,
    pessoa_fone         TEXT,
    -- pessoa_whatsapp: monta link wa.me a partir do telefone. Só depende desta linha -> coluna gerada.
    pessoa_whatsapp     TEXT GENERATED ALWAYS AS (
        CASE WHEN pessoa_fone IS NOT NULL AND pessoa_fone <> ''
            THEN 'wa.me/' || replace(replace(replace(replace(replace(
                    pessoa_fone, '.', ''), ' ', ''), '-', ''), ')', ''), '(', '')
            ELSE ''
        END
    ) VIRTUAL,
    -- hierarquia: auto-referência (diretor/gerente executivo/gerente/líder de cada pessoa)
    pessoa_diretor      INTEGER REFERENCES pessoas(pessoa_id),
    pessoa_ger_exec     INTEGER REFERENCES pessoas(pessoa_id),
    pessoa_ger          INTEGER REFERENCES pessoas(pessoa_id),
    pessoa_lider        INTEGER REFERENCES pessoas(pessoa_id),
    pessoa_squad        TEXT,
    -- pessoa_lider_squad (nome do líder + squad) precisa de self-JOIN -> vira VIEW, não fica aqui.
    pessoa_billable     TEXT
);
CREATE INDEX idx_pessoas_lider ON pessoas(pessoa_lider);

-- ferias_marcacao: registros reais de solicitação (férias/recesso/licença) por pessoa.
-- As colunas pessoa_nome/diretor/ger_exec/ger/lider/squad/lider_squad da aba original
-- foram removidas -> vêm de JOIN com pessoas.
CREATE TABLE ferias_marcacao (
    feriasm_id      INTEGER PRIMARY KEY,
    pessoa_id       INTEGER NOT NULL REFERENCES pessoas(pessoa_id),
    feriasm_tipo    TEXT NOT NULL,   -- 'FERIAS' | 'RECESSO' | 'LICENÇA'
    -- feriasm_indice: só depende de feriasm_tipo (mesma linha) -> gerada
    feriasm_indice  INTEGER GENERATED ALWAYS AS (
        CASE feriasm_tipo WHEN 'FERIAS' THEN 1 WHEN 'RECESSO' THEN 2 WHEN 'LICENÇA' THEN 3 END
    ) VIRTUAL,
    feriasm_ini     TEXT NOT NULL,
    feriasm_fim     TEXT NOT NULL,
    -- feriasm_prazo: diferença de datas desta linha -> gerada
    feriasm_prazo   INTEGER GENERATED ALWAYS AS (julianday(feriasm_fim) - julianday(feriasm_ini) + 1) VIRTUAL
    -- feriasm_status (ativo se dentro da janela de +-90 dias de HOJE) depende da data atual,
    -- não é determinístico -> calculado no app/VIEW na hora da consulta, não armazenado
);
CREATE INDEX idx_feriasm_pessoa ON ferias_marcacao(pessoa_id);
CREATE INDEX idx_feriasm_periodo ON ferias_marcacao(feriasm_ini, feriasm_fim);

-- A aba "ferias" (calendário largo com colunas D01..D90) virou esta VIEW, no formato
-- normalizado (pessoa_id, dia, status) que você confirmou. É só ~300 pessoas x 90 dias:
-- calcular na hora sai barato e nunca fica dessincronizado com ferias_marcacao. Se um dia
-- isso ficar lento (mais gente, mais dias), dá pra materializar como tabela real.
CREATE VIEW ferias_calendario AS
WITH RECURSIVE dias(offset_dia) AS (
    SELECT 0
    UNION ALL
    SELECT offset_dia + 1 FROM dias WHERE offset_dia < 89
)
SELECT
    p.pessoa_id,
    date('now', '+' || d.offset_dia || ' days') AS dia,
    (
        SELECT CASE fm.feriasm_indice WHEN 1 THEN 'F' WHEN 2 THEN 'R' WHEN 3 THEN 'L' END
        FROM ferias_marcacao fm
        WHERE fm.pessoa_id = p.pessoa_id
          AND date('now', '+' || d.offset_dia || ' days') BETWEEN fm.feriasm_ini AND fm.feriasm_fim
        LIMIT 1
    ) AS status
FROM pessoas p
CROSS JOIN dias d;

CREATE TABLE produtos (   -- era a aba "suites"; renomeado pra bater com o prefixo das colunas
    produto_id              INTEGER PRIMARY KEY,
    produto_area            TEXT,
    produto_nome            TEXT NOT NULL,
    produto_detalhe         TEXT,
    produto_suite           TEXT,
    produto_tip_apuracao    TEXT,
    produto_sku             TEXT,
    produto_franquia        TEXT,
    produto_grupo           INTEGER,
    produto_preco           REAL,
    produto_recorrencia     TEXT,
    produto_regra_apuracao  TEXT
);

CREATE TABLE servidores (   -- era a aba "server"; "server" evitado por clareza, sem conflito de reserva
    server_id           INTEGER PRIMARY KEY,
    server_nome         TEXT NOT NULL,
    server_ambiente      TEXT,
    server_finalidade    TEXT,
    server_mysql         TEXT,
    server_status        TEXT,
    server_proc          TEXT,
    server_conteudo      TEXT,
    server_familia       TEXT
);

-- ============================================================
-- TABELAS OPERACIONAIS
-- ============================================================

CREATE TABLE urls (
    url_id              INTEGER PRIMARY KEY,
    cliente_id          INTEGER NOT NULL REFERENCES clientes(cliente_id),
    url_path            TEXT NOT NULL,
    server_id           INTEGER REFERENCES servidores(server_id),  -- era "url_server"
    produto_id          INTEGER REFERENCES produtos(produto_id),   -- era "url_prod"
    -- url_ambiente (vem de servidores.server_ambiente via JOIN) e url_prod_desc (via JOIN produtos) removidos daqui
    url_status          TEXT,
    url_dt_status        TEXT,
    url_exc              TEXT,
    url_dt_exc           TEXT,
    url_pasta_raiz       TEXT,
    url_pasta_anexos     TEXT,
    urb_bd               TEXT,
    url_obs              TEXT
);
CREATE INDEX idx_urls_cliente ON urls(cliente_id);
CREATE INDEX idx_urls_status ON urls(url_status);

CREATE TABLE contatos (
    contato_id       INTEGER PRIMARY KEY,
    cliente_id       INTEGER NOT NULL REFERENCES clientes(cliente_id),
    contato_nome     TEXT NOT NULL,
    contato_mail     TEXT,
    contato_fone     TEXT,
    contato_status   TEXT
    -- contato_cred/sec/esc/liberacred/sign/regulatorio/geral removidos: dependiam de urls/clientes -> viram VIEW
);
CREATE INDEX idx_contatos_cliente ON contatos(cliente_id);

CREATE TABLE cart_mes (
    cart_mes_id          INTEGER PRIMARY KEY,
    cart_ano_mes         TEXT NOT NULL,   -- '2025/01'
    cart_vigencia_ativa  TEXT
    -- cart_desc (contagens agregadas) removido -> vira VIEW
);

CREATE TABLE precos_cliente (
    pc_id                       INTEGER PRIMARY KEY,
    cliente_id                  INTEGER NOT NULL REFERENCES clientes(cliente_id),
    produto_id                  INTEGER NOT NULL REFERENCES produtos(produto_id),
    cart_mes_id                 INTEGER REFERENCES cart_mes(cart_mes_id),
    pc_dat_niver                TEXT,
    pc_dat_ult_reajuste         TEXT,
    pc_cod_index                TEXT,
    -- pc_tip_vlr removido -> moveu pra clientes.cliente_tip_vlr (regime é do cliente, não da linha de preço)
    pc_vlr_franquia             REAL,
    -- pc_vlr_unit: valor fixo gravado (sem fórmula, conforme decisão) -- default é o
    -- valor-base que a fórmula original cravava (2.06); ajustes viram um UPDATE direto.
    pc_vlr_unit                 REAL DEFAULT 2.06,
    pc_fx1_lim REAL, pc_fx2_lim REAL, pc_fx3_lim REAL, pc_fx4_lim REAL, pc_fx5_lim REAL,
    pc_fx1_vlr REAL, pc_fx2_vlr REAL, pc_fx3_vlr REAL, pc_fx4_vlr REAL, pc_fx5_vlr REAL
    -- pc_mes_atu_* (agregações de consumo_ana), pc_totalizador (string de relatório),
    -- pc_alerta_preco removidos -> viram VIEW / backend
    -- pc_dat_ini/fim_vigencia removidos -> cart_mes_id já identifica o período de vigência
);
CREATE INDEX idx_pc_cliente ON precos_cliente(cliente_id);
CREATE INDEX idx_pc_produto ON precos_cliente(produto_id);

CREATE TABLE consumo_ana (
    consumo_id      INTEGER PRIMARY KEY,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(cliente_id),
    produto_id      INTEGER NOT NULL REFERENCES produtos(produto_id),
    cart_mes_id     INTEGER REFERENCES cart_mes(cart_mes_id),
    consumo_data    TEXT NOT NULL,
    consumo_qtd     REAL,
    consumo_det     TEXT,
    consumo_consit  TEXT
);
CREATE INDEX idx_consumo_cliente_produto_mes ON consumo_ana(cliente_id, produto_id, cart_mes_id);
CREATE INDEX idx_consumo_data ON consumo_ana(consumo_data);

CREATE TABLE faturamento (
    fat_id                  INTEGER PRIMARY KEY,
    cart_mes_id             INTEGER REFERENCES cart_mes(cart_mes_id),
    cliente_id              INTEGER NOT NULL REFERENCES clientes(cliente_id),
    fat_dat_venc            TEXT,
    fat_cod_venc_protheus   TEXT,
    fat_num_nfe             TEXT,
    fat_num_rps             TEXT,
    fat_obs                 TEXT
    -- fat_vlr_liq/brt (SUMIFS em precos_cliente), cliente_cnpj/cnpj_fat (JOIN clientes) removidos -> VIEW/JOIN
    -- fat_flag_csv removido -- só tinha uso interno no AppSheet
);
CREATE INDEX idx_faturamento_cliente ON faturamento(cliente_id);

CREATE TABLE carteira (
    cart_id                 INTEGER PRIMARY KEY,
    cliente_id              INTEGER NOT NULL REFERENCES clientes(cliente_id),
    cart_mes_id             INTEGER REFERENCES cart_mes(cart_mes_id),
    cart_qtd                INTEGER,
    cart_vlr                REAL,
    cart_pdd                REAL,
    cart_sem_pdd             REAL,
    cart_fat                REAL,
    cart_qtd_mes            INTEGER,
    cart_emprestimos_mes    INTEGER,
    cart_ult_def            TEXT,
    cart_data_base          TEXT,
    cart_dat_extracao       TEXT,
    cart_rds                TEXT,
    cart_db                 TEXT,
    cart_prod               TEXT,
    -- cart_nome_plan_analitica: nome de arquivo montado a partir de outras colunas desta linha -> gerada.
    -- Base é cart_db (o "slug" tipo "2mj_factor"), não cart_prod (texto descritivo tipo "Módulo
    -- WebFactor") -- confirmado batendo a fórmula original do AppSheet contra nomes reais de
    -- arquivo no Drive (achado 2026-08-31, ver STATUS.md).
    cart_nome_plan_analitica TEXT GENERATED ALWAYS AS (
        cart_db || '_Medicao_' ||
        strftime('%Y-%m-01', cart_data_base) || '_' ||
        strftime('%Y-%m-', cart_data_base) || strftime('%d', cart_data_base) || '.xlsx'
    ) VIRTUAL,
    cart_url_plan_analitica  TEXT
);
CREATE INDEX idx_carteira_cliente_mes ON carteira(cliente_id, cart_mes_id);

CREATE TABLE resp (
    resp_id         INTEGER PRIMARY KEY,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(cliente_id),
    resp_tipo       TEXT,
    pessoa_id       INTEGER REFERENCES pessoas(pessoa_id)
    -- resp_nome/mail/fone/zap removidos -> JOIN com pessoas
);
CREATE INDEX idx_resp_cliente ON resp(cliente_id);

CREATE TABLE escala (
    escala_id        INTEGER PRIMARY KEY,
    pessoa_id        INTEGER NOT NULL REFERENCES pessoas(pessoa_id),
    escala_data      TEXT NOT NULL,
    escala_hora_ini  TEXT,
    escala_hora_fim  TEXT
    -- escala_tempo (duração) fica melhor calculada no app na hora de gravar, ou como VIEW,
    -- já que envolve subtração de horários (tipo TIME, sem suporte nativo forte em generated column).
    -- escala_mail/telefone/whatsapp removidos -> JOIN com pessoas
);
CREATE INDEX idx_escala_pessoa_data ON escala(pessoa_id, escala_data);

CREATE TABLE portfolios (   -- era a aba "port"
    port_id         INTEGER PRIMARY KEY,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(cliente_id),
    port_tipo       TEXT,
    port_nome       TEXT,
    port_pm         TEXT,
    port_diretorio  TEXT,
    port_status     TEXT,
    port_pdf        INTEGER
    -- port_inicio/fim/perc_atual/perc_estim/perc_desv (agregações de crono) e port_pace
    -- (regra de negócio) removidos -> VIEW / backend
);
CREATE INDEX idx_portfolios_cliente ON portfolios(cliente_id);

CREATE TABLE crono (
    crono_id            INTEGER PRIMARY KEY,
    port_id             INTEGER NOT NULL REFERENCES portfolios(port_id),
    crono_grupo         INTEGER,
    crono_topico        INTEGER,
    -- crono_grp_tpc: concatenação de grupo+tópico desta linha -> gerada
    crono_grp_tpc       TEXT GENERATED ALWAYS AS (
        crono_grupo || CASE WHEN crono_topico IS NULL OR crono_topico = 0 THEN '' ELSE '.' || crono_topico END
    ) VIRTUAL,
    crono_tipo          TEXT,   -- 'A' = linha agregadora (grupo), 'T' = tarefa individual
    crono_atividade     TEXT,
    crono_inicio        TEXT,
    crono_fim           TEXT,
    crono_replan        TEXT,
    crono_esforco       TEXT,
    crono_perc_atual    REAL,
    crono_hh_orc        REAL,
    crono_hh_real       REAL,
    crono_status        TEXT,
    resp_id             INTEGER REFERENCES list_resp_crono(resp_id),
    crono_demanda_1     TEXT,
    crono_demanda_2     TEXT,
    crono_demanda_3     TEXT,
    crono_relat         INTEGER
    -- crono_inicio_calc/fim_calc/perc_atual_calc (agregação por port_id+grupo, quando tipo='A')
    -- e crono_perc_esperado (regra de negócio com datas) removidos -> VIEW / backend
);
CREATE INDEX idx_crono_port_grupo ON crono(port_id, crono_grupo);

CREATE TABLE propostas (
    proposta_id       INTEGER PRIMARY KEY,
    cliente_id        INTEGER NOT NULL REFERENCES clientes(cliente_id),
    proposta_chamado  INTEGER,
    proposta_demanda  INTEGER,
    proposta_nome     TEXT,
    proposta_desc     TEXT,
    proposta_hh       REAL,
    proposta_vlr      REAL,
    proposta_status   TEXT,
    proposta_anexo    TEXT
);
CREATE INDEX idx_propostas_cliente ON propostas(cliente_id);

CREATE TABLE fornecedores (
    fornecedor_id      INTEGER PRIMARY KEY,
    fornecedor_area    TEXT,
    fornecedor_nome    TEXT NOT NULL,
    fornecedor_cnpj    TEXT
);

CREATE TABLE forn_contratos (
    forn_cont_id            INTEGER PRIMARY KEY,
    fornecedor_id           INTEGER NOT NULL REFERENCES fornecedores(fornecedor_id),
    pessoa_id               INTEGER REFERENCES pessoas(pessoa_id),
    forn_cont_num_contrato  TEXT,
    forn_cont_tipo          TEXT,
    forn_cont_nivel         TEXT,
    forn_cont_aloc          TEXT,
    forn_cont_qtd_prf       INTEGER,
    forn_cont_desc          TEXT,
    forn_cont_tip_vlr       TEXT,
    forn_cont_vlr_mes       REAL,
    forn_cont_dt_ini        TEXT,
    forn_cont_dt_fim        TEXT,
    forn_cont_ind_reaj      TEXT,
    forn_cont_status        TEXT
);
CREATE INDEX idx_forncont_fornecedor ON forn_contratos(fornecedor_id);

CREATE TABLE forn_pagadoria (
    forn_pag_id                     INTEGER PRIMARY KEY,
    fornecedor_id                   INTEGER NOT NULL REFERENCES fornecedores(fornecedor_id),
    forn_pag_resp                   TEXT,
    forn_pag_tipo                   TEXT,
    forn_pag_tipo_detalhado         TEXT,
    forn_pag_competencia            TEXT,
    forn_pag_dat                    TEXT,
    forn_pag_nome_prf               TEXT,
    forn_pag_qtd                    REAL,
    forn_pag_vlr_unit               REAL,
    forn_pag_tot_bruto              REAL,
    forn_pag_tot_liq                REAL,
    forn_pag_vlr_pag_cliente_bruto  REAL,
    forn_pag_vlr_pag_cliente_liq    REAL,
    forn_pag_vlr_receita_bruta      REAL,
    forn_pag_vlr_receita_liq        REAL,
    forn_pag_obs                    TEXT
);
CREATE INDEX idx_fornpag_fornecedor ON forn_pagadoria(fornecedor_id);

CREATE TABLE anexos (
    anexo_id        INTEGER PRIMARY KEY,
    cliente_id      INTEGER REFERENCES clientes(cliente_id),
    fornecedor_id   INTEGER REFERENCES fornecedores(fornecedor_id),
    anexo_nome      TEXT,
    anexo_data      TEXT,
    anexo_arquivo   TEXT
);

-- Linha única de configuração global (branding) -- CHECK garante que nunca existe mais
-- que 1 linha. param_logo_escuro_url: logo pra fundo escuro (barra de título do app);
-- param_logo_claro_url: logo pra fundo claro (capa dos PDFs).
CREATE TABLE parametros_gerais (
    param_id                INTEGER PRIMARY KEY CHECK (param_id = 1),
    param_logo_escuro_url   TEXT,
    param_logo_claro_url    TEXT
);
INSERT INTO parametros_gerais (param_id) VALUES (1);

-- ============================================================
-- REFERÊNCIA / ENUM (tabelas pequenas, listas fixas)
-- ============================================================

-- Login do app principal (2026-08-11) -- controle de acesso próprio, separado do PIN mestre
-- do /admin: user_senha_hash (scrypt, nunca texto puro), user_deve_trocar_senha (força troca
-- no primeiro acesso ou depois de reset), user_convite_token/expira_em (link de "definir senha"
-- enviado por e-mail -- prova que o usuário tem acesso à caixa de entrada cadastrada).
CREATE TABLE usuarios (
    user_id                    INTEGER PRIMARY KEY,
    user_nome                  TEXT NOT NULL,
    user_mail                  TEXT NOT NULL UNIQUE,
    user_status                TEXT,
    user_senha_hash             TEXT,
    user_deve_trocar_senha      INTEGER NOT NULL DEFAULT 1,
    user_convite_token          TEXT,
    user_convite_expira_em      TEXT
);

-- Sessão do login do app principal -- token opaco (não é JWT, sem segredo pra assinar),
-- validade fixa de N dias a partir do login (ver SESSION_TTL_DIAS no backend). Revogação
-- acontece por expiração natural aqui OU pelo requireUserAuth recusar na hora se
-- usuarios.user_status != 'ATIVO' (desabilitar um usuário derruba o acesso na próxima
-- requisição, mesmo com sessão ainda "válida" nesta tabela).
CREATE TABLE usuario_sessoes (
    sessao_token  TEXT PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES usuarios(user_id) ON DELETE CASCADE,
    criado_em     TEXT NOT NULL,
    expira_em     TEXT NOT NULL
);
CREATE INDEX idx_usuario_sessoes_user ON usuario_sessoes(user_id);

-- 1 linha por (usuario, menu do sistema) -- 4 flags independentes; um menu sem nenhuma
-- das 4 marcadas fica oculto pra esse usuário. menu_key bate com os ids usados na
-- navegação do app (ver frontend/src/menus.ts).
CREATE TABLE usuarios_permissoes_menu (
    user_id        INTEGER NOT NULL REFERENCES usuarios(user_id),
    menu_key       TEXT NOT NULL,
    perm_leitura   INTEGER NOT NULL DEFAULT 0,
    perm_insercao  INTEGER NOT NULL DEFAULT 0,
    perm_edicao    INTEGER NOT NULL DEFAULT 0,
    perm_exclusao  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, menu_key)
);

CREATE TABLE list_tip_resp (
    tip_resp   TEXT PRIMARY KEY
);

CREATE TABLE list_resp_crono (
    resp_id    INTEGER PRIMARY KEY,
    resp_nome  TEXT NOT NULL
);

CREATE TABLE list_url_status (
    url_status  TEXT PRIMARY KEY
);

CREATE TABLE indices_economicos (   -- era a aba "index" -- renomeado (INDEX é palavra reservada em SQL)
    index_cod   INTEGER,
    index_nome  TEXT NOT NULL,
    index_ano   INTEGER NOT NULL,
    index_mes   INTEGER NOT NULL,
    index_vlr   REAL,
    PRIMARY KEY (index_nome, index_ano, index_mes)
    -- index_var_mes (compara com mês anterior) e index_acum_12m (soma móvel de 12 meses)
    -- removidos -> viram VIEW com window function (LAG / SUM OVER)
);

-- ============================================================
-- DECISÕES JÁ TOMADAS (referência):
--   1) ferias normalizada como VIEW ferias_calendario (ver acima, junto de pessoas).
--   2) macros, formulas_apoio, instruções, pend_crono, areas_docs, docs, config
--      ficam de fora deste schema (não fazem parte do CRM em si).
--   3) pc_vlr_unit (precos_cliente): virou valor fixo gravado (REAL, default 2.06),
--      sem fórmula/coluna gerada -- ajustes de preço passam a ser um UPDATE direto.
-- ============================================================
