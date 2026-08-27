import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Produto } from "../api/types";
import { ProdutoForm, valuesToPayload, type ProdutoFormValues } from "./ProdutoForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

export function ProdutosPage() {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("produtos");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Produto | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.list<Produto>("produtos", { limit: 20000 });
      setProdutos(res.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleDelete(produto: Produto) {
    if (!confirm(`Excluir o produto "${produto.produto_nome}" (#${produto.produto_id})?`)) return;
    try {
      await api.remove("produtos", produto.produto_id);
      setProdutos((prev) => prev.filter((p) => p.produto_id !== produto.produto_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: ProdutoFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        const created = await api.create<Produto>("produtos", payload);
        setProdutos((prev) => [...prev, created]);
      } else if (editing) {
        const updated = await api.update<Produto>("produtos", editing.produto_id, payload);
        setProdutos((prev) => prev.map((p) => (p.produto_id === updated.produto_id ? updated : p)));
      }
      setEditing(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns: DataGridColumn<Produto>[] = useMemo(
    () => [
      { id: "produto_id", header: "ID", value: (p) => p.produto_id, width: 70, minWidth: 60 },
      { id: "produto_nome", header: "Nome", value: (p) => p.produto_nome, width: 240 },
      { id: "produto_detalhe", header: "Detalhe", value: (p) => p.produto_detalhe, width: 180 },
      { id: "produto_suite", header: "Suíte", value: (p) => p.produto_suite, width: 140 },
      { id: "produto_sku", header: "SKU", value: (p) => p.produto_sku, width: 120 },
      {
        id: "produto_preco",
        header: "Preço",
        value: (p) => p.produto_preco,
        width: 110,
        cell: (p) => (p.produto_preco != null ? p.produto_preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : ""),
      },
      { id: "produto_recorrencia", header: "Recorrência", value: (p) => p.produto_recorrencia, width: 130 },
    ],
    []
  );

  const filters: DataGridFilter<Produto>[] = useMemo(
    () => [
      { id: "produto_suite", label: "Suíte", value: (p) => p.produto_suite ?? "" },
      { id: "produto_recorrencia", label: "Recorrência", value: (p) => p.produto_recorrencia ?? "" },
    ],
    []
  );

  return (
    <div className="page">
      <StatCards stats={[{ label: "Total de produtos", value: produtos.length, tone: "accent" }]} />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={produtos}
        columns={columns}
        getRowId={(p) => p.produto_id}
        searchValue={(p) => `${p.produto_nome} ${p.produto_detalhe ?? ""} ${p.produto_suite ?? ""} ${p.produto_sku ?? ""}`}
        searchPlaceholder="Buscar por nome, detalhe, suíte, SKU..."
        filters={filters}
        loading={loading}
        exportFilename="produtos"
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
              + Novo produto
            </button>
          ) : undefined
        }
      />

      {editing && (
        <ProdutoForm
          produto={editing === "new" ? null : editing}
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
