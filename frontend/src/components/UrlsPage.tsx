import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cliente, ListUrlStatus, Produto, Servidor, Url } from "../api/types";
import { UrlForm, valuesToPayload, type UrlFormValues } from "./UrlForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

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

  const servidorNomeById = useMemo(() => {
    const map = new Map<number, string>();
    servidores.forEach((s) => map.set(s.server_id, s.server_nome));
    return map;
  }, [servidores]);

  function clienteNome(u: Url): string {
    return clienteNomeById.get(u.cliente_id) ?? "";
  }
  function produtoNome(u: Url): string {
    return u.produto_id != null ? produtoNomeById.get(u.produto_id) ?? "" : "";
  }
  function servidorNome(u: Url): string {
    return u.server_id != null ? servidorNomeById.get(u.server_id) ?? "" : "";
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
    ],
    [clienteNomeById, produtoNomeById, servidorNomeById]
  );

  const filters: DataGridFilter<Url>[] = useMemo(
    () => [
      { id: "url_status", label: "Status", value: (u) => u.url_status ?? "" },
      { id: "produto", label: "Produto", value: produtoNome },
      { id: "servidor", label: "Servidor", value: servidorNome },
    ],
    [produtoNomeById, servidorNomeById]
  );

  return (
    <div className="page">
      <StatCards
        stats={[
          { label: "Total de URLs", value: urls.length, tone: "accent" },
          { label: "Ativas", value: urls.filter((u) => u.url_status === "ATIVO").length, tone: "green" },
          { label: "Bloqueadas", value: urls.filter((u) => u.url_status === "BLOQUEADO").length, tone: "red" },
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
          `${u.url_path} ${clienteNome(u)} ${produtoNome(u)} ${servidorNome(u)} ${u.url_status ?? ""}`
        }
        searchPlaceholder="Buscar por caminho, cliente, produto, status..."
        filters={filters}
        loading={loading}
        exportFilename="urls"
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
