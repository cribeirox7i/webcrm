import { useState } from "react";
import type { FornContrato, Pessoa } from "../api/types";
import { SearchableSelect } from "./SearchableSelect";

export interface FornContratoFormValues {
  pessoa_id: string;
  forn_cont_num_contrato: string;
  forn_cont_tipo: string;
  forn_cont_nivel: string;
  forn_cont_aloc: string;
  forn_cont_qtd_prf: string;
  forn_cont_desc: string;
  forn_cont_tip_vlr: string;
  forn_cont_vlr_mes: string;
  forn_cont_dt_ini: string;
  forn_cont_dt_fim: string;
  forn_cont_ind_reaj: string;
  forn_cont_status: string;
}

function toFormValues(c: FornContrato | null): FornContratoFormValues {
  return {
    pessoa_id: c?.pessoa_id != null ? String(c.pessoa_id) : "",
    forn_cont_num_contrato: c?.forn_cont_num_contrato ?? "",
    forn_cont_tipo: c?.forn_cont_tipo ?? "",
    forn_cont_nivel: c?.forn_cont_nivel ?? "",
    forn_cont_aloc: c?.forn_cont_aloc ?? "",
    forn_cont_qtd_prf: c?.forn_cont_qtd_prf != null ? String(c.forn_cont_qtd_prf) : "",
    forn_cont_desc: c?.forn_cont_desc ?? "",
    forn_cont_tip_vlr: c?.forn_cont_tip_vlr ?? "",
    forn_cont_vlr_mes: c?.forn_cont_vlr_mes != null ? String(c.forn_cont_vlr_mes) : "",
    forn_cont_dt_ini: c?.forn_cont_dt_ini ?? "",
    forn_cont_dt_fim: c?.forn_cont_dt_fim ?? "",
    forn_cont_ind_reaj: c?.forn_cont_ind_reaj ?? "",
    forn_cont_status: c?.forn_cont_status ?? "",
  };
}

export function valuesToPayload(fornecedorId: number, values: FornContratoFormValues): Record<string, unknown> {
  return {
    fornecedor_id: fornecedorId,
    pessoa_id: values.pessoa_id ? Number(values.pessoa_id) : null,
    forn_cont_num_contrato: values.forn_cont_num_contrato.trim() || null,
    forn_cont_tipo: values.forn_cont_tipo.trim() || null,
    forn_cont_nivel: values.forn_cont_nivel.trim() || null,
    forn_cont_aloc: values.forn_cont_aloc.trim() || null,
    forn_cont_qtd_prf: values.forn_cont_qtd_prf ? Number(values.forn_cont_qtd_prf) : null,
    forn_cont_desc: values.forn_cont_desc.trim() || null,
    forn_cont_tip_vlr: values.forn_cont_tip_vlr || null,
    forn_cont_vlr_mes: values.forn_cont_vlr_mes ? Number(values.forn_cont_vlr_mes) : null,
    forn_cont_dt_ini: values.forn_cont_dt_ini || null,
    forn_cont_dt_fim: values.forn_cont_dt_fim || null,
    forn_cont_ind_reaj: values.forn_cont_ind_reaj || null,
    forn_cont_status: values.forn_cont_status || null,
  };
}

interface FornContratoFormProps {
  contrato: FornContrato | null;
  pessoas: Pessoa[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: FornContratoFormValues) => void;
}

const TIPOS_VLR = ["BRUTO", "LIQUIDO"];
const INDICES = ["IGMP", "IPCA", "SALÁRIO"];
const STATUS = ["ATIVO", "INATIVO"];

export function FornContratoForm({ contrato, pessoas, saving, error, onCancel, onSubmit }: FornContratoFormProps) {
  const [values, setValues] = useState<FornContratoFormValues>(() => toFormValues(contrato));

  function set<K extends keyof FornContratoFormValues>(key: K, value: FornContratoFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const pessoaOptions = pessoas.map((p) => ({ value: String(p.pessoa_id), label: p.pessoa_nome }));

  return (
    <div className="modal-backdrop">
      <form
        className="modal modal-wide"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        <h2>{contrato ? `Editar contrato #${contrato.forn_cont_id}` : "Novo contrato"}</h2>

        <div className="form-row">
          <label htmlFor="forn_cont_num_contrato">Número do contrato</label>
          <input
            id="forn_cont_num_contrato"
            value={values.forn_cont_num_contrato}
            onChange={(e) => set("forn_cont_num_contrato", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="pessoa_id">Responsável</label>
          <SearchableSelect
            id="pessoa_id"
            options={pessoaOptions}
            value={values.pessoa_id}
            onChange={(v) => set("pessoa_id", v)}
            placeholder="Buscar pessoa..."
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_cont_tipo">Tipo</label>
          <input id="forn_cont_tipo" value={values.forn_cont_tipo} onChange={(e) => set("forn_cont_tipo", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="forn_cont_nivel">Nível</label>
          <input id="forn_cont_nivel" value={values.forn_cont_nivel} onChange={(e) => set("forn_cont_nivel", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="forn_cont_aloc">Alocação</label>
          <input id="forn_cont_aloc" value={values.forn_cont_aloc} onChange={(e) => set("forn_cont_aloc", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="forn_cont_qtd_prf">Qtd. profissionais</label>
          <input
            id="forn_cont_qtd_prf"
            type="number"
            value={values.forn_cont_qtd_prf}
            onChange={(e) => set("forn_cont_qtd_prf", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_cont_desc">Descrição</label>
          <input id="forn_cont_desc" value={values.forn_cont_desc} onChange={(e) => set("forn_cont_desc", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="forn_cont_tip_vlr">Regime</label>
          <select id="forn_cont_tip_vlr" value={values.forn_cont_tip_vlr} onChange={(e) => set("forn_cont_tip_vlr", e.target.value)}>
            <option value="">(nenhum)</option>
            {TIPOS_VLR.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="forn_cont_vlr_mes">Valor mensal</label>
          <input
            id="forn_cont_vlr_mes"
            type="number"
            step="0.01"
            value={values.forn_cont_vlr_mes}
            onChange={(e) => set("forn_cont_vlr_mes", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_cont_dt_ini">Início da vigência</label>
          <input id="forn_cont_dt_ini" type="date" value={values.forn_cont_dt_ini} onChange={(e) => set("forn_cont_dt_ini", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="forn_cont_dt_fim">Fim da vigência</label>
          <input id="forn_cont_dt_fim" type="date" value={values.forn_cont_dt_fim} onChange={(e) => set("forn_cont_dt_fim", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="forn_cont_ind_reaj">Índice de reajuste</label>
          <select id="forn_cont_ind_reaj" value={values.forn_cont_ind_reaj} onChange={(e) => set("forn_cont_ind_reaj", e.target.value)}>
            <option value="">(nenhum)</option>
            {INDICES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="forn_cont_status">Status</label>
          <select id="forn_cont_status" value={values.forn_cont_status} onChange={(e) => set("forn_cont_status", e.target.value)}>
            <option value="">(nenhum)</option>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
