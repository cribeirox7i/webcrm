import { useState } from "react";
import type { Servidor } from "../api/types";

export interface ServidorFormValues {
  server_nome: string;
  server_ambiente: string;
  server_finalidade: string;
  server_mysql: string;
  server_status: string;
  server_proc: string;
  server_conteudo: string;
  server_familia: string;
}

function toFormValues(servidor: Servidor | null): ServidorFormValues {
  return {
    server_nome: servidor?.server_nome ?? "",
    server_ambiente: servidor?.server_ambiente ?? "",
    server_finalidade: servidor?.server_finalidade ?? "",
    server_mysql: servidor?.server_mysql ?? "",
    server_status: servidor?.server_status ?? "",
    server_proc: servidor?.server_proc ?? "",
    server_conteudo: servidor?.server_conteudo ?? "",
    server_familia: servidor?.server_familia ?? "",
  };
}

export function valuesToPayload(values: ServidorFormValues): Record<string, unknown> {
  return {
    server_nome: values.server_nome.trim(),
    server_ambiente: values.server_ambiente || null,
    server_finalidade: values.server_finalidade.trim() || null,
    server_mysql: values.server_mysql.trim() || null,
    server_status: values.server_status || null,
    server_proc: values.server_proc.trim() || null,
    server_conteudo: values.server_conteudo.trim() || null,
    server_familia: values.server_familia.trim() || null,
  };
}

interface ServidorFormProps {
  servidor: Servidor | null;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: ServidorFormValues) => void;
}

const AMBIENTES = ["DEV", "PROD"];
const STATUS = ["ATIVO", "INATIVO", "EXCLUÍDO"];

export function ServidorForm({ servidor, saving, error, onCancel, onSubmit }: ServidorFormProps) {
  const [values, setValues] = useState<ServidorFormValues>(() => toFormValues(servidor));

  function set<K extends keyof ServidorFormValues>(key: K, value: ServidorFormValues[K]) {
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
        <h2>{servidor ? `Editar servidor #${servidor.server_id}` : "Novo servidor"}</h2>

        <div className="form-row">
          <label htmlFor="server_nome">Nome *</label>
          <input
            id="server_nome"
            required
            value={values.server_nome}
            onChange={(e) => set("server_nome", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="server_ambiente">Ambiente</label>
          <select
            id="server_ambiente"
            value={values.server_ambiente}
            onChange={(e) => set("server_ambiente", e.target.value)}
          >
            <option value="">(nenhum)</option>
            {AMBIENTES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="server_status">Status</label>
          <select id="server_status" value={values.server_status} onChange={(e) => set("server_status", e.target.value)}>
            <option value="">(nenhum)</option>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="server_familia">Família</label>
          <input
            id="server_familia"
            value={values.server_familia}
            onChange={(e) => set("server_familia", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="server_finalidade">Finalidade</label>
          <input
            id="server_finalidade"
            value={values.server_finalidade}
            onChange={(e) => set("server_finalidade", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="server_proc">Processador</label>
          <input id="server_proc" value={values.server_proc} onChange={(e) => set("server_proc", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="server_mysql">MySQL</label>
          <input id="server_mysql" value={values.server_mysql} onChange={(e) => set("server_mysql", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="server_conteudo">Conteúdo</label>
          <input
            id="server_conteudo"
            value={values.server_conteudo}
            onChange={(e) => set("server_conteudo", e.target.value)}
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
