import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cliente, GrupoEcon, Produto, Url } from "../api/types";
import { ClienteForm, valuesToPayload, type ClienteFormValues } from "./ClienteForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";
import { clearFilterKeys, toggleFilterValue } from "../lib/filterValues";
import { formatDate } from "../lib/formatDate";

interface ClientesPageProps {
  onOpenCliente: (clienteId: number) => void;
}

export function ClientesPage({ onOpenCliente }: ClientesPageProps) {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("clientes");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [grupos, setGrupos] = useState<GrupoEcon[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [urls, setUrls] = useState<Url[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Cliente | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Estado dos filtros do DataGrid levantado pra cá (controlado) pra os cards de StatCards
  // poderem alternar o mesmo filtro que o dropdown "Status" já mostra -- ver DESIGN_SYSTEM.md.
  const [filterValues, setFilterValues] = useState<Record<string, string>>({ cliente_status: "ATIVO" });
  // Contagens dos StatCards, recalculadas pelo DataGrid a cada busca/filtro -- cada uma ignora o
  // próprio filtro de status (ver `countWith`) pra não zerar quando outro card estiver ativo.
  const [cardCounts, setCardCounts] = useState({ total: 0, ativos: 0, inativos: 0 });

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [clientesRes, gruposRes, produtosRes, urlsRes] = await Promise.all([
        api.list<Cliente>("clientes", { limit: 20000 }),
        api.list<GrupoEcon>("grupos_econ", { limit: 20000 }),
        api.list<Produto>("produtos", { limit: 20000 }),
        api.list<Url>("urls", { limit: 20000 }),
      ]);
      setClientes(clientesRes.data);
      setGrupos(gruposRes.data);
      setProdutos(produtosRes.data);
      setUrls(urlsRes.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const grupoNomeById = useMemo(() => {
    const map = new Map<number, string>();
    grupos.forEach((g) => map.set(g.grp_id, g.grp_nome));
    return map;
  }, [grupos]);

  function grupoNome(c: Cliente): string {
    return c.grp_id != null ? grupoNomeById.get(c.grp_id) ?? "" : "";
  }

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

  // cliente_id -> Set de nomes de produto / suíte (via URLs cadastradas)
  const clienteProdutos = useMemo(() => {
    const map = new Map<number, Set<string>>();
    urls.forEach((u) => {
      if (u.produto_id == null) return;
      const nome = produtoNomeById.get(u.produto_id);
      if (!nome) return;
      const s = map.get(u.cliente_id) ?? new Set<string>();
      s.add(nome);
      map.set(u.cliente_id, s);
    });
    return map;
  }, [urls, produtoNomeById]);

  const clienteSuites = useMemo(() => {
    const map = new Map<number, Set<string>>();
    urls.forEach((u) => {
      if (u.produto_id == null) return;
      const suite = produtoSuiteById.get(u.produto_id);
      if (!suite) return;
      const s = map.get(u.cliente_id) ?? new Set<string>();
      s.add(suite);
      map.set(u.cliente_id, s);
    });
    return map;
  }, [urls, produtoSuiteById]);

  // Listas distintas de opções pra popular os dropdowns (independente do filtro ativo)
  const todosProdutos = useMemo(
    () => [...new Set(urls.map((u) => (u.produto_id != null ? produtoNomeById.get(u.produto_id) : undefined)).filter(Boolean) as string[])].sort(),
    [urls, produtoNomeById]
  );

  const todasSuites = useMemo(
    () => [...new Set(urls.map((u) => (u.produto_id != null ? produtoSuiteById.get(u.produto_id) : undefined)).filter(Boolean) as string[])].sort(),
    [urls, produtoSuiteById]
  );

  async function handleDelete(cliente: Cliente) {
    if (!confirm(`Excluir o cliente "${cliente.cliente_nome}" (#${cliente.cliente_id})?`)) return;
    try {
      await api.remove("clientes", cliente.cliente_id);
      setClientes((prev) => prev.filter((c) => c.cliente_id !== cliente.cliente_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: ClienteFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        const created = await api.create<Cliente>("clientes", payload);
        setClientes((prev) => [...prev, created]);
      } else if (editing) {
        const updated = await api.update<Cliente>("clientes", editing.cliente_id, payload);
        setClientes((prev) => prev.map((c) => (c.cliente_id === updated.cliente_id ? updated : c)));
      }
      setEditing(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns: DataGridColumn<Cliente>[] = useMemo(
    () => [
      { id: "cliente_id", header: "ID", value: (c) => c.cliente_id, width: 60, minWidth: 50 },
      { id: "cliente_nome", header: "Nome", value: (c) => c.cliente_nome, width: 240 },
      { id: "grupo", header: "Grupo econômico", value: grupoNome, width: 160 },
      { id: "cliente_cnpj", header: "CNPJ", value: (c) => c.cliente_cnpj, width: 150 },
      { id: "cliente_log", header: "Responsável", value: (c) => c.cliente_log ?? "", width: 170 },
      {
        id: "cliente_status",
        header: "Status",
        value: (c) => c.cliente_status,
        width: 100,
        cell: (c) => <span className={`badge badge-${c.cliente_status.toLowerCase()}`}>{c.cliente_status}</span>,
      },
      {
        id: "cliente_dat_bloqueio",
        header: "Data bloqueio",
        value: (c) => c.cliente_dat_bloqueio ?? "",
        width: 110,
        align: "center",
        cell: (c) => formatDate(c.cliente_dat_bloqueio),
        exportValue: (c) => formatDate(c.cliente_dat_bloqueio),
      },
    ],
    [grupoNomeById]
  );

  const filters: DataGridFilter<Cliente>[] = useMemo(
    () => [
      { id: "cliente_status", label: "Status", value: (c) => c.cliente_status },
      { id: "grupo", label: "Grupo econômico", value: grupoNome },
      {
        id: "produto",
        label: "Produto",
        value: (c) => [...(clienteProdutos.get(c.cliente_id) ?? [])].join("|"),
        options: todosProdutos,
        match: (c, active) => clienteProdutos.get(c.cliente_id)?.has(active) ?? false,
      },
      {
        id: "suite",
        label: "Suíte",
        value: (c) => [...(clienteSuites.get(c.cliente_id) ?? [])].join("|"),
        options: todasSuites,
        match: (c, active) => clienteSuites.get(c.cliente_id)?.has(active) ?? false,
      },
    ],
    [grupoNomeById, clienteProdutos, clienteSuites, todosProdutos, todasSuites]
  );

  return (
    <div className="page">
      <StatCards
        stats={[
          {
            label: "Total de clientes",
            value: cardCounts.total,
            tone: "accent",
            onClick: () => setFilterValues((prev) => clearFilterKeys(prev, ["cliente_status"])),
            active: !filterValues.cliente_status,
          },
          {
            label: "Ativos",
            value: cardCounts.ativos,
            tone: "green",
            onClick: () => setFilterValues((prev) => toggleFilterValue(prev, "cliente_status", "ATIVO")),
            active: filterValues.cliente_status === "ATIVO",
          },
          {
            label: "Inativos",
            value: cardCounts.inativos,
            tone: "red",
            onClick: () => setFilterValues((prev) => toggleFilterValue(prev, "cliente_status", "INATIVO")),
            active: filterValues.cliente_status === "INATIVO",
          },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={clientes}
        columns={columns}
        getRowId={(c) => c.cliente_id}
        searchValue={(c) => `${c.cliente_nome} ${c.cliente_cnpj ?? ""} ${grupoNome(c)} ${c.cliente_log ?? ""}`}
        searchPlaceholder="Buscar por nome, CNPJ, grupo, responsável..."
        filters={filters}
        loading={loading}
        exportFilename="clientes"
        filterValues={filterValues}
        onFilterValuesChange={setFilterValues}
        onFilteredChange={({ countWith }) =>
          setCardCounts({
            total: countWith({ cliente_status: undefined }),
            ativos: countWith({ cliente_status: "ATIVO" }),
            inativos: countWith({ cliente_status: "INATIVO" }),
          })
        }
        onRowClick={(c) => onOpenCliente(c.cliente_id)}
        actionsWidth={100}
        renderActions={
          podeEditar || podeExcluir
            ? (c) => (
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  {podeEditar && (
                    <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing(c)}>
                      <EditIcon />
                    </button>
                  )}
                  {podeExcluir && (
                    <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDelete(c)}>
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
              + Novo cliente
            </button>
          ) : undefined
        }
      />

      {editing && (
        <ClienteForm
          cliente={editing === "new" ? null : editing}
          grupos={grupos}
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
