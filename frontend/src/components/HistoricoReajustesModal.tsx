import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { ReajusteEventoDetalhe } from "../api/types";
import { ExpandedGridModal } from "./ExpandedGridModal";
import type { DataGridColumn } from "./DataGrid";

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
}

/** Lista todos os eventos de reajuste já aplicados (Admin > Reajuste) -- botão "Histórico de
 * Reajustes" na tela de Consumo. Busca a própria lista ao abrir (view reajuste_eventos_detalhe,
 * mesma que a tela de Admin usa), não recebe dado pronto do card como o ExpandedGridModal usual. */
export function HistoricoReajustesModal({ onClose }: HistoricoReajustesModalProps) {
  const [eventos, setEventos] = useState<ReajusteEventoDetalhe[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const data = await api.listAll<ReajusteEventoDetalhe>("reajuste_eventos_detalhe");
        if (!cancelado) setEventos(data);
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

  const columns: DataGridColumn<ReajusteEventoDetalhe>[] = useMemo(
    () => [
      { id: "reaj_data", header: "Data", value: (h) => h.reaj_data, width: 100, cell: (h) => formatDataBr(h.reaj_data) },
      { id: "cliente_nome", header: "Cliente", value: (h) => h.cliente_nome, width: 200 },
      { id: "cliente_cnpj", header: "CNPJ", value: (h) => h.cliente_cnpj ?? "", width: 130 },
      { id: "produto_nome", header: "Produto", value: (h) => h.produto_nome, width: 160 },
      { id: "produto_detalhe", header: "Detalhe", value: (h) => h.produto_detalhe ?? "", width: 160 },
      {
        id: "pc_dat_niver",
        header: "Aniversário do Contrato",
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
      exportFilename="historico-reajustes"
      loading={loading}
      emptyMessage="Nenhum reajuste aplicado ainda."
    />
  );
}
