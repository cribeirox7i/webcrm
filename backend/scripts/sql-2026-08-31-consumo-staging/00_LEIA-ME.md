# Tabela de preparo pra Importar Consumo — SQL de produção (Supabase SQL Editor)

**Por que existe**: a importação de consumo (Admin > Financeiro > Importar Consumo) lida com
arquivos reais de 60+ mil linhas. Mandar tudo isso num único `POST` estourava o limite de
tamanho de requisição da Vercel (~4.5MB) **antes** de chegar no backend — o navegador mostrava
isso como erro de **CORS** (achado 2026-08-31: a resposta de erro da própria Vercel, gerada na
borda, não carrega o header de CORS que a nossa app adicionaria). A solução foi subir os arquivos
em lotes pequenos pra uma tabela de preparo no banco, e só depois disso rodar a
análise/gravação de verdade (que já lê do banco via SQL, sem limite de tamanho de requisição).

**Precisa rodar isto antes do próximo deploy funcionar** — sem a tabela, `/admin/importar-consumo`
inteiro (upload, análise e gravação) fica quebrado com erro 500 "relation does not exist".

Rodar **`01_criar_tabela.sql`**. Idempotente (`CREATE TABLE IF NOT EXISTS`).

## Depois do SQL

1. Deploy do código: `git push` no `main` → Vercel faz deploy automático do backend.
2. Testar Importar Consumo de novo com os arquivos reais (a tela agora mostra "Enviando pro
   servidor: X / Y linhas..." antes de "Analisar").

## Manutenção

A tabela é limpa automaticamente pelo próprio fluxo (no início de uma nova sessão de upload, e no
fim de uma confirmação bem-sucedida) — não deveria acumular linha nenhuma entre usos. Se por
algum motivo sobrar lixo (ex. uma sessão abandonada no meio), é seguro rodar
`DELETE FROM consumo_import_staging;` a qualquer momento — ela nunca guarda dado definitivo.
