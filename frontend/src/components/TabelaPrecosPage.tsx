import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cliente, PrecosCliente, PrecosClienteMesAtual, Produto } from "../api/types";
import { PrecoClienteForm, valuesToPayload, type PrecoClienteFormValues } from "./PrecoClienteForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { usePageTitle } from "../PageTitleContext";
import { EditIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

// Célula de grid sem o "R$" (símbolo no cabeçalho da coluna), mesmo padrão das outras telas do
// Financeiro. Esta tela não tem StatCards de dinheiro, então não sobrou uso pro formato com
// símbolo -- o formatMoney que existia aqui foi removido junto.
function formatValor(v: number | null): string {
  return v != null ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

export type AlertaKey = "sem_valor" | "sem_indexador" | "cliente_inativo";

export const ALERTA_LABEL: Record<AlertaKey, string> = {
  sem_valor: "Consumo sem Preço",
  sem_indexador: "Clientes sem Indexador",
  cliente_inativo: "Clientes Inativos",
};

interface TabelaPrecosPageProps {
  cartMesId: number;
  cartAnoMes: string;
  alertaInicial?: AlertaKey;
  onBack: () => void;
}

export function TabelaPrecosPage({ cartMesId, cartAnoMes, alertaInicial, onBack }: TabelaPrecosPageProps) {
  const { podeEditar } = usePermissao("financeiro");
  const [precos, setPrecos] = useState<PrecosCliente[]>([]);
  const [precosMesAtual, setPrecosMesAtual] = useState<PrecosClienteMesAtual[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [alertaAtivo, setAlertaAtivo] = useState<AlertaKey | null>(alertaInicial ?? null);

  const [editing, setEditing] = useState<PrecosCliente | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [precosRes, precosMesAtualRes, clientesRes, produtosRes] = await Promise.all([
        api.list<PrecosCliente>("precos_cliente", { cart_mes_id: cartMesId, limit: 20000 }),
        api.list<PrecosClienteMesAtual>("precos_cliente_mes_atual", { cart_mes_id: cartMesId, limit: 20000 }),
        api.list<Cliente>("clientes", { limit: 20000 }),
        api.list<Produto>("produtos", { limit: 20000 }),
      ]);
      setPrecos(precosRes.data);
      setPrecosMesAtual(precosMesAtualRes.data);
      setClientes(clientesRes.data);
      setProdutos(produtosRes.data);
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

  function clienteNome(pc: PrecosCliente): string {
    return clienteNomeById.get(pc.cliente_id) ?? "";
  }
  function produtoNome(pc: PrecosCliente): string {
    return produtoById.get(pc.produto_id)?.produto_nome ?? "";
  }
  function produtoDetalhe(pc: PrecosCliente): string {
    return produtoById.get(pc.produto_id)?.produto_detalhe ?? "";
  }

  async function handleSubmit(values: PrecoClienteFormValues) {
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values, cartMesId);
      const updated = await api.update<PrecosCliente>("precos_cliente", editing.pc_id, payload);
      setPrecos((prev) => prev.map((p) => (p.pc_id === updated.pc_id ? updated : p)));
      setEditing(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns: DataGridColumn<PrecosCliente>[] = useMemo(
    () => [
      { id: "pc_id", header: "ID", value: (p) => p.pc_id, width: 60, minWidth: 50 },
      { id: "cliente", header: "Cliente", value: clienteNome, width: 260 },
      { id: "produto", header: "Produto", value: produtoNome, width: 160 },
      { id: "detalhe", header: "Detalhe", value: produtoDetalhe, width: 180 },
      {
        id: "pc_vlr_franquia",
        header: "Franquia (R$)",
        value: (p) => p.pc_vlr_franquia,
        width: 105,
        align: "right",
        cell: (p) => formatValor(p.pc_vlr_franquia),
      },
      {
        id: "pc_vlr_unit",
        header: "Valor unitário (R$)",
        value: (p) => p.pc_vlr_unit,
        width: 115,
        align: "right",
        cell: (p) => formatValor(p.pc_vlr_unit),
      },
      {
        id: "cliente_tip_vlr",
        header: "Regime",
        value: (p) => clienteById.get(p.cliente_id)?.cliente_tip_vlr ?? "",
        width: 90,
      },
    ],
    [clienteNomeById, clienteById, produtoById]
  );

  const filters: DataGridFilter<PrecosCliente>[] = useMemo(
    () => [{ id: "produto", label: "Produto", value: produtoNome }],
    [produtoById]
  );

  const idsSemValor = useMemo(
    () => new Set(precosMesAtual.filter((p) => p.pc_alerta_preco === "S").map((p) => p.pc_id)),
    [precosMesAtual]
  );

  const idsSemIndexador = useMemo(
    () => new Set(precos.filter((p) => !p.pc_dat_niver || !p.pc_cod_index).map((p) => p.pc_id)),
    [precos]
  );

  const clientesInativosComConsumo = useMemo(() => {
    const comConsumo = new Set(
      precosMesAtual.filter((p) => (p.pc_mes_atu_qtd_consumo ?? 0) > 0).map((p) => p.cliente_id)
    );
    return new Set(clientes.filter((c) => c.cliente_status !== "ATIVO" && comConsumo.has(c.cliente_id)).map((c) => c.cliente_id));
  }, [precosMesAtual, clientes]);

  const idsClienteInativo = useMemo(
    () => new Set(precos.filter((p) => clientesInativosComConsumo.has(p.cliente_id)).map((p) => p.pc_id)),
    [precos, clientesInativosComConsumo]
  );

  const alertaSets = useMemo<Record<AlertaKey, Set<number>>>(
    () => ({ sem_valor: idsSemValor, sem_indexador: idsSemIndexador, cliente_inativo: idsClienteInativo }),
    [idsSemValor, idsSemIndexador, idsClienteInativo]
  );

  const dadosExibidos = useMemo(() => {
    if (!alertaAtivo) return precos;
    const ids = alertaSets[alertaAtivo];
    return precos.filter((p) => ids.has(p.pc_id));
  }, [precos, alertaAtivo, alertaSets]);

  usePageTitle(["Financeiro", "Tabela de Preços", cartAnoMes]);

  return (
    <div className="page">
      <div className="dashboard-header">
        <button onClick={onBack}>&larr; Voltar</button>
      </div>

      <StatCards stats={[{ label: "Total de preços", value: precos.length, tone: "accent" }]} />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      {alertaAtivo && (
        <div className="banner-error">
          Mostrando {dadosExibidos.length} item(ns) do alerta "{ALERTA_LABEL[alertaAtivo]}"
          <button onClick={() => setAlertaAtivo(null)}>Limpar filtro</button>
        </div>
      )}

      <DataGrid
        data={dadosExibidos}
        columns={columns}
        getRowId={(p) => p.pc_id}
        searchValue={(p) => `${clienteNome(p)} ${produtoNome(p)} ${produtoDetalhe(p)}`}
        searchPlaceholder="Buscar por cliente, produto, detalhe..."
        filters={filters}
        loading={loading}
        exportFilename={`tabela_precos_${cartAnoMes.replace("/", "-")}`}
        renderActions={
          podeEditar
            ? (p) => (
                <div className="row-actions">
                  <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing(p)}>
                    <EditIcon />
                  </button>
                </div>
              )
            : undefined
        }
        actionsWidth={60}
        toolbarExtra={
          <>
            {(["cliente_inativo", "sem_indexador", "sem_valor"] as const).map((key) => (
              <button
                key={key}
                className={`alert-btn ${alertaSets[key].size === 0 ? "zero" : ""} ${alertaAtivo === key ? "active" : ""}`}
                onClick={() => setAlertaAtivo((prev) => (prev === key ? null : key))}
                disabled={alertaSets[key].size === 0}
              >
                ⚠ {ALERTA_LABEL[key]} ({alertaSets[key].size})
              </button>
            ))}
          </>
        }
      />

      {editing && (
        <PrecoClienteForm
          pc={editing}
          cartAnoMes={cartAnoMes}
          clientes={clientes}
          produtos={produtos}
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
