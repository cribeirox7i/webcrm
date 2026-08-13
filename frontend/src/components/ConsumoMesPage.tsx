import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cliente, PrecosCliente, PrecosClienteMesAtual, Produto } from "../api/types";
import { StatCards } from "./StatCards";
import { usePageTitle } from "../PageTitleContext";
import { ConsumoAnaDetalhePage } from "./ConsumoAnaDetalhePage";
import { ALERTA_LABEL, type AlertaKey } from "./TabelaPrecosPage";
import { exportToCsv, exportToPdf, exportToXlsx, shareExport, type ExportCell } from "../lib/export";
import { CsvIcon, PdfIcon, ShareIcon, XlsIcon } from "./icons";

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface ConsumoGrupo {
  key: string;
  clienteNome: string;
  clienteCnpj: string;
  produtoNome: string;
  franquia: number;
  consumo: number;
  total: number;
  excedente: number;
  linhas: { pc: PrecosClienteMesAtual; produto: Produto | undefined }[];
}

interface ConsumoMesPageProps {
  cartMesId: number;
  cartAnoMes: string;
  onBack: () => void;
  onAbrirAlertaPrecos: (alerta: AlertaKey) => void;
}

export function ConsumoMesPage({ cartMesId, cartAnoMes, onBack, onAbrirAlertaPrecos }: ConsumoMesPageProps) {
  const [precos, setPrecos] = useState<PrecosClienteMesAtual[]>([]);
  const [precosCliente, setPrecosCliente] = useState<PrecosCliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [skuFiltro, setSkuFiltro] = useState("");
  const [detalhe, setDetalhe] = useState<{ clienteId: number; clienteNome: string; produtoId: number; produtoNome: string } | null>(
    null
  );

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [precos, precosCliente, clientesRes, produtosRes] = await Promise.all([
        api.listAll<PrecosClienteMesAtual>("precos_cliente_mes_atual", { cart_mes_id: cartMesId }),
        api.listAll<PrecosCliente>("precos_cliente", { cart_mes_id: cartMesId }),
        api.list<Cliente>("clientes", { limit: 20000 }),
        api.list<Produto>("produtos", { limit: 20000 }),
      ]);
      setPrecos(precos);
      setPrecosCliente(precosCliente);
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

  const grupos = useMemo<ConsumoGrupo[]>(() => {
    const map = new Map<string, ConsumoGrupo>();
    for (const pc of precos) {
      const produto = produtoById.get(pc.produto_id);
      const cliente = clienteById.get(pc.cliente_id);
      const grupoKey = produto?.produto_grupo != null ? `g${produto.produto_grupo}` : `p${pc.produto_id}`;
      const key = `${pc.cliente_id}::${grupoKey}`;

      let grupo = map.get(key);
      if (!grupo) {
        grupo = {
          key,
          clienteNome: cliente?.cliente_nome ?? "",
          clienteCnpj: cliente?.cliente_cnpj ?? "",
          produtoNome: produto?.produto_nome ?? "",
          franquia: 0,
          consumo: 0,
          total: 0,
          excedente: 0,
          linhas: [],
        };
        map.set(key, grupo);
      }
      grupo.franquia += pc.pc_mes_atu_vlr_franquia ?? 0;
      grupo.consumo += pc.pc_mes_atu_vlr_exced ?? 0;
      grupo.linhas.push({ pc, produto });
    }

    const list = [...map.values()];
    for (const g of list) {
      g.total = Math.max(g.franquia, g.consumo);
      g.excedente = Math.max(0, g.consumo - g.franquia);
    }
    // mantém grupos zerados na lista se tiverem alguma linha com transação mas sem valor
    // parametrizado -- esses casos precisam aparecer no resultado orgânico (destacados em
    // vermelho), não só via alerta, senão o usuário nunca vê o problema.
    const visiveis = list.filter((g) => g.total > 0 || g.linhas.some(({ pc }) => pc.pc_alerta_preco === "S"));
    visiveis.sort((a, b) => a.clienteNome.localeCompare(b.clienteNome) || a.produtoNome.localeCompare(b.produtoNome));
    return visiveis;
  }, [precos, produtoById, clienteById]);

  const skuOptions = useMemo(() => {
    const set = new Set<string>();
    grupos.forEach((g) => g.linhas.forEach(({ produto }) => produto?.produto_sku && set.add(produto.produto_sku)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [grupos]);

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const porTexto = !term
      ? grupos
      : grupos.filter(
          (g) =>
            g.clienteNome.toLowerCase().includes(term) ||
            g.clienteCnpj.toLowerCase().includes(term) ||
            g.produtoNome.toLowerCase().includes(term)
        );
    if (!skuFiltro) return porTexto;
    return porTexto
      .map((g) => ({ ...g, linhas: g.linhas.filter(({ produto }) => produto?.produto_sku === skuFiltro) }))
      .filter((g) => g.linhas.length > 0);
  }, [grupos, search, skuFiltro]);

  const qtdAlertaSemValor = useMemo(() => precos.filter((pc) => pc.pc_alerta_preco === "S").length, [precos]);

  const qtdAlertaSemIndexador = useMemo(
    () => precosCliente.filter((pc) => !pc.pc_dat_niver || !pc.pc_cod_index).length,
    [precosCliente]
  );

  const qtdAlertaClienteInativo = useMemo(() => {
    const clienteIdsComConsumo = new Set(
      precos.filter((pc) => (pc.pc_mes_atu_qtd_consumo ?? 0) > 0).map((pc) => pc.cliente_id)
    );
    return clientes.filter((c) => c.cliente_status !== "ATIVO" && clienteIdsComConsumo.has(c.cliente_id)).length;
  }, [precos, clientes]);

  const qtdPorAlerta: Record<AlertaKey, number> = {
    sem_valor: qtdAlertaSemValor,
    sem_indexador: qtdAlertaSemIndexador,
    cliente_inativo: qtdAlertaClienteInativo,
  };

  const totaisGerais = useMemo(
    () =>
      grupos.reduce(
        (acc, g) => ({
          franquia: acc.franquia + g.franquia,
          consumo: acc.consumo + g.consumo,
          total: acc.total + g.total,
          excedente: acc.excedente + g.excedente,
        }),
        { franquia: 0, consumo: 0, total: 0, excedente: 0 }
      ),
    [grupos]
  );

  function exportRows(): { headers: string[]; rows: ExportCell[][] } {
    const headers = ["CNPJ", "Cliente", "Produto", "Franquia", "Consumo", "Excedente", "Total"];
    const rows = filtrados.map((g) => [g.clienteCnpj, g.clienteNome, g.produtoNome, g.franquia, g.consumo, g.excedente, g.total]);
    return { headers, rows };
  }

  usePageTitle(["Financeiro", "Consumo", cartAnoMes]);

  if (detalhe) {
    return (
      <ConsumoAnaDetalhePage
        clienteId={detalhe.clienteId}
        clienteNome={detalhe.clienteNome}
        produtoId={detalhe.produtoId}
        produtoNome={detalhe.produtoNome}
        cartMesId={cartMesId}
        cartAnoMes={cartAnoMes}
        onBack={() => setDetalhe(null)}
      />
    );
  }

  return (
    <div className="page">
      <div className="dashboard-header">
        <button onClick={onBack}>&larr; Voltar</button>
      </div>

      <StatCards
        stats={[
          { label: "Franquia total", value: formatMoney(totaisGerais.franquia), tone: "gray" },
          { label: "Consumo total", value: formatMoney(totaisGerais.consumo), tone: "accent" },
          { label: "Excedente total", value: formatMoney(totaisGerais.excedente), tone: "red" },
          { label: "Total geral", value: formatMoney(totaisGerais.total), tone: "green" },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <div className="datagrid-toolbar">
        <div className="datagrid-toolbar-left">
          <input
            className="search"
            placeholder="Buscar por cliente, CNPJ ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="datagrid-filter">
            <select value={skuFiltro} onChange={(e) => setSkuFiltro(e.target.value)}>
              <option value="">SKU (todos)</option>
              {skuOptions.map((sku) => (
                <option key={sku} value={sku}>
                  {sku}
                </option>
              ))}
            </select>
          </span>
        </div>
        <div className="datagrid-toolbar-right">
          {(["cliente_inativo", "sem_indexador", "sem_valor"] as const).map((key) => (
            <button
              key={key}
              className={`alert-btn ${qtdPorAlerta[key] === 0 ? "zero" : ""}`}
              onClick={() => onAbrirAlertaPrecos(key)}
              disabled={qtdPorAlerta[key] === 0}
              title="Abre a Tabela de Preços filtrada nesses itens"
            >
              ⚠ {ALERTA_LABEL[key]} ({qtdPorAlerta[key]})
            </button>
          ))}
          <button
            className="icon-btn"
            title="Exportar XLS"
            aria-label="Exportar XLS"
            onClick={() => {
              const { headers, rows } = exportRows();
              exportToXlsx(`consumo_${cartAnoMes.replace("/", "-")}`, headers, rows);
            }}
          >
            <XlsIcon />
          </button>
          <button
            className="icon-btn"
            title="Exportar CSV"
            aria-label="Exportar CSV"
            onClick={() => {
              const { headers, rows } = exportRows();
              exportToCsv(`consumo_${cartAnoMes.replace("/", "-")}`, headers, rows);
            }}
          >
            <CsvIcon />
          </button>
          <button
            className="icon-btn"
            title="Exportar PDF"
            aria-label="Exportar PDF"
            onClick={() => {
              const { headers, rows } = exportRows();
              exportToPdf(`consumo_${cartAnoMes.replace("/", "-")}`, headers, rows);
            }}
          >
            <PdfIcon />
          </button>
          <button
            className="icon-btn"
            title="Compartilhar"
            aria-label="Compartilhar"
            onClick={() => {
              const { headers, rows } = exportRows();
              shareExport(`consumo_${cartAnoMes.replace("/", "-")}`, headers, rows);
            }}
          >
            <ShareIcon />
          </button>
        </div>
      </div>

      <p className="page-subtitle">{loading ? "Carregando..." : `${filtrados.length} grupos de consumo`}</p>

      <div className="consumo-grupo-list">
        {filtrados.map((g) => (
          <div className="consumo-grupo" key={g.key}>
            <div className="consumo-grupo-header">
              <span className="consumo-grupo-titulo">
                {g.clienteCnpj} - {g.clienteNome} · {g.produtoNome}
              </span>
              <span className="consumo-grupo-totais">
                <span>
                  Franquia: <strong>{formatMoney(g.franquia)}</strong>
                </span>
                <span>
                  Consumo: <strong>{formatMoney(g.consumo)}</strong>
                </span>
                <span>
                  Excedente: <strong>{formatMoney(g.excedente)}</strong>
                </span>
                <span>
                  Total: <strong>{formatMoney(g.total)}</strong>
                </span>
              </span>
            </div>
            <table className="mini-table mini-table-fixed">
              <thead>
                <tr>
                  <th style={{ width: "42%" }}>Detalhe</th>
                  <th style={{ width: "13%" }}>SKU</th>
                  <th style={{ width: "13%" }} className="text-right">
                    # Transações
                  </th>
                  <th style={{ width: "16%" }} className="text-right">
                    Franquia realizada
                  </th>
                  <th style={{ width: "16%" }} className="text-right">
                    Vlr unit. realizado
                  </th>
                </tr>
              </thead>
              <tbody>
                {g.linhas.map(({ pc, produto }) => (
                  <tr
                    key={pc.pc_id}
                    className={`clickable-row ${pc.pc_alerta_preco === "S" ? "row-alerta" : ""}`}
                    onClick={() =>
                      setDetalhe({
                        clienteId: pc.cliente_id,
                        clienteNome: g.clienteNome,
                        produtoId: pc.produto_id,
                        produtoNome: produto?.produto_nome ?? "",
                      })
                    }
                  >
                    <td>{produto?.produto_detalhe ?? ""}</td>
                    <td>{produto?.produto_sku ?? ""}</td>
                    <td className="text-right">{pc.pc_mes_atu_qtd_consumo}</td>
                    <td className="text-right">{formatMoney(pc.pc_mes_atu_vlr_franquia ?? 0)}</td>
                    <td className="text-right">{formatMoney(pc.pc_mes_atu_vlr_exced ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {!loading && filtrados.length === 0 && <p className="dashboard-empty">Nenhum grupo de consumo encontrado.</p>}
      </div>
    </div>
  );
}
