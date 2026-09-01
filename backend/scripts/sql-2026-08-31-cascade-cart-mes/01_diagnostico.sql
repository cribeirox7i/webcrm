-- Só SELECT, não altera nada. Mostra a FK de cart_mes_id de cada tabela e se ela já tem
-- ON DELETE CASCADE (confdeltype = 'c') ou não (confdeltype = 'a', "no action" -- o padrão do
-- Postgres quando não se especifica ON DELETE, e o que faz hoje excluir um mês com dado
-- vinculado dar erro de violação de chave estrangeira em vez de apagar em cascata).
SELECT
    rel.relname AS tabela,
    con.conname AS constraint_atual,
    CASE con.confdeltype
        WHEN 'c' THEN 'CASCADE (já aplicado)'
        WHEN 'a' THEN 'NO ACTION (padrão -- ainda não aplicado)'
        ELSE con.confdeltype::text
    END AS comportamento_no_delete
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_class frel ON frel.oid = con.confrelid
WHERE con.contype = 'f'
  AND frel.relname = 'cart_mes'
ORDER BY rel.relname;
