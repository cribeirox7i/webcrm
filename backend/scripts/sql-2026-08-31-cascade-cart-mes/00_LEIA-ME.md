# DELETE CASCADE em cart_mes — SQL de produção (Supabase SQL Editor)

**Contexto**: hoje excluir um `cart_mes` que ainda tem linhas em `carteira`/`precos_cliente`/
`consumo_ana`/`faturamento` dá erro de violação de chave estrangeira (nenhuma FK tem
`ON DELETE CASCADE`) — nada é apagado, a exclusão simplesmente falha. Decisão do usuário
(2026-08-31): trocar pra `ON DELETE CASCADE` nas 5 tabelas que referenciam `cart_mes_id`
(as 4 acima + `consumo_import_staging`, a tabela de preparo da importação de consumo).

**Trava de segurança que acompanha isso** (já no código, `backend/src/routes/resource.ts`):
a exclusão de `cart_mes` só é permitida quando `cart_vigencia_ativa = 'S'` — excluir um mês
antigo por engano passa a exigir primeiro marcá-lo como vigente (ação deliberada), em vez de
acontecer com 1 clique. Isso é checagem de aplicação, não de banco — não depende deste SQL.

Rodar **nesta ordem**. Ambos idempotentes (podem rodar de novo sem estragar nada).

| # | arquivo | o que faz |
|---|---|---|
| 1 | `01_diagnostico.sql` | só `SELECT` — mostra a FK atual de cada tabela e se já tem `ON DELETE CASCADE` ou não. |
| 2 | `02_aplicar_cascade.sql` | `DROP`+`ADD CONSTRAINT` (Postgres não permite alterar a ação de `DELETE` de uma FK existente, só recriar) nas 5 tabelas, descobrindo o nome real da constraint em vez de assumir — termina com um `SELECT` de conferência (as 5 linhas devem mostrar "CASCADE (já aplicado)"). |

## Depois do SQL

Nenhum passo adicional — o código que já foi enviado (`resource.ts`) já checa a condição de
vigência antes de deixar excluir; a cascata em si é só o comportamento do banco.
