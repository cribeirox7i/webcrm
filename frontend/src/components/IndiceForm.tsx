import { useState } from "react";
import type { IndiceEconomico } from "../api/types";

// Nomes padronizados (2026-08-28): 'IGMP'->'IGP-M', 'SALÁRIO'->'SALÁRIO MÍNIMO', + CDI/INPC.
// Mesma lista usada no dropdown "Índice de reajuste" de PrecoClienteForm.tsx.
export const INDICES_NOMES = ["IPCA", "INPC", "IGP-M", "CDI", "SALÁRIO MÍNIMO"];

export interface IndiceFormValues {
  index_nome: string;
  index_ano: string;
  index_mes: string;
  index_vlr: string;
}

function toFormValues(ie: IndiceEconomico | null): IndiceFormValues {
  const agora = new Date();
  return {
    index_nome: ie?.index_nome ?? INDICES_NOMES[0],
    index_ano: ie ? String(ie.index_ano) : String(agora.getFullYear()),
    index_mes: ie ? String(ie.index_mes) : String(agora.getMonth() + 1),
    index_vlr: ie?.index_vlr != null ? String(ie.index_vlr) : "",
  };
}

interface IndiceFormProps {
  indice: IndiceEconomico | null;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: IndiceFormValues) => void;
}

export function IndiceForm({ indice, saving, error, onCancel, onSubmit }: IndiceFormProps) {
  const editando = indice !== null;
  const [values, setValues] = useState<IndiceFormValues>(() => toFormValues(indice));

  function set<K extends keyof IndiceFormValues>(key: K, value: IndiceFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const meses = Array.from({ length: 12 }, (_, i) => i + 1);

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
        <h2>{editando ? `Editar ${indice!.index_nome} ${String(indice!.index_mes).padStart(2, "0")}/${indice!.index_ano}` : "Novo índice"}</h2>

        {editando ? (
          <>
            <div className="form-row">
              <label>Índice</label>
              <span className="badge">{values.index_nome}</span>
            </div>
            <div className="form-row">
              <label>Competência</label>
              <span className="badge">
                {String(Number(values.index_mes)).padStart(2, "0")}/{values.index_ano}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="form-row">
              <label htmlFor="index_nome">Índice</label>
              <select id="index_nome" value={values.index_nome} onChange={(e) => set("index_nome", e.target.value)}>
                {INDICES_NOMES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="index_ano">Ano</label>
              <input
                id="index_ano"
                type="number"
                min="1994"
                max="2100"
                value={values.index_ano}
                onChange={(e) => set("index_ano", e.target.value)}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="index_mes">Mês</label>
              <select id="index_mes" value={values.index_mes} onChange={(e) => set("index_mes", e.target.value)}>
                {meses.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="form-row">
          <label htmlFor="index_vlr">
            Valor {values.index_nome === "SALÁRIO MÍNIMO" ? "(R$)" : "(variação % do mês)"}
          </label>
          <input
            id="index_vlr"
            type="number"
            step="0.0001"
            value={values.index_vlr}
            onChange={(e) => set("index_vlr", e.target.value)}
            required
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
