import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Carteira, Cliente } from "../api/types";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { usePageTitle } from "../PageTitleContext";
import { ExternalLinkIcon } from "./icons";

function formatMoney(v: number | null): string {
  return v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
}

// Célula de grid sem o "R$" (o símbolo vai no cabeçalho da coluna) -- economiza ~19px por
// coluna de dinheiro, e esta tela tem 4 delas. formatMoney continua em uso nos StatCards.
function formatValor(v: number | null): string {
  return v != null ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

function formatInt(v: number | null): string {
  return v != null ? v.toLocaleString("pt-BR") : "";
}

interface CarteiraMesPageProps {
  cartMesId: number;
  cartAnoMes: string;
  onBack: () => void;
}

export function CarteiraMesPage({ cartMesId, cartAnoMes, onBack }: CarteiraMesPageProps) {
  const [carteira, setCarteira] = useState<Carteira[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [carteiraRes, clientesRes] = await Promise.all([
        api.list<Carteira>("carteira", { cart_mes_id: cartMesId, limit: 20000 }),
        api.list<Cliente>("clientes", { limit: 20000 }),
      ]);
      setCarteira(carteiraRes.data);
      setClientes(clientesRes.data);
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

  function clienteNome(c: Carteira): string {
    return clienteNomeById.get(c.cliente_id) ?? "";
  }

  const totais = useMemo(() => {
    return carteira.reduce(
      (acc, c) => ({
        valor: acc.valor + (c.cart_vlr ?? 0),
        pdd: acc.pdd + (c.cart_pdd ?? 0),
        semPdd: acc.semPdd + (c.cart_sem_pdd ?? 0),
        operacoes: acc.operacoes + (c.cart_qtd ?? 0),
      }),
      { valor: 0, pdd: 0, semPdd: 0, operacoes: 0 }
    );
  }, [carteira]);

  const columns: DataGridColumn<Carteira>[] = useMemo(
    () => [
      { id: "cliente", header: "Cliente", value: clienteNome, width: 260 },
      {
        id: "cart_vlr",
        header: "Valor da carteira (R$)",
        value: (c) => c.cart_vlr,
        width: 130,
        align: "right",
        cell: (c) => formatValor(c.cart_vlr),
      },
      { id: "cart_qtd", header: "Operações", value: (c) => c.cart_qtd, width: 100 },
      {
        id: "cart_pdd",
        header: "Carteira em PDD (R$)",
        value: (c) => c.cart_pdd,
        width: 130,
        align: "right",
        cell: (c) => formatValor(c.cart_pdd),
      },
      {
        id: "cart_sem_pdd",
        header: "Carteira sem PDD (R$)",
        value: (c) => c.cart_sem_pdd,
        width: 130,
        align: "right",
        cell: (c) => formatValor(c.cart_sem_pdd),
      },
      {
        id: "cart_qtd_mes",
        header: "Operações no mês",
        value: (c) => c.cart_qtd_mes,
        width: 140,
        align: "right",
        cell: (c) => formatInt(c.cart_qtd_mes),
      },
      {
        id: "cart_emprestimos_mes",
        header: "Concessões no mês (R$)",
        value: (c) => c.cart_emprestimos_mes,
        width: 130,
        align: "right",
        cell: (c) => formatValor(c.cart_emprestimos_mes),
      },
      { id: "cart_prod", header: "Produto", value: (c) => c.cart_prod, width: 120 },
      { id: "cart_ult_def", header: "Último deferimento", value: (c) => c.cart_ult_def, width: 140, align: "center" },
      { id: "cart_data_base", header: "Data base", value: (c) => c.cart_data_base, width: 110, align: "center" },
      {
        id: "cart_dat_extracao",
        header: "Data da extração",
        value: (c) => c.cart_dat_extracao,
        width: 150,
        align: "center",
      },
    ],
    [clienteNomeById]
  );

  usePageTitle(["Financeiro", "Carteira", cartAnoMes]);

  return (
    <div className="page">
      <div className="dashboard-header">
        <button onClick={onBack}>&larr; Voltar</button>
      </div>

      <StatCards
        stats={[
          { label: "Valor total da carteira", value: formatMoney(totais.valor), tone: "accent" },
          { label: "Carteira em PDD", value: formatMoney(totais.pdd), tone: "red" },
          { label: "Carteira sem PDD", value: formatMoney(totais.semPdd), tone: "green" },
          { label: "Operações", value: totais.operacoes, tone: "gray" },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={carteira}
        columns={columns}
        getRowId={(c) => c.cart_id}
        searchValue={(c) => clienteNome(c)}
        searchPlaceholder="Buscar por cliente..."
        loading={loading}
        exportFilename={`carteira_${cartAnoMes.replace("/", "-")}`}
        actionsWidth={60}
        renderActions={(c) => (
          <div className="row-actions">
            <button
              className="icon-btn"
              title="Planilha"
              aria-label="Planilha"
              disabled={!c.cart_url_plan_analitica}
              onClick={() => window.open(c.cart_url_plan_analitica ?? "", "_blank", "noopener,noreferrer")}
            >
              <ExternalLinkIcon />
            </button>
          </div>
        )}
      />
    </div>
  );
}
