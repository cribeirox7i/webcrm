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
-- PARTE 1 - CONFERENCIA (so leitura, seguro rodar a qualquer momento)
-- Esperado: 0 em todas as colunas. Qualquer numero diferente de 0 significa que
-- existe dado real violando a regra -- NAO aplicar a PARTE 2 nesse caso, me
-- avisar primeiro pra decidirmos o que fazer com aquelas linhas.
-- =============================================================================

SELECT 'carteira' AS tabela,
       COUNT(*) FILTER (WHERE cart_qtd             < 0) AS cart_qtd,
       COUNT(*) FILTER (WHERE cart_vlr             < 0) AS cart_vlr,
       COUNT(*) FILTER (WHERE cart_pdd             < 0) AS cart_pdd,
       COUNT(*) FILTER (WHERE cart_sem_pdd         < 0) AS cart_sem_pdd,
       COUNT(*) FILTER (WHERE cart_fat             < 0) AS cart_fat,
       COUNT(*) FILTER (WHERE cart_qtd_mes         < 0) AS cart_qtd_mes,
       COUNT(*) FILTER (WHERE cart_emprestimos_mes < 0) AS cart_emprestimos_mes
FROM carteira;

SELECT 'precos_cliente' AS tabela,
       COUNT(*) FILTER (WHERE pc_vlr_franquia < 0) AS pc_vlr_franquia,
       COUNT(*) FILTER (WHERE pc_vlr_unit     < 0) AS pc_vlr_unit,
       COUNT(*) FILTER (WHERE pc_fx1_lim < 0 OR pc_fx2_lim < 0 OR pc_fx3_lim < 0
                           OR pc_fx4_lim < 0 OR pc_fx5_lim < 0) AS faixas_limite,
       COUNT(*) FILTER (WHERE pc_fx1_vlr < 0 OR pc_fx2_vlr < 0 OR pc_fx3_vlr < 0
                           OR pc_fx4_vlr < 0 OR pc_fx5_vlr < 0) AS faixas_valor
FROM precos_cliente;

SELECT 'consumo_ana' AS tabela,
       COUNT(*) FILTER (WHERE consumo_qtd < 0) AS consumo_qtd
FROM consumo_ana;

SELECT 'crono' AS tabela,
       COUNT(*) FILTER (WHERE crono_perc_atual < 0) AS crono_perc_atual,
       COUNT(*) FILTER (WHERE crono_hh_orc     < 0) AS crono_hh_orc,
       COUNT(*) FILTER (WHERE crono_hh_real    < 0) AS crono_hh_real
FROM crono;

-- Percentual acima de 100%: nao vira constraint (ver PARTE 3), so conferencia.
-- crono_perc_atual e fracao (0-1): o form manda 0-100 e divide por 100.
SELECT 'crono_perc_atual > 1 (acima de 100%)' AS conferencia, COUNT(*) AS linhas
FROM crono WHERE crono_perc_atual > 1;


-- =============================================================================
-- PARTE 2 - APLICACAO (altera o schema; rodar so se a PARTE 1 voltou tudo 0)
-- Cada constraint e NOT VALID de proposito: o Postgres passa a barrar toda
-- escrita nova imediatamente, mas nao varre a tabela inteira na hora de aplicar
-- (evita lock longo em `consumo_ana`, que tem ~256 mil linhas). A validacao do
-- dado que ja existe fica pra PARTE 2B.
-- =============================================================================

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

ALTER TABLE precos_cliente
  ADD CONSTRAINT precos_cliente_valores_nao_negativos CHECK (
    pc_vlr_franquia >= 0 AND pc_vlr_unit >= 0 AND
    pc_fx1_lim >= 0 AND pc_fx2_lim >= 0 AND pc_fx3_lim >= 0 AND
    pc_fx4_lim >= 0 AND pc_fx5_lim >= 0 AND
    pc_fx1_vlr >= 0 AND pc_fx2_vlr >= 0 AND pc_fx3_vlr >= 0 AND
    pc_fx4_vlr >= 0 AND pc_fx5_vlr >= 0
  ) NOT VALID;

ALTER TABLE consumo_ana
  ADD CONSTRAINT consumo_ana_qtd_nao_negativa CHECK (consumo_qtd >= 0) NOT VALID;

ALTER TABLE crono
  ADD CONSTRAINT crono_valores_nao_negativos CHECK (
    crono_perc_atual >= 0 AND crono_hh_orc >= 0 AND crono_hh_real >= 0
  ) NOT VALID;


-- =============================================================================
-- PARTE 2B - VALIDAR O DADO EXISTENTE (opcional, depois da PARTE 2)
-- Promove as constraints de NOT VALID pra validadas. Faz uma varredura completa
-- de cada tabela; em `consumo_ana` isso pega ~256 mil linhas, entao rodar numa
-- hora de baixo uso. Se a PARTE 1 voltou tudo 0, nao deve falhar nenhuma.
-- =============================================================================

ALTER TABLE carteira       VALIDATE CONSTRAINT carteira_valores_nao_negativos;
ALTER TABLE precos_cliente VALIDATE CONSTRAINT precos_cliente_valores_nao_negativos;
ALTER TABLE consumo_ana    VALIDATE CONSTRAINT consumo_ana_qtd_nao_negativa;
ALTER TABLE crono          VALIDATE CONSTRAINT crono_valores_nao_negativos;


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
