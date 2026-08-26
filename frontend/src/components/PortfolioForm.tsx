import { useState } from "react";
import type { Cliente, Portfolio } from "../api/types";
import { SearchableSelect } from "./SearchableSelect";

export interface PortfolioFormValues {
  cliente_id: string;
  port_tipo: string;
  port_nome: string;
  port_pm: string;
  port_diretorio: string;
  port_status: string;
}

function toFormValues(port: Portfolio | null): PortfolioFormValues {
  return {
    cliente_id: port?.cliente_id != null ? String(port.cliente_id) : "",
    port_tipo: port?.port_tipo ?? "",
    port_nome: port?.port_nome ?? "",
    port_pm: port?.port_pm ?? "",
    port_diretorio: port?.port_diretorio ?? "",
    port_status: port?.port_status ?? "",
  };
}

export function valuesToPayload(values: PortfolioFormValues): Record<string, unknown> {
  return {
    cliente_id: values.cliente_id ? Number(values.cliente_id) : null,
    port_tipo: values.port_tipo || null,
    port_nome: values.port_nome.trim() || null,
    port_pm: values.port_pm.trim() || null,
    port_diretorio: values.port_diretorio.trim() || null,
    port_status: values.port_status || null,
  };
}

interface PortfolioFormProps {
  portfolio: Portfolio | null;
  clientes: Cliente[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: PortfolioFormValues) => void;
}

const TIPOS = ["MIGRAÇÃO", "CAPEX", "IMPLANTAÇÃO", "EVOLUÇÃO"];
const STATUS = ["ANDAMENTO", "CONCLUÍDO", "CANCELADO"];

export function PortfolioForm({ portfolio, clientes, saving, error, onCancel, onSubmit }: PortfolioFormProps) {
  const [values, setValues] = useState<PortfolioFormValues>(() => toFormValues(portfolio));

  function set<K extends keyof PortfolioFormValues>(key: K, value: PortfolioFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const clienteOptions = clientes.map((c) => ({ value: String(c.cliente_id), label: c.cliente_nome }));

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
        <h2>{portfolio ? `Editar projeto #${portfolio.port_id}` : "Novo projeto"}</h2>

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
          <label htmlFor="port_tipo">Tipo</label>
          <select id="port_tipo" value={values.port_tipo} onChange={(e) => set("port_tipo", e.target.value)}>
            <option value="">(nenhum)</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="port_nome">Projeto *</label>
          <input id="port_nome" required value={values.port_nome} onChange={(e) => set("port_nome", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="port_pm">PM</label>
          <input id="port_pm" value={values.port_pm} onChange={(e) => set("port_pm", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="port_diretorio">Diretório (pasta)</label>
          <input
            id="port_diretorio"
            placeholder="https://drive.google.com/..."
            value={values.port_diretorio}
            onChange={(e) => set("port_diretorio", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="port_status">Status</label>
          <select id="port_status" value={values.port_status} onChange={(e) => set("port_status", e.target.value)}>
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
