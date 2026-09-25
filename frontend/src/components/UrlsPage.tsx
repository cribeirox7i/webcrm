import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cliente, ListUrlStatus, Produto, Servidor, Url } from "../api/types";
import { UrlForm, valuesToPayload, type UrlFormValues } from "./UrlForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";
import { clearFilterKeys, toggleFilterValue } from "../lib/filterValues";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");
}

export function UrlsPage() {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("urls");
  const [urls, setUrls] = useState<Url[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [servidores, setServidores] = useState<Servidor[]>([]);
  const [statusOptions, setStatusOptions] = useState<ListUrlStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Url | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filtro do DataGrid levantado pra cá (controlado) pra os cards de StatCards poderem
  // alternar o mesmo filtro de status, mesmo sem mais existir um dropdown "Status" correspondente.
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  // Contagens dos StatCards, recalculadas pelo DataGrid a cada busca/filtro -- cada uma ignora o
  // próprio filtro de status (ver `countWith`) pra não zerar quando outro card estiver ativo.
  const [cardCounts, setCardCounts] = useState({ total: 0, ativas: 0, bloqueadas: 0 });

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [urlsRes, clientesRes, produtosRes, servidoresRes, statusRes] = await Promise.all([
        api.list<Url>("urls", { limit: 20000 }),
        api.list<Cliente>("clientes", { limit: 20000 }),
        api.list<Produto>("produtos", { limit: 20000 }),
        api.list<Servidor>("servidores", { limit: 20000 }),
        api.list<ListUrlStatus>("list_url_status", { limit: 20000 }),
      ]);
      setUrls(urlsRes.data);
      setClientes(clientesRes.data);
      setProdutos(produtosRes.data);
      setServidores(servidoresRes.data);
      setStatusOptions(statusRes.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const clienteNomeById = useMemo(() => {
    const map = new Map<number, string>();
    clientes.forEach((c) => map.set(c.cliente_id, c.cliente_nome));
    return map;
  }, [clientes]);

  const produtoNomeById = useMemo(() => {
    const map = new Map<number, string>();
    produtos.forEach((p) => map.set(p.produto_id, p.produto_nome));
    return map;
  }, [produtos]);

  const produtoSuiteById = useMemo(() => {
    const map = new Map<number, string>();
    produtos.forEach((p) => map.set(p.produto_id, p.produto_suite ?? ""));
    return map;
  }, [produtos]);

  const servidorNomeById = useMemo(() => {
    const map = new Map<number, string>();
    servidores.forEach((s) => map.set(s.server_id, s.server_nome));
    return map;
  }, [servidores]);

  const servidorAmbienteById = useMemo(() => {
    const map = new Map<number, string>();
    servidores.forEach((s) => map.set(s.server_id, s.server_ambiente ?? ""));
    return map;
  }, [servidores]);

  function clienteNome(u: Url): string {
    return clienteNomeById.get(u.cliente_id) ?? "";
  }
  function produtoNome(u: Url): string {
    return u.produto_id != null ? produtoNomeById.get(u.produto_id) ?? "" : "";
  }
  function produtoSuite(u: Url): string {
    return u.produto_id != null ? produtoSuiteById.get(u.produto_id) ?? "" : "";
  }
  function servidorNome(u: Url): string {
    return u.server_id != null ? servidorNomeById.get(u.server_id) ?? "" : "";
  }
  function servidorAmbiente(u: Url): string {
    return u.server_id != null ? servidorAmbienteById.get(u.server_id) ?? "" : "";
  }

  async function handleDelete(url: Url) {
    if (!confirm(`Excluir a URL "${url.url_path}" (#${url.url_id})?`)) return;
    try {
      await api.remove("urls", url.url_id);
      setUrls((prev) => prev.filter((u) => u.url_id !== url.url_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: UrlFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        const created = await api.create<Url>("urls", payload);
        setUrls((prev) => [...prev, created]);
      } else if (editing) {
        const updated = await api.update<Url>("urls", editing.url_id, payload);
        setUrls((prev) => prev.map((u) => (u.url_id === updated.url_id ? updated : u)));
      }
      setEditing(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns: DataGridColumn<Url>[] = useMemo(
    () => [
      { id: "url_id", header: "ID", value: (u) => u.url_id, width: 70, minWidth: 60 },
      { id: "url_path", header: "Caminho", value: (u) => u.url_path, width: 280 },
      { id: "cliente", header: "Cliente", value: clienteNome, width: 240 },
      { id: "produto", header: "Produto", value: produtoNome, width: 160 },
      { id: "suite", header: "Suíte", value: produtoSuite, width: 140 },
      { id: "servidor", header: "Servidor", value: servidorNome, width: 130 },
      {
        id: "url_status",
        header: "Status",
        value: (u) => u.url_status,
        width: 120,
        cell: (u) =>
          u.url_status ? (
            <span className={`badge badge-${slugify(u.url_status)}`}>{u.url_status}</span>
          ) : (
            ""
          ),
      },
      {
        id: "url_dt_status",
        header: "Data Status",
        value: (u) => u.url_dt_status ?? "",
        width: 110,
        align: "center",
        cell: (u) => formatDate(u.url_dt_status),
        exportValue: (u) => formatDate(u.url_dt_status),
      },
      {
        id: "url_exc",
        header: "Exclusão",
        value: (u) => u.url_exc,
        width: 190,
        cell: (u) => (u.url_exc ? <span className={`badge badge-${slugify(u.url_exc)}`}>{u.url_exc}</span> : ""),
      },
      {
        id: "url_dt_exc",
        header: "Data Exclusão",
        value: (u) => u.url_dt_exc ?? "",
        width: 110,
        align: "center",
        cell: (u) => formatDate(u.url_dt_exc),
        exportValue: (u) => formatDate(u.url_dt_exc),
      },
    ],
    [clienteNomeById, produtoNomeById, produtoSuiteById, servidorNomeById]
  );

  // Só entra no XLS/PDF/CSV, não na tela -- Suíte já é coluna visível (e por isso já sai na
  // exportação também), Ambiente (do servidor) só foi pedido pra exportação.
  const extraExportColumns = useMemo(
    () => [{ header: "Ambiente", value: servidorAmbiente }],
    [servidorAmbienteById]
  );

  const filters: DataGridFilter<Url>[] = useMemo(
    () => [
      { id: "url_exc", label: "Exclusão", value: (u) => u.url_exc ?? "" },
      { id: "produto", label: "Produto", value: produtoNome },
      { id: "suite", label: "Suíte", value: produtoSuite },
      { id: "servidor", label: "Servidor", value: servidorNome },
    ],
    [produtoNomeById, produtoSuiteById, servidorNomeById]
  );

  return (
    <div className="page">
      <StatCards
        stats={[
          {
            label: "Total de URLs",
            value: cardCounts.total,
            tone: "accent",
            onClick: () => setFilterValues((prev) => clearFilterKeys(prev, ["url_status"])),
            active: !filterValues.url_status,
          },
          {
            label: "Ativas",
            value: cardCounts.ativas,
            tone: "green",
            onClick: () => setFilterValues((prev) => toggleFilterValue(prev, "url_status", "ATIVO")),
            active: filterValues.url_status === "ATIVO",
          },
          {
            label: "Bloqueadas",
            value: cardCounts.bloqueadas,
            tone: "red",
            onClick: () => setFilterValues((prev) => toggleFilterValue(prev, "url_status", "BLOQUEADO")),
            active: filterValues.url_status === "BLOQUEADO",
          },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={urls}
        columns={columns}
        getRowId={(u) => u.url_id}
        searchValue={(u) =>
          `${u.url_path} ${clienteNome(u)} ${produtoNome(u)} ${produtoSuite(u)} ${servidorNome(u)} ${u.url_status ?? ""} ${u.url_exc ?? ""}`
        }
        searchPlaceholder="Buscar por caminho, cliente, produto, suíte, status..."
        filters={filters}
        loading={loading}
        exportFilename="urls"
        extraExportColumns={extraExportColumns}
        filterValues={filterValues}
        onFilterValuesChange={setFilterValues}
        onFilteredChange={({ countWith }) =>
          setCardCounts({
            total: countWith({ url_status: undefined }),
            ativas: countWith({ url_status: "ATIVO" }),
            bloqueadas: countWith({ url_status: "BLOQUEADO" }),
          })
        }
        actionsWidth={100}
        renderActions={
          podeEditar || podeExcluir
            ? (u) => (
                <div className="row-actions">
                  {podeEditar && (
                    <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing(u)}>
                      <EditIcon />
                    </button>
                  )}
                  {podeExcluir && (
                    <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDelete(u)}>
                      <TrashIcon />
                    </button>
                  )}
                </div>
              )
            : undefined
        }
        toolbarExtra={
          podeInserir ? (
            <button className="primary" onClick={() => setEditing("new")}>
              + Nova URL
            </button>
          ) : undefined
        }
      />

      {editing && (
        <UrlForm
          url={editing === "new" ? null : editing}
          clientes={clientes}
          produtos={produtos}
          servidores={servidores}
          statusOptions={statusOptions}
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
