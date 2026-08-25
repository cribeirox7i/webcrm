-- =============================================================================
-- CHECK constraints de valor nao-negativo nas tabelas financeiras/operacionais
-- Auditoria de seguranca #2 (2026-08-25), item 22 do checklist (logica de negocio)
--
-- COMO USAR: rodar no Supabase -> SQL Editor, na ordem. A PARTE 1 so consulta
-- (nao altera nada) e diz se existe dado que violaria as constraints. So rodar a
-- PARTE 2 se a PARTE 1 voltar tudo zerado.
--
-- O backend ja valida a mesma regra em `resource.ts` (COLUNAS_NAO_NEGATIVAS), o
-- que cobre o CRUD generico das telas. Estas constraints sao a rede de baixo:
-- pegam tambem escrita por SQL manual, script de migracao e a importacao de
-- carteira, que nao passam por aquele caminho.
--
-- SOBRE NULL: em Postgres, um CHECK passa quando a expressao da NULL (a condicao
-- e "unknown", nao "false"). Ou seja, linha com valor NULL NAO viola nenhuma
-- constraint abaixo, e nenhuma delas torna coluna alguma obrigatoria. Nada aqui
-- mexe com `cliente_id`, nem com as 306 URLs e a 1 linha de carteira sem cliente
-- vinculado (sentinela "0" da planilha original, migrado pra NULL de proposito).
-- =============================================================================


-- =============================================================================
-- PARTE 0 - ESTADO ATUAL (so leitura; rodar SOZINHA, antes de qualquer coisa)
--
-- Diz quais das 4 constraints ja existem e se cada uma ja foi validada contra o
-- dado existente (`validada` = a coluna `convalidated` do pg_constraint). Serve
-- pra saber de onde retomar quando nao esta claro o que ja rodou:
--   nao existe          -> falta aplicar a PARTE 2
--   existe, validada=f  -> PARTE 2 feita, falta a PARTE 2B
--   existe, validada=t  -> nada a fazer, ja esta tudo aplicado
--
-- IMPORTANTE: no SQL Editor do Supabase, selecionar SO este bloco e rodar (ou
-- apagar o resto). Rodando o arquivo inteiro, o editor mostra apenas o resultado
-- da ultima instrucao que devolve linhas -- foi o que aconteceu na primeira
-- execucao desta leva.
-- =============================================================================

SELECT c.conname AS constraint_name,
       c.conrelid::regclass::text AS tabela,
       c.convalidated AS validada,
       CASE WHEN c.convalidated THEN 'ja aplicada e validada'
            ELSE 'aplicada, mas falta a PARTE 2B' END AS situacao
FROM pg_constraint c
WHERE c.conname IN (
  'carteira_valores_nao_negativos',
  'precos_cliente_valores_nao_negativos',
  'consumo_ana_qtd_nao_negativa',
  'crono_valores_nao_negativos'
)
ORDER BY c.conrelid::regclass::text;


-- =============================================================================
-- PARTE 1 - CONFERENCIA (so leitura, seguro rodar a qualquer momento)
--
-- E UMA QUERY UNICA de proposito: o SQL Editor do Supabase mostra apenas o
-- resultado da ULTIMA instrucao de um lote, entao a primeira versao disto (5
-- SELECTs separados) rodava tudo mas exibia so o ultimo -- exatamente as contagens
-- que importam ficavam invisiveis. Aqui tudo volta num resultado so.
--
-- A PRIMEIRA linha do resultado e sempre o veredito consolidado (tabela =
-- 'TOTAL'): "OK - pode aplicar a PARTE 2" ou "TEM VIOLACAO - nao aplicar a
-- PARTE 2". Abaixo dela vem uma linha por coluna checada, com as violacoes (se
-- houver) logo em seguida, porque a ordenacao e por contagem decrescente.
-- Se vier qualquer coisa diferente de 0, NAO aplicar a PARTE 2 -- me avisar
-- primeiro pra decidirmos o que fazer com aquelas linhas.
--
-- Este script foi testado de ponta a ponta num Postgres real (PGlite, WASM) com
-- as 4 tabelas nos mesmos tipos do schema.pg.sql: PARTE 1 com dado saudavel
-- (veredito OK) e com violacao plantada (acusou a coluna certa), PARTE 2 e 2B
-- aplicando sem erro, as 4 constraints barrando negativo de fato, e linha com
-- cliente_id NULL + valores NULL continuando aceita depois de tudo aplicado.
-- =============================================================================

WITH checagens AS (
  SELECT 'carteira' AS tabela, c.coluna, COUNT(*) FILTER (WHERE c.valor < 0) AS violacoes
  FROM carteira t
  CROSS JOIN LATERAL (VALUES
    ('cart_qtd',             t.cart_qtd::numeric),
    ('cart_vlr',             t.cart_vlr),
    ('cart_pdd',             t.cart_pdd),
    ('cart_sem_pdd',         t.cart_sem_pdd),
    ('cart_fat',             t.cart_fat),
    ('cart_qtd_mes',         t.cart_qtd_mes::numeric),
    ('cart_emprestimos_mes', t.cart_emprestimos_mes)
  ) AS c(coluna, valor)
  GROUP BY c.coluna

  UNION ALL

  SELECT 'precos_cliente', c.coluna, COUNT(*) FILTER (WHERE c.valor < 0)
  FROM precos_cliente t
  CROSS JOIN LATERAL (VALUES
    ('pc_vlr_franquia', t.pc_vlr_franquia),
    ('pc_vlr_unit',     t.pc_vlr_unit),
    ('pc_fx1_lim', t.pc_fx1_lim), ('pc_fx2_lim', t.pc_fx2_lim), ('pc_fx3_lim', t.pc_fx3_lim),
    ('pc_fx4_lim', t.pc_fx4_lim), ('pc_fx5_lim', t.pc_fx5_lim),
    ('pc_fx1_vlr', t.pc_fx1_vlr), ('pc_fx2_vlr', t.pc_fx2_vlr), ('pc_fx3_vlr', t.pc_fx3_vlr),
    ('pc_fx4_vlr', t.pc_fx4_vlr), ('pc_fx5_vlr', t.pc_fx5_vlr)
  ) AS c(coluna, valor)
  GROUP BY c.coluna

  UNION ALL

  SELECT 'consumo_ana', 'consumo_qtd', COUNT(*) FILTER (WHERE consumo_qtd < 0)
  FROM consumo_ana

  UNION ALL

  SELECT 'crono', c.coluna, COUNT(*) FILTER (WHERE c.valor < 0)
  FROM crono t
  CROSS JOIN LATERAL (VALUES
    ('crono_perc_atual', t.crono_perc_atual),
    ('crono_hh_orc',     t.crono_hh_orc),
    ('crono_hh_real',    t.crono_hh_real)
  ) AS c(coluna, valor)
  GROUP BY c.coluna
)
SELECT tabela, coluna, violacoes,
       CASE WHEN violacoes = 0 THEN 'ok' ELSE 'VIOLA -- nao aplicar a PARTE 2' END AS situacao
FROM checagens

UNION ALL

-- Informativo, nao vira constraint (ver PARTE 3): crono_perc_atual e fracao (0-1),
-- o form manda 0-100 e divide por 100. Passar de 1 = acima de 100%.
SELECT 'crono', 'crono_perc_atual > 1 (acima de 100%)', COUNT(*),
       CASE WHEN COUNT(*) = 0 THEN 'ok' ELSE 'informativo, nao bloqueia' END
FROM crono WHERE crono_perc_atual > 1

UNION ALL

-- Veredito consolidado, so das checagens que de fato bloqueiam a PARTE 2.
SELECT 'TOTAL', '(todas as colunas que bloqueiam)', SUM(violacoes),
       CASE WHEN SUM(violacoes) = 0
            THEN 'OK - pode aplicar a PARTE 2'
            ELSE 'TEM VIOLACAO - nao aplicar a PARTE 2' END
FROM checagens

ORDER BY 3 DESC, 1, 2;


-- =============================================================================
-- PARTE 2 - APLICACAO (altera o schema; rodar so se a PARTE 1 voltou tudo 0)
--
-- Cada constraint e NOT VALID de proposito: o Postgres passa a barrar toda
-- escrita nova imediatamente, mas nao varre a tabela inteira na hora de aplicar
-- (evita lock longo em `consumo_ana`, que tem ~256 mil linhas). A validacao do
-- dado que ja existe fica pra PARTE 2B.
--
-- IDEMPOTENTE: cada bloco so cria a constraint se ela ainda nao existir. A
-- primeira versao usava `ALTER TABLE ... ADD CONSTRAINT` direto, e rodar o
-- arquivo de novo estourava `42710: constraint ... already exists` no primeiro
-- ALTER (achado real: o usuario rodou o arquivo inteiro na primeira vez, entao a
-- PARTE 2 ja tinha aplicado tudo, e a segunda execucao quebrou aqui). O Postgres
-- nao tem `ADD CONSTRAINT IF NOT EXISTS`, por isso o DO/IF NOT EXISTS -- e nao um
-- `DROP CONSTRAINT IF EXISTS` antes, que jogaria fora a validacao ja feita pela
-- PARTE 2B e obrigaria a varredura completa de novo.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'carteira_valores_nao_negativos'
                   AND conrelid = 'carteira'::regclass) THEN
    ALTER TABLE carteira
      ADD CONSTRAINT carteira_valores_nao_negativos CHECK (
        cart_qtd             >= 0 AND
        cart_vlr             >= 0 AND
        cart_pdd             >= 0 AND
        cart_sem_pdd         >= 0 AND
        cart_fat             >= 0 AND
        cart_qtd_mes         >= 0 AND
        cart_emprestimos_mes >= 0
      ) NOT VALID;
    RAISE NOTICE 'carteira_valores_nao_negativos criada';
  ELSE
    RAISE NOTICE 'carteira_valores_nao_negativos ja existia, nada feito';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'precos_cliente_valores_nao_negativos'
                   AND conrelid = 'precos_cliente'::regclass) THEN
    ALTER TABLE precos_cliente
      ADD CONSTRAINT precos_cliente_valores_nao_negativos CHECK (
        pc_vlr_franquia >= 0 AND pc_vlr_unit >= 0 AND
        pc_fx1_lim >= 0 AND pc_fx2_lim >= 0 AND pc_fx3_lim >= 0 AND
        pc_fx4_lim >= 0 AND pc_fx5_lim >= 0 AND
        pc_fx1_vlr >= 0 AND pc_fx2_vlr >= 0 AND pc_fx3_vlr >= 0 AND
        pc_fx4_vlr >= 0 AND pc_fx5_vlr >= 0
      ) NOT VALID;
    RAISE NOTICE 'precos_cliente_valores_nao_negativos criada';
  ELSE
    RAISE NOTICE 'precos_cliente_valores_nao_negativos ja existia, nada feito';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'consumo_ana_qtd_nao_negativa'
                   AND conrelid = 'consumo_ana'::regclass) THEN
    ALTER TABLE consumo_ana
      ADD CONSTRAINT consumo_ana_qtd_nao_negativa CHECK (consumo_qtd >= 0) NOT VALID;
    RAISE NOTICE 'consumo_ana_qtd_nao_negativa criada';
  ELSE
    RAISE NOTICE 'consumo_ana_qtd_nao_negativa ja existia, nada feito';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'crono_valores_nao_negativos'
                   AND conrelid = 'crono'::regclass) THEN
    ALTER TABLE crono
      ADD CONSTRAINT crono_valores_nao_negativos CHECK (
        crono_perc_atual >= 0 AND crono_hh_orc >= 0 AND crono_hh_real >= 0
      ) NOT VALID;
    RAISE NOTICE 'crono_valores_nao_negativos criada';
  ELSE
    RAISE NOTICE 'crono_valores_nao_negativos ja existia, nada feito';
  END IF;
END $$;


-- =============================================================================
-- PARTE 2B - VALIDAR O DADO EXISTENTE (opcional, depois da PARTE 2)
-- Promove as constraints de NOT VALID pra validadas. Faz uma varredura completa
-- de cada tabela; em `consumo_ana` isso pega ~256 mil linhas, entao rodar numa
-- hora de baixo uso. Se a PARTE 1 voltou tudo 0, nao deve falhar nenhuma.
-- =============================================================================

-- Guardado por IF EXISTS pelo mesmo motivo da PARTE 2 (poder rodar de novo sem
-- estourar). Revalidar constraint ja validada e no-op no Postgres, nao da erro --
-- o guarda aqui e pro caso da constraint nao existir ainda.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'carteira_valores_nao_negativos') THEN
    ALTER TABLE carteira VALIDATE CONSTRAINT carteira_valores_nao_negativos;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'precos_cliente_valores_nao_negativos') THEN
    ALTER TABLE precos_cliente VALIDATE CONSTRAINT precos_cliente_valores_nao_negativos;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumo_ana_qtd_nao_negativa') THEN
    ALTER TABLE consumo_ana VALIDATE CONSTRAINT consumo_ana_qtd_nao_negativa;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crono_valores_nao_negativos') THEN
    ALTER TABLE crono VALIDATE CONSTRAINT crono_valores_nao_negativos;
  END IF;
END $$;


-- =============================================================================
-- PARTE 3 - O QUE FICOU DE FORA DE PROPOSITO
--
-- - `cliente_id` continua aceitando NULL em `urls` e `carteira`. Nao foi tocado:
--   306 URLs e 1 linha de carteira dependem disso hoje.
-- - Teto de 100% em `crono_perc_atual` (CHECK <= 1): nao aplicado sem confirmar
--   se atividade "estourada" pode passar de 100% no uso real. A PARTE 1 conta
--   quantas linhas hoje passariam de 1.
-- - Datas (`cart_data_base`, `crono_inicio`, `crono_replan` etc.) sao TEXT no
--   schema, herdado do SQLite. Validar formato exigiria CHECK com regex ou
--   converter as colunas pra DATE -- mudanca de tipo, com impacto em codigo,
--   fora do escopo desta leva.
-- - Coerencia entre colunas (ex.: cart_pdd <= cart_vlr, crono_fim >= crono_inicio)
--   nao foi assumida: nao sei se e regra de negocio real ou coincidencia dos
--   dados atuais. Precisa de confirmacao antes de virar constraint.
-- =============================================================================
