import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { adminApi, type LinhaMedicao, type RelatorioImportacao } from "../api/adminClient";
import type { CartMes } from "../api/types";

interface ImportarCarteiraPageProps {
  token: string;
  onLogout: () => void;
}

/** Cabeçalhos esperados na planilha de medição -> campo da nossa carteira. A comparação é feita
 * com o texto normalizado (sem acento/pontuação/espaço, maiúsculo) porque o arquivo original vem
 * com acentuação inconsistente ("QTD. OP. Mês", "Valor total emprestado no Mês") e pequenas
 * variações entre extrações. */
const COLUNAS: { chave: keyof LinhaMedicao; cabecalhos: string[] }[] = [
  { chave: "nome", cabecalhos: ["NOME"] },
  { chave: "cnpj", cabecalhos: ["CNPJ"] },
  { chave: "qtd", cabecalhos: ["QTDOPE"] },
  { chave: "vlr", cabecalhos: ["VALORCARTEIRA"] },
  { chave: "pdd", cabecalhos: ["VALORPDD"] },
  { chave: "semPdd", cabecalhos: ["VALORCARTEIRASEMPDD"] },
  { chave: "fat", cabecalhos: ["VALORCARTEIRAFATURAMENTO"] },
  { chave: "qtdMes", cabecalhos: ["QTDOPMES"] },
  { chave: "emprestimosMes", cabecalhos: ["VALORTOTALEMPRESTADONOMES"] },
  { chave: "ultDef", cabecalhos: ["DATAULTIMODEFERIMNTOOP", "DATAULTIMODEFERIMENTOOP"] },
  { chave: "dataBase", cabecalhos: ["DATABASE"] },
  { chave: "datExtracao", cabecalhos: ["DATAHORAGERADA"] },
  { chave: "rds", cabecalhos: ["RDS"] },
  { chave: "db", cabecalhos: ["BD"] },
  { chave: "prod", cabecalhos: ["MODULO"] },
];

function normalizaCabecalho(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** exceljs devolve valores ricos (fórmula, texto formatado, hyperlink) -- reduz pro valor cru. */
function valorCru(v: ExcelJS.CellValue): unknown {
  if (v == null) return null;
  if (typeof v === "object") {
    if (v instanceof Date) return v;
    if ("result" in v) return (v as { result: unknown }).result;
    if ("text" in v) return (v as { text: unknown }).text;
    if ("richText" in v) return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  return v;
}

export function ImportarCarteiraPage({ token, onLogout }: ImportarCarteiraPageProps) {
  const [meses, setMeses] = useState<CartMes[]>([]);
  const [cartMesId, setCartMesId] = useState<string>("");
  const [linhas, setLinhas] = useState<LinhaMedicao[] | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string>("");
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [concluido, setConcluido] = useState<RelatorioImportacao | null>(null);

  function tratarErroAuth(err: unknown): boolean {
    if ((err as Error).message === "não autenticado") {
      onLogout();
      return true;
    }
    return false;
  }

  useEffect(() => {
    adminApi
      .list<CartMes>("cart_mes", token, { limit: 1000 })
      .then((res) => {
        const ordenados = [...res.data].sort((a, b) => b.cart_ano_mes.localeCompare(a.cart_ano_mes));
        setMeses(ordenados);
        if (ordenados[0]) setCartMesId(String(ordenados[0].cart_mes_id));
      })
      .catch((err) => {
        if (!tratarErroAuth(err)) setErro((err as Error).message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function lerPlanilha(file: File) {
    setErro(null);
    setRelatorio(null);
    setConcluido(null);
    setLinhas(null);
    setNomeArquivo(file.name);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("planilha sem abas");

      const cabecalho = ws.getRow(1);
      const indicePorChave = new Map<keyof LinhaMedicao, number>();
      cabecalho.eachCell((cell, col) => {
        const norm = normalizaCabecalho(valorCru(cell.value));
        const achou = COLUNAS.find((c) => c.cabecalhos.includes(norm));
        if (achou && !indicePorChave.has(achou.chave)) indicePorChave.set(achou.chave, col);
      });

      const faltando = COLUNAS.filter((c) => !indicePorChave.has(c.chave)).map((c) => c.cabecalhos[0]);
      if (faltando.length) {
        throw new Error(`colunas não encontradas na planilha: ${faltando.join(", ")}`);
      }

      const lidas: LinhaMedicao[] = [];
      ws.eachRow((row, num) => {
        if (num === 1) return;
        const obj = {} as Record<string, unknown>;
        indicePorChave.forEach((col, chave) => {
          obj[chave] = valorCru(row.getCell(col).value);
        });
        const temAlgo = obj.nome != null || obj.cnpj != null;
        if (temAlgo) lidas.push(obj as unknown as LinhaMedicao);
      });

      if (!lidas.length) throw new Error("nenhuma linha de dados encontrada");
      setLinhas(lidas);
    } catch (err) {
      setErro(`Falha ao ler a planilha: ${(err as Error).message}`);
    }
  }

  async function simular() {
    if (!linhas || !cartMesId) return;
    setOcupado(true);
    setErro(null);
    try {
      const rel = await adminApi.importarCarteira(token, Number(cartMesId), linhas, true);
      setRelatorio(rel);
    } catch (err) {
      if (!tratarErroAuth(err)) setErro((err as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!linhas || !cartMesId || !relatorio) return;
    const aviso =
      relatorio.linhasExistentesNoMes > 0
        ? `Isto vai APAGAR as ${relatorio.linhasExistentesNoMes} linhas de carteira já existentes em ${relatorio.mes} e gravar ${relatorio.aInserir} no lugar. Confirmar?`
        : `Gravar ${relatorio.aInserir} linhas de carteira em ${relatorio.mes}?`;
    if (!confirm(aviso)) return;

    setOcupado(true);
    setErro(null);
    try {
      const rel = await adminApi.importarCarteira(token, Number(cartMesId), linhas, false);
      setConcluido(rel);
      setRelatorio(null);
      setLinhas(null);
      setNomeArquivo("");
    } catch (err) {
      if (!tratarErroAuth(err)) setErro((err as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const mesSelecionado = useMemo(
    () => meses.find((m) => String(m.cart_mes_id) === cartMesId),
    [meses, cartMesId]
  );

  return (
    <div className="page">
      <h1>Importar Carteira</h1>
      <p className="page-subtitle">
        Carrega a planilha mensal de medição para a tabela de carteira. O cliente é identificado pelo CNPJ;
        quando o CNPJ não resolve, o sistema tenta pelo nome do database usando o histórico da carteira.
        Nada é gravado antes de você conferir o relatório.
      </p>

      {erro && <div className="banner-error">{erro}</div>}

      <div className="page" style={{ maxWidth: 900, padding: 0 }}>
        <div className="form-row">
          <label htmlFor="cart_mes_id">Mês de destino</label>
          <select
            id="cart_mes_id"
            value={cartMesId}
            onChange={(e) => {
              setCartMesId(e.target.value);
              setRelatorio(null);
              setConcluido(null);
            }}
            disabled={ocupado}
          >
            {meses.map((m) => (
              <option key={m.cart_mes_id} value={m.cart_mes_id}>
                {m.cart_ano_mes}
                {m.cart_vigencia_ativa === "S" ? " (vigência ativa)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="arquivo">Planilha de medição (.xlsx)</label>
          <input
            id="arquivo"
            type="file"
            accept=".xlsx"
            disabled={ocupado}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) lerPlanilha(f);
            }}
          />
          {linhas && (
            <p className="page-subtitle">
              {nomeArquivo}: {linhas.length} linhas lidas.
            </p>
          )}
        </div>

        <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
          <button className="primary" disabled={!linhas || !cartMesId || ocupado} onClick={simular}>
            {ocupado ? "Processando..." : "Analisar planilha"}
          </button>
        </div>
      </div>

      {concluido && (
        <div className="page" style={{ maxWidth: 900, padding: 0 }}>
          <h2>Importação concluída — {concluido.mes}</h2>
          <p className="page-subtitle">
            {concluido.inseridos} linhas gravadas
            {concluido.apagados ? `, ${concluido.apagados} linhas anteriores do mês substituídas` : ""}.
          </p>
        </div>
      )}

      {relatorio && (
        <div className="page" style={{ maxWidth: 900, padding: 0 }}>
          <h2>Conferência — {relatorio.mes}</h2>
          <p className="page-subtitle">
            {relatorio.linhasNaPlanilha} linhas na planilha · <strong>{relatorio.aInserir} serão gravadas</strong> ·{" "}
            {relatorio.ignorados.length} ficam de fora
            {relatorio.linhasExistentesNoMes > 0 && (
              <>
                {" "}
                · <strong>{relatorio.linhasExistentesNoMes} linhas já existentes neste mês serão apagadas</strong>
              </>
            )}
          </p>

          <table className="mini-table">
            <thead>
              <tr>
                <th>Como o cliente foi identificado</th>
                <th className="text-right">Linhas</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Pelo CNPJ</td>
                <td className="text-right">{relatorio.porCnpj}</td>
              </tr>
              <tr>
                <td>Pelo nome (CNPJ repetido em mais de um cliente)</td>
                <td className="text-right">{relatorio.porNome.length}</td>
              </tr>
              <tr>
                <td>Pelo nome do database (CNPJ sem cadastro)</td>
                <td className="text-right">{relatorio.porDatabase.length}</td>
              </tr>
            </tbody>
          </table>

          {relatorio.porNome.length > 0 && (
            <>
              <h3>CNPJ repetido — confira o cliente escolhido</h3>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Planilha</th>
                    <th>CNPJ</th>
                    <th>Cliente escolhido</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.porNome.map((r, i) => (
                    <tr key={i}>
                      <td>{r.nome}</td>
                      <td>{r.cnpj}</td>
                      <td>
                        #{r.clienteId} {r.clienteNome}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {relatorio.porDatabase.length > 0 && (
            <>
              <h3>Identificados pelo database — confira antes de confirmar</h3>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Planilha</th>
                    <th>Database</th>
                    <th>Cliente escolhido</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.porDatabase.map((r, i) => (
                    <tr key={i}>
                      <td>{r.nome}</td>
                      <td>{r.db}</td>
                      <td>
                        #{r.clienteId} {r.clienteNome}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {relatorio.ignorados.length > 0 && (
            <>
              <h3>Não serão importadas</h3>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>CNPJ</th>
                    <th>Database</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.ignorados.map((r, i) => (
                    <tr key={i}>
                      <td>{r.nome}</td>
                      <td>{r.cnpj}</td>
                      <td>{r.db}</td>
                      <td>{r.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            <button className="primary" disabled={ocupado || relatorio.aInserir === 0} onClick={confirmar}>
              {ocupado ? "Gravando..." : `Confirmar e gravar em ${mesSelecionado?.cart_ano_mes ?? ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
