-- Troca a FK de cart_mes_id (em carteira, precos_cliente, consumo_ana, faturamento e
-- consumo_import_staging) pra ON DELETE CASCADE -- decisão do usuário: excluir um cart_mes
-- passa a apagar em cascata tudo que está vinculado àquele mês nessas 5 tabelas.
--
-- Não dá pra "ALTER CONSTRAINT" a ação de DELETE direto no Postgres -- o jeito é DROP + ADD.
-- O nome da constraint é descoberto dinamicamente (pg_constraint) em vez de assumido
-- (`tabela_cart_mes_id_fkey`), pra não quebrar se algum ambiente tiver um nome diferente do
-- padrão gerado automaticamente. Idempotente: rodar de novo só recria a mesma constraint (já
-- com CASCADE) sem erro.

DO $$
DECLARE
    tbl TEXT;
    cons_name TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['carteira', 'precos_cliente', 'consumo_ana', 'faturamento', 'consumo_import_staging']
    LOOP
        SELECT con.conname INTO cons_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_class frel ON frel.oid = con.confrelid
        WHERE con.contype = 'f'
          AND rel.relname = tbl
          AND frel.relname = 'cart_mes';

        IF cons_name IS NULL THEN
            RAISE NOTICE 'tabela % não tem FK pra cart_mes (ou não existe) -- pulando', tbl;
        ELSE
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tbl, cons_name);
            EXECUTE format(
                'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (cart_mes_id) REFERENCES cart_mes(cart_mes_id) ON DELETE CASCADE',
                tbl, cons_name
            );
            RAISE NOTICE 'tabela %: constraint % agora com ON DELETE CASCADE', tbl, cons_name;
        END IF;
    END LOOP;
END $$;

-- conferência pós-fix -- as 5 linhas devem mostrar "CASCADE (já aplicado)"
SELECT
    rel.relname AS tabela,
    con.conname AS constraint_atual,
    CASE con.confdeltype WHEN 'c' THEN 'CASCADE (já aplicado)' ELSE con.confdeltype::text END AS comportamento_no_delete
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_class frel ON frel.oid = con.confrelid
WHERE con.contype = 'f'
  AND frel.relname = 'cart_mes'
ORDER BY rel.relname;
