import { useState } from "react";
import type { FaturamentoDetalhe } from "../api/types";

export interface FaturamentoFormValues {
  fat_num_nfe: string;
  fat_num_rps: string;
  fat_obs: string;
}

function toFormValues(f: FaturamentoDetalhe): FaturamentoFormValues {
  return {
    fat_num_nfe: f.fat_num_nfe ?? "",
    fat_num_rps: f.fat_num_rps ?? "",
    fat_obs: f.fat_obs ?? "",
  };
}

export function valuesToPayload(values: FaturamentoFormValues): Record<string, unknown> {
  return {
    fat_num_nfe: values.fat_num_nfe.trim() || null,
    fat_num_rps: values.fat_num_rps.trim() || null,
    fat_obs: values.fat_obs.trim() || null,
  };
}

interface FaturamentoFormProps {
  faturamento: FaturamentoDetalhe;
  clienteNome: string;
  cartAnoMes: string;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: FaturamentoFormValues) => void;
}

export function FaturamentoForm({
  faturamento,
  clienteNome,
  cartAnoMes,
  saving,
  error,
  onCancel,
  onSubmit,
}: FaturamentoFormProps) {
  const [values, setValues] = useState<FaturamentoFormValues>(() => toFormValues(faturamento));

  function set<K extends keyof FaturamentoFormValues>(key: K, value: FaturamentoFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        <h2>Editar faturamento #{faturamento.fat_id}</h2>

        <div className="form-row">
          <label>Mês</label>
          <span className="badge">{cartAnoMes}</span>
        </div>

        <div className="form-row">
          <label>Cliente</label>
          <span className="badge">{clienteNome}</span>
        </div>

        <div className="form-row">
          <label htmlFor="fat_num_nfe">Número NFE</label>
          <input id="fat_num_nfe" value={values.fat_num_nfe} onChange={(e) => set("fat_num_nfe", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="fat_num_rps">Número RPS</label>
          <input id="fat_num_rps" value={values.fat_num_rps} onChange={(e) => set("fat_num_rps", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="fat_obs">Observações</label>
          <textarea id="fat_obs" value={values.fat_obs} onChange={(e) => set("fat_obs", e.target.value)} />
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
