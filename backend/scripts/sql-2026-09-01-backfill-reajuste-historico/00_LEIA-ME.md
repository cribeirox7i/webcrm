# Backfill de reajuste_eventos histórico — SQL de produção (Supabase SQL Editor)

**Contexto**: `reajuste_eventos` (criada na leva "Reajuste de preço de consumo") só passou a ser
alimentada por reajustes aplicados via Admin > Reajuste dali pra frente. Existem contratos em
`precos_cliente` com `pc_dat_ult_reajuste` já preenchido (reajuste feito antes dessa tela existir)
cujo `pc_vlr_unit`/`pc_vlr_franquia` mudou de valor em relação ao mês anterior (mesmo
cliente+produto, mês de `cart_mes` anterior) — esses casos reais não têm evento nenhum no
histórico. Pedido do usuário (2026-09-01): gerar um script que detecte essas transições e
preencha `reajuste_eventos` retroativamente.

**Decisões já confirmadas com o usuário**:
- Escopo: **todos** os registros de `precos_cliente` com `pc_dat_ult_reajuste` preenchido (não só
  o mês vigente) — comparados com o mês imediatamente anterior (mesmo cliente+produto).
- Taxa gravada: **taxa observada** = `(valor_novo / valor_anterior) - 1`, calculada em cima da
  variação real (não busca o acumulado do indexador na época).
- Data do evento: a própria `pc_dat_ult_reajuste` já gravada na linha.

**Ainda em aberto** (por isso este script é só diagnóstico, sem gravar nada): quando unitário e
franquia mudam com taxas diferentes no mesmo mês — ou só um dos dois muda — não dá pra saber sem
olhar os dados reais qual taxa faz sentido gravar (a tabela tem 1 coluna de taxa só, compartilhada
pelos dois valores). Rodar isto primeiro e mandar o resultado de volta antes do script de gravação
(`02_backfill.sql`, ainda não escrito) ser fechado.

| # | arquivo | o que faz |
|---|---|---|
| 1 | `01_diagnostico.sql` | só `SELECT` — lista cada linha candidata (tem `pc_dat_ult_reajuste` e existe mês anterior pra comparar) com o antes/depois de cada valor e a taxa observada de cada um separadamente, mais se já existe evento gravado pra aquele `pc_id`. |
