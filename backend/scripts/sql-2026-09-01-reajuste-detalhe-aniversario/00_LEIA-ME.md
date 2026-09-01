# Adiciona Aniversário do Contrato em reajuste_eventos_detalhe — SQL de produção

**Contexto**: pedido do usuário (2026-09-01) — a tela de Histórico de Reajustes deve mostrar a
data de aniversário do contrato (`precos_cliente.pc_dat_niver`), que hoje não está na view
`reajuste_eventos_detalhe`.

`01_atualizar_view.sql`: `CREATE OR REPLACE VIEW` adicionando `LEFT JOIN precos_cliente` (por
`pc_id`) e a coluna `pc_dat_niver`. Idempotente, sem risco -- só troca a definição da view, não
mexe em dado nenhum.
