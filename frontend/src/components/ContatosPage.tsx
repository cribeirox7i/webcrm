import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cliente, Contato } from "../api/types";
import { ContatoForm, valuesToPayload, type ContatoFormValues } from "./ContatoForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";
import { clearFilterKeys, toggleFilterValue } from "../lib/filterValues";

export function ContatosPage() {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("contatos");
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Contato | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filtro do DataGrid levantado pra cá (controlado) pra os cards de StatCards poderem
  // alternar o mesmo filtro que o dropdown "Status" já mostra.
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [contatosRes, clientesRes] = await Promise.all([
        api.list<Contato>("contatos", { limit: 20000 }),
        api.list<Cliente>("clientes", { limit: 20000 }),
      ]);
      setContatos(contatosRes.data);
      setClientes(clientesRes.data);
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

  function clienteNome(c: Contato): string {
    return clienteNomeById.get(c.cliente_id) ?? "";
  }

  async function handleDelete(contato: Contato) {
    if (!confirm(`Excluir o contato "${contato.contato_nome}" (#${contato.contato_id})?`)) return;
    try {
      await api.remove("contatos", contato.contato_id);
      setContatos((prev) => prev.filter((c) => c.contato_id !== contato.contato_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: ContatoFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        const created = await api.create<Contato>("contatos", payload);
        setContatos((prev) => [...prev, created]);
      } else if (editing) {
        const updated = await api.update<Contato>("contatos", editing.contato_id, payload);
        setContatos((prev) => prev.map((c) => (c.contato_id === updated.contato_id ? updated : c)));
      }
      setEditing(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns: DataGridColumn<Contato>[] = useMemo(
    () => [
      { id: "contato_id", header: "ID", value: (c) => c.contato_id, width: 70, minWidth: 60 },
      { id: "contato_nome", header: "Nome", value: (c) => c.contato_nome, width: 220 },
      { id: "cliente", header: "Cliente", value: clienteNome, width: 240 },
      { id: "contato_mail", header: "E-mail", value: (c) => c.contato_mail, width: 220 },
      { id: "contato_fone", header: "Telefone", value: (c) => c.contato_fone, width: 150 },
      {
        id: "contato_status",
        header: "Status",
        value: (c) => c.contato_status,
        width: 100,
        cell: (c) => (c.contato_status ? <span className={`badge badge-${c.contato_status.toLowerCase()}`}>{c.contato_status}</span> : ""),
      },
    ],
    [clienteNomeById]
  );

  const filters: DataGridFilter<Contato>[] = useMemo(
    () => [
      { id: "contato_status", label: "Status", value: (c) => c.contato_status ?? "" },
      { id: "cliente", label: "Cliente", value: clienteNome },
    ],
    [clienteNomeById]
  );

  return (
    <div className="page">
      <StatCards
        stats={[
          {
            label: "Total de contatos",
            value: contatos.length,
            tone: "accent",
            onClick: () => setFilterValues((prev) => clearFilterKeys(prev, ["contato_status"])),
            active: !filterValues.contato_status,
          },
          {
            label: "Ativos",
            value: contatos.filter((c) => c.contato_status === "ATIVO").length,
            tone: "green",
            onClick: () => setFilterValues((prev) => toggleFilterValue(prev, "contato_status", "ATIVO")),
            active: filterValues.contato_status === "ATIVO",
          },
          {
            label: "Inativos",
            value: contatos.filter((c) => c.contato_status === "INATIVO").length,
            tone: "red",
            onClick: () => setFilterValues((prev) => toggleFilterValue(prev, "contato_status", "INATIVO")),
            active: filterValues.contato_status === "INATIVO",
          },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={contatos}
        columns={columns}
        getRowId={(c) => c.contato_id}
        searchValue={(c) => `${c.contato_nome} ${clienteNome(c)} ${c.contato_mail ?? ""} ${c.contato_fone ?? ""}`}
        searchPlaceholder="Buscar por nome, cliente, e-mail, telefone..."
        filters={filters}
        loading={loading}
        exportFilename="contatos"
        filterValues={filterValues}
        onFilterValuesChange={setFilterValues}
        actionsWidth={100}
        renderActions={
          podeEditar || podeExcluir
            ? (c) => (
                <div className="row-actions">
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
              + Novo contato
            </button>
          ) : undefined
        }
      />

      {editing && (
        <ContatoForm
          contato={editing === "new" ? null : editing}
          clientes={clientes}
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
