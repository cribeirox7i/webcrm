import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { IndiceCalculado, IndiceEconomico } from "../api/types";
import { IndiceForm, type IndiceFormValues } from "./IndiceForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";
import { clearFilterKeys, toggleFilterValue } from "../lib/filterValues";

const MESES_PT = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function rowKey(i: { index_nome: string; index_ano: number; index_mes: number }): string {
  return `${i.index_nome}|${i.index_ano}|${i.index_mes}`;
}

// index_var_mes / index_acum_12m vêm da view já em fração (0.0042 = 0,42%).
function formatPct(v: number | null): string {
  if (v == null) return "";
  return (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

function formatVlr(v: number | null): string {
  return v != null ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "";
}

export function IndicesPage() {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("indices");
  const [indices, setIndices] = useState<IndiceCalculado[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<IndiceEconomico | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.list<IndiceCalculado>("indices_calculados", { limit: 20000 });
      setIndices(res.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleDelete(i: IndiceCalculado) {
    const comp = `${String(i.index_mes).padStart(2, "0")}/${i.index_ano}`;
    if (!confirm(`Excluir o índice ${i.index_nome} de ${comp}?`)) return;
    try {
      await api.removeIndice(i.index_nome, i.index_ano, i.index_mes);
      setIndices((prev) => prev.filter((x) => rowKey(x) !== rowKey(i)));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: IndiceFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const nome = values.index_nome;
      const ano = Number(values.index_ano);
      const mes = Number(values.index_mes);
      const vlr = values.index_vlr === "" ? null : Number(values.index_vlr);
      await api.upsertIndice<IndiceEconomico>(nome, ano, mes, { index_vlr: vlr });
      setEditing(null);
      // a view recalcula variação/acumulado -- mais simples recarregar do que remontar na mão
      await loadAll();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const ordenados = useMemo(
    () =>
      [...indices].sort(
        (a, b) =>
          a.index_nome.localeCompare(b.index_nome) ||
          b.index_ano - a.index_ano ||
          b.index_mes - a.index_mes
      ),
    [indices]
  );

  const nomes = useMemo(
    () => [...new Set(indices.map((i) => i.index_nome))].sort((a, b) => a.localeCompare(b)),
    [indices]
  );

  const columns: DataGridColumn<IndiceCalculado>[] = useMemo(
    () => [
      { id: "index_nome", header: "Índice", value: (i) => i.index_nome, width: 150 },
      { id: "index_ano", header: "Ano", value: (i) => i.index_ano, width: 80, align: "center" },
      {
        id: "index_mes",
        header: "Mês",
        value: (i) => i.index_mes,
        width: 80,
        align: "center",
        cell: (i) => MESES_PT[i.index_mes] ?? i.index_mes,
      },
      {
        id: "index_vlr",
        header: "Valor",
        value: (i) => i.index_vlr,
        width: 120,
        align: "right",
        cell: (i) => formatVlr(i.index_vlr),
      },
      {
        id: "index_var_mes",
        header: "Variação no mês",
        value: (i) => i.index_var_mes,
        width: 130,
        align: "right",
        cell: (i) => formatPct(i.index_var_mes),
      },
      {
        id: "index_acum_12m",
        header: "Acumulado 12m",
        value: (i) => i.index_acum_12m,
        width: 130,
        align: "right",
        cell: (i) => formatPct(i.index_acum_12m),
      },
    ],
    []
  );

  const filters: DataGridFilter<IndiceCalculado>[] = useMemo(
    () => [{ id: "index_nome", label: "Índice", value: (i) => i.index_nome }],
    []
  );

  return (
    <div className="page">
      <StatCards
        stats={[
          {
            label: "Registros",
            value: indices.length,
            tone: "accent",
            onClick: () => setFilterValues((prev) => clearFilterKeys(prev, ["index_nome"])),
            active: !filterValues.index_nome,
          },
          ...nomes.map((n) => ({
            label: n,
            value: indices.filter((i) => i.index_nome === n).length,
            tone: "gray" as const,
            onClick: () => setFilterValues((prev) => toggleFilterValue(prev, "index_nome", n)),
            active: filterValues.index_nome === n,
          })),
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={ordenados}
        columns={columns}
        getRowId={rowKey}
        searchValue={(i) => `${i.index_nome} ${i.index_ano} ${i.index_mes}`}
        searchPlaceholder="Buscar por índice, ano, mês..."
        filters={filters}
        filterValues={filterValues}
        onFilterValuesChange={setFilterValues}
        loading={loading}
        exportFilename="indices"
        actionsWidth={100}
        renderActions={
          podeEditar || podeExcluir
            ? (i) => (
                <div className="row-actions">
                  {podeEditar && (
                    <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing(i)}>
                      <EditIcon />
                    </button>
                  )}
                  {podeExcluir && (
                    <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDelete(i)}>
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
              + Novo índice
            </button>
          ) : undefined
        }
      />

      {editing && (
        <IndiceForm
          indice={editing === "new" ? null : editing}
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
