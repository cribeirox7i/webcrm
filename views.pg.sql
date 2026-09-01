-- WEBCRM — views PostgreSQL (Supabase), portado de views.sql (SQLite)
-- Rode depois de schema.pg.sql (algumas views referenciam outras). Comentários de regra de
-- negócio do original preservados; só a sintaxe SQLite-específica foi traduzida:
--   - MAX(a,b)/MIN(a,b) escalares (SQLite) -> GREATEST(a,b)/LEAST(a,b) (Postgres não tem
--     forma escalar de 2+ argumentos pra MAX/MIN, só a agregada -- não confundir as duas).
--   - date('now')/julianday(...) -> CURRENT_DATE e subtração de datas nativa do Postgres.
--   - Window functions (LAG/SUM OVER) e WITH RECURSIVE são portáveis sem alteração.

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
-- Ver comentário original em views.sql sobre o bug de VLOOKUP corrigido aqui.
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

CREATE VIEW cliente_flags_resumo AS
SELECT
    cliente_id,
    CASE WHEN 'Sim' IN (flag_cred, flag_sec, flag_esc, flag_liberacred, flag_sign, flag_regulatorio)
         THEN 'Sim' ELSE 'Não' END AS flag_geral,
    flag_cred, flag_sec, flag_esc, flag_liberacred, flag_sign, flag_regulatorio
FROM cliente_flags_produtos;

-- ============================================================
-- 3) cart_mes: total de carteira e de consumo naquele mês
-- ============================================================
CREATE VIEW cart_mes_resumo AS
SELECT
    cm.cart_mes_id,
    cm.cart_ano_mes,
    cm.cart_vigencia_ativa,
    (SELECT COALESCE(SUM(ca.cart_vlr), 0) FROM carteira ca WHERE ca.cart_mes_id = cm.cart_mes_id) AS total_carteira,
    (SELECT COALESCE(SUM(GREATEST(soma_franquia, soma_exced)), 0)
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
     ) sub) AS total_consumo
FROM cart_mes cm;

-- ============================================================
-- 4) precos_cliente: consumo do mês vigente, valores finais e alerta de preço
-- Regras de negócio preservadas do original (ver views.sql pra contexto completo).
-- ============================================================
CREATE VIEW precos_cliente_mes_atual AS
SELECT
    pc.pc_id,
    pc.cliente_id,
    pc.produto_id,
    pc.cart_mes_id,
    COALESCE(cm.cart_vigencia_ativa, 'N') AS pc_vigencia_ativa,
    pc.pc_vlr_franquia AS pc_mes_atu_vlr_franquia,
    COALESCE(qtd.qtd_consumo, 0) AS pc_mes_atu_qtd_consumo,
    (COALESCE(qtd.qtd_consumo, 0) * pc.pc_vlr_unit) AS pc_mes_atu_vlr_exced,
    (GREATEST(COALESCE(qtd.qtd_consumo, 0) * pc.pc_vlr_unit, pc.pc_vlr_franquia)
        * CASE WHEN c.cliente_tip_vlr = 'BRUTO' THEN 0.9165 ELSE 1 END) AS pc_mes_atu_vlr_final_liq,
    (CASE WHEN GREATEST(COALESCE(qtd.qtd_consumo, 0) * pc.pc_vlr_unit, pc.pc_vlr_franquia) > 0
        THEN GREATEST(COALESCE(qtd.qtd_consumo, 0) * pc.pc_vlr_unit, pc.pc_vlr_franquia)
             / (CASE WHEN c.cliente_tip_vlr = 'BRUTO' THEN 1 ELSE 0.91651 END)
        ELSE 0
    END) AS pc_mes_atu_vlr_final_brt,
    pool.vlr_liq_consumo_pool AS pc_mes_atu_vlr_liq_consumo,
    CASE WHEN COALESCE(qtd.qtd_consumo, 0) > 0 AND (COALESCE(qtd.qtd_consumo, 0) * pc.pc_vlr_unit) <= 0
         THEN 'S' ELSE '' END AS pc_alerta_preco
FROM precos_cliente pc
JOIN produtos prod_pc ON prod_pc.produto_id = pc.produto_id
JOIN clientes c ON c.cliente_id = pc.cliente_id
LEFT JOIN cart_mes cm ON cm.cart_mes_id = pc.cart_mes_id
LEFT JOIN (
    SELECT cliente_id, produto_id, cart_mes_id, SUM(consumo_qtd) AS qtd_consumo
    FROM consumo_ana
    GROUP BY cliente_id, produto_id, cart_mes_id
) qtd ON qtd.cliente_id = pc.cliente_id AND qtd.produto_id = pc.produto_id AND qtd.cart_mes_id = pc.cart_mes_id
LEFT JOIN (
    SELECT
        cliente_id, produto_grupo, cart_mes_id,
        GREATEST(soma_franquia, soma_exced) AS vlr_liq_consumo_pool
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
    ) sub2
) pool ON pool.cliente_id = pc.cliente_id
      AND pool.produto_grupo = prod_pc.produto_grupo
      AND pool.cart_mes_id = pc.cart_mes_id;

-- ============================================================
-- 5) faturamento: valores líquido/bruto de precos_cliente (vigência ativa)
-- ============================================================
-- Antes (achado 2026-09-01): fat_vlr_liq/brt somavam pc_mes_atu_vlr_final_liq/brt linha a linha
-- (por produto individual), sem o pool de franquia por produto_grupo que a tela de Consumo e
-- cart_mes_resumo.total_consumo já usam -- resultado divergia sem nenhuma explicação visível na
-- tela. Confirmado com o usuário: Faturamento deve usar o MESMO pool (GREATEST agrupado por
-- cliente+produto_grupo, mesma fórmula de cart_mes_resumo.total_consumo), com o fator fiscal
-- BRUTO/LIQUIDO aplicado por cima do total já agrupado -- não mais por linha.
--
-- fat_dat_venc (achado 2026-09-01, mesma leva): não é campo manual (nunca teve campo no
-- formulário de edição -- só Número NFE/RPS/Observações) -- é calculado a partir de
-- clientes.cliente_dia_venc_consumo + o mês/ano do cart_mes da própria linha, sempre ao vivo
-- (nunca gravado na coluna física `faturamento.fat_dat_venc`, que fica sempre NULL e não é mais
-- lida aqui -- por isso `f.*` virou lista explícita de colunas). Cliente sem dia cadastrado
-- devolve NULL (sinaliza cadastro incompleto, não inventa um valor); dia maior que o último dia
-- do mês (ex. 31 num fevereiro) usa o último dia disponível daquele mês.
CREATE VIEW faturamento_detalhe AS
SELECT
    f.fat_id,
    f.cart_mes_id,
    f.cliente_id,
    f.fat_cod_venc_protheus,
    f.fat_num_nfe,
    f.fat_num_rps,
    f.fat_obs,
    c.cliente_cnpj,
    c.cliente_cnpj_fat,
    (pool.vlr_consumo_pool * CASE WHEN c.cliente_tip_vlr = 'BRUTO' THEN 0.9165 ELSE 1 END) AS fat_vlr_liq,
    (CASE WHEN pool.vlr_consumo_pool > 0
        THEN pool.vlr_consumo_pool / (CASE WHEN c.cliente_tip_vlr = 'BRUTO' THEN 1 ELSE 0.91651 END)
        ELSE 0
    END) AS fat_vlr_brt,
    (CASE WHEN c.cliente_dia_venc_consumo IS NOT NULL AND cm.cart_ano_mes ~ '^\d{4}/\d{1,2}$' THEN
        make_date(
            split_part(cm.cart_ano_mes, '/', 1)::int,
            split_part(cm.cart_ano_mes, '/', 2)::int,
            LEAST(
                c.cliente_dia_venc_consumo,
                EXTRACT(DAY FROM (
                    make_date(split_part(cm.cart_ano_mes, '/', 1)::int, split_part(cm.cart_ano_mes, '/', 2)::int, 1)
                    + INTERVAL '1 month - 1 day'
                ))::int
            )
        )::text
    END) AS fat_dat_venc
FROM faturamento f
JOIN clientes c ON c.cliente_id = f.cliente_id
LEFT JOIN cart_mes cm ON cm.cart_mes_id = f.cart_mes_id
JOIN LATERAL (
    SELECT COALESCE(SUM(GREATEST(soma_franquia, soma_exced)), 0) AS vlr_consumo_pool
    FROM (
        SELECT
            p2.produto_grupo,
            SUM(pc2.pc_vlr_franquia) AS soma_franquia,
            SUM(COALESCE((SELECT SUM(consumo_qtd) FROM consumo_ana ca2
                 WHERE ca2.cliente_id = pc2.cliente_id AND ca2.produto_id = pc2.produto_id
                   AND ca2.cart_mes_id = pc2.cart_mes_id), 0) * pc2.pc_vlr_unit) AS soma_exced
        FROM precos_cliente pc2
        JOIN produtos p2 ON p2.produto_id = pc2.produto_id
        WHERE pc2.cliente_id = f.cliente_id AND pc2.cart_mes_id = f.cart_mes_id
        GROUP BY p2.produto_grupo
    ) sub2
) pool ON true;

-- ============================================================
-- 6) crono: linhas "A" (agregadoras) calculam datas/percentual a partir das linhas "T"
-- ============================================================
CREATE VIEW crono_calculado AS
WITH base AS (
    SELECT
        cr.*,
        CASE
            WHEN cr.crono_tipo <> 'T' THEN NULL
            WHEN cr.crono_inicio IS NULL OR cr.crono_inicio = '' THEN 0
            WHEN cr.crono_inicio >= CURRENT_DATE::text THEN 0
            WHEN cr.crono_fim IS NULL OR cr.crono_fim = '' THEN 0
            ELSE LEAST(1.0,
                (CURRENT_DATE - cr.crono_inicio::date)::numeric
                / ((cr.crono_fim::date - cr.crono_inicio::date) + 1)
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
    ) sub3) AS port_fim,
    (SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE AVG(c2.crono_perc_atual) END
     FROM crono c2 WHERE c2.port_id = p.port_id AND c2.crono_tipo = 'T') AS port_perc_atual,
    (SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE AVG(cc.crono_perc_esperado) END
     FROM crono_calculado cc WHERE cc.port_id = p.port_id AND cc.crono_tipo = 'T') AS port_perc_estim
FROM portfolios p;
-- port_perc_desv e port_pace continuam calculados no backend, não em SQL (igual ao original).

-- ============================================================
-- 8) indices_economicos: variação mensal e acumulado de 12 meses (window functions)
-- ============================================================
CREATE VIEW indices_calculados AS
WITH var_mes AS (
    SELECT
        ie.*,
        CASE
            WHEN ie.index_nome = 'SALÁRIO MÍNIMO' THEN
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

-- ============================================================
-- 9) reajuste_eventos: junta nome de cliente/produto pro histórico exibido na tela de Consumo
--    e na aba Admin > Reajuste (evita repetir esse join em cada tela)
-- ============================================================
CREATE VIEW reajuste_eventos_detalhe AS
SELECT
    re.*,
    c.cliente_nome,
    c.cliente_cnpj,
    p.produto_nome,
    p.produto_detalhe,
    pc.pc_dat_niver
FROM reajuste_eventos re
JOIN clientes c ON c.cliente_id = re.cliente_id
JOIN produtos p ON p.produto_id = re.produto_id
LEFT JOIN precos_cliente pc ON pc.pc_id = re.pc_id;
