import { useState } from "react";
import type { Cliente, Contato } from "../api/types";
import { SearchableSelect } from "./SearchableSelect";

export interface ContatoFormValues {
  cliente_id: string;
  contato_nome: string;
  contato_mail: string;
  contato_fone: string;
  contato_status: string;
}

function toFormValues(contato: Contato | null): ContatoFormValues {
  return {
    cliente_id: contato?.cliente_id != null ? String(contato.cliente_id) : "",
    contato_nome: contato?.contato_nome ?? "",
    contato_mail: contato?.contato_mail ?? "",
    contato_fone: contato?.contato_fone ?? "",
    contato_status: contato?.contato_status ?? "",
  };
}

export function valuesToPayload(values: ContatoFormValues): Record<string, unknown> {
  return {
    cliente_id: values.cliente_id ? Number(values.cliente_id) : null,
    contato_nome: values.contato_nome.trim(),
    contato_mail: values.contato_mail.trim() || null,
    contato_fone: values.contato_fone.trim() || null,
    contato_status: values.contato_status || null,
  };
}

interface ContatoFormProps {
  contato: Contato | null;
  clientes: Cliente[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: ContatoFormValues) => void;
}

const STATUS = ["ATIVO", "INATIVO"];

export function ContatoForm({ contato, clientes, saving, error, onCancel, onSubmit }: ContatoFormProps) {
  const [values, setValues] = useState<ContatoFormValues>(() => toFormValues(contato));

  function set<K extends keyof ContatoFormValues>(key: K, value: ContatoFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const clienteOptions = clientes.map((c) => ({ value: String(c.cliente_id), label: c.cliente_nome }));

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
        <h2>{contato ? `Editar contato #${contato.contato_id}` : "Novo contato"}</h2>

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
          <label htmlFor="contato_nome">Nome *</label>
          <input
            id="contato_nome"
            required
            value={values.contato_nome}
            onChange={(e) => set("contato_nome", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="contato_mail">E-mail</label>
          <input id="contato_mail" value={values.contato_mail} onChange={(e) => set("contato_mail", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="contato_fone">Telefone</label>
          <input id="contato_fone" value={values.contato_fone} onChange={(e) => set("contato_fone", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="contato_status">Status</label>
          <select id="contato_status" value={values.contato_status} onChange={(e) => set("contato_status", e.target.value)}>
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
