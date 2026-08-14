import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { GrupoEcon } from "../api/types";
import { GrupoEconForm, valuesToPayload, type GrupoEconFormValues } from "./GrupoEconForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

export function GruposEconPage() {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("grupos_econ");
  const [grupos, setGrupos] = useState<GrupoEcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<GrupoEcon | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.list<GrupoEcon>("grupos_econ", { limit: 20000 });
      setGrupos(res.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleDelete(grupo: GrupoEcon) {
    if (!confirm(`Excluir o grupo econômico "${grupo.grp_nome}" (#${grupo.grp_id})?`)) return;
    try {
      await api.remove("grupos_econ", grupo.grp_id);
      setGrupos((prev) => prev.filter((g) => g.grp_id !== grupo.grp_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: GrupoEconFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        const created = await api.create<GrupoEcon>("grupos_econ", payload);
        setGrupos((prev) => [...prev, created]);
      } else if (editing) {
        const updated = await api.update<GrupoEcon>("grupos_econ", editing.grp_id, payload);
        setGrupos((prev) => prev.map((g) => (g.grp_id === updated.grp_id ? updated : g)));
      }
      setEditing(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns: DataGridColumn<GrupoEcon>[] = useMemo(
    () => [
      { id: "grp_id", header: "ID", value: (g) => g.grp_id, width: 80, minWidth: 60 },
      { id: "grp_nome", header: "Nome", value: (g) => g.grp_nome, width: 320 },
    ],
    []
  );

  return (
    <div className="page">
      <StatCards stats={[{ label: "Total de grupos econômicos", value: grupos.length, tone: "accent" }]} />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={grupos}
        columns={columns}
        getRowId={(g) => g.grp_id}
        searchValue={(g) => g.grp_nome}
        searchPlaceholder="Buscar por nome..."
        loading={loading}
        exportFilename="grupos_economicos"
        actionsWidth={100}
        renderActions={
          podeEditar || podeExcluir
            ? (g) => (
                <div className="row-actions">
                  {podeEditar && (
                    <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing(g)}>
                      <EditIcon />
                    </button>
                  )}
                  {podeExcluir && (
                    <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDelete(g)}>
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
              + Novo grupo econômico
            </button>
          ) : undefined
        }
      />

      {editing && (
        <GrupoEconForm
          grupo={editing === "new" ? null : editing}
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
