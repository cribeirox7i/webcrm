import { useEffect, useMemo, useState } from "react";
import { adminApi, type CandidatoReajuste } from "../api/adminClient";
import type { ReajusteEventoDetalhe } from "../api/types";
import { DataGrid, type DataGridColumn, type DataGridFilter, type DataGridSelection } from "../components/DataGrid";

interface ReajusteAdminPageProps {
  token: string;
  onLogout: () => void;
}

const STATUS_LABEL: Record<CandidatoReajuste["status"], string> = {
  aplicavel: "Aplicável",
  sem_indexador: "Sem indexador cadastrado",
  sem_indice_mes_corrente: "Índice do mês de apuração ainda não sincronizado",
  acumulado_negativo: "Acumulado 12m negativo (não reajusta)",
  ja_aplicado: "Já reajustado este mês",
};

function formatPct(v: number | null): string {
  if (v == null) return "";
  return (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}
function formatMoney(v: number | null): string {
  return v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
}
function formatDataBr(iso: string | null): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

export function ReajusteAdminPage({ token, onLogout }: ReajusteAdminPageProps) {
  const [candidatos, setCandidatos] = useState<CandidatoReajuste[] | null>(null);
  // Guardado a partir da resposta de /simular -- /aplicar precisa mandar de volta exatamente o
  // anoRef/mesRef usado na simulação (não recalcula "vigente" de novo na hora de aplicar, pra
  // não divergir se o mês vigente mudar entre simular e confirmar).
  const [refUsada, setRefUsada] = useState<{ anoRef: number; mesRef: number; cartAnoMes: string; origem: "atual" | "vigente" } | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [simulando, setSimulando] = useState<"atual" | "vigente" | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<{ aplicados: number; ignorados: { pc_id: number; motivo: string }[] } | null>(null);

  const [historico, setHistorico] = useState<ReajusteEventoDetalhe[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);

  function handleAuthError(err: unknown): boolean {
    if ((err as Error).message === "não autenticado") {
      onLogout();
      return true;
    }
    return false;
  }

  async function loadHistorico() {
    setLoadingHistorico(true);
    try {
      const res = await adminApi.list<ReajusteEventoDetalhe>("reajuste_eventos_detalhe", token, { limit: 20000 });
      setHistorico(res.data);
    } catch (err) {
      if (!handleAuthError(err)) setErro((err as Error).message);
    } finally {
      setLoadingHistorico(false);
    }
  }

  useEffect(() => {
    loadHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSimular(origem: "atual" | "vigente") {
    setSimulando(origem);
    setErro(null);
    setResumo(null);
    try {
      const r = await adminApi.simularReajuste(token, origem);
      setCandidatos(r.candidatos);
      setRefUsada({ anoRef: r.anoRef, mesRef: r.mesRef, cartAnoMes: r.cartAnoMes, origem });
      setSelectedIds(new Set(r.candidatos.filter((c) => c.status === "aplicavel").map((c) => c.pc_id)));
    } catch (err) {
      if (!handleAuthError(err)) setErro((err as Error).message);
    } finally {
      setSimulando(null);
    }
  }

  async function handleAplicar() {
    if (selectedIds.size === 0 || !refUsada) return;
    setAplicando(true);
    setErro(null);
    try {
      const r = await adminApi.aplicarReajuste(token, [...selectedIds] as number[], refUsada.anoRef, refUsada.mesRef);
      setResumo({ aplicados: r.aplicados, ignorados: r.ignorados });
      await Promise.all([handleSimular(refUsada.origem), loadHistorico()]);
    } catch (err) {
      if (!handleAuthError(err)) setErro((err as Error).message);
    } finally {
      setAplicando(false);
    }
  }

  const selection: DataGridSelection = {
    selectedIds,
    onToggle: (id) =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    onToggleAll: (ids) =>
      setSelectedIds((prev) => (ids.every((id) => prev.has(id)) ? new Set() : new Set(ids))),
  };

  const candidatoColumns: DataGridColumn<CandidatoReajuste>[] = useMemo(
    () => [
      { id: "cliente_nome", header: "Cliente", value: (c) => c.cliente_nome, width: 200 },
      { id: "cliente_cnpj", header: "CNPJ", value: (c) => c.cliente_cnpj ?? "", width: 130 },
      { id: "produto_nome", header: "Produto", value: (c) => c.produto_nome, width: 160 },
      { id: "produto_detalhe", header: "Detalhe", value: (c) => c.produto_detalhe ?? "", width: 160 },
      {
        id: "pc_dat_niver",
        header: "Aniversário",
        value: (c) => c.pc_dat_niver ?? "",
        width: 110,
        cell: (c) => formatDataBr(c.pc_dat_niver),
      },
      { id: "pc_cod_index", header: "Indexador", value: (c) => c.pc_cod_index ?? "", width: 110 },
      {
        id: "index_acum_12m",
        header: "Acumulado 12m",
        value: (c) => c.index_acum_12m,
        width: 120,
        align: "right",
        cell: (c) => formatPct(c.index_acum_12m),
      },
      {
        id: "vlr_unit",
        header: "Vlr unit. (atual → novo)",
        value: (c) => c.vlr_unit_novo ?? c.vlr_unit_atual,
        width: 190,
        align: "right",
        cell: (c) => `${formatMoney(c.vlr_unit_atual)} → ${formatMoney(c.vlr_unit_novo)}`,
      },
      {
        id: "vlr_franquia",
        header: "Franquia (atual → novo)",
        value: (c) => c.vlr_franquia_novo ?? c.vlr_franquia_atual,
        width: 190,
        align: "right",
        cell: (c) => `${formatMoney(c.vlr_franquia_atual)} → ${formatMoney(c.vlr_franquia_novo)}`,
      },
      { id: "status", header: "Status", value: (c) => STATUS_LABEL[c.status], width: 240 },
    ],
    []
  );

  const candidatoFilters: DataGridFilter<CandidatoReajuste>[] = useMemo(
    () => [{ id: "status", label: "Status", value: (c) => STATUS_LABEL[c.status] }],
    []
  );

  const historicoColumns: DataGridColumn<ReajusteEventoDetalhe>[] = useMemo(
    () => [
      { id: "reaj_data", header: "Data", value: (h) => h.reaj_data, width: 100, cell: (h) => formatDataBr(h.reaj_data) },
      { id: "cliente_nome", header: "Cliente", value: (h) => h.cliente_nome, width: 200 },
      { id: "produto_nome", header: "Produto", value: (h) => h.produto_nome, width: 160 },
      {
        id: "pc_dat_niver",
        header: "Data Contrato",
        value: (h) => h.pc_dat_niver ?? "",
        width: 120,
        cell: (h) => formatDataBr(h.pc_dat_niver),
      },
      { id: "reaj_index_nome", header: "Indexador", value: (h) => h.reaj_index_nome, width: 110 },
      {
        id: "reaj_taxa_acum_12m",
        header: "Acumulado 12m",
        value: (h) => h.reaj_taxa_acum_12m,
        width: 120,
        align: "right",
        cell: (h) => formatPct(h.reaj_taxa_acum_12m),
      },
      {
        id: "vlr_unit",
        header: "Vlr unit. (antes → depois)",
        value: (h) => h.reaj_vlr_unit_novo ?? h.reaj_vlr_unit_ant,
        width: 150,
        align: "right",
        cell: (h) => `${formatMoney(h.reaj_vlr_unit_ant)} → ${formatMoney(h.reaj_vlr_unit_novo)}`,
      },
      {
        id: "vlr_franquia",
        header: "Franquia (antes → depois)",
        value: (h) => h.reaj_vlr_franquia_novo ?? h.reaj_vlr_franquia_ant,
        width: 150,
        align: "right",
        cell: (h) => `${formatMoney(h.reaj_vlr_franquia_ant)} → ${formatMoney(h.reaj_vlr_franquia_novo)}`,
      },
    ],
    []
  );

  return (
    <div className="page">
      <h1>Reajuste de Preço de Consumo</h1>
      <p className="page-subtitle">
        Reajusta o valor unitário e a franquia dos contratos (Tabela de Preços) com aniversário no mês
        da competência vigente (`cart_mes.cart_vigencia_ativa`) -- o mês de Carteira/Consumo que acabou
        de ser importado, não o mês do calendário -- e que já tenham pelo menos 1 ano de vida no
        contrato, aplicando o acumulado de 12 meses do indexador de cada contrato: novo valor = valor
        atual × (1 + acumulado 12m). Simule antes de aplicar -- nada é gravado até confirmar.
      </p>
      <p className="page-subtitle">
        <strong>Acumulado 12m apurado no mês anterior à competência</strong>: reajuste de Agosto usa o
        acumulado fechado em Julho (12 meses terminando em Julho, de Agosto do ano anterior a Julho do
        ano corrente) -- não o de Agosto, cujo índice (IPCA/INPC) o Banco Central ainda não publicou
        no momento em que a competência de Agosto normalmente é reajustada.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <button className="primary" onClick={() => handleSimular("vigente")} disabled={simulando !== null}>
          {simulando === "vigente" ? "Simulando..." : "Simular reajuste da competência vigente"}
        </button>
        {candidatos && (
          <button onClick={handleAplicar} disabled={aplicando || selectedIds.size === 0}>
            {aplicando ? "Aplicando..." : `Aplicar selecionados (${selectedIds.size})`}
          </button>
        )}
        {refUsada && <span className="page-subtitle">Competência usada: {refUsada.cartAnoMes}</span>}
      </div>

      {erro && <p className="form-error">{erro}</p>}

      {resumo && (
        <div className="banner-error" style={{ background: "var(--accent-bg, #eef7ee)", marginBottom: 16 }}>
          {resumo.aplicados} contrato(s) reajustado(s).
          {resumo.ignorados.length > 0 && (
            <ul>
              {resumo.ignorados.map((i) => (
                <li key={i.pc_id}>
                  pc_id {i.pc_id}: {i.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {candidatos && (
        <>
          <p className="page-subtitle">{candidatos.length} contrato(s) com aniversário no mês corrente</p>
          <DataGrid
            data={candidatos}
            columns={candidatoColumns}
            getRowId={(c) => c.pc_id}
            searchValue={(c) => `${c.cliente_nome} ${c.cliente_cnpj ?? ""} ${c.produto_nome}`}
            searchPlaceholder="Buscar por cliente, CNPJ ou produto..."
            filters={candidatoFilters}
            selection={selection}
            exportFilename="reajuste-simulacao"
          />
        </>
      )}

      <h2 style={{ marginTop: 32 }}>Histórico de reajustes</h2>
      <DataGrid
        data={historico}
        columns={historicoColumns}
        getRowId={(h) => h.reaj_id}
        searchValue={(h) => `${h.cliente_nome} ${h.produto_nome} ${h.reaj_index_nome}`}
        searchPlaceholder="Buscar por cliente, produto ou indexador..."
        loading={loadingHistorico}
        exportFilename="reajuste-historico"
      />
    </div>
  );
}
