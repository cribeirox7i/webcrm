import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cliente, Proposta } from "../api/types";
import { PropostaForm, valuesToPayload, type PropostaFormValues } from "./PropostaForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { DownloadIcon, EditIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

function formatMoney(v: number | null): string {
  return v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
}

export function PropostasPage() {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("propostas");
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Proposta | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [propostasRes, clientesRes] = await Promise.all([
        api.list<Proposta>("propostas", { limit: 20000 }),
        api.list<Cliente>("clientes", { limit: 20000 }),
      ]);
      setPropostas(propostasRes.data);
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

  function clienteNome(p: Proposta): string {
    return clienteNomeById.get(p.cliente_id) ?? "";
  }

  async function handleDelete(proposta: Proposta) {
    if (!confirm(`Excluir a proposta "${proposta.proposta_nome ?? proposta.proposta_id}"?`)) return;
    try {
      await api.remove("propostas", proposta.proposta_id);
      setPropostas((prev) => prev.filter((p) => p.proposta_id !== proposta.proposta_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleDownload(proposta: Proposta) {
    try {
      const { url } = await api.downloadPropostaAnexo(proposta.proposta_id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(`Não foi possível baixar o anexo: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: PropostaFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        const created = await api.create<Proposta>("propostas", payload);
        setPropostas((prev) => [...prev, created]);
        setEditing(created);
      } else if (editing) {
        const updated = await api.update<Proposta>("propostas", editing.proposta_id, payload);
        setPropostas((prev) => prev.map((p) => (p.proposta_id === updated.proposta_id ? updated : p)));
        setEditing(updated);
      }
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleAnexoChange(updated: Proposta) {
    setPropostas((prev) => prev.map((p) => (p.proposta_id === updated.proposta_id ? updated : p)));
    setEditing(updated);
  }

  const columns: DataGridColumn<Proposta>[] = useMemo(
    () => [
      { id: "cliente", header: "Cliente", value: clienteNome, width: 220 },
      { id: "proposta_chamado", header: "Chamado", value: (p) => p.proposta_chamado, width: 100 },
      { id: "proposta_demanda", header: "Demanda", value: (p) => p.proposta_demanda, width: 100 },
      { id: "proposta_nome", header: "Assunto", value: (p) => p.proposta_nome, width: 200 },
      { id: "proposta_desc", header: "Descritivo", value: (p) => p.proposta_desc, width: 320 },
      { id: "proposta_hh", header: "HH", value: (p) => p.proposta_hh, width: 70, align: "right" },
      {
        id: "proposta_vlr",
        header: "Valor",
        value: (p) => p.proposta_vlr,
        width: 120,
        align: "right",
        cell: (p) => formatMoney(p.proposta_vlr),
      },
      {
        id: "proposta_status",
        header: "Status",
        value: (p) => p.proposta_status ?? "",
        width: 190,
        cell: (p) =>
          p.proposta_status ? <span className="badge">{p.proposta_status}</span> : "",
      },
    ],
    [clienteNomeById]
  );

  const filters: DataGridFilter<Proposta>[] = useMemo(
    () => [
      { id: "cliente", label: "Cliente", value: clienteNome },
      { id: "proposta_status", label: "Status", value: (p) => p.proposta_status ?? "" },
    ],
    [clienteNomeById]
  );

  return (
    <div className="page">
      <StatCards stats={[{ label: "Total de propostas", value: propostas.length, tone: "accent" }]} />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={propostas}
        columns={columns}
        getRowId={(p) => p.proposta_id}
        searchValue={(p) => `${clienteNome(p)} ${p.proposta_nome ?? ""} ${p.proposta_desc ?? ""}`}
        searchPlaceholder="Buscar por cliente, assunto, descritivo..."
        filters={filters}
        loading={loading}
        exportFilename="propostas"
        actionsWidth={126}
        renderActions={(p) => (
          <div className="row-actions">
            <button
              className="icon-btn"
              title="Baixar anexo"
              aria-label="Baixar anexo"
              disabled={!p.proposta_anexo}
              onClick={() => handleDownload(p)}
            >
              <DownloadIcon />
            </button>
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
        )}
        toolbarExtra={
          podeInserir ? (
            <button className="primary" onClick={() => setEditing("new")}>
              + Nova proposta
            </button>
          ) : undefined
        }
      />

      {editing && (
        <PropostaForm
          proposta={editing === "new" ? null : editing}
          clientes={clientes}
          saving={saving}
          error={formError}
          onCancel={() => {
            setEditing(null);
            setFormError(null);
          }}
          onSubmit={handleSubmit}
          onAnexoChange={handleAnexoChange}
        />
      )}
    </div>
  );
}
