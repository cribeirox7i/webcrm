import { useState } from "react";
import { api } from "../api/client";
import type { Cliente, Proposta } from "../api/types";
import { SearchableSelect } from "./SearchableSelect";
import { DownloadIcon, TrashIcon } from "./icons";

export interface PropostaFormValues {
  cliente_id: string;
  proposta_chamado: string;
  proposta_demanda: string;
  proposta_nome: string;
  proposta_desc: string;
  proposta_hh: string;
  proposta_vlr: string;
  proposta_status: string;
}

function toFormValues(p: Proposta | null): PropostaFormValues {
  return {
    cliente_id: p?.cliente_id != null ? String(p.cliente_id) : "",
    proposta_chamado: p?.proposta_chamado != null ? String(p.proposta_chamado) : "",
    proposta_demanda: p?.proposta_demanda != null ? String(p.proposta_demanda) : "",
    proposta_nome: p?.proposta_nome ?? "",
    proposta_desc: p?.proposta_desc ?? "",
    proposta_hh: p?.proposta_hh != null ? String(p.proposta_hh) : "",
    proposta_vlr: p?.proposta_vlr != null ? String(p.proposta_vlr) : "",
    proposta_status: p?.proposta_status ?? "",
  };
}

export function valuesToPayload(values: PropostaFormValues): Record<string, unknown> {
  return {
    cliente_id: values.cliente_id ? Number(values.cliente_id) : null,
    proposta_chamado: values.proposta_chamado ? Number(values.proposta_chamado) : null,
    proposta_demanda: values.proposta_demanda ? Number(values.proposta_demanda) : null,
    proposta_nome: values.proposta_nome.trim() || null,
    proposta_desc: values.proposta_desc.trim() || null,
    proposta_hh: values.proposta_hh ? Number(values.proposta_hh) : null,
    proposta_vlr: values.proposta_vlr ? Number(values.proposta_vlr) : null,
    proposta_status: values.proposta_status || null,
  };
}

interface PropostaFormProps {
  proposta: Proposta | null;
  clientes: Cliente[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: PropostaFormValues) => void;
  /** Chamado depois que um anexo é enviado/removido, pra atualizar a linha na grid --
   * o upload/remoção acontece direto (não passa pelo submit do form de metadados). */
  onAnexoChange: (updated: Proposta) => void;
}

const STATUS = [
  "REFINAMENTO E ESTIMATIVA",
  "ESTIMAVA ENVIADA AO COMERCIAL",
  "PROPOSTA ENVIADA AO CLIENTE",
  "EM DESENVOLVIMENTO",
  "CONCLUÍDA",
  "CANCELADA",
];

export function PropostaForm({ proposta, clientes, saving, error, onCancel, onSubmit, onAnexoChange }: PropostaFormProps) {
  const [values, setValues] = useState<PropostaFormValues>(() => toFormValues(proposta));
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [anexoError, setAnexoError] = useState<string | null>(null);

  function set<K extends keyof PropostaFormValues>(key: K, value: PropostaFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const clienteOptions = clientes.map((c) => ({ value: String(c.cliente_id), label: c.cliente_nome }));

  async function handleAnexoFile(file: File) {
    if (!proposta) return;
    setUploadingAnexo(true);
    setAnexoError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const updated = await api.uploadPropostaAnexo(proposta.proposta_id, formData);
      onAnexoChange(updated);
    } catch (err) {
      setAnexoError((err as Error).message);
    } finally {
      setUploadingAnexo(false);
    }
  }

  async function handleAnexoDownload() {
    if (!proposta) return;
    try {
      const { url } = await api.downloadPropostaAnexo(proposta.proposta_id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(`Não foi possível baixar o anexo: ${(err as Error).message}`);
    }
  }

  async function handleAnexoRemove() {
    if (!proposta || !confirm("Remover o anexo desta proposta?")) return;
    setUploadingAnexo(true);
    setAnexoError(null);
    try {
      const updated = await api.removePropostaAnexo(proposta.proposta_id);
      onAnexoChange(updated);
    } catch (err) {
      setAnexoError((err as Error).message);
    } finally {
      setUploadingAnexo(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        <h2>{proposta ? `Editar proposta #${proposta.proposta_id}` : "Nova proposta"}</h2>

        <div className="form-row">
          <label htmlFor="cliente_id">Cliente *</label>
          <SearchableSelect
            id="cliente_id"
            options={clienteOptions}
            value={values.cliente_id}
            onChange={(v) => set("cliente_id", v)}
            placeholder="Buscar cliente..."
            allowEmpty={false}
          />
        </div>

        <div className="form-row">
          <label htmlFor="proposta_chamado">Chamado *</label>
          <input
            id="proposta_chamado"
            type="number"
            required
            value={values.proposta_chamado}
            onChange={(e) => set("proposta_chamado", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="proposta_demanda">Demanda *</label>
          <input
            id="proposta_demanda"
            type="number"
            required
            value={values.proposta_demanda}
            onChange={(e) => set("proposta_demanda", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="proposta_nome">Assunto *</label>
          <input
            id="proposta_nome"
            required
            value={values.proposta_nome}
            onChange={(e) => set("proposta_nome", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="proposta_desc">Descritivo *</label>
          <input
            id="proposta_desc"
            required
            value={values.proposta_desc}
            onChange={(e) => set("proposta_desc", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="proposta_hh">HH *</label>
          <input
            id="proposta_hh"
            type="number"
            step="0.1"
            required
            value={values.proposta_hh}
            onChange={(e) => set("proposta_hh", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="proposta_vlr">Valor</label>
          <input
            id="proposta_vlr"
            type="number"
            step="0.01"
            value={values.proposta_vlr}
            onChange={(e) => set("proposta_vlr", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="proposta_status">Status</label>
          <select id="proposta_status" value={values.proposta_status} onChange={(e) => set("proposta_status", e.target.value)}>
            <option value="">(nenhum)</option>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label>Anexo (PDF)</label>
          {proposta ? (
            <div className="row-actions">
              {proposta.proposta_anexo ? (
                <>
                  <button type="button" className="icon-btn" title="Baixar" aria-label="Baixar" onClick={handleAnexoDownload}>
                    <DownloadIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Remover anexo"
                    aria-label="Remover anexo"
                    disabled={uploadingAnexo}
                    onClick={handleAnexoRemove}
                  >
                    <TrashIcon />
                  </button>
                </>
              ) : (
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={uploadingAnexo}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAnexoFile(file);
                  }}
                />
              )}
              {uploadingAnexo && <span className="page-subtitle">Enviando...</span>}
            </div>
          ) : (
            <p className="page-subtitle">Salve a proposta primeiro pra poder anexar o PDF.</p>
          )}
          {anexoError && <p className="form-error">{anexoError}</p>}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
