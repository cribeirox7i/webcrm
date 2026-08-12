import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cliente, Contato, GrupoEcon, Produto, Servidor, Url } from "../api/types";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { usePageTitle } from "../PageTitleContext";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");
}

interface ClienteDashboardPageProps {
  clienteId: number;
  onBack: () => void;
}

export function ClienteDashboardPage({ clienteId, onBack }: ClienteDashboardPageProps) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [grupos, setGrupos] = useState<GrupoEcon[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [urls, setUrls] = useState<Url[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [servidores, setServidores] = useState<Servidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [clienteRes, gruposRes, contatosRes, urlsRes, produtosRes, servidoresRes] = await Promise.all([
        api.get<Cliente>("clientes", clienteId),
        api.list<GrupoEcon>("grupos_econ", { limit: 20000 }),
        api.list<Contato>("contatos", { cliente_id: clienteId, limit: 20000 }),
        api.list<Url>("urls", { cliente_id: clienteId, limit: 20000 }),
        api.list<Produto>("produtos", { limit: 20000 }),
        api.list<Servidor>("servidores", { limit: 20000 }),
      ]);
      setCliente(clienteRes);
      setGrupos(gruposRes.data);
      setContatos(contatosRes.data);
      setUrls(urlsRes.data);
      setProdutos(produtosRes.data);
      setServidores(servidoresRes.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const grupoNome = useMemo(() => {
    if (!cliente?.grp_id) return "";
    return grupos.find((g) => g.grp_id === cliente.grp_id)?.grp_nome ?? "";
  }, [cliente, grupos]);

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

  const produtosDistintos = useMemo(() => {
    const ids = new Set(urls.map((u) => u.produto_id).filter((id): id is number => id != null));
    return ids.size;
  }, [urls]);

  const contatoColumns: DataGridColumn<Contato>[] = useMemo(
    () => [
      { id: "contato_nome", header: "Nome", value: (c) => c.contato_nome, width: 180 },
      { id: "contato_mail", header: "E-mail", value: (c) => c.contato_mail ?? "", width: 200 },
      { id: "contato_fone", header: "Telefone", value: (c) => c.contato_fone ?? "", width: 130 },
      {
        id: "contato_status",
        header: "Status",
        value: (c) => c.contato_status ?? "",
        width: 110,
        cell: (c) => (c.contato_status ? <span className={`badge badge-${slugify(c.contato_status)}`}>{c.contato_status}</span> : ""),
      },
    ],
    []
  );

  const urlColumns: DataGridColumn<Url>[] = useMemo(
    () => [
      {
        id: "produto",
        header: "Produto",
        value: (u) => (u.produto_id != null ? produtoNomeById.get(u.produto_id) ?? "" : ""),
        width: 150,
      },
      { id: "url_path", header: "Caminho", value: (u) => u.url_path, width: 220 },
      {
        id: "servidor",
        header: "Servidor",
        value: (u) => (u.server_id != null ? servidorNomeById.get(u.server_id) ?? "" : ""),
        width: 110,
      },
      {
        id: "url_status",
        header: "Status",
        value: (u) => u.url_status ?? "",
        width: 110,
        cell: (u) => (u.url_status ? <span className={`badge badge-${slugify(u.url_status)}`}>{u.url_status}</span> : ""),
      },
    ],
    [produtoNomeById, servidorNomeById]
  );

  usePageTitle(["Clientes", cliente?.cliente_nome ?? "..."]);

  if (loading && !cliente) {
    return (
      <div className="page">
        <p className="page-subtitle">Carregando...</p>
      </div>
    );
  }

  if (loadError || !cliente) {
    return (
      <div className="page">
        <div className="banner-error">
          Falha ao carregar cliente: {loadError ?? "não encontrado"} <button onClick={loadAll}>Tentar de novo</button>
        </div>
        <button onClick={onBack}>&larr; Voltar para clientes</button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="dashboard-header">
        <button onClick={onBack}>&larr; Voltar</button>
        <div className="dashboard-subtitle">
          {grupoNome && <span>{grupoNome}</span>}
          {cliente.cliente_cnpj && <span>CNPJ {cliente.cliente_cnpj}</span>}
          <span className={`badge badge-${cliente.cliente_status.toLowerCase()}`}>{cliente.cliente_status}</span>
        </div>
      </div>

      <StatCards
        stats={[
          { label: "Contatos", value: contatos.length, tone: "accent" },
          { label: "Contatos ativos", value: contatos.filter((c) => c.contato_status === "ATIVO").length, tone: "green" },
          { label: "URLs", value: urls.length, tone: "accent" },
          { label: "URLs ativas", value: urls.filter((u) => u.url_status === "ATIVO").length, tone: "green" },
          { label: "Produtos vinculados", value: produtosDistintos, tone: "gray" },
        ]}
      />

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Contatos</h3>
          <div className="dashboard-card-body">
            {contatos.length === 0 ? (
              <p className="dashboard-empty">Nenhum contato cadastrado.</p>
            ) : (
              <DataGrid
                data={contatos}
                columns={contatoColumns}
                getRowId={(c) => c.contato_id}
                searchValue={(c) => c.contato_nome}
                exportFilename={`contatos_${cliente.cliente_id}`}
                hideToolbar
              />
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Produtos / URLs</h3>
          <div className="dashboard-card-body">
            {urls.length === 0 ? (
              <p className="dashboard-empty">Nenhuma URL cadastrada.</p>
            ) : (
              <DataGrid
                data={urls}
                columns={urlColumns}
                getRowId={(u) => u.url_id}
                searchValue={(u) => u.url_path}
                exportFilename={`urls_${cliente.cliente_id}`}
                hideToolbar
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
