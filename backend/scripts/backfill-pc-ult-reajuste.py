"""Gera o SQL de backfill de precos_cliente.pc_dat_ult_reajuste a partir de uma planilha de
tabela de precos exportada do sistema (colunas: ID, CNPJ do Cliente, Produto, Detalhe,
Ultimo Reajuste).

So entram no SQL as linhas cuja coluna "Ultimo Reajuste" NAO esta vazia. O UPDATE casa por
pc_id (= coluna ID) e ainda confere CNPJ + produto + detalhe no JOIN, pra so gravar quando os
quatro batem (consistencia -- se o pc_id foi reaproveitado / a planilha esta de outro corte,
a linha nao e tocada e aparece no pre-check).

Uso:
    python backend/scripts/backfill-pc-ult-reajuste.py <xlsx> [precheck|update] > saida.sql

    precheck (default) -> so SELECTs de conferencia (quantos casam por id, por id+cnpj+prod+det,
                          e a lista das divergencias)
    update             -> o UPDATE de verdade (BEGIN/COMMIT)

Nao contem dado sensivel -- so le o xlsx passado como argumento e escreve SQL no stdout.
"""
import sys
import io
import datetime
import re
import openpyxl

# Windows: o stdout do Python usa cp1252 por padrao -- forcar UTF-8 (e LF), senao acentos de
# produto/detalhe (ex. "VALIDACAO") viram bytes invalidos pro Postgres e derrubam o UPDATE.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="\n")


def so_digitos(s):
    return re.sub(r"\D", "", s or "")


def sql_str(s):
    return "'" + (s or "").replace("'", "''") + "'"


def main():
    if len(sys.argv) < 2:
        sys.exit("uso: backfill-pc-ult-reajuste.py <caminho-do-xlsx> [precheck|update]")
    caminho = sys.argv[1]
    modo = sys.argv[2] if len(sys.argv) > 2 else "precheck"
    if modo not in ("precheck", "update"):
        sys.exit("modo invalido: use 'precheck' ou 'update'")
    wb = openpyxl.load_workbook(caminho, data_only=True)
    ws = wb.active
    linhas = list(ws.iter_rows(values_only=True))
    hdr = [str(c).strip() if c is not None else "" for c in linhas[0]]

    def col(nome):
        try:
            return hdr.index(nome)
        except ValueError:
            sys.exit(f"coluna '{nome}' nao encontrada. Cabecalho: {hdr}")

    i_id, i_cnpj, i_prod, i_det, i_dt = (
        col("ID"), col("CNPJ do Cliente"), col("Produto"), col("Detalhe"), col("Ultimo Reajuste"),
    )

    registros = []
    for row in linhas[1:]:
        dt = row[i_dt]
        if dt in (None, ""):
            continue
        if isinstance(dt, (datetime.datetime, datetime.date)):
            dt_iso = dt.strftime("%Y-%m-%d")
        else:
            dt_iso = str(dt).strip()[:10]
        registros.append((
            int(row[i_id]),
            so_digitos(str(row[i_cnpj] or "")),
            str(row[i_prod] or "").strip(),
            str(row[i_det] or "").strip(),
            dt_iso,
        ))

    def values_block(indent="  "):
        linhas_sql = [f"{indent}(VALUES"]
        for k, (pid, cnpj, prod, det, dt_iso) in enumerate(registros):
            virg = "," if k < len(registros) - 1 else ""
            linhas_sql.append(
                f"{indent}  ({pid}, {sql_str(cnpj)}, {sql_str(prod)}, {sql_str(det)}, DATE {sql_str(dt_iso)}){virg}"
            )
        linhas_sql.append(f"{indent}) AS v(pc_id, cnpj, produto, detalhe, dt)")
        return "\n".join(linhas_sql)

    MATCH = (
        "regexp_replace(COALESCE(c.cliente_cnpj, ''), '\\D', '', 'g') = v.cnpj\n"
        "  AND p.produto_nome = v.produto\n"
        "  AND COALESCE(p.produto_detalhe, '') = COALESCE(v.detalhe, '')"
    )

    print("-- precos_cliente.pc_dat_ult_reajuste -- gerado por backfill-pc-ult-reajuste.py")
    print(f"-- Origem: {caminho}")
    print(f"-- Linhas com 'Ultimo Reajuste' preenchido: {len(registros)}")

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
        print("--    (decidir o que fazer com essas linhas antes de aplicar o 05)")
        print("SELECT v.pc_id, v.cnpj AS cnpj_planilha,")
        print("       regexp_replace(COALESCE(c.cliente_cnpj,''),'\\D','','g') AS cnpj_banco,")
        print("       v.produto AS produto_planilha, p.produto_nome AS produto_banco,")
        print("       v.detalhe AS detalhe_planilha, p.produto_detalhe AS detalhe_banco")
        print("FROM " + values_block().lstrip())
        print("JOIN precos_cliente pc ON pc.pc_id = v.pc_id")
        print("JOIN clientes c ON c.cliente_id = pc.cliente_id")
        print("JOIN produtos p ON p.produto_id = pc.produto_id")
        print("WHERE NOT (" + MATCH + ");")
        return

    # modo == "update"
    print("-- Idempotente: re-rodar grava o mesmo valor. Rode 04_backfill_precheck.sql antes.")
    print("BEGIN;")
    print("UPDATE precos_cliente pc")
    print("SET pc_dat_ult_reajuste = v.dt")
    print("FROM " + values_block().lstrip() + ",")
    print("     clientes c, produtos p")
    print("WHERE pc.pc_id = v.pc_id")
    print("  AND c.cliente_id = pc.cliente_id")
    print("  AND p.produto_id = pc.produto_id")
    print("  AND " + MATCH + ";")
    print("-- confira o numero de linhas afetadas com o esperado acima antes do COMMIT;")
    print("COMMIT;")


if __name__ == "__main__":
    main()
