import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { ConsumoAna } from "../api/types";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { usePageTitle } from "../PageTitleContext";

interface ConsumoAnaDetalhePageProps {
  clienteId: number;
  clienteNome: string;
  produtoId: number;
  produtoNome: string;
  cartMesId: number;
  cartAnoMes: string;
  onBack: () => void;
}

export function ConsumoAnaDetalhePage({
  clienteId,
  clienteNome,
  produtoId,
  produtoNome,
  cartMesId,
  cartAnoMes,
  onBack,
}: ConsumoAnaDetalhePageProps) {
  const [registros, setRegistros] = useState<ConsumoAna[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.list<ConsumoAna>("consumo_ana", {
        cliente_id: clienteId,
        produto_id: produtoId,
        cart_mes_id: cartMesId,
        limit: 20000,
      });
      setRegistros(res.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, produtoId, cartMesId]);

  const totalQtd = useMemo(() => registros.reduce((acc, r) => acc + (r.consumo_qtd ?? 0), 0), [registros]);

  const columns: DataGridColumn<ConsumoAna>[] = useMemo(
    () => [
      { id: "consumo_id", header: "ID", value: (r) => r.consumo_id, width: 70, minWidth: 60 },
      { id: "consumo_data", header: "Data", value: (r) => r.consumo_data, width: 120, align: "center" },
      { id: "consumo_qtd", header: "Quantidade", value: (r) => r.consumo_qtd, width: 110 },
      { id: "consumo_det", header: "Detalhe", value: (r) => r.consumo_det ?? "", width: 240 },
      { id: "consumo_consit", header: "Consistência", value: (r) => r.consumo_consit ?? "", width: 160 },
    ],
    []
  );

  usePageTitle(["Financeiro", "Consumo", cartAnoMes, "Analítico"]);

  return (
    <div className="page">
      <div className="dashboard-header">
        <button onClick={onBack}>&larr; Voltar</button>
        <div className="dashboard-subtitle">
          <span>{clienteNome}</span>
          <span>{produtoNome}</span>
        </div>
      </div>

      <StatCards
        stats={[
          { label: "Registros", value: registros.length, tone: "accent" },
          { label: "Quantidade total", value: totalQtd, tone: "green" },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={registros}
        columns={columns}
        getRowId={(r) => r.consumo_id}
        searchValue={(r) => `${r.consumo_data} ${r.consumo_det ?? ""}`}
        searchPlaceholder="Buscar por data ou detalhe..."
        loading={loading}
        exportFilename={`consumo_ana_${clienteId}_${produtoId}_${cartAnoMes.replace("/", "-")}`}
      />
    </div>
  );
}
