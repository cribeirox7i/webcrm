import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cliente, ConsumoAna, FaturamentoDetalhe, PrecosCliente, PrecosClienteMesAtual, Produto } from "../api/types";
import { StatCards } from "./StatCards";
import { usePageTitle } from "../PageTitleContext";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { FaturamentoForm, valuesToPayload, type FaturamentoFormValues } from "./FaturamentoForm";
import { exportCsvProtheus, exportRelatorioConsumoPdf } from "../lib/export";
import { CsvIcon, EditIcon, PdfIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";
import { useAuth } from "../auth/AuthContext";

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Célula de grid sem o "R$" (símbolo no cabeçalho da coluna) -- esta é a tela mais larga do
// Financeiro (11 colunas), então cada px conta. formatMoney segue em uso nos StatCards/relatório.
function formatValor(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  // consumo_data pode vir com hora (ex. "2026-07-27 15:52:48", da importação de Consumo) --
  // corta pros 10 primeiros caracteres antes de separar, senão a hora vaza pro "dia" (achado
  // 2026-08-31: "27 15:52:48/07/2026").
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

interface FaturamentoMesPageProps {
  cartMesId: number;
  cartAnoMes: string;
  onBack: () => void;
}

export function FaturamentoMesPage({ cartMesId, cartAnoMes, onBack }: FaturamentoMesPageProps) {
  const { podeEditar } = usePermissao("financeiro");
  // mesma permissão que já condiciona o botão "Planilha" em Carteira/dashboard do cliente --
  // decisão do usuário. Botão fica visível, só desabilitado (padrão "bloqueado", não "some").
  const { permissoes } = useAuth();
  const permPlanilhaAnalitica = !!permissoes?.get("planilha_analitica")?.leitura;
  const [faturamentos, setFaturamentos] = useState<FaturamentoDetalhe[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [precosMesAtual, setPrecosMesAtual] = useState<PrecosClienteMesAtual[]>([]);
  // `precos_cliente_mes_atual` não expõe `pc_vlr_unit` (só as colunas calculadas) -- carregado à
  // parte (cru), só pra achar o valor unitário de cada linha no relatório PDF.
  const [precosCliente, setPrecosCliente] = useState<PrecosCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<FaturamentoDetalhe | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  function toggleSelected(id: string | number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id as number)) next.delete(id as number);
      else next.add(id as number);
      return next;
    });
  }

  function toggleSelectedAll(ids: (string | number)[]) {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id as number));
      return allSelected ? new Set() : new Set(ids as number[]);
    });
  }

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [faturamentosRes, clientesRes, produtosRes, precosMesAtualRes, precosClienteRes] = await Promise.all([
        api.list<FaturamentoDetalhe>("faturamento_detalhe", { cart_mes_id: cartMesId, limit: 20000 }),
        api.list<Cliente>("clientes", { limit: 20000 }),
        api.list<Produto>("produtos", { limit: 20000 }),
        api.list<PrecosClienteMesAtual>("precos_cliente_mes_atual", { cart_mes_id: cartMesId, limit: 20000 }),
        api.list<PrecosCliente>("precos_cliente", { cart_mes_id: cartMesId, limit: 20000 }),
      ]);
      setFaturamentos(faturamentosRes.data);
      setClientes(clientesRes.data);
      setProdutos(produtosRes.data);
      setPrecosMesAtual(precosMesAtualRes.data);
      setPrecosCliente(precosClienteRes.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartMesId]);

  const clienteNomeById = useMemo(() => {
    const map = new Map<number, string>();
    clientes.forEach((c) => map.set(c.cliente_id, c.cliente_nome));
    return map;
  }, [clientes]);

  const clienteById = useMemo(() => {
    const map = new Map<number, Cliente>();
    clientes.forEach((c) => map.set(c.cliente_id, c));
    return map;
  }, [clientes]);

  const produtoById = useMemo(() => {
    const map = new Map<number, Produto>();
    produtos.forEach((p) => map.set(p.produto_id, p));
    return map;
  }, [produtos]);

  const vlrUnitPorPcId = useMemo(() => {
    const map = new Map<number, number | null>();
    precosCliente.forEach((p) => map.set(p.pc_id, p.pc_vlr_unit));
    return map;
  }, [precosCliente]);

  /** "NOME" ou "NOME / DETALHE" quando o produto tem detalhe cadastrado (ex. "DIMENSA SIGN /
   * ENVIO DE SMS") -- usado no relatório PDF de faturamento. */
  function produtoComDetalhe(produtoId: number): string {
    const produto = produtoById.get(produtoId);
    if (!produto) return "";
    return [produto.produto_nome, produto.produto_detalhe].filter(Boolean).join(" / ");
  }

  function clienteNome(f: FaturamentoDetalhe): string {
    return clienteNomeById.get(f.cliente_id) ?? "";
  }

  function tipoValor(f: FaturamentoDetalhe): "BRUTO" | "LIQUIDO" {
    return clienteById.get(f.cliente_id)?.cliente_tip_vlr === "BRUTO" ? "BRUTO" : "LIQUIDO";
  }

  function valorAFaturar(f: FaturamentoDetalhe): number {
    return tipoValor(f) === "BRUTO" ? f.fat_vlr_brt : f.fat_vlr_liq;
  }

  async function handleSubmit(values: FaturamentoFormValues) {
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      const updated = await api.update<FaturamentoDetalhe>("faturamento", editing.fat_id, payload);
      setFaturamentos((prev) => prev.map((f) => (f.fat_id === updated.fat_id ? { ...f, ...updated } : f)));
      setEditing(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleExportarRelatorio(f: FaturamentoDetalhe) {
    const tipo = tipoValor(f);
    const linhasPc = precosMesAtual.filter((p) => p.cliente_id === f.cliente_id);
    const linhas = linhasPc
      .map((p) => {
        const produto = produtoById.get(p.produto_id);
        const liq = p.pc_mes_atu_vlr_final_liq ?? 0;
        const brt = p.pc_mes_atu_vlr_final_brt ?? 0;
        return {
          produto: produto?.produto_nome ?? "",
          detalhe: produto?.produto_detalhe ?? "",
          qtd: p.pc_mes_atu_qtd_consumo,
          valorUnit: vlrUnitPorPcId.get(p.pc_id) ?? null,
          valorAFaturar: tipo === "BRUTO" ? brt : liq,
        };
      })
      .filter((l) => l.valorAFaturar > 0);
    // NÃO soma `linhas` (cada uma é o valor líquido/bruto calculado por produto individual,
    // sem o pool de franquia por grupo) -- usa o total já agrupado por produto_grupo que
    // `faturamento_detalhe` calcula (mesmo valor mostrado no StatCard e no CSV Protheus),
    // achado 2026-09-01: o relatório mostrava um total diferente do valor realmente cobrado.
    const totalAFaturar = valorAFaturar(f);

    const analiticoRes = await api.list<ConsumoAna>("consumo_ana", {
      cliente_id: f.cliente_id,
      cart_mes_id: cartMesId,
      limit: 20000,
    });
    const analitico = analiticoRes.data.map((a) => ({
      produto: produtoComDetalhe(a.produto_id),
      data: formatDate(a.consumo_data),
      qtd: a.consumo_qtd ?? 0,
      detalhe: a.consumo_det ?? "",
    }));

    const cnpj = f.cliente_cnpj_fat ?? f.cliente_cnpj ?? "";
    await exportRelatorioConsumoPdf(
      `relatorio_consumo_${f.cliente_id}_${cartAnoMes.replace("/", "-")}`,
      { competencia: cartAnoMes, clienteNome: clienteNome(f), cnpj, tipo },
      linhas,
      totalAFaturar,
      analitico
    );
  }

  // COD_PROD e MENSAGEM são constantes fixas dessa integração (confirmadas com o usuário a
  // partir de 11 exportações reais anteriores, idênticas em todo cliente/valor) -- não vêm
  // de nenhum produto específico, já que cada linha do CSV representa o TOTAL a faturar do
  // cliente no mês (a própria linha da grid), não um item de venda avulso.
  const PROTHEUS_COD_PROD = "0623301141";
  const PROTHEUS_MENSAGEM = "LIBERACRED";

  function faturamentoParaLinhaProtheus(f: FaturamentoDetalhe) {
    return {
      cgc: (f.cliente_cnpj_fat ?? f.cliente_cnpj ?? "").replace(/\D/g, ""),
      codProd: PROTHEUS_COD_PROD,
      valorUnit: valorAFaturar(f),
      condPag: f.fat_cod_venc_protheus ?? "",
      mensagem: PROTHEUS_MENSAGEM,
    };
  }

  function handleCsvProtheus(f: FaturamentoDetalhe) {
    exportCsvProtheus(`csv_protheus_${f.cliente_id}_${cartAnoMes.replace("/", "-")}`, [faturamentoParaLinhaProtheus(f)]);
  }

  function handleCsvProtheusSelecionados() {
    const selecionados = faturamentos.filter((f) => selectedIds.has(f.fat_id));
    if (!selecionados.length) return;
    exportCsvProtheus(`csv_protheus_${cartAnoMes.replace("/", "-")}`, selecionados.map(faturamentoParaLinhaProtheus));
  }

  const totais = useMemo(
    () =>
      faturamentos.reduce(
        (acc, f) => ({
          liq: acc.liq + f.fat_vlr_liq,
          brt: acc.brt + f.fat_vlr_brt,
          aFaturar: acc.aFaturar + valorAFaturar(f),
        }),
        { liq: 0, brt: 0, aFaturar: 0 }
      ),
    [faturamentos, clienteById]
  );

  const columns: DataGridColumn<FaturamentoDetalhe>[] = useMemo(
    () => [
      { id: "cliente", header: "Cliente", value: clienteNome, width: 240 },
      { id: "cliente_cnpj", header: "CNPJ", value: (f) => f.cliente_cnpj, width: 150 },
      {
        id: "fat_dat_venc",
        header: "Vencimento NFE",
        value: (f) => f.fat_dat_venc,
        width: 130,
        align: "center",
        cell: (f) => formatDate(f.fat_dat_venc),
      },
      {
        id: "fat_vlr_liq",
        header: "Valor Líquido (R$)",
        value: (f) => f.fat_vlr_liq,
        width: 120,
        align: "right",
        cell: (f) => formatValor(f.fat_vlr_liq),
      },
      {
        id: "fat_vlr_brt",
        header: "Valor Bruto (R$)",
        value: (f) => f.fat_vlr_brt,
        width: 120,
        align: "right",
        cell: (f) => formatValor(f.fat_vlr_brt),
      },
      {
        id: "tipo",
        header: "Tipo",
        value: tipoValor,
        width: 90,
        cell: (f) => (
          <span className={`badge ${tipoValor(f) === "BRUTO" ? "badge-bruto" : "badge-liquido"}`}>
            {tipoValor(f) === "BRUTO" ? "Bruto" : "Líquido"}
          </span>
        ),
      },
      {
        id: "valor_a_faturar",
        header: "Valor a Faturar (R$)",
        value: valorAFaturar,
        width: 125,
        align: "right",
        cell: (f) => formatValor(valorAFaturar(f)),
      },
      { id: "fat_num_nfe", header: "Número NFE", value: (f) => f.fat_num_nfe, width: 130 },
      { id: "fat_num_rps", header: "Número RPS", value: (f) => f.fat_num_rps, width: 130 },
      { id: "fat_obs", header: "Observações", value: (f) => f.fat_obs, width: 200 },
    ],
    [clienteNomeById, clienteById]
  );

  usePageTitle(["Financeiro", "Faturamento", cartAnoMes]);

  return (
    <div className="page">
      <div className="dashboard-header">
        <button onClick={onBack}>&larr; Voltar</button>
      </div>

      <StatCards
        stats={[
          { label: "Clientes faturados", value: faturamentos.length, tone: "accent" },
          { label: "Valor líquido total", value: formatMoney(totais.liq), tone: "green" },
          { label: "Valor bruto total", value: formatMoney(totais.brt), tone: "gray" },
          { label: "Valor a faturar total", value: formatMoney(totais.aFaturar), tone: "accent" },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={faturamentos}
        columns={columns}
        getRowId={(f) => f.fat_id}
        searchValue={(f) => `${clienteNome(f)} ${f.cliente_cnpj ?? ""} ${f.cliente_cnpj_fat ?? ""}`}
        searchPlaceholder="Buscar por cliente ou CNPJ..."
        loading={loading}
        exportFilename={`faturamento_${cartAnoMes.replace("/", "-")}`}
        actionsWidth={130}
        selection={{ selectedIds, onToggle: toggleSelected, onToggleAll: toggleSelectedAll }}
        toolbarExtra={
          <button disabled={selectedIds.size === 0} onClick={handleCsvProtheusSelecionados} title="Gera um único CSV Protheus, uma linha por linha selecionada">
            CSV Protheus ({selectedIds.size} selecionadas)
          </button>
        }
        renderActions={(f) => (
          <div className="row-actions">
            {podeEditar && (
              <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing(f)}>
                <EditIcon />
              </button>
            )}
            <button
              className="icon-btn"
              title={permPlanilhaAnalitica ? "Relatório" : "Sem permissão pra gerar o relatório analítico"}
              aria-label="Relatório"
              disabled={!permPlanilhaAnalitica}
              onClick={() => handleExportarRelatorio(f)}
            >
              <PdfIcon />
            </button>
            <button className="icon-btn" title="CSV Protheus" aria-label="CSV Protheus" onClick={() => handleCsvProtheus(f)}>
              <CsvIcon />
            </button>
          </div>
        )}
      />

      {editing && (
        <FaturamentoForm
          faturamento={editing}
          clienteNome={clienteNome(editing)}
          cartAnoMes={cartAnoMes}
          saving={saving}
          error={formError}
          onCancel={() => {
            setEditing(null);
            setFormError(null);
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
