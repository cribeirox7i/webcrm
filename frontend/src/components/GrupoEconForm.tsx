import { useState } from "react";
import type { GrupoEcon } from "../api/types";

export interface GrupoEconFormValues {
  grp_nome: string;
}

function toFormValues(grupo: GrupoEcon | null): GrupoEconFormValues {
  return { grp_nome: grupo?.grp_nome ?? "" };
}

export function valuesToPayload(values: GrupoEconFormValues): Record<string, unknown> {
  return { grp_nome: values.grp_nome.trim() };
}

interface GrupoEconFormProps {
  grupo: GrupoEcon | null;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: GrupoEconFormValues) => void;
}

export function GrupoEconForm({ grupo, saving, error, onCancel, onSubmit }: GrupoEconFormProps) {
  const [values, setValues] = useState<GrupoEconFormValues>(() => toFormValues(grupo));

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
        <h2>{grupo ? `Editar grupo econômico #${grupo.grp_id}` : "Novo grupo econômico"}</h2>

        <div className="form-row">
          <label htmlFor="grp_nome">Nome *</label>
          <input
            id="grp_nome"
            required
            value={values.grp_nome}
            onChange={(e) => setValues({ grp_nome: e.target.value })}
          />
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
