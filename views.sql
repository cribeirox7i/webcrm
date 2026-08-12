-- WEBCRM — views (v1)
-- Views que substituem as fórmulas de agregação/self-join/rollup que ficaram de fora
-- do schema.sql. Rode depois de schema.sql (algumas views referenciam outras).

-- ============================================================
-- 1) pessoas: pessoa_lider_squad (self-join — nome do líder + squad da própria pessoa)
-- ============================================================
CREATE VIEW pessoas_detalhe AS
SELECT
    p.*,
    lp.pessoa_nome AS lider_nome,
    lp.pessoa_nome || ' | ' || p.pessoa_squad AS pessoa_lider_squad
FROM pessoas p
LEFT JOIN pessoas lp ON lp.pessoa_id = p.pessoa_lider;

-- ============================================================
-- 2) contatos: flags de produto (contato_cred/sec/esc/liberacred/sign/regulatorio/geral)
--
-- IMPORTANTE: na planilha original esses flags eram por CLIENTE (repetidos em toda
-- linha de contato daquele cliente) -- então virou uma view por cliente_id, não por
-- contato_id. Os contatos continuam ligados ao cliente por FK; quem quiser o flag
-- consulta esta view pelo cliente_id, sem duplicar em cada contato.
--
-- CONFIRMADO: flag_liberacred e flag_sign seguem o mesmo padrão de cred/sec/esc --
-- "Sim" quando existe URL ATIVA do produto correspondente (LIBERACRED / SIGN) pra
-- aquele cliente. A fórmula original de contato_sign tinha um índice de coluna
-- errado no VLOOKUP (comparava CNPJ com "ATIVO") -- confirmado como bug, corrigido aqui.
-- ============================================================
CREATE VIEW cliente_flags_produtos AS
SELECT
    c.cliente_id,
    CASE WHEN EXISTS (
        SELECT 1 FROM urls u JOIN produtos p ON p.produto_id = u.produto_id
        WHERE u.cliente_id = c.cliente_id AND u.url_status = 'ATIVO'
          AND p.produto_nome IN ('WEBCRED', 'WEBAGENTE', 'WEBRH')
    ) THEN 'Sim' ELSE 'Não' END AS flag_cred,
    CASE WHEN EXISTS (
        SELECT 1 FROM urls u JOIN produtos p ON p.produto_id = u.produto_id
        WHERE u.cliente_id = c.cliente_id AND u.url_status = 'ATIVO'
          AND p.produto_nome IN ('WEBSEC', 'WEBFACTOR')
    ) THEN 'Sim' ELSE 'Não' END AS flag_sec,
    CASE WHEN EXISTS (
        SELECT 1 FROM urls u JOIN produtos p ON p.produto_id = u.produto_id
        WHERE u.cliente_id = c.cliente_id AND u.url_status = 'ATIVO'
          AND p.produto_nome = 'WEBESC'
    ) THEN 'Sim' ELSE 'Não' END AS flag_esc,
    CASE WHEN EXISTS (
        SELECT 1 FROM urls u JOIN produtos p ON p.produto_id = u.produto_id
        WHERE u.cliente_id = c.cliente_id AND u.url_status = 'ATIVO'
          AND p.produto_nome = 'LIBERACRED'
    ) THEN 'Sim' ELSE 'Não' END AS flag_liberacred,
    CASE WHEN EXISTS (
        SELECT 1 FROM urls u JOIN produtos p ON p.produto_id = u.produto_id
        WHERE u.cliente_id = c.cliente_id AND u.url_status = 'ATIVO'
          AND p.produto_nome = 'SIGN'
    ) THEN 'Sim' ELSE 'Não' END AS flag_sign,
    CASE WHEN EXISTS (
        SELECT 1 FROM urls u JOIN produtos p ON p.produto_id = u.produto_id
        WHERE u.cliente_id = c.cliente_id AND u.url_status = 'ATIVO'
          AND p.produto_nome = 'REGULATORIOS'
    ) THEN 'Sim' ELSE 'Não' END AS flag_regulatorio
FROM clientes c;

-- flag_geral = "Sim" se qualquer um dos flags acima for "Sim" (equivalente ao contato_geral original)
CREATE VIEW cliente_flags_resumo AS
SELECT
    cliente_id,
    CASE WHEN 'Sim' IN (flag_cred, flag_sec, flag_esc, flag_liberacred, flag_sign, flag_regulatorio)
         THEN 'Sim' ELSE 'Não' END AS flag_geral,
    flag_cred, flag_sec, flag_esc, flag_liberacred, flag_sign, flag_regulatorio
FROM cliente_flags_produtos;

-- ============================================================
-- 3) cart_mes: total de carteira e de consumo naquele mês
--
-- total_consumo replica a mesma regra de pool de franquia por (cliente, produto_grupo)
-- usada em precos_cliente_mes_atual/pc_mes_atu_vlr_liq_consumo (ver seção 4 abaixo) --
-- soma o MAX(franquia agrupada, consumo agrupado) de cada grupo, não a soma simples
-- das linhas de precos_cliente, senão contaria a franquia mais de uma vez por grupo.
-- ============================================================
CREATE VIEW cart_mes_resumo AS
SELECT
    cm.cart_mes_id,
    cm.cart_ano_mes,
    cm.cart_vigencia_ativa,
    (SELECT COALESCE(SUM(ca.cart_vlr), 0) FROM carteira ca WHERE ca.cart_mes_id = cm.cart_mes_id) AS total_carteira,
    (SELECT COALESCE(SUM(MAX(soma_franquia, soma_exced)), 0)
     FROM (
         SELECT
             pc2.cliente_id,
             p2.produto_grupo,
             SUM(pc2.pc_vlr_franquia) AS soma_franquia,
             SUM(COALESCE((SELECT SUM(consumo_qtd) FROM consumo_ana ca2
                  WHERE ca2.cliente_id = pc2.cliente_id AND ca2.produto_id = pc2.produto_id
                    AND ca2.cart_mes_id = pc2.cart_mes_id), 0) * pc2.pc_vlr_unit) AS soma_exced
         FROM precos_cliente pc2
         JOIN produtos p2 ON p2.produto_id = pc2.produto_id
         WHERE pc2.cart_mes_id = cm.cart_mes_id
         GROUP BY pc2.cliente_id, p2.produto_grupo
     )) AS total_consumo
FROM cart_mes cm;

-- ============================================================
-- 4) precos_cliente: consumo do mês vigente, valores finais e alerta de preço
--
-- ATENÇÃO -- pc_mes_atu_vlr_liq_consumo: a fórmula original soma franquia e excedente
-- agrupando por (produto_grupo, cart_mes_id, cliente) e usa o maior dos dois
-- totais como "valor líquido de consumo". A regra de negócio exata por trás disso
-- (pool de franquia dentro do mesmo grupo de produto) não ficou 100% clara pra mim --
-- traduzi a fórmula literalmente, mas vale você validar o resultado com um caso real
-- antes de confiar nisso pra faturamento.
--
-- NOTA -- pc_vigencia_ativa também era fórmula na planilha (compara hoje com o
-- período de vigência); como precos_cliente não tem mais datas próprias de vigência
-- (cart_mes_id já identifica o período), usa o cart_vigencia_ativa do mês vinculado.
-- ============================================================
-- CONFIRMADO: o contrato de licenciamento define uma franquia de consumo por GRUPO de
-- produto (não por produto isolado) -- vários módulos/produtos (linhas de "produtos")
-- podem compartilhar a mesma franquia. Por isso o pool abaixo soma franquia e consumo
-- de todos os produtos do mesmo produto_grupo (pro mesmo cliente/mês) e cobra
-- o que for maior entre "franquia agrupada" e "consumo agrupado" -- exatamente como
-- descrito: mínimo garantido pela franquia, excedente cobrado por transação acima dela.
CREATE VIEW precos_cliente_mes_atual AS
SELECT
    pc.pc_id,
    pc.cliente_id,
    pc.produto_id,
    pc.cart_mes_id,
    COALESCE(cm.cart_vigencia_ativa, 'N') AS pc_vigencia_ativa,
    pc.pc_vlr_franquia AS pc_mes_atu_vlr_franquia,   -- era só uma cópia da própria linha (P2) -- sem necessidade de recalcular
    COALESCE(qtd.qtd_consumo, 0) AS pc_mes_atu_qtd_consumo,
    (COALESCE(qtd.qtd_consumo, 0) * pc.pc_vlr_unit) AS pc_mes_atu_vlr_exced,
    (MAX(COALESCE(qtd.qtd_consumo, 0) * pc.pc_vlr_unit, pc.pc_vlr_franquia)
        * CASE WHEN c.cliente_tip_vlr = 'BRUTO' THEN 0.9165 ELSE 1 END) AS pc_mes_atu_vlr_final_liq,
    (CASE WHEN MAX(COALESCE(qtd.qtd_consumo, 0) * pc.pc_vlr_unit, pc.pc_vlr_franquia) > 0
        THEN MAX(COALESCE(qtd.qtd_consumo, 0) * pc.pc_vlr_unit, pc.pc_vlr_franquia)
             / (CASE WHEN c.cliente_tip_vlr = 'BRUTO' THEN 1 ELSE 0.91651 END)
        ELSE 0
    END) AS pc_mes_atu_vlr_final_brt,
    pool.vlr_liq_consumo_pool AS pc_mes_atu_vlr_liq_consumo,
    CASE WHEN COALESCE(qtd.qtd_consumo, 0) > 0 AND (COALESCE(qtd.qtd_consumo, 0) * pc.pc_vlr_unit) <= 0
         THEN 'S' ELSE '' END AS pc_alerta_preco
FROM precos_cliente pc
JOIN produtos prod_pc ON prod_pc.produto_id = pc.produto_id   -- pra saber o produto_grupo desta linha
JOIN clientes c ON c.cliente_id = pc.cliente_id               -- regime de faturamento (BRUTO/LIQUIDO) é do cliente
LEFT JOIN cart_mes cm ON cm.cart_mes_id = pc.cart_mes_id
LEFT JOIN (
    SELECT cliente_id, produto_id, cart_mes_id, SUM(consumo_qtd) AS qtd_consumo
    FROM consumo_ana
    GROUP BY cliente_id, produto_id, cart_mes_id
) qtd ON qtd.cliente_id = pc.cliente_id AND qtd.produto_id = pc.produto_id AND qtd.cart_mes_id = pc.cart_mes_id
LEFT JOIN (
    SELECT
        cliente_id, produto_grupo, cart_mes_id,
        MAX(soma_franquia, soma_exced) AS vlr_liq_consumo_pool
    FROM (
        SELECT
            pc2.cliente_id,
            p2.produto_grupo,
            pc2.cart_mes_id,
            SUM(pc2.pc_vlr_franquia) AS soma_franquia,
            SUM(COALESCE((SELECT SUM(consumo_qtd) FROM consumo_ana ca2
                 WHERE ca2.cliente_id = pc2.cliente_id AND ca2.produto_id = pc2.produto_id
                   AND ca2.cart_mes_id = pc2.cart_mes_id), 0) * pc2.pc_vlr_unit) AS soma_exced
        FROM precos_cliente pc2
        JOIN produtos p2 ON p2.produto_id = pc2.produto_id
        GROUP BY pc2.cliente_id, p2.produto_grupo, pc2.cart_mes_id
    )
) pool ON pool.cliente_id = pc.cliente_id
      AND pool.produto_grupo = prod_pc.produto_grupo
      AND pool.cart_mes_id = pc.cart_mes_id;

-- ============================================================
-- 5) faturamento: valores líquido/bruto somados de precos_cliente (vigência ativa)
-- ============================================================
-- BUG CORRIGIDO (2026-08-10): as duas subqueries abaixo não filtravam por cart_mes_id --
-- somavam TODAS as linhas de precos_cliente_mes_atual com pc_vigencia_ativa = 'S' pra
-- aquele cliente, não só as do mês desta linha de faturamento. Como normalmente só existe
-- 1 cart_mes vigente por vez, isso "parecia" certo enquanto se navegava só no mês vigente
-- -- mas ao abrir Faturamento de um mês fechado, mostrava o valor do mês vigente (errado)
-- e o export CSV Protheus (filtrado corretamente por cart_mes_id no frontend) saía vazio.
-- Removido também o filtro `pc_vigencia_ativa = 'S'`: uma vez escopado pelo cart_mes_id
-- da própria linha, esse filtro só faria sentido pra zerar o faturamento de qualquer mês
-- que não seja o vigente no momento -- errado pra fins de faturamento histórico.
CREATE VIEW faturamento_detalhe AS
SELECT
    f.*,
    c.cliente_cnpj,
    c.cliente_cnpj_fat,
    (SELECT COALESCE(SUM(pcm.pc_mes_atu_vlr_final_liq), 0)
     FROM precos_cliente_mes_atual pcm
     WHERE pcm.cliente_id = f.cliente_id AND pcm.cart_mes_id = f.cart_mes_id) AS fat_vlr_liq,
    (SELECT COALESCE(SUM(pcm.pc_mes_atu_vlr_final_brt), 0)
     FROM precos_cliente_mes_atual pcm
     WHERE pcm.cliente_id = f.cliente_id AND pcm.cart_mes_id = f.cart_mes_id) AS fat_vlr_brt
FROM faturamento f
JOIN clientes c ON c.cliente_id = f.cliente_id;

-- ============================================================
-- 6) crono: linhas "A" (agregadoras) calculam datas/percentual a partir das linhas
--    "T" (tarefa) do mesmo port_id + crono_grupo. crono_perc_esperado também entra
--    aqui (não existe como coluna em crono -- depende da data de hoje, igual
--    feriasm_status/pc_vigencia_ativa -- calculado ao vivo, nunca armazenado).
-- ============================================================
CREATE VIEW crono_calculado AS
WITH base AS (
    SELECT
        cr.*,
        CASE
            WHEN cr.crono_tipo <> 'T' THEN NULL  -- linhas 'A' calculam a média das 'T' abaixo
            WHEN cr.crono_inicio IS NULL OR cr.crono_inicio = '' THEN 0
            WHEN cr.crono_inicio >= date('now') THEN 0
            WHEN cr.crono_fim IS NULL OR cr.crono_fim = '' THEN 0
            ELSE MIN(1.0,
                (julianday('now') - julianday(cr.crono_inicio))
                / (julianday(cr.crono_fim) - julianday(cr.crono_inicio) + 1)
            )
        END AS crono_perc_esperado_t
    FROM crono cr
)
SELECT
    b.*,
    CASE WHEN b.crono_tipo = 'A'
        THEN (SELECT MIN(c2.crono_inicio) FROM crono c2
              WHERE c2.port_id = b.port_id AND c2.crono_grupo = b.crono_grupo)
        ELSE b.crono_inicio
    END AS crono_inicio_calc,
    CASE WHEN b.crono_tipo = 'A'
        THEN (SELECT MAX(c2.crono_fim) FROM crono c2
              WHERE c2.port_id = b.port_id AND c2.crono_grupo = b.crono_grupo)
        ELSE b.crono_fim
    END AS crono_fim_calc,
    CASE WHEN b.crono_tipo = 'T' THEN b.crono_perc_atual
        ELSE (
            SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE AVG(c2.crono_perc_atual) END
            FROM crono c2
            WHERE c2.port_id = b.port_id AND c2.crono_grupo = b.crono_grupo AND c2.crono_tipo = 'T'
        )
    END AS crono_perc_atual_calc,
    CASE WHEN b.crono_tipo = 'T' THEN b.crono_perc_esperado_t
        ELSE (
            SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE AVG(bb.crono_perc_esperado_t) END
            FROM base bb
            WHERE bb.port_id = b.port_id AND bb.crono_grupo = b.crono_grupo AND bb.crono_tipo = 'T'
        )
    END AS crono_perc_esperado
FROM base b;

-- ============================================================
-- 7) portfolios: datas e percentuais agregados a partir de crono
-- ============================================================
CREATE VIEW portfolios_progresso AS
SELECT
    p.*,
    (SELECT MIN(cc.crono_inicio_calc) FROM crono_calculado cc WHERE cc.port_id = p.port_id) AS port_inicio,
    (SELECT MAX(fim_ou_replan) FROM (
        SELECT MAX(c2.crono_fim) AS fim_ou_replan FROM crono c2 WHERE c2.port_id = p.port_id
        UNION ALL
        SELECT MAX(c2.crono_replan) FROM crono c2 WHERE c2.port_id = p.port_id
    )) AS port_fim,
    (SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE AVG(c2.crono_perc_atual) END
     FROM crono c2 WHERE c2.port_id = p.port_id AND c2.crono_tipo = 'T') AS port_perc_atual,
    (SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE AVG(cc.crono_perc_esperado) END
     FROM crono_calculado cc WHERE cc.port_id = p.port_id AND cc.crono_tipo = 'T') AS port_perc_estim
FROM portfolios p;
-- port_perc_desv (perc_atual - perc_estim) e port_pace (regra de negócio com cascata de IFs)
-- ficam pro backend calcular em cima do resultado desta view, não em SQL.

-- ============================================================
-- 8) indices_economicos: variação mensal (vs. mês anterior do mesmo índice) e
--    acumulado de 12 meses (soma móvel) -- window functions
-- ============================================================
-- OBS: uma window function não pode ser usada dentro de outra na mesma consulta --
-- por isso index_var_mes é calculado num CTE primeiro, e index_acum_12m (soma móvel
-- de 12 meses) é aplicado por cima, numa segunda passada.
CREATE VIEW indices_calculados AS
WITH var_mes AS (
    SELECT
        ie.*,
        CASE
            WHEN ie.index_nome = 'SALÁRIO' THEN
                -- sem mês anterior (1a linha da série) -> compara o valor com ele mesmo, dá 0
                -- (mesmo fallback que a fórmula original: SE(ISNUMBER(E1),E1,E2))
                (ie.index_vlr / NULLIF(COALESCE(LAG(ie.index_vlr) OVER (
                    PARTITION BY ie.index_nome ORDER BY ie.index_ano, ie.index_mes
                ), ie.index_vlr), 0)) - 1
            ELSE ie.index_vlr / 100.0
        END AS index_var_mes
    FROM indices_economicos ie
)
SELECT
    vm.*,
    SUM(vm.index_var_mes) OVER (
        PARTITION BY vm.index_nome ORDER BY vm.index_ano, vm.index_mes
        ROWS BETWEEN 11 PRECEDING AND CURRENT ROW
    ) AS index_acum_12m
FROM var_mes vm;
