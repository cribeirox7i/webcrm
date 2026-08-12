import { useState } from "react";
import type { Usuario } from "../api/types";

export interface UsuarioFormValues {
  user_nome: string;
  user_mail: string;
  user_status: string;
}

function toFormValues(usuario: Usuario | null): UsuarioFormValues {
  return {
    user_nome: usuario?.user_nome ?? "",
    user_mail: usuario?.user_mail ?? "",
    user_status: usuario?.user_status ?? "ATIVO",
  };
}

export function valuesToPayload(values: UsuarioFormValues): Record<string, unknown> {
  return {
    user_nome: values.user_nome.trim(),
    user_mail: values.user_mail.trim(),
    user_status: values.user_status || null,
  };
}

interface UsuarioFormProps {
  usuario: Usuario | null;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: UsuarioFormValues) => void;
}

const STATUS = ["ATIVO", "INATIVO"];

export function UsuarioForm({ usuario, saving, error, onCancel, onSubmit }: UsuarioFormProps) {
  const [values, setValues] = useState<UsuarioFormValues>(() => toFormValues(usuario));

  function set<K extends keyof UsuarioFormValues>(key: K, value: UsuarioFormValues[K]) {
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
        <h2>{usuario ? `Editar usuário #${usuario.user_id}` : "Novo usuário"}</h2>

        <div className="form-row">
          <label htmlFor="user_nome">Nome *</label>
          <input id="user_nome" required value={values.user_nome} onChange={(e) => set("user_nome", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="user_mail">E-mail *</label>
          <input
            id="user_mail"
            type="email"
            required
            value={values.user_mail}
            onChange={(e) => set("user_mail", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="user_status">Status</label>
          <select id="user_status" value={values.user_status} onChange={(e) => set("user_status", e.target.value)}>
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
