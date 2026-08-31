import { useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { adminApi, type LinhaConsumo, type RelatorioImportacaoConsumo } from "../api/adminClient";
import type { CartMes } from "../api/types";
import { SearchableSelect } from "../components/SearchableSelect";

interface ImportarConsumoModalProps {
  cartMes: CartMes;
  token: string;
  onClose: () => void;
  onLogout: () => void;
}

/** Cabeçalhos esperados nos arquivos de consumo (xlsx OU csv, todos no mesmo layout) -> campo de
 * `LinhaConsumo`. Comparação com o texto normalizado (sem acento/pontuação/espaço, maiúsculo),
 * mesmo padrão de ImportarCarteiraModal. "DURACAO" é o mesmo conceito de "QUANTIDADE" (layout de
 * VOIP -- ver `duracaoParaMinutos`), só que precisa de conversão antes de virar `consumo_qtd`. */
const COLUNAS: { chave: keyof LinhaConsumo; cabecalhos: string[] }[] = [
  { chave: "idProduto", cabecalhos: ["IDPRODUTO"] },
  { chave: "cnpj", cabecalhos: ["CNPJ"] },
  { chave: "data", cabecalhos: ["DATA"] },
  { chave: "quantidade", cabecalhos: ["QUANTIDADE", "DURACAO"] },
  { chave: "detalhamento", cabecalhos: ["DETALHAMENTO"] },
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

/** Converte a "Duração" (layout VOIP, mesmo papel de "quantidade" nos outros layouts) pra
 * minutos -- mesma lógica da fórmula que o usuário já usava no Google Sheets
 * (`=(VALOR(ESQUERDA(...))*86400 + VALOR(DIREITA(...;8))*86400)/60`): o texto vem como
 * "<dias> <HH:MM:SS>" (o Sheets formata duração assim, às vezes com a palavra "day"/"days" no
 * meio -- confirmado com um exemplo real, "0 days 00:04:05"). Pegar sempre os ÚLTIMOS 8
 * caracteres pro tempo funciona independente disso, porque "HH:MM:SS" tem largura fixa e fica
 * sempre no fim, não importa quantos dígitos tem a contagem de dias nem se tem a palavra "day(s)"
 * no meio. Se o valor já chegar como número (célula de xlsx com formato de duração nativo,
 * fração de dia -- mesma coisa que o `VALOR()` do Sheets devolvia) só multiplica por 1440
 * (minutos num dia) em vez de passar pelo texto. */
function duracaoParaMinutos(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v * 1440;
  const s = String(v ?? "").trim();
  if (!s) return null;
  const tempoTxt = s.slice(-8);
  const m = tempoTxt.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const idxEspaco = s.indexOf(" ");
  const dias = Number(idxEspaco === -1 ? "0" : s.slice(0, idxEspaco));
  if (!Number.isFinite(dias)) return null;
  const [, hh, mm, ss] = m;
  const totalSegundos = dias * 86400 + Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
  return totalSegundos / 60;
}

/** Parser de CSV simples (delimitador `;` ou `,`, autodetectado pela linha de cabeçalho; aspas
 * duplas suportadas pro caso raro de o texto de Detalhamento conter o delimitador). Não é RFC4180
 * completo, mas cobre o layout real desses arquivos (sem quebra de linha dentro de um campo). */
function splitCsvLine(linha: string, delim: string): string[] {
  const out: string[] = [];
  let atual = "";
  let emAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (emAspas) {
      if (ch === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          emAspas = false;
        }
      } else {
        atual += ch;
      }
    } else if (ch === '"') {
      emAspas = true;
    } else if (ch === delim) {
      out.push(atual);
      atual = "";
    } else {
      atual += ch;
    }
  }
  out.push(atual);
  return out.map((s) => s.trim());
}

function parseCsv(textoBruto: string): LinhaConsumo[] {
  // `File.text()` já decodifica UTF-8 removendo o BOM (testado contra um CSV real exportado do
  // PEP), mas tirar de novo aqui não custa nada e blinda contra qualquer navegador/gerador de
  // arquivo que deixe passar -- sem isso o BOM vira lixo colado no primeiro cabeçalho e a coluna
  // "some" (achado ao testar o parser fora do navegador com decode diferente).
  const texto = textoBruto.startsWith("\uFEFF") ? textoBruto.slice(1) : textoBruto;
  const linhasTexto = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!linhasTexto.length) return [];
  const header = linhasTexto[0];
  const nPontoVirgula = (header.match(/;/g) ?? []).length;
  const nVirgula = (header.match(/,/g) ?? []).length;
  const delim = nPontoVirgula >= nVirgula ? ";" : ",";

  const cabecalhos = splitCsvLine(header, delim).map(normalizaCabecalho);
  const indicePorChave = new Map<keyof LinhaConsumo, number>();
  COLUNAS.forEach((c) => {
    const idx = cabecalhos.findIndex((h) => c.cabecalhos.includes(h));
    if (idx >= 0) indicePorChave.set(c.chave, idx);
  });
  const faltando = COLUNAS.filter((c) => !indicePorChave.has(c.chave)).map((c) => c.cabecalhos[0]);
  if (faltando.length) throw new Error(`colunas não encontradas: ${faltando.join(", ")}`);

  // layout VOIP: a coluna "quantidade" veio do cabeçalho "Duração" -- valor precisa de conversão
  // pra minutos antes de virar consumo_qtd (ver duracaoParaMinutos).
  const idxQuantidade = indicePorChave.get("quantidade");
  const ehDuracao = idxQuantidade != null && cabecalhos[idxQuantidade] === "DURACAO";

  const out: LinhaConsumo[] = [];
  for (let i = 1; i < linhasTexto.length; i++) {
    const campos = splitCsvLine(linhasTexto[i], delim);
    const obj = {} as Record<string, unknown>;
    indicePorChave.forEach((idx, chave) => {
      obj[chave] = campos[idx];
    });
    if (ehDuracao) obj.quantidade = duracaoParaMinutos(obj.quantidade);
    if (obj.cnpj != null || obj.idProduto != null) out.push(obj as unknown as LinhaConsumo);
  }
  return out;
}

async function parseXlsx(file: File): Promise<LinhaConsumo[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("planilha sem abas");

  const indicePorChave = new Map<keyof LinhaConsumo, number>();
  // layout VOIP: a coluna "quantidade" veio do cabeçalho "Duração" -- valor precisa de conversão
  // pra minutos antes de virar consumo_qtd (ver duracaoParaMinutos).
  let ehDuracao = false;
  ws.getRow(1).eachCell((cell, col) => {
    const norm = normalizaCabecalho(valorCru(cell.value));
    const achou = COLUNAS.find((c) => c.cabecalhos.includes(norm));
    if (achou && !indicePorChave.has(achou.chave)) {
      indicePorChave.set(achou.chave, col);
      if (achou.chave === "quantidade" && norm === "DURACAO") ehDuracao = true;
    }
  });
  const faltando = COLUNAS.filter((c) => !indicePorChave.has(c.chave)).map((c) => c.cabecalhos[0]);
  if (faltando.length) throw new Error(`colunas não encontradas: ${faltando.join(", ")}`);

  const out: LinhaConsumo[] = [];
  ws.eachRow((row, num) => {
    if (num === 1) return;
    const obj = {} as Record<string, unknown>;
    indicePorChave.forEach((col, chave) => {
      obj[chave] = valorCru(row.getCell(col).value);
    });
    if (ehDuracao) obj.quantidade = duracaoParaMinutos(obj.quantidade);
    if (obj.cnpj != null || obj.idProduto != null) out.push(obj as unknown as LinhaConsumo);
  });
  return out;
}

export function ImportarConsumoModal({ cartMes, token, onClose, onLogout }: ImportarConsumoModalProps) {
  const [linhas, setLinhas] = useState<LinhaConsumo[] | null>(null);
  // { nome do arquivo -> linhas lidas dele } -- só pra mostrar o resumo por arquivo na tela.
  const [arquivosLidos, setArquivosLidos] = useState<{ nome: string; linhas: number }[]>([]);
  const [relatorio, setRelatorio] = useState<RelatorioImportacaoConsumo | null>(null);
  const [concluido, setConcluido] = useState<RelatorioImportacaoConsumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // { CNPJ normalizado -> cliente_id } / { ID_Produto original -> produto_id }, escolhidos à mão
  // -- agrupado, não por linha (ver comentário no backend).
  const [correcoesCnpj, setCorrecoesCnpj] = useState<Record<string, number>>({});
  const [correcoesProduto, setCorrecoesProduto] = useState<Record<string, number>>({});
  // true depois que `linhas` já foi todo enviado pra tabela de preparo no banco (upload em
  // lotes) -- enquanto isso não acontece, "Analisar" precisa subir os arquivos antes de poder
  // classificar. Reseta pra false sempre que um arquivo novo é lido.
  const [enviado, setEnviado] = useState(false);
  const [progressoEnvio, setProgressoEnvio] = useState<{ enviadas: number; total: number } | null>(null);

  const opcoesCliente = useMemo(
    () =>
      (relatorio?.clientes ?? [])
        .map((c) => ({ value: String(c.cliente_id), label: `#${c.cliente_id} ${c.cliente_nome}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [relatorio?.clientes]
  );
  const opcoesProduto = useMemo(
    () =>
      (relatorio?.produtos ?? [])
        .map((p) => ({ value: String(p.produto_id), label: `#${p.produto_id} ${p.produto_nome}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [relatorio?.produtos]
  );

  function tratarErroAuth(err: unknown): boolean {
    if ((err as Error).message === "não autenticado") {
      onLogout();
      return true;
    }
    return false;
  }

  async function lerArquivos(files: FileList) {
    setErro(null);
    setRelatorio(null);
    setConcluido(null);
    setCorrecoesCnpj({});
    setCorrecoesProduto({});
    setEnviado(false);

    const lista = Array.from(files);
    const resumo: { nome: string; linhas: number }[] = [];
    const todasLinhas: LinhaConsumo[] = [];
    try {
      for (const file of lista) {
        const ehCsv = /\.csv$/i.test(file.name);
        const lidas = ehCsv ? parseCsv(await file.text()) : await parseXlsx(file);
        if (!lidas.length) throw new Error(`${file.name}: nenhuma linha de dados encontrada`);
        resumo.push({ nome: file.name, linhas: lidas.length });
        todasLinhas.push(...lidas);
      }
      setArquivosLidos(resumo);
      setLinhas(todasLinhas);
    } catch (err) {
      setErro(`Falha ao ler os arquivos: ${(err as Error).message}`);
      setArquivosLidos([]);
      setLinhas(null);
    }
  }

  // Arquivos reais desse fluxo passam de 60 mil linhas -- mandar tudo isso num POST só estoura o
  // limite de tamanho de requisição da Vercel antes de chegar no backend (o navegador mostra
  // isso como erro de CORS, não como erro de tamanho -- achado 2026-08-31). Por isso o upload
  // vai em lotes pequenos pra uma tabela de preparo no banco; só depois disso a análise/gravação
  // (que já lê do banco, sem limite de tamanho de requisição) pode rodar.
  const TAMANHO_LOTE = 2000;

  async function enviarEmLotes(dados: LinhaConsumo[]) {
    await adminApi.limparStagingConsumo(token, cartMes.cart_mes_id);
    setProgressoEnvio({ enviadas: 0, total: dados.length });
    for (let i = 0; i < dados.length; i += TAMANHO_LOTE) {
      const lote = dados.slice(i, i + TAMANHO_LOTE);
      await adminApi.enviarChunkConsumo(token, cartMes.cart_mes_id, lote);
      setProgressoEnvio({ enviadas: Math.min(i + lote.length, dados.length), total: dados.length });
    }
    setEnviado(true);
    setProgressoEnvio(null);
  }

  async function analisar() {
    if (!linhas) return;
    setOcupado(true);
    setErro(null);
    try {
      if (!enviado) await enviarEmLotes(linhas);
      setRelatorio(await adminApi.importarConsumo(token, cartMes.cart_mes_id, true, correcoesCnpj, correcoesProduto));
    } catch (err) {
      if (!tratarErroAuth(err)) setErro((err as Error).message);
    } finally {
      setOcupado(false);
      setProgressoEnvio(null);
    }
  }

  /** Chamado quando o usuário escolhe um cliente pra um CNPJ pendente -- guarda e já reanalisa,
   * pra ver o efeito (a linha some de "CNPJ não identificado" na hora). As linhas já estão na
   * tabela de preparo desde o "Analisar" inicial, não precisa subir de novo. */
  async function corrigirCnpj(cnpj: string, clienteId: number) {
    const novas = { ...correcoesCnpj, [cnpj]: clienteId };
    setCorrecoesCnpj(novas);
    setOcupado(true);
    setErro(null);
    try {
      setRelatorio(await adminApi.importarConsumo(token, cartMes.cart_mes_id, true, novas, correcoesProduto));
    } catch (err) {
      if (!tratarErroAuth(err)) setErro((err as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function corrigirProduto(idProduto: string, produtoId: number) {
    const novas = { ...correcoesProduto, [idProduto]: produtoId };
    setCorrecoesProduto(novas);
    setOcupado(true);
    setErro(null);
    try {
      setRelatorio(await adminApi.importarConsumo(token, cartMes.cart_mes_id, true, correcoesCnpj, novas));
    } catch (err) {
      if (!tratarErroAuth(err)) setErro((err as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!relatorio) return;
    const existentes =
      relatorio.consumoExistenteNoMes > 0 || relatorio.precosExistentesNoMes > 0 || relatorio.faturamentoExistenteNoMes > 0;
    const aviso = existentes
      ? `Isto vai APAGAR o que já existe em ${relatorio.mes} (${relatorio.consumoExistenteNoMes} linhas de consumo, ` +
        `${relatorio.precosExistentesNoMes} de preços, ${relatorio.faturamentoExistenteNoMes} de faturamento) e gravar de novo. Confirmar?`
      : `Gravar ${relatorio.aInserir} linhas de consumo, ${relatorio.precosOrigem?.linhas ?? 0} de preços duplicadas` +
        ` e ${relatorio.clientesDistintos} linhas de faturamento em ${relatorio.mes}?`;
    if (!confirm(aviso)) return;

    setOcupado(true);
    setErro(null);
    try {
      // a tabela de preparo já tem as linhas (subidas no "Analisar") -- o backend lê de lá e
      // limpa ela mesmo, sozinho, depois de gravar com sucesso.
      const rel = await adminApi.importarConsumo(token, cartMes.cart_mes_id, false, correcoesCnpj, correcoesProduto);
      setConcluido(rel);
      setRelatorio(null);
      setLinhas(null);
      setArquivosLidos([]);
      setCorrecoesCnpj({});
      setCorrecoesProduto({});
      setEnviado(false);
    } catch (err) {
      if (!tratarErroAuth(err)) setErro((err as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal-fixo" style={{ width: 880, maxWidth: "100%" }}>
        <h2>Importar consumo — {cartMes.cart_ano_mes}</h2>

        <div className="modal-corpo">
          <p className="page-subtitle">
            O produto é identificado pelo ID_Produto (a chave já é o <code>produto_id</code>) e o cliente pelo CNPJ.
            Além de gravar o consumo, esta carga duplica a tabela de preços do mês mais recente pra{" "}
            {cartMes.cart_ano_mes} e cria uma linha de faturamento por cliente. Nada é gravado antes de você conferir.
          </p>

          {erro && <div className="banner-error">{erro}</div>}

          {!concluido && (
            <div className="form-row">
              <label htmlFor="arquivos_consumo">Arquivos de consumo (.xlsx ou .csv, pode selecionar vários)</label>
              <input
                id="arquivos_consumo"
                type="file"
                accept=".xlsx,.csv"
                multiple
                disabled={ocupado}
                onChange={(e) => {
                  if (e.target.files?.length) lerArquivos(e.target.files);
                }}
              />
              {arquivosLidos.length > 0 && (
                <ul className="page-subtitle" style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {arquivosLidos.map((a) => (
                    <li key={a.nome}>
                      {a.nome}: {a.linhas} linhas
                    </li>
                  ))}
                  <li>
                    <strong>Total: {linhas?.length ?? 0} linhas</strong>
                  </li>
                </ul>
              )}
              {progressoEnvio && (
                <p className="page-subtitle">
                  Enviando pro servidor: {progressoEnvio.enviadas} / {progressoEnvio.total} linhas...
                </p>
              )}
            </div>
          )}

          {concluido && (
            <p className="page-subtitle">
              <strong>Importação concluída.</strong> {concluido.consumoInseridos} linhas de consumo gravadas em{" "}
              {concluido.mes}
              {concluido.consumoApagados ? ` (${concluido.consumoApagados} anteriores substituídas)` : ""} ·{" "}
              {concluido.precosDuplicados} linhas de preços duplicadas
              {concluido.precosApagados ? ` (${concluido.precosApagados} anteriores substituídas)` : ""} ·{" "}
              {concluido.faturamentoInseridos} linhas de faturamento criadas
              {concluido.faturamentoApagados ? ` (${concluido.faturamentoApagados} anteriores substituídas)` : ""}.
            </p>
          )}

          {relatorio && (
            <>
              <p className="page-subtitle">
                {relatorio.linhasNaPlanilha} linhas lidas · <strong>{relatorio.aInserir} serão gravadas</strong> em
                consumo ({relatorio.clientesDistintos} clientes distintos)
                {ocupado && " · atualizando..."}
              </p>

              <p className="page-subtitle">
                {relatorio.precosOrigem ? (
                  <>
                    Tabela de preços: <strong>{relatorio.precosOrigem.linhas} linhas</strong> serão duplicadas do mês{" "}
                    <strong>{relatorio.precosOrigem.anoMes}</strong> pra {relatorio.mes}.
                  </>
                ) : (
                  <>Nenhum outro mês tem preço cadastrado ainda — a tabela de preços ficará vazia pra {relatorio.mes}.</>
                )}
                {(relatorio.consumoExistenteNoMes > 0 ||
                  relatorio.precosExistentesNoMes > 0 ||
                  relatorio.faturamentoExistenteNoMes > 0) && (
                  <>
                    {" "}
                    <strong>
                      Já existe {relatorio.consumoExistenteNoMes} linhas de consumo, {relatorio.precosExistentesNoMes}{" "}
                      de preços e {relatorio.faturamentoExistenteNoMes} de faturamento em {relatorio.mes} — serão
                      substituídas.
                    </strong>
                  </>
                )}
              </p>

              {relatorio.cnpjsPendentes.length > 0 && (
                <>
                  <h3>CNPJ não identificado</h3>
                  <p className="page-subtitle">
                    Linhas com esses CNPJs ficam de fora até você escolher o cliente correspondente (vale pra todas as
                    linhas daquele CNPJ, não só uma).
                  </p>
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th>CNPJ</th>
                        <th className="text-right">Linhas</th>
                        <th>Cliente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.cnpjsPendentes.map((r) => (
                        <tr key={r.cnpj}>
                          <td>{r.cnpj}</td>
                          <td className="text-right">{r.linhas}</td>
                          <td>
                            <SearchableSelect
                              options={
                                r.candidatos.length > 0
                                  ? r.candidatos.map((c) => ({ value: String(c.cliente_id), label: `#${c.cliente_id} ${c.cliente_nome}` }))
                                  : opcoesCliente
                              }
                              value={String(correcoesCnpj[r.cnpj] ?? "")}
                              onChange={(v) => v && corrigirCnpj(r.cnpj, Number(v))}
                              allowEmpty={false}
                              placeholder="Buscar cliente..."
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {relatorio.produtosPendentes.length > 0 && (
                <>
                  <h3>Produto não identificado</h3>
                  <p className="page-subtitle">
                    ID_Produto que não bate com nenhum produto cadastrado. Linhas ficam de fora até você escolher o
                    produto correspondente (vale pra todas as linhas daquele ID_Produto).
                  </p>
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th>ID_Produto</th>
                        <th className="text-right">Linhas</th>
                        <th>Produto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.produtosPendentes.map((r) => (
                        <tr key={r.idProduto}>
                          <td>{r.idProduto}</td>
                          <td className="text-right">{r.linhas}</td>
                          <td>
                            <SearchableSelect
                              options={opcoesProduto}
                              value={String(correcoesProduto[r.idProduto] ?? "")}
                              onChange={(v) => v && corrigirProduto(r.idProduto, Number(v))}
                              allowEmpty={false}
                              placeholder="Buscar produto..."
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={ocupado}>
            {concluido ? "Fechar" : "Cancelar"}
          </button>
          {!concluido && !relatorio && (
            <button type="button" className="primary" disabled={!linhas || ocupado} onClick={analisar}>
              {progressoEnvio ? "Enviando..." : ocupado ? "Analisando..." : "Analisar arquivos"}
            </button>
          )}
          {!concluido && relatorio && (
            <button type="button" className="primary" disabled={ocupado} onClick={confirmar}>
              {ocupado ? "Gravando..." : `Confirmar e gravar em ${cartMes.cart_ano_mes}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
