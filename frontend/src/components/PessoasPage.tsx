import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Pessoa } from "../api/types";
import { PessoaForm, valuesToPayload, type PessoaFormValues } from "./PessoaForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";
import { clearFilterKeys, toggleFilterValue } from "../lib/filterValues";

export function PessoasPage() {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("pessoas");
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Pessoa | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filtro do DataGrid levantado pra cá (controlado) pra os cards de StatCards poderem
  // alternar o mesmo filtro que o dropdown "Status" já mostra.
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.list<Pessoa>("pessoas", { limit: 20000 });
      setPessoas(res.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const nomeById = useMemo(() => {
    const map = new Map<number, string>();
    pessoas.forEach((p) => map.set(p.pessoa_id, p.pessoa_nome));
    return map;
  }, [pessoas]);

  function liderNome(p: Pessoa): string {
    return p.pessoa_lider != null ? nomeById.get(p.pessoa_lider) ?? "" : "";
  }

  async function handleDelete(pessoa: Pessoa) {
    if (!confirm(`Excluir a pessoa "${pessoa.pessoa_nome}" (#${pessoa.pessoa_id})?`)) return;
    try {
      await api.remove("pessoas", pessoa.pessoa_id);
      setPessoas((prev) => prev.filter((p) => p.pessoa_id !== pessoa.pessoa_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: PessoaFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        const created = await api.create<Pessoa>("pessoas", payload);
        setPessoas((prev) => [...prev, created]);
      } else if (editing) {
        const updated = await api.update<Pessoa>("pessoas", editing.pessoa_id, payload);
        setPessoas((prev) => prev.map((p) => (p.pessoa_id === updated.pessoa_id ? updated : p)));
      }
      setEditing(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns: DataGridColumn<Pessoa>[] = useMemo(
    () => [
      { id: "pessoa_id", header: "ID", value: (p) => p.pessoa_id, width: 70, minWidth: 60 },
      { id: "pessoa_nome", header: "Nome", value: (p) => p.pessoa_nome, width: 220 },
      { id: "pessoa_funcao", header: "Função", value: (p) => p.pessoa_funcao, width: 220 },
      { id: "pessoa_squad", header: "Squad", value: (p) => p.pessoa_squad, width: 140 },
      { id: "lider", header: "Líder", value: liderNome, width: 180 },
      { id: "pessoa_mail", header: "E-mail", value: (p) => p.pessoa_mail, width: 220 },
      {
        id: "pessoa_status",
        header: "Status",
        value: (p) => p.pessoa_status,
        width: 100,
        cell: (p) => (p.pessoa_status ? <span className={`badge badge-${p.pessoa_status.toLowerCase()}`}>{p.pessoa_status}</span> : ""),
      },
    ],
    [nomeById]
  );

  const filters: DataGridFilter<Pessoa>[] = useMemo(
    () => [
      { id: "pessoa_status", label: "Status", value: (p) => p.pessoa_status ?? "" },
      { id: "pessoa_squad", label: "Squad", value: (p) => p.pessoa_squad ?? "" },
      { id: "lider", label: "Líder", value: liderNome },
    ],
    [nomeById]
  );

  return (
    <div className="page">
      <StatCards
        stats={[
          {
            label: "Total de pessoas",
            value: pessoas.length,
            tone: "accent",
            onClick: () => setFilterValues((prev) => clearFilterKeys(prev, ["pessoa_status"])),
            active: !filterValues.pessoa_status,
          },
          {
            label: "Ativas",
            value: pessoas.filter((p) => p.pessoa_status === "ATIVO").length,
            tone: "green",
            onClick: () => setFilterValues((prev) => toggleFilterValue(prev, "pessoa_status", "ATIVO")),
            active: filterValues.pessoa_status === "ATIVO",
          },
          {
            label: "Inativas",
            value: pessoas.filter((p) => p.pessoa_status === "INATIVO").length,
            tone: "red",
            onClick: () => setFilterValues((prev) => toggleFilterValue(prev, "pessoa_status", "INATIVO")),
            active: filterValues.pessoa_status === "INATIVO",
          },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={pessoas}
        columns={columns}
        getRowId={(p) => p.pessoa_id}
        searchValue={(p) => `${p.pessoa_nome} ${p.pessoa_funcao ?? ""} ${p.pessoa_squad ?? ""} ${p.pessoa_mail ?? ""} ${liderNome(p)}`}
        searchPlaceholder="Buscar por nome, função, squad, e-mail, líder..."
        filters={filters}
        loading={loading}
        exportFilename="pessoas"
        filterValues={filterValues}
        onFilterValuesChange={setFilterValues}
        actionsWidth={100}
        renderActions={
          podeEditar || podeExcluir
            ? (p) => (
                <div className="row-actions">
                  {podeEditar && (
                    <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing(p)}>
                      <EditIcon />
                    </button>
                  )}
                  {podeExcluir && (
                    <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDelete(p)}>
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
              + Nova pessoa
            </button>
          ) : undefined
        }
      />

      {editing && (
        <PessoaForm
          pessoa={editing === "new" ? null : editing}
          pessoas={pessoas}
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
