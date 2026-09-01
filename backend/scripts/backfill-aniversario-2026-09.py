"""Gera o SQL de backfill de precos_cliente.pc_dat_niver (Aniversario do Contrato) e
pc_dat_ult_reajuste (Ultimo Reajuste) a partir da planilha "tabela_precos_2026-07 - V2.xlsx"
(layout fixo por posicao de coluna, ver COLS abaixo -- os cabecalhos tem acento e o console
do Windows corrompe na exibicao, entao casamos por indice, nao por nome).

So entram no SQL as linhas cuja coluna "Aniversario do Contrato" NAO esta vazia (365 de 4711).
Dessas, so uma parte tambem tem "Ultimo Reajuste" preenchido (70) -- pc_dat_ult_reajuste so e
gravado nessas.

O UPDATE casa por pc_id (= coluna ID) e ainda confere CNPJ + produto + detalhe no JOIN, mesmo
padrao do backfill de agosto (backfill-pc-ult-reajuste.py) -- so grava quando os quatro batem.

Uso:
    python backend/scripts/backfill-aniversario-2026-09.py <xlsx> [precheck|update] > saida.sql

    precheck (default) -> so SELECTs de conferencia
    update             -> o UPDATE de verdade (BEGIN/COMMIT)
"""
import sys
import io
import datetime
import re
import openpyxl

# Windows: forcar UTF-8 (e LF) no stdout -- senao acento de produto/detalhe vira byte invalido
# pro Postgres e derruba o UPDATE (mesmo achado do backfill de agosto).
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="\n")

# Layout fixo da planilha (posicao de coluna, 0-based) -- ver cabecalho completo no
# 00_LEIA-ME.md: ID, Cliente, Produto, Detalhe, Franquia (R$), Valor unitario (R$), Regime,
# CNPJ do Cliente, CNPJ de Faturamento, Indice de Reajuste, Aniversario do Contrato, Ultimo Reajuste
I_ID, I_PRODUTO, I_DETALHE, I_CNPJ, I_ANIVERSARIO, I_ULTIMO = 0, 2, 3, 7, 10, 11


def so_digitos(s):
    return re.sub(r"\D", "", s or "")


def sql_str(s):
    return "'" + (s or "").replace("'", "''") + "'"


def data_iso(v):
    """Converte um valor de celula (str 'DD/MM/AAAA' ou datetime) pra 'AAAA-MM-DD', ou None."""
    if v in (None, ""):
        return None
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return None  # formato inesperado -- fica de fora, aparece como divergencia no precheck


def main():
    if len(sys.argv) < 2:
        sys.exit("uso: backfill-aniversario-2026-09.py <caminho-do-xlsx> [precheck|update]")
    caminho = sys.argv[1]
    modo = sys.argv[2] if len(sys.argv) > 2 else "precheck"
    if modo not in ("precheck", "update"):
        sys.exit("modo invalido: use 'precheck' ou 'update'")

    wb = openpyxl.load_workbook(caminho, data_only=True)
    ws = wb.active
    linhas = list(ws.iter_rows(values_only=True))
    if len(linhas[0]) < 12:
        sys.exit(f"cabecalho com {len(linhas[0])} colunas, esperava >= 12 -- layout mudou?")

    registros = []
    formato_invalido = []
    for row in linhas[1:]:
        aniversario_raw = row[I_ANIVERSARIO]
        if aniversario_raw in (None, ""):
            continue
        aniversario_iso = data_iso(aniversario_raw)
        if aniversario_iso is None:
            formato_invalido.append((row[I_ID], aniversario_raw))
            continue
        ultimo_iso = data_iso(row[I_ULTIMO])  # None quando vazio -- ok, nem todo mundo tem
        registros.append((
            int(row[I_ID]),
            so_digitos(str(row[I_CNPJ] or "")),
            str(row[I_PRODUTO] or "").strip(),
            str(row[I_DETALHE] or "").strip(),
            aniversario_iso,
            ultimo_iso,
        ))

    def values_block(indent="  "):
        linhas_sql = [f"{indent}(VALUES"]
        for k, (pid, cnpj, prod, det, an_iso, ur_iso) in enumerate(registros):
            virg = "," if k < len(registros) - 1 else ""
            ur_sql = f"DATE {sql_str(ur_iso)}" if ur_iso else "NULL::date"
            linhas_sql.append(
                f"{indent}  ({pid}, {sql_str(cnpj)}, {sql_str(prod)}, {sql_str(det)}, "
                f"DATE {sql_str(an_iso)}, {ur_sql}){virg}"
            )
        linhas_sql.append(f"{indent}) AS v(pc_id, cnpj, produto, detalhe, aniversario, ultimo_reajuste)")
        return "\n".join(linhas_sql)

    MATCH = (
        "regexp_replace(COALESCE(c.cliente_cnpj, ''), '\\D', '', 'g') = v.cnpj\n"
        "  AND p.produto_nome = v.produto\n"
        "  AND COALESCE(p.produto_detalhe, '') = COALESCE(v.detalhe, '')"
    )

    print("-- precos_cliente.pc_dat_niver + pc_dat_ult_reajuste -- gerado por backfill-aniversario-2026-09.py")
    print(f"-- Origem: {caminho}")
    print(f"-- Linhas com 'Aniversario do Contrato' preenchido: {len(registros)}")
    print(f"-- Dessas, com 'Ultimo Reajuste' tambem preenchido: {sum(1 for r in registros if r[5])}")
    if formato_invalido:
        print(f"-- ATENCAO: {len(formato_invalido)} linha(s) com Aniversario em formato inesperado, IGNORADAS: {formato_invalido}")

    if modo == "precheck":
        print("-- ==== PRE-CHECK (so SELECT, nao grava nada) ====")
        print()
        print("-- 1) quantos pc_id da planilha existem em precos_cliente:")
        print("SELECT count(*) AS ids_encontrados")
        print("FROM " + values_block().lstrip())
        print("JOIN precos_cliente pc ON pc.pc_id = v.pc_id;")
        print(f"-- esperado: {len(registros)}")
        print()
        print("-- 2) quantos casam TAMBEM em CNPJ + produto + detalhe (o que o UPDATE vai gravar):")
        print("SELECT count(*) AS casam_tudo")
        print("FROM " + values_block().lstrip())
        print("JOIN precos_cliente pc ON pc.pc_id = v.pc_id")
        print("JOIN clientes c ON c.cliente_id = pc.cliente_id")
        print("JOIN produtos p ON p.produto_id = pc.produto_id")
        print("WHERE " + MATCH + ";")
        print(f"-- se for < {len(registros)}, ver a consulta 3")
        print()
        print("-- 3) DIVERGENCIAS: pc_id existe mas CNPJ/produto/detalhe nao batem")
        print("--    (decidir o que fazer com essas linhas antes de aplicar o update)")
        print("SELECT v.pc_id, v.cnpj AS cnpj_planilha,")
        print("       regexp_replace(COALESCE(c.cliente_cnpj,''),'\\D','','g') AS cnpj_banco,")
        print("       v.produto AS produto_planilha, p.produto_nome AS produto_banco,")
        print("       v.detalhe AS detalhe_planilha, p.produto_detalhe AS detalhe_banco")
        print("FROM " + values_block().lstrip())
        print("JOIN precos_cliente pc ON pc.pc_id = v.pc_id")
        print("JOIN clientes c ON c.cliente_id = pc.cliente_id")
        print("JOIN produtos p ON p.produto_id = pc.produto_id")
        print("WHERE NOT (" + MATCH + ");")
        print()
        print("-- 4) o que MUDA de verdade (valor atual != valor da planilha) -- pra saber o tamanho")
        print("--    real do impacto antes de gravar (algumas linhas podem ja estar corretas)")
        print("SELECT")
        print("  count(*) FILTER (WHERE pc.pc_dat_niver IS DISTINCT FROM v.aniversario::text) AS aniversario_muda,")
        print("  count(*) FILTER (WHERE v.ultimo_reajuste IS NOT NULL AND pc.pc_dat_ult_reajuste IS DISTINCT FROM v.ultimo_reajuste::text) AS ultimo_reajuste_muda")
        print("FROM " + values_block().lstrip())
        print("JOIN precos_cliente pc ON pc.pc_id = v.pc_id")
        print("JOIN clientes c ON c.cliente_id = pc.cliente_id")
        print("JOIN produtos p ON p.produto_id = pc.produto_id")
        print("WHERE " + MATCH + ";")
        return

    # modo == "update"
    print("-- Idempotente: re-rodar grava o mesmo valor. Rode 01_diagnostico_aniversario.sql antes")
    print("-- e confira as divergencias (consulta 3) -- essas linhas NAO sao tocadas por este UPDATE.")
    print("BEGIN;")
    print("UPDATE precos_cliente pc")
    print("SET")
    print("  pc_dat_niver = v.aniversario::text,")
    print("  pc_dat_ult_reajuste = COALESCE(v.ultimo_reajuste::text, pc.pc_dat_ult_reajuste)")
    print("FROM " + values_block().lstrip() + ",")
    print("     clientes c, produtos p")
    print("WHERE pc.pc_id = v.pc_id")
    print("  AND c.cliente_id = pc.cliente_id")
    print("  AND p.produto_id = pc.produto_id")
    print("  AND " + MATCH + ";")
    print("-- confira o numero de linhas afetadas com 'casam_tudo' do precheck antes do COMMIT;")
    print("COMMIT;")


if __name__ == "__main__":
    main()
