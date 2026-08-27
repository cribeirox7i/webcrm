import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Servidor } from "../api/types";
import { ServidorForm, valuesToPayload, type ServidorFormValues } from "./ServidorForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";
import { clearFilterKeys, toggleFilterValue } from "../lib/filterValues";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");
}

export function ServidoresPage() {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("servidores");
  const [servidores, setServidores] = useState<Servidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Servidor | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filtro do DataGrid levantado pra cá (controlado) pra os cards de StatCards poderem
  // alternar o mesmo filtro que os dropdowns "Status"/"Ambiente" já mostram. "Família" (3º
  // dropdown, sem card correspondente) não é tocado pelo clique nos cards.
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.list<Servidor>("servidores", { limit: 20000 });
      setServidores(res.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleDelete(servidor: Servidor) {
    if (!confirm(`Excluir o servidor "${servidor.server_nome}" (#${servidor.server_id})?`)) return;
    try {
      await api.remove("servidores", servidor.server_id);
      setServidores((prev) => prev.filter((s) => s.server_id !== servidor.server_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: ServidorFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        const created = await api.create<Servidor>("servidores", payload);
        setServidores((prev) => [...prev, created]);
      } else if (editing) {
        const updated = await api.update<Servidor>("servidores", editing.server_id, payload);
        setServidores((prev) => prev.map((s) => (s.server_id === updated.server_id ? updated : s)));
      }
      setEditing(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns: DataGridColumn<Servidor>[] = useMemo(
    () => [
      { id: "server_id", header: "ID", value: (s) => s.server_id, width: 70, minWidth: 60 },
      { id: "server_nome", header: "Nome", value: (s) => s.server_nome, width: 220 },
      { id: "server_ambiente", header: "Ambiente", value: (s) => s.server_ambiente, width: 110 },
      { id: "server_familia", header: "Família", value: (s) => s.server_familia, width: 150 },
      {
        id: "server_status",
        header: "Status",
        value: (s) => s.server_status,
        width: 110,
        cell: (s) => (s.server_status ? <span className={`badge badge-${slugify(s.server_status)}`}>{s.server_status}</span> : ""),
      },
      { id: "server_finalidade", header: "Finalidade", value: (s) => s.server_finalidade, width: 220 },
    ],
    []
  );

  const filters: DataGridFilter<Servidor>[] = useMemo(
    () => [
      { id: "server_status", label: "Status", value: (s) => s.server_status ?? "" },
      { id: "server_ambiente", label: "Ambiente", value: (s) => s.server_ambiente ?? "" },
      { id: "server_familia", label: "Família", value: (s) => s.server_familia ?? "" },
    ],
    []
  );

  return (
    <div className="page">
      <StatCards
        stats={[
          {
            label: "Total de servidores",
            value: servidores.length,
            tone: "accent",
            onClick: () => setFilterValues((prev) => clearFilterKeys(prev, ["server_status", "server_ambiente"])),
            active: !filterValues.server_status && !filterValues.server_ambiente,
          },
          {
            label: "Ativos",
            value: servidores.filter((s) => s.server_status === "ATIVO").length,
            tone: "green",
            onClick: () => setFilterValues((prev) => toggleFilterValue(prev, "server_status", "ATIVO")),
            active: filterValues.server_status === "ATIVO",
          },
          {
            label: "Produção",
            value: servidores.filter((s) => s.server_ambiente === "PROD").length,
            tone: "gray",
            onClick: () => setFilterValues((prev) => toggleFilterValue(prev, "server_ambiente", "PROD")),
            active: filterValues.server_ambiente === "PROD",
          },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={servidores}
        columns={columns}
        getRowId={(s) => s.server_id}
        searchValue={(s) => `${s.server_nome} ${s.server_ambiente ?? ""} ${s.server_familia ?? ""} ${s.server_finalidade ?? ""}`}
        searchPlaceholder="Buscar por nome, ambiente, família, finalidade..."
        filters={filters}
        loading={loading}
        exportFilename="servidores"
        filterValues={filterValues}
        onFilterValuesChange={setFilterValues}
        actionsWidth={100}
        renderActions={
          podeEditar || podeExcluir
            ? (s) => (
                <div className="row-actions">
                  {podeEditar && (
                    <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing(s)}>
                      <EditIcon />
                    </button>
                  )}
                  {podeExcluir && (
                    <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDelete(s)}>
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
              + Novo servidor
            </button>
          ) : undefined
        }
      />

      {editing && (
        <ServidorForm
          servidor={editing === "new" ? null : editing}
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
