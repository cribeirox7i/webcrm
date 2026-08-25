import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { CartMesResumo } from "../api/types";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { TabelaPrecosPage, type AlertaKey } from "./TabelaPrecosPage";
import { CarteiraMesPage } from "./CarteiraMesPage";
import { ConsumoMesPage } from "./ConsumoMesPage";
import { FaturamentoMesPage } from "./FaturamentoMesPage";
import { ChartIcon, InvoiceIcon, TagIcon, WalletIcon } from "./icons";

type Drill =
  | { mode: "precos" | "carteira" | "consumo" | "faturamento"; cartMesId: number; cartAnoMes: string; alerta?: AlertaKey }
  | null;

// Sem o "R$" na célula: o símbolo vai no cabeçalho da coluna ("Total de carteira (R$)"), o que
// economiza ~19px por coluna de dinheiro (medido no navegador: "R$ 22.910.039.233,15" ocupa
// 125px contra 106px sem o prefixo) sem perder informação nenhuma. Nos StatCards o "R$"
// continua, porque lá é número de destaque e sobra espaço.
function formatValor(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FinanceiroPage() {
  const [meses, setMeses] = useState<CartMesResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drill, setDrill] = useState<Drill>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.list<CartMesResumo>("cart_mes_resumo", { limit: 1000 });
      setMeses(res.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const mesesOrdenados = useMemo(
    () => [...meses].sort((a, b) => b.cart_ano_mes.localeCompare(a.cart_ano_mes)),
    [meses]
  );

  const columns: DataGridColumn<CartMesResumo>[] = useMemo(
    () => [
      { id: "cart_ano_mes", header: "Ano / Mês", value: (m) => m.cart_ano_mes, width: 120 },
      {
        id: "cart_vigencia_ativa",
        header: "Vigência ativa",
        value: (m) => m.cart_vigencia_ativa,
        width: 130,
        cell: (m) => (m.cart_vigencia_ativa ? <span className="badge">{m.cart_vigencia_ativa}</span> : ""),
      },
      {
        id: "total_carteira",
        header: "Total de carteira (R$)",
        value: (m) => m.total_carteira,
        width: 140,
        align: "right",
        cell: (m) => formatValor(m.total_carteira),
      },
      {
        id: "total_consumo",
        header: "Total de consumo (R$)",
        value: (m) => m.total_consumo,
        width: 140,
        align: "right",
        cell: (m) => formatValor(m.total_consumo),
      },
    ],
    []
  );

  if (drill) {
    if (drill.mode === "precos")
      return (
        <TabelaPrecosPage
          cartMesId={drill.cartMesId}
          cartAnoMes={drill.cartAnoMes}
          alertaInicial={drill.alerta}
          onBack={() => setDrill(null)}
        />
      );
    if (drill.mode === "carteira")
      return (
        <CarteiraMesPage cartMesId={drill.cartMesId} cartAnoMes={drill.cartAnoMes} onBack={() => setDrill(null)} />
      );
    if (drill.mode === "faturamento")
      return (
        <FaturamentoMesPage cartMesId={drill.cartMesId} cartAnoMes={drill.cartAnoMes} onBack={() => setDrill(null)} />
      );
    return (
      <ConsumoMesPage
        cartMesId={drill.cartMesId}
        cartAnoMes={drill.cartAnoMes}
        onBack={() => setDrill(null)}
        onAbrirAlertaPrecos={(alerta) =>
          setDrill({ mode: "precos", cartMesId: drill.cartMesId, cartAnoMes: drill.cartAnoMes, alerta })
        }
      />
    );
  }

  return (
    <div className="page">
      <StatCards stats={[{ label: "Meses cadastrados", value: meses.length, tone: "accent" }]} />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={mesesOrdenados}
        columns={columns}
        getRowId={(m) => m.cart_mes_id}
        searchValue={(m) => m.cart_ano_mes}
        searchPlaceholder="Buscar por ano/mês..."
        loading={loading}
        exportFilename="financeiro"
        // 350, não 280: a célula de ações desta tela mede 346px reais (2 grupos rotulados
        // CARTEIRA/CONSUMO + 5 botões de ícone, medido no navegador em px lógicos). Com 280
        // declarados, o navegador não conseguia encolher a célula abaixo do conteúdo e a tabela
        // renderizava ~66px além do que o DataGrid tinha calculado -- causa real da rolagem
        // lateral nesta tela, e não a largura das colunas de valor (que aqui até sobra espaço:
        // elas estavam sendo ESTICADAS pelo DataGrid).
        actionsWidth={350}
        renderActions={(m) => (
          <div className="row-actions-columns">
            <span className="row-actions-group">
              <span className="row-actions-group-label">Carteira</span>
              <button className="icon-btn" title="Tabela de preços desabilitada por enquanto" aria-label="Preços" disabled>
                <TagIcon />
              </button>
              <button
                className="icon-btn"
                title="Carteira"
                aria-label="Carteira"
                onClick={() => setDrill({ mode: "carteira", cartMesId: m.cart_mes_id, cartAnoMes: m.cart_ano_mes })}
              >
                <WalletIcon />
              </button>
            </span>
            <span className="row-actions-group">
              <span className="row-actions-group-label">Consumo</span>
              <button
                className="icon-btn"
                title="Preços"
                aria-label="Preços"
                onClick={() => setDrill({ mode: "precos", cartMesId: m.cart_mes_id, cartAnoMes: m.cart_ano_mes })}
              >
                <TagIcon />
              </button>
              <button
                className="icon-btn"
                title="Consumo"
                aria-label="Consumo"
                onClick={() => setDrill({ mode: "consumo", cartMesId: m.cart_mes_id, cartAnoMes: m.cart_ano_mes })}
              >
                <ChartIcon />
              </button>
              <button
                className="icon-btn"
                title="Faturamento"
                aria-label="Faturamento"
                onClick={() => setDrill({ mode: "faturamento", cartMesId: m.cart_mes_id, cartAnoMes: m.cart_ano_mes })}
              >
                <InvoiceIcon />
              </button>
            </span>
          </div>
        )}
      />
    </div>
  );
}
