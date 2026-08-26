import { useState } from "react";
import type { Cliente, PrecosCliente, Produto } from "../api/types";

export interface PrecoClienteFormValues {
  pc_vlr_franquia: string;
  pc_vlr_unit: string;
  pc_cod_index: string;
  pc_dat_niver: string;
}

function toFormValues(pc: PrecosCliente): PrecoClienteFormValues {
  return {
    pc_vlr_franquia: pc.pc_vlr_franquia != null ? String(pc.pc_vlr_franquia) : "",
    pc_vlr_unit: pc.pc_vlr_unit != null ? String(pc.pc_vlr_unit) : "",
    pc_cod_index: pc.pc_cod_index ?? "",
    pc_dat_niver: pc.pc_dat_niver ?? "",
  };
}

export function valuesToPayload(values: PrecoClienteFormValues, cartMesId: number): Record<string, unknown> {
  return {
    cart_mes_id: cartMesId,
    pc_vlr_franquia: values.pc_vlr_franquia ? Number(values.pc_vlr_franquia) : null,
    pc_vlr_unit: values.pc_vlr_unit ? Number(values.pc_vlr_unit) : null,
    pc_cod_index: values.pc_cod_index.trim() || null,
    pc_dat_niver: values.pc_dat_niver || null,
  };
}

interface PrecoClienteFormProps {
  pc: PrecosCliente;
  cartAnoMes: string;
  clientes: Cliente[];
  produtos: Produto[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: PrecoClienteFormValues) => void;
}

const INDICES = ["IGMP", "IPCA", "SALÁRIO"];

export function PrecoClienteForm({
  pc,
  cartAnoMes,
  clientes,
  produtos,
  saving,
  error,
  onCancel,
  onSubmit,
}: PrecoClienteFormProps) {
  const [values, setValues] = useState<PrecoClienteFormValues>(() => toFormValues(pc));

  function set<K extends keyof PrecoClienteFormValues>(key: K, value: PrecoClienteFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const clienteLabel = clientes.find((c) => c.cliente_id === pc.cliente_id)?.cliente_nome ?? "";
  const produto = produtos.find((p) => p.produto_id === pc.produto_id);
  const produtoLabel = produto ? `${produto.produto_nome} - ${produto.produto_detalhe ?? ""}` : "";

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
        <h2>Editar preço #{pc.pc_id}</h2>

        <div className="form-row">
          <label>Mês</label>
          <span className="badge">{cartAnoMes}</span>
        </div>

        <div className="form-row">
          <label>Cliente</label>
          <span className="badge">{clienteLabel}</span>
        </div>

        <div className="form-row">
          <label>Produto</label>
          <span className="badge">{produtoLabel}</span>
        </div>

        <div className="form-row">
          <label htmlFor="pc_vlr_franquia">Franquia (R$)</label>
          <input
            id="pc_vlr_franquia"
            type="number"
            step="0.01"
            value={values.pc_vlr_franquia}
            onChange={(e) => set("pc_vlr_franquia", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="pc_vlr_unit">Valor unitário (R$)</label>
          <input
            id="pc_vlr_unit"
            type="number"
            step="0.01"
            value={values.pc_vlr_unit}
            onChange={(e) => set("pc_vlr_unit", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="pc_cod_index">Índice de reajuste</label>
          <select id="pc_cod_index" value={values.pc_cod_index} onChange={(e) => set("pc_cod_index", e.target.value)}>
            <option value="">(nenhum)</option>
            {INDICES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="pc_dat_niver">Data de aniversário do contrato</label>
          <input
            id="pc_dat_niver"
            type="date"
            value={values.pc_dat_niver}
            onChange={(e) => set("pc_dat_niver", e.target.value)}
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
