import { useState } from "react";
import ExcelJS from "exceljs";
import { adminApi, type LinhaMedicao, type RelatorioImportacao } from "../api/adminClient";
import type { CartMes } from "../api/types";

interface ImportarCarteiraModalProps {
  cartMes: CartMes;
  token: string;
  onClose: () => void;
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

export function ImportarCarteiraModal({ cartMes, token, onClose, onLogout }: ImportarCarteiraModalProps) {
  const [linhas, setLinhas] = useState<LinhaMedicao[] | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null);
  const [concluido, setConcluido] = useState<RelatorioImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function tratarErroAuth(err: unknown): boolean {
    if ((err as Error).message === "não autenticado") {
      onLogout();
      return true;
    }
    return false;
  }

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

      const indicePorChave = new Map<keyof LinhaMedicao, number>();
      ws.getRow(1).eachCell((cell, col) => {
        const norm = normalizaCabecalho(valorCru(cell.value));
        const achou = COLUNAS.find((c) => c.cabecalhos.includes(norm));
        if (achou && !indicePorChave.has(achou.chave)) indicePorChave.set(achou.chave, col);
      });

      const faltando = COLUNAS.filter((c) => !indicePorChave.has(c.chave)).map((c) => c.cabecalhos[0]);
      if (faltando.length) throw new Error(`colunas não encontradas: ${faltando.join(", ")}`);

      const lidas: LinhaMedicao[] = [];
      ws.eachRow((row, num) => {
        if (num === 1) return;
        const obj = {} as Record<string, unknown>;
        indicePorChave.forEach((col, chave) => {
          obj[chave] = valorCru(row.getCell(col).value);
        });
        if (obj.nome != null || obj.cnpj != null) lidas.push(obj as unknown as LinhaMedicao);
      });

      if (!lidas.length) throw new Error("nenhuma linha de dados encontrada");
      setLinhas(lidas);
    } catch (err) {
      setErro(`Falha ao ler a planilha: ${(err as Error).message}`);
    }
  }

  async function analisar() {
    if (!linhas) return;
    setOcupado(true);
    setErro(null);
    try {
      setRelatorio(await adminApi.importarCarteira(token, cartMes.cart_mes_id, linhas, true));
    } catch (err) {
      if (!tratarErroAuth(err)) setErro((err as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!linhas || !relatorio) return;
    const aviso =
      relatorio.linhasExistentesNoMes > 0
        ? `Isto vai APAGAR as ${relatorio.linhasExistentesNoMes} linhas de carteira já existentes em ${relatorio.mes} e gravar ${relatorio.aInserir} no lugar. Confirmar?`
        : `Gravar ${relatorio.aInserir} linhas de carteira em ${relatorio.mes}?`;
    if (!confirm(aviso)) return;

    setOcupado(true);
    setErro(null);
    try {
      const rel = await adminApi.importarCarteira(token, cartMes.cart_mes_id, linhas, false);
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

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 880, maxWidth: "100%" }}>
        <h2>Importar carteira — {cartMes.cart_ano_mes}</h2>
        <p className="page-subtitle">
          O cliente é identificado pelo CNPJ; quando o CNPJ não resolve, o sistema tenta pelo nome do
          database usando o histórico da carteira. Nada é gravado antes de você conferir.
        </p>

        {erro && <div className="banner-error">{erro}</div>}

        {!concluido && (
          <div className="form-row">
            <label htmlFor="arquivo_medicao">Planilha de medição (.xlsx)</label>
            <input
              id="arquivo_medicao"
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
        )}

        {concluido && (
          <p className="page-subtitle">
            <strong>Importação concluída.</strong> {concluido.inseridos} linhas gravadas em {concluido.mes}
            {concluido.apagados ? `, ${concluido.apagados} linhas anteriores substituídas` : ""}.
          </p>
        )}

        {relatorio && (
          <>
            <p className="page-subtitle">
              {relatorio.linhasNaPlanilha} linhas na planilha · <strong>{relatorio.aInserir} serão gravadas</strong> ·{" "}
              {relatorio.ignorados.length} ficam de fora
              {relatorio.linhasExistentesNoMes > 0 && (
                <>
                  {" "}
                  · <strong>{relatorio.linhasExistentesNoMes} linhas já existentes serão apagadas</strong>
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
          </>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={ocupado}>
            {concluido ? "Fechar" : "Cancelar"}
          </button>
          {!concluido && !relatorio && (
            <button type="button" className="primary" disabled={!linhas || ocupado} onClick={analisar}>
              {ocupado ? "Analisando..." : "Analisar planilha"}
            </button>
          )}
          {!concluido && relatorio && (
            <button
              type="button"
              className="primary"
              disabled={ocupado || relatorio.aInserir === 0}
              onClick={confirmar}
            >
              {ocupado ? "Gravando..." : `Confirmar e gravar em ${cartMes.cart_ano_mes}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
