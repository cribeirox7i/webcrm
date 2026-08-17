import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cliente, GrupoEcon } from "../api/types";
import { ClienteForm, valuesToPayload, type ClienteFormValues } from "./ClienteForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

interface ClientesPageProps {
  onOpenCliente: (clienteId: number) => void;
}

export function ClientesPage({ onOpenCliente }: ClientesPageProps) {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("clientes");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [grupos, setGrupos] = useState<GrupoEcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Cliente | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [clientesRes, gruposRes] = await Promise.all([
        api.list<Cliente>("clientes", { limit: 20000 }),
        api.list<GrupoEcon>("grupos_econ", { limit: 20000 }),
      ]);
      setClientes(clientesRes.data);
      setGrupos(gruposRes.data);
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
      { id: "cliente_id", header: "ID", value: (c) => c.cliente_id, width: 70, minWidth: 60 },
      { id: "cliente_nome", header: "Nome", value: (c) => c.cliente_nome, width: 280 },
      { id: "grupo", header: "Grupo econômico", value: grupoNome, width: 200 },
      { id: "cliente_cnpj", header: "CNPJ", value: (c) => c.cliente_cnpj, width: 170 },
      {
        id: "cliente_status",
        header: "Status",
        value: (c) => c.cliente_status,
        width: 110,
        cell: (c) => <span className={`badge badge-${c.cliente_status.toLowerCase()}`}>{c.cliente_status}</span>,
      },
      { id: "cliente_dat_bloqueio", header: "Data bloqueio", value: (c) => c.cliente_dat_bloqueio ?? "", width: 130 },
    ],
    [grupoNomeById]
  );

  const filters: DataGridFilter<Cliente>[] = useMemo(
    () => [
      { id: "cliente_status", label: "Status", value: (c) => c.cliente_status },
      { id: "grupo", label: "Grupo econômico", value: grupoNome },
    ],
    [grupoNomeById]
  );

  return (
    <div className="page">
      <StatCards
        stats={[
          { label: "Total de clientes", value: clientes.length, tone: "accent" },
          { label: "Ativos", value: clientes.filter((c) => c.cliente_status === "ATIVO").length, tone: "green" },
          { label: "Inativos", value: clientes.filter((c) => c.cliente_status !== "ATIVO").length, tone: "red" },
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
        defaultFilterValues={{ cliente_status: "ATIVO" }}
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
