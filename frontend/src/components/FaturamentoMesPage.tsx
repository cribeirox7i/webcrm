import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cliente, ConsumoAna, FaturamentoDetalhe, PrecosClienteMesAtual, Produto } from "../api/types";
import { StatCards } from "./StatCards";
import { usePageTitle } from "../PageTitleContext";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { FaturamentoForm, valuesToPayload, type FaturamentoFormValues } from "./FaturamentoForm";
import { exportCsvProtheus, exportRelatorioConsumoPdf } from "../lib/export";
import { CsvIcon, EditIcon, PdfIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

interface FaturamentoMesPageProps {
  cartMesId: number;
  cartAnoMes: string;
  onBack: () => void;
}

export function FaturamentoMesPage({ cartMesId, cartAnoMes, onBack }: FaturamentoMesPageProps) {
  const { podeEditar } = usePermissao("financeiro");
  const [faturamentos, setFaturamentos] = useState<FaturamentoDetalhe[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [precosMesAtual, setPrecosMesAtual] = useState<PrecosClienteMesAtual[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<FaturamentoDetalhe | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [faturamentosRes, clientesRes, produtosRes, precosMesAtualRes] = await Promise.all([
        api.list<FaturamentoDetalhe>("faturamento_detalhe", { cart_mes_id: cartMesId, limit: 20000 }),
        api.list<Cliente>("clientes", { limit: 20000 }),
        api.list<Produto>("produtos", { limit: 20000 }),
        api.list<PrecosClienteMesAtual>("precos_cliente_mes_atual", { cart_mes_id: cartMesId, limit: 20000 }),
      ]);
      setFaturamentos(faturamentosRes.data);
      setClientes(clientesRes.data);
      setProdutos(produtosRes.data);
      setPrecosMesAtual(precosMesAtualRes.data);
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
          valorAFaturar: tipo === "BRUTO" ? brt : liq,
        };
      })
      .filter((l) => l.valorAFaturar > 0);
    const totalAFaturar = linhas.reduce((acc, l) => acc + l.valorAFaturar, 0);

    const analiticoRes = await api.list<ConsumoAna>("consumo_ana", {
      cliente_id: f.cliente_id,
      cart_mes_id: cartMesId,
      limit: 20000,
    });
    const analitico = analiticoRes.data.map((a) => ({
      produto: produtoById.get(a.produto_id)?.produto_nome ?? "",
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

  function handleCsvProtheus(f: FaturamentoDetalhe) {
    const cgc = (f.cliente_cnpj_fat ?? f.cliente_cnpj ?? "").replace(/\D/g, "");
    const linhas = precosMesAtual
      .filter((p) => p.cliente_id === f.cliente_id)
      .map((p) => {
        const produto = produtoById.get(p.produto_id);
        return {
          cgc,
          codProd: produto?.produto_sku ?? "",
          valorUnit: p.pc_mes_atu_vlr_final_liq ?? 0,
          condPag: f.fat_cod_venc_protheus ?? "",
          mensagem: produto?.produto_nome ?? "",
        };
      });
    exportCsvProtheus(`csv_protheus_${f.cliente_id}_${cartAnoMes.replace("/", "-")}`, linhas);
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
      { id: "cliente_cnpj_fat", header: "CNPJ Faturamento", value: (f) => f.cliente_cnpj_fat, width: 150 },
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
        header: "Valor Líquido",
        value: (f) => f.fat_vlr_liq,
        width: 130,
        align: "right",
        cell: (f) => formatMoney(f.fat_vlr_liq),
      },
      {
        id: "fat_vlr_brt",
        header: "Valor Bruto",
        value: (f) => f.fat_vlr_brt,
        width: 130,
        align: "right",
        cell: (f) => formatMoney(f.fat_vlr_brt),
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
        header: "Valor a Faturar",
        value: valorAFaturar,
        width: 150,
        align: "right",
        cell: (f) => formatMoney(valorAFaturar(f)),
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
        actionsWidth={140}
        renderActions={(f) => (
          <div className="row-actions">
            {podeEditar && (
              <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing(f)}>
                <EditIcon />
              </button>
            )}
            <button className="icon-btn" title="Relatório" aria-label="Relatório" onClick={() => handleExportarRelatorio(f)}>
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
