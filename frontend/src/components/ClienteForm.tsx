import { useState } from "react";
import type { Cliente, GrupoEcon } from "../api/types";

/** Máscara de CNPJ alfanumérico (Receita Federal, a partir de 2026): os 12 primeiros
 * caracteres podem ser letra ou número, só os 2 dígitos verificadores no fim continuam
 * numéricos -- por isso não dá mais pra usar uma máscara só-números como antes. */
function formatCnpj(raw: string): string {
  const alnum = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const base = alnum.slice(0, 12);
  const dv = alnum.slice(12, 14).replace(/[^0-9]/g, "");
  const clean = (base + dv).slice(0, 14);
  let out = "";
  for (let i = 0; i < clean.length; i++) {
    if (i === 2 || i === 5) out += ".";
    else if (i === 8) out += "/";
    else if (i === 12) out += "-";
    out += clean[i];
  }
  return out;
}

export interface ClienteFormValues {
  cliente_nome: string;
  grp_id: string;
  cliente_cnpj: string;
  cliente_cnpj_fat: string;
  cliente_cnpj_number: string;
  cliente_dia_venc_consumo: string;
  cliente_dia_venc_carteira: string;
  cliente_cod_github: string;
  cliente_log: string;
  cliente_tip_vlr: string;
}

function toFormValues(cliente: Cliente | null): ClienteFormValues {
  return {
    cliente_nome: cliente?.cliente_nome ?? "",
    grp_id: cliente?.grp_id != null ? String(cliente.grp_id) : "",
    cliente_cnpj: cliente?.cliente_cnpj ?? "",
    cliente_cnpj_fat: cliente?.cliente_cnpj_fat ?? "",
    cliente_cnpj_number: cliente?.cliente_cnpj_number ?? "",
    cliente_dia_venc_consumo:
      cliente?.cliente_dia_venc_consumo != null ? String(cliente.cliente_dia_venc_consumo) : "",
    cliente_dia_venc_carteira:
      cliente?.cliente_dia_venc_carteira != null ? String(cliente.cliente_dia_venc_carteira) : "",
    cliente_cod_github: cliente?.cliente_cod_github ?? "",
    cliente_log: cliente?.cliente_log ?? "",
    cliente_tip_vlr: cliente?.cliente_tip_vlr ?? "",
  };
}

export function valuesToPayload(values: ClienteFormValues): Record<string, unknown> {
  return {
    cliente_nome: values.cliente_nome.trim(),
    grp_id: values.grp_id ? Number(values.grp_id) : null,
    cliente_cnpj: values.cliente_cnpj.trim() || null,
    cliente_cnpj_fat: values.cliente_cnpj_fat.trim() || null,
    cliente_cnpj_number: values.cliente_cnpj_number.trim() || null,
    cliente_dia_venc_consumo: values.cliente_dia_venc_consumo
      ? Number(values.cliente_dia_venc_consumo)
      : null,
    cliente_dia_venc_carteira: values.cliente_dia_venc_carteira
      ? Number(values.cliente_dia_venc_carteira)
      : null,
    cliente_cod_github: values.cliente_cod_github.trim() || null,
    cliente_log: values.cliente_log.trim() || null,
    cliente_tip_vlr: values.cliente_tip_vlr || null,
  };
}

interface ClienteFormProps {
  cliente: Cliente | null;
  grupos: GrupoEcon[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: ClienteFormValues) => void;
}

export function ClienteForm({ cliente, grupos, saving, error, onCancel, onSubmit }: ClienteFormProps) {
  const [values, setValues] = useState<ClienteFormValues>(() => toFormValues(cliente));

  function set<K extends keyof ClienteFormValues>(key: K, value: ClienteFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

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
        <h2>{cliente ? `Editar cliente #${cliente.cliente_id}` : "Novo cliente"}</h2>

        {cliente && (
          <>
            <div className="form-row">
              <label>Status (automático)</label>
              <span className={`badge badge-${cliente.cliente_status.toLowerCase()}`}>
                {cliente.cliente_status}
              </span>
            </div>
            <div className="form-row">
              <label>Data bloqueio (automático)</label>
              <span>{cliente.cliente_dat_bloqueio ?? "—"}</span>
            </div>
          </>
        )}

        <div className="form-row">
          <label htmlFor="cliente_nome">Nome *</label>
          <input
            id="cliente_nome"
            required
            value={values.cliente_nome}
            onChange={(e) => set("cliente_nome", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="grp_id">Grupo econômico</label>
          <select id="grp_id" value={values.grp_id} onChange={(e) => set("grp_id", e.target.value)}>
            <option value="">(nenhum)</option>
            {grupos.map((g) => (
              <option key={g.grp_id} value={g.grp_id}>
                {g.grp_nome}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="cliente_cnpj">CNPJ *</label>
          <input
            id="cliente_cnpj"
            required
            placeholder="AA.AAA.AAA/AAAA-99"
            maxLength={18}
            value={values.cliente_cnpj}
            onChange={(e) => set("cliente_cnpj", formatCnpj(e.target.value))}
          />
        </div>

        <div className="form-row">
          <label htmlFor="cliente_cnpj_fat">CNPJ faturamento</label>
          <input
            id="cliente_cnpj_fat"
            placeholder="AA.AAA.AAA/AAAA-99"
            maxLength={18}
            value={values.cliente_cnpj_fat}
            onChange={(e) => set("cliente_cnpj_fat", formatCnpj(e.target.value))}
          />
        </div>

        <div className="form-row">
          <label htmlFor="cliente_tip_vlr">Regime de faturamento</label>
          <select
            id="cliente_tip_vlr"
            value={values.cliente_tip_vlr}
            onChange={(e) => set("cliente_tip_vlr", e.target.value)}
          >
            <option value="">(nenhum)</option>
            <option value="LIQUIDO">LIQUIDO</option>
            <option value="BRUTO">BRUTO</option>
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="cliente_dia_venc_consumo">Dia venc. consumo</label>
          <input
            id="cliente_dia_venc_consumo"
            type="number"
            min={1}
            max={31}
            value={values.cliente_dia_venc_consumo}
            onChange={(e) => set("cliente_dia_venc_consumo", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="cliente_dia_venc_carteira">Dia venc. carteira</label>
          <input
            id="cliente_dia_venc_carteira"
            type="number"
            min={1}
            max={31}
            value={values.cliente_dia_venc_carteira}
            onChange={(e) => set("cliente_dia_venc_carteira", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="cliente_cod_github">Código Protheus</label>
          <input
            id="cliente_cod_github"
            value={values.cliente_cod_github}
            onChange={(e) => set("cliente_cod_github", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="cliente_log">Responsável (email)</label>
          <input
            id="cliente_log"
            value={values.cliente_log}
            onChange={(e) => set("cliente_log", e.target.value)}
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
