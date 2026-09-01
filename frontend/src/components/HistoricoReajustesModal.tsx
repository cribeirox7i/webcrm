import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { CartMesResumo, ReajusteEventoDetalhe } from "../api/types";
import { ExpandedGridModal } from "./ExpandedGridModal";
import type { DataGridColumn, DataGridFilter } from "./DataGrid";

/** "2026-02-05" -> "2026/02" -- mesmo formato de cart_ano_mes, pra casar o evento com a
 * competência do cart_mes clicado (reajuste_eventos não tem cart_mes_id, só a data do evento). */
function competenciaDoEvento(reajData: string): string {
  return reajData.slice(0, 7).replace("-", "/");
}

function formatPct(v: number): string {
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

interface HistoricoReajustesModalProps {
  onClose: () => void;
  /** Competência (cart_ano_mes) do mês cujo botão inline abriu o modal -- filtro de "Mês" (ao
   * lado da busca, mesmo padrão de toda tela com DataGrid) já nasce nela. Omitir/`null` abre
   * sem filtro (todos os meses). */
  cartAnoMesInicial?: string | null;
}

/** Lista os eventos de reajuste já aplicados (Admin > Reajuste) -- botão "Histórico de
 * Reajustes" na lista de meses (Financeiro). Busca a própria lista ao abrir (view
 * reajuste_eventos_detalhe, mesma que a tela de Admin usa), não recebe dado pronto do card como
 * o ExpandedGridModal usual. */
export function HistoricoReajustesModal({ onClose, cartAnoMesInicial }: HistoricoReajustesModalProps) {
  const [eventos, setEventos] = useState<ReajusteEventoDetalhe[]>([]);
  const [competencias, setCompetencias] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [data, meses] = await Promise.all([
          api.listAll<ReajusteEventoDetalhe>("reajuste_eventos_detalhe"),
          api.list<CartMesResumo>("cart_mes_resumo", { limit: 1000 }),
        ]);
        if (cancelado) return;
        setEventos(data);
        setCompetencias([...new Set(meses.data.map((m) => m.cart_ano_mes))].sort((a, b) => b.localeCompare(a)));
      } catch (err) {
        if (!cancelado) setErro((err as Error).message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // Lista fixa de opções (via `options`, não derivada de `data`): todo mês cadastrado em
  // cart_mes precisa poder ser escolhido no filtro, mesmo o que ainda não tem nenhum reajuste
  // (ex.: o botão inline foi clicado num mês novo) -- pedido explícito do usuário.
  const filters: DataGridFilter<ReajusteEventoDetalhe>[] = useMemo(
    () => [{ id: "mes", label: "Mês", value: (h) => competenciaDoEvento(h.reaj_data), options: competencias }],
    [competencias]
  );

  const columns: DataGridColumn<ReajusteEventoDetalhe>[] = useMemo(
    () => [
      { id: "reaj_data", header: "Data", value: (h) => h.reaj_data, width: 100, cell: (h) => formatDataBr(h.reaj_data) },
      { id: "cliente_nome", header: "Cliente", value: (h) => h.cliente_nome, width: 200 },
      { id: "cliente_cnpj", header: "CNPJ", value: (h) => h.cliente_cnpj ?? "", width: 130 },
      { id: "produto_nome", header: "Produto", value: (h) => h.produto_nome, width: 160 },
      { id: "produto_detalhe", header: "Detalhe", value: (h) => h.produto_detalhe ?? "", width: 160 },
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

  if (erro) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <p className="form-error">Falha ao carregar histórico: {erro}</p>
          <button onClick={onClose}>Fechar</button>
        </div>
      </div>
    );
  }

  return (
    <ExpandedGridModal
      title="Histórico de Reajustes"
      onClose={onClose}
      data={eventos}
      columns={columns}
      getRowId={(h) => h.reaj_id}
      searchValue={(h) => `${h.cliente_nome} ${h.cliente_cnpj ?? ""} ${h.produto_nome} ${h.reaj_index_nome}`}
      searchPlaceholder="Buscar por cliente, CNPJ, produto ou indexador..."
      filters={filters}
      defaultFilterValues={{ mes: cartAnoMesInicial ?? "" }}
      exportFilename="historico-reajustes"
      loading={loading}
      emptyMessage="Nenhum reajuste aplicado ainda."
    />
  );
}
