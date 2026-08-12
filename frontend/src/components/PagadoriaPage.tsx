import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Fornecedor, FornPagadoria } from "../api/types";
import { FornPagadoriaForm, valuesToPayload, type FornPagadoriaFormValues } from "./FornPagadoriaForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

function formatMoney(v: number | null): string {
  return v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
}

export function PagadoriaPage() {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("pagadoria");
  const [pagamentos, setPagamentos] = useState<FornPagadoria[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<FornPagadoria | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [pagamentosRes, fornecedoresRes] = await Promise.all([
        api.list<FornPagadoria>("forn_pagadoria", { limit: 20000 }),
        api.list<Fornecedor>("fornecedores", { limit: 20000 }),
      ]);
      setPagamentos(pagamentosRes.data);
      setFornecedores(fornecedoresRes.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const fornecedorNomeById = useMemo(() => {
    const map = new Map<number, string>();
    fornecedores.forEach((f) => map.set(f.fornecedor_id, f.fornecedor_nome));
    return map;
  }, [fornecedores]);

  function fornecedorNome(p: FornPagadoria): string {
    return fornecedorNomeById.get(p.fornecedor_id) ?? "";
  }

  async function handleDelete(pagamento: FornPagadoria) {
    if (!confirm(`Excluir o pagamento #${pagamento.forn_pag_id}?`)) return;
    try {
      await api.remove("forn_pagadoria", pagamento.forn_pag_id);
      setPagamentos((prev) => prev.filter((p) => p.forn_pag_id !== pagamento.forn_pag_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: FornPagadoriaFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        const created = await api.create<FornPagadoria>("forn_pagadoria", payload);
        setPagamentos((prev) => [...prev, created]);
      } else if (editing) {
        const updated = await api.update<FornPagadoria>("forn_pagadoria", editing.forn_pag_id, payload);
        setPagamentos((prev) => prev.map((p) => (p.forn_pag_id === updated.forn_pag_id ? updated : p)));
      }
      setEditing(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns: DataGridColumn<FornPagadoria>[] = useMemo(
    () => [
      { id: "forn_pag_id", header: "ID", value: (p) => p.forn_pag_id, width: 60, minWidth: 50 },
      { id: "fornecedor", header: "Fornecedor", value: fornecedorNome, width: 240 },
      { id: "forn_pag_resp", header: "Responsável", value: (p) => p.forn_pag_resp, width: 130 },
      { id: "forn_pag_tipo", header: "Tipo", value: (p) => p.forn_pag_tipo, width: 140 },
      { id: "forn_pag_tipo_detalhado", header: "Subtipo", value: (p) => p.forn_pag_tipo_detalhado, width: 140 },
      { id: "forn_pag_competencia", header: "Competência", value: (p) => p.forn_pag_competencia, width: 110, align: "center" },
      { id: "forn_pag_dat", header: "Pagamento", value: (p) => p.forn_pag_dat, width: 110, align: "center" },
      { id: "forn_pag_nome_prf", header: "Alocado", value: (p) => p.forn_pag_nome_prf, width: 160 },
      {
        id: "forn_pag_tot_liq",
        header: "Total pago (líq.)",
        value: (p) => p.forn_pag_tot_liq,
        width: 140,
        align: "right",
        cell: (p) => formatMoney(p.forn_pag_tot_liq),
      },
      {
        id: "forn_pag_tot_bruto",
        header: "Total pago (bruto)",
        value: (p) => p.forn_pag_tot_bruto,
        width: 140,
        align: "right",
        cell: (p) => formatMoney(p.forn_pag_tot_bruto),
      },
    ],
    [fornecedorNomeById]
  );

  const filters: DataGridFilter<FornPagadoria>[] = useMemo(
    () => [
      { id: "fornecedor", label: "Fornecedor", value: fornecedorNome },
      { id: "forn_pag_tipo", label: "Tipo", value: (p) => p.forn_pag_tipo ?? "" },
      { id: "forn_pag_competencia", label: "Competência", value: (p) => p.forn_pag_competencia ?? "" },
    ],
    [fornecedorNomeById]
  );

  return (
    <div className="page">
      <StatCards stats={[{ label: "Total de pagamentos", value: pagamentos.length, tone: "accent" }]} />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={pagamentos}
        columns={columns}
        getRowId={(p) => p.forn_pag_id}
        searchValue={(p) => `${fornecedorNome(p)} ${p.forn_pag_resp ?? ""} ${p.forn_pag_tipo ?? ""} ${p.forn_pag_nome_prf ?? ""}`}
        searchPlaceholder="Buscar por fornecedor, responsável, tipo, alocado..."
        filters={filters}
        loading={loading}
        exportFilename="pagadoria"
        actionsWidth={90}
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
              + Novo pagamento
            </button>
          ) : undefined
        }
      />

      {editing && (
        <FornPagadoriaForm
          pagamento={editing === "new" ? null : editing}
          fornecedores={fornecedores}
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
