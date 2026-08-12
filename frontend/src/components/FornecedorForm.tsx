import { useState } from "react";
import type { Fornecedor } from "../api/types";

export interface FornecedorFormValues {
  fornecedor_nome: string;
  fornecedor_area: string;
  fornecedor_cnpj: string;
}

function toFormValues(fornecedor: Fornecedor | null): FornecedorFormValues {
  return {
    fornecedor_nome: fornecedor?.fornecedor_nome ?? "",
    fornecedor_area: fornecedor?.fornecedor_area ?? "",
    fornecedor_cnpj: fornecedor?.fornecedor_cnpj ?? "",
  };
}

export function valuesToPayload(values: FornecedorFormValues): Record<string, unknown> {
  return {
    fornecedor_nome: values.fornecedor_nome.trim(),
    fornecedor_area: values.fornecedor_area.trim() || null,
    fornecedor_cnpj: values.fornecedor_cnpj.trim() || null,
  };
}

interface FornecedorFormProps {
  fornecedor: Fornecedor | null;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: FornecedorFormValues) => void;
}

export function FornecedorForm({ fornecedor, saving, error, onCancel, onSubmit }: FornecedorFormProps) {
  const [values, setValues] = useState<FornecedorFormValues>(() => toFormValues(fornecedor));

  function set<K extends keyof FornecedorFormValues>(key: K, value: FornecedorFormValues[K]) {
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
        <h2>{fornecedor ? `Editar fornecedor #${fornecedor.fornecedor_id}` : "Novo fornecedor"}</h2>

        <div className="form-row">
          <label htmlFor="fornecedor_nome">Nome *</label>
          <input
            id="fornecedor_nome"
            required
            value={values.fornecedor_nome}
            onChange={(e) => set("fornecedor_nome", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="fornecedor_area">Área</label>
          <input
            id="fornecedor_area"
            value={values.fornecedor_area}
            onChange={(e) => set("fornecedor_area", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="fornecedor_cnpj">CNPJ</label>
          <input
            id="fornecedor_cnpj"
            value={values.fornecedor_cnpj}
            onChange={(e) => set("fornecedor_cnpj", e.target.value)}
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
