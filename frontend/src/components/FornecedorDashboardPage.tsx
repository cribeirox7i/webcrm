import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { FornContrato, FornPagadoria, Fornecedor, Pessoa } from "../api/types";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { AnexosSection } from "./AnexosSection";
import { FornContratoForm, valuesToPayload as contratoValuesToPayload } from "./FornContratoForm";
import { FornPagadoriaForm, valuesToPayload as pagamentoValuesToPayload } from "./FornPagadoriaForm";
import { usePageTitle } from "../PageTitleContext";
import { EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

function formatMoney(v: number | null): string {
  return v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
}

interface FornecedorDashboardPageProps {
  fornecedorId: number;
  onBack: () => void;
}

export function FornecedorDashboardPage({ fornecedorId, onBack }: FornecedorDashboardPageProps) {
  const permFornecedores = usePermissao("fornecedores");
  const permPagadoria = usePermissao("pagadoria");
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null);
  const [contratos, setContratos] = useState<FornContrato[]>([]);
  const [pagamentos, setPagamentos] = useState<FornPagadoria[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingContrato, setEditingContrato] = useState<FornContrato | null | "new">(null);
  const [savingContrato, setSavingContrato] = useState(false);
  const [contratoError, setContratoError] = useState<string | null>(null);

  const [editingPagamento, setEditingPagamento] = useState<FornPagadoria | null | "new">(null);
  const [savingPagamento, setSavingPagamento] = useState(false);
  const [pagamentoError, setPagamentoError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [fornecedorRes, contratosRes, pagamentosRes, pessoasRes] = await Promise.all([
        api.get<Fornecedor>("fornecedores", fornecedorId),
        api.list<FornContrato>("forn_contratos", { fornecedor_id: fornecedorId, limit: 20000 }),
        api.list<FornPagadoria>("forn_pagadoria", { fornecedor_id: fornecedorId, limit: 20000 }),
        api.list<Pessoa>("pessoas", { limit: 20000 }),
      ]);
      setFornecedor(fornecedorRes);
      setContratos(contratosRes.data);
      setPagamentos(pagamentosRes.data);
      setPessoas(pessoasRes.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fornecedorId]);

  const pessoaNomeById = useMemo(() => {
    const map = new Map<number, string>();
    pessoas.forEach((p) => map.set(p.pessoa_id, p.pessoa_nome));
    return map;
  }, [pessoas]);

  async function handleSubmitContrato(values: Parameters<typeof contratoValuesToPayload>[1]) {
    setSavingContrato(true);
    setContratoError(null);
    try {
      const payload = contratoValuesToPayload(fornecedorId, values);
      if (editingContrato === "new") {
        const created = await api.create<FornContrato>("forn_contratos", payload);
        setContratos((prev) => [...prev, created]);
      } else if (editingContrato) {
        const updated = await api.update<FornContrato>("forn_contratos", editingContrato.forn_cont_id, payload);
        setContratos((prev) => prev.map((c) => (c.forn_cont_id === updated.forn_cont_id ? updated : c)));
      }
      setEditingContrato(null);
    } catch (err) {
      setContratoError((err as Error).message);
    } finally {
      setSavingContrato(false);
    }
  }

  async function handleDeleteContrato(contrato: FornContrato) {
    if (!confirm(`Excluir o contrato #${contrato.forn_cont_id}?`)) return;
    try {
      await api.remove("forn_contratos", contrato.forn_cont_id);
      setContratos((prev) => prev.filter((c) => c.forn_cont_id !== contrato.forn_cont_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmitPagamento(values: Parameters<typeof pagamentoValuesToPayload>[0]) {
    setSavingPagamento(true);
    setPagamentoError(null);
    try {
      const payload = pagamentoValuesToPayload(values);
      if (editingPagamento === "new") {
        const created = await api.create<FornPagadoria>("forn_pagadoria", payload);
        setPagamentos((prev) => [...prev, created]);
      } else if (editingPagamento) {
        const updated = await api.update<FornPagadoria>("forn_pagadoria", editingPagamento.forn_pag_id, payload);
        setPagamentos((prev) => prev.map((p) => (p.forn_pag_id === updated.forn_pag_id ? updated : p)));
      }
      setEditingPagamento(null);
    } catch (err) {
      setPagamentoError((err as Error).message);
    } finally {
      setSavingPagamento(false);
    }
  }

  async function handleDeletePagamento(pagamento: FornPagadoria) {
    if (!confirm(`Excluir o pagamento #${pagamento.forn_pag_id}?`)) return;
    try {
      await api.remove("forn_pagadoria", pagamento.forn_pag_id);
      setPagamentos((prev) => prev.filter((p) => p.forn_pag_id !== pagamento.forn_pag_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  const contratoColumns: DataGridColumn<FornContrato>[] = useMemo(
    () => [
      { id: "forn_cont_num_contrato", header: "Número do Contrato", value: (c) => c.forn_cont_num_contrato ?? "", width: 160 },
      {
        id: "pessoa",
        header: "Responsável",
        value: (c) => (c.pessoa_id != null ? pessoaNomeById.get(c.pessoa_id) ?? "" : ""),
        width: 160,
      },
      {
        id: "forn_cont_vlr_mes",
        header: "Valor mensal",
        value: (c) => c.forn_cont_vlr_mes,
        width: 130,
        align: "right",
        cell: (c) => formatMoney(c.forn_cont_vlr_mes),
      },
      {
        id: "forn_cont_status",
        header: "Status",
        value: (c) => c.forn_cont_status ?? "",
        width: 100,
        cell: (c) => (c.forn_cont_status ? <span className={`badge badge-${c.forn_cont_status.toLowerCase()}`}>{c.forn_cont_status}</span> : ""),
      },
    ],
    [pessoaNomeById]
  );

  const pagamentoColumns: DataGridColumn<FornPagadoria>[] = useMemo(
    () => [
      { id: "forn_pag_resp", header: "Responsável", value: (p) => p.forn_pag_resp ?? "", width: 130 },
      { id: "forn_pag_tipo", header: "Tipo", value: (p) => p.forn_pag_tipo ?? "", width: 120 },
      { id: "forn_pag_subtipo", header: "Subtipo", value: (p) => p.forn_pag_tipo_detalhado ?? "", width: 130 },
      {
        id: "forn_pag_tot_liq",
        header: "Total pago (líq.)",
        value: (p) => p.forn_pag_tot_liq,
        width: 130,
        align: "right",
        cell: (p) => formatMoney(p.forn_pag_tot_liq),
      },
    ],
    []
  );

  usePageTitle(["Fornecedores", fornecedor?.fornecedor_nome ?? "..."]);

  if (loading && !fornecedor) {
    return (
      <div className="page">
        <p className="page-subtitle">Carregando...</p>
      </div>
    );
  }

  if (loadError || !fornecedor) {
    return (
      <div className="page">
        <div className="banner-error">
          Falha ao carregar fornecedor: {loadError ?? "não encontrado"} <button onClick={loadAll}>Tentar de novo</button>
        </div>
        <button onClick={onBack}>&larr; Voltar para fornecedores</button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="dashboard-header">
        <button onClick={onBack}>&larr; Voltar</button>
        <div className="dashboard-subtitle">
          {fornecedor.fornecedor_area && <span>{fornecedor.fornecedor_area}</span>}
          {fornecedor.fornecedor_cnpj && <span>CNPJ {fornecedor.fornecedor_cnpj}</span>}
        </div>
      </div>

      <StatCards
        stats={[
          { label: "Contratos", value: contratos.length, tone: "accent" },
          { label: "Contratos ativos", value: contratos.filter((c) => c.forn_cont_status === "ATIVO").length, tone: "green" },
          { label: "Pagamentos", value: pagamentos.length, tone: "accent" },
        ]}
      />

      <div className="dashboard-stack">
        <div className="dashboard-card dashboard-card-fixed">
          <div className="dashboard-card-header">
            <h3>Contratos</h3>
            {permFornecedores.podeInserir && (
              <button className="primary" onClick={() => setEditingContrato("new")}>
                + Adicionar
              </button>
            )}
          </div>
          <div className="dashboard-card-body">
            {contratos.length === 0 ? (
              <p className="dashboard-empty">Nenhum contrato cadastrado.</p>
            ) : (
              <DataGrid
                data={contratos}
                columns={contratoColumns}
                getRowId={(c) => c.forn_cont_id}
                searchValue={(c) => c.forn_cont_num_contrato ?? ""}
                exportFilename={`forn_contratos_${fornecedorId}`}
                hideToolbar
                actionsWidth={90}
                renderActions={
                  permFornecedores.podeEditar || permFornecedores.podeExcluir
                    ? (c) => (
                        <div className="row-actions">
                          {permFornecedores.podeEditar && (
                            <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditingContrato(c)}>
                              <EditIcon />
                            </button>
                          )}
                          {permFornecedores.podeExcluir && (
                            <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDeleteContrato(c)}>
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      )
                    : undefined
                }
              />
            )}
          </div>
        </div>

        <div className="dashboard-row">
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>Pagadoria</h3>
              {permPagadoria.podeInserir && (
                <button className="primary" onClick={() => setEditingPagamento("new")}>
                  + Adicionar
                </button>
              )}
            </div>
            <div className="dashboard-card-body">
              {pagamentos.length === 0 ? (
                <p className="dashboard-empty">Nenhum pagamento cadastrado.</p>
              ) : (
                <DataGrid
                  data={pagamentos}
                  columns={pagamentoColumns}
                  getRowId={(p) => p.forn_pag_id}
                  searchValue={(p) => `${p.forn_pag_resp ?? ""} ${p.forn_pag_tipo ?? ""}`}
                  exportFilename={`forn_pagadoria_${fornecedorId}`}
                  hideToolbar
                  actionsWidth={90}
                  renderActions={
                    permPagadoria.podeEditar || permPagadoria.podeExcluir
                      ? (p) => (
                          <div className="row-actions">
                            {permPagadoria.podeEditar && (
                              <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditingPagamento(p)}>
                                <EditIcon />
                              </button>
                            )}
                            {permPagadoria.podeExcluir && (
                              <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDeletePagamento(p)}>
                                <TrashIcon />
                              </button>
                            )}
                          </div>
                        )
                      : undefined
                  }
                />
              )}
            </div>
          </div>

          <AnexosSection filterKey="fornecedor_id" filterId={fornecedorId} menuKey="fornecedores" />
        </div>
      </div>

      {editingContrato && (
        <FornContratoForm
          contrato={editingContrato === "new" ? null : editingContrato}
          pessoas={pessoas}
          saving={savingContrato}
          error={contratoError}
          onCancel={() => {
            setEditingContrato(null);
            setContratoError(null);
          }}
          onSubmit={handleSubmitContrato}
        />
      )}

      {editingPagamento && (
        <FornPagadoriaForm
          pagamento={editingPagamento === "new" ? null : editingPagamento}
          fornecedorId={fornecedorId}
          fornecedorNome={fornecedor.fornecedor_nome}
          saving={savingPagamento}
          error={pagamentoError}
          onCancel={() => {
            setEditingPagamento(null);
            setPagamentoError(null);
          }}
          onSubmit={handleSubmitPagamento}
        />
      )}
    </div>
  );
}
