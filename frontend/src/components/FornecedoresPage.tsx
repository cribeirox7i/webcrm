import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Fornecedor } from "../api/types";
import { FornecedorForm, valuesToPayload, type FornecedorFormValues } from "./FornecedorForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

interface FornecedoresPageProps {
  onOpenFornecedor: (fornecedorId: number) => void;
}

export function FornecedoresPage({ onOpenFornecedor }: FornecedoresPageProps) {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("fornecedores");
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Fornecedor | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.list<Fornecedor>("fornecedores", { limit: 20000 });
      setFornecedores(res.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleDelete(fornecedor: Fornecedor) {
    if (!confirm(`Excluir o fornecedor "${fornecedor.fornecedor_nome}" (#${fornecedor.fornecedor_id})?`)) return;
    try {
      await api.remove("fornecedores", fornecedor.fornecedor_id);
      setFornecedores((prev) => prev.filter((f) => f.fornecedor_id !== fornecedor.fornecedor_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: FornecedorFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        const created = await api.create<Fornecedor>("fornecedores", payload);
        setFornecedores((prev) => [...prev, created]);
      } else if (editing) {
        const updated = await api.update<Fornecedor>("fornecedores", editing.fornecedor_id, payload);
        setFornecedores((prev) =>
          prev.map((f) => (f.fornecedor_id === updated.fornecedor_id ? updated : f))
        );
      }
      setEditing(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns: DataGridColumn<Fornecedor>[] = useMemo(
    () => [
      { id: "fornecedor_id", header: "ID", value: (f) => f.fornecedor_id, width: 70, minWidth: 60 },
      { id: "fornecedor_nome", header: "Nome", value: (f) => f.fornecedor_nome, width: 300 },
      { id: "fornecedor_area", header: "Área", value: (f) => f.fornecedor_area, width: 180 },
      { id: "fornecedor_cnpj", header: "CNPJ", value: (f) => f.fornecedor_cnpj, width: 180 },
    ],
    []
  );

  const filters: DataGridFilter<Fornecedor>[] = useMemo(
    () => [{ id: "fornecedor_area", label: "Área", value: (f) => f.fornecedor_area ?? "" }],
    []
  );

  return (
    <div className="page">
      <StatCards stats={[{ label: "Total de fornecedores", value: fornecedores.length, tone: "accent" }]} />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={fornecedores}
        columns={columns}
        getRowId={(f) => f.fornecedor_id}
        searchValue={(f) => `${f.fornecedor_nome} ${f.fornecedor_area ?? ""} ${f.fornecedor_cnpj ?? ""}`}
        searchPlaceholder="Buscar por nome, área, CNPJ..."
        filters={filters}
        loading={loading}
        exportFilename="fornecedores"
        onRowClick={(f) => onOpenFornecedor(f.fornecedor_id)}
        actionsWidth={100}
        renderActions={
          podeEditar || podeExcluir
            ? (f) => (
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  {podeEditar && (
                    <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing(f)}>
                      <EditIcon />
                    </button>
                  )}
                  {podeExcluir && (
                    <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDelete(f)}>
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
              + Novo fornecedor
            </button>
          ) : undefined
        }
      />

      {editing && (
        <FornecedorForm
          fornecedor={editing === "new" ? null : editing}
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
