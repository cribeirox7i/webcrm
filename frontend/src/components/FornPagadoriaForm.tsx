import { useState } from "react";
import type { Fornecedor, FornPagadoria } from "../api/types";
import { SearchableSelect } from "./SearchableSelect";

export interface FornPagadoriaFormValues {
  fornecedor_id: string;
  forn_pag_resp: string;
  forn_pag_tipo: string;
  forn_pag_tipo_detalhado: string;
  forn_pag_competencia: string;
  forn_pag_dat: string;
  forn_pag_nome_prf: string;
  forn_pag_qtd: string;
  forn_pag_vlr_unit: string;
  forn_pag_tot_bruto: string;
  forn_pag_tot_liq: string;
  forn_pag_vlr_pag_cliente_bruto: string;
  forn_pag_vlr_pag_cliente_liq: string;
  forn_pag_vlr_receita_bruta: string;
  forn_pag_vlr_receita_liq: string;
  forn_pag_obs: string;
}

function toFormValues(p: FornPagadoria | null, fixedFornecedorId?: number): FornPagadoriaFormValues {
  const fornecedorId = p?.fornecedor_id ?? fixedFornecedorId;
  return {
    fornecedor_id: fornecedorId != null ? String(fornecedorId) : "",
    forn_pag_resp: p?.forn_pag_resp ?? "",
    forn_pag_tipo: p?.forn_pag_tipo ?? "",
    forn_pag_tipo_detalhado: p?.forn_pag_tipo_detalhado ?? "",
    forn_pag_competencia: p?.forn_pag_competencia ?? "",
    forn_pag_dat: p?.forn_pag_dat ?? "",
    forn_pag_nome_prf: p?.forn_pag_nome_prf ?? "",
    forn_pag_qtd: p?.forn_pag_qtd != null ? String(p.forn_pag_qtd) : "",
    forn_pag_vlr_unit: p?.forn_pag_vlr_unit != null ? String(p.forn_pag_vlr_unit) : "",
    forn_pag_tot_bruto: p?.forn_pag_tot_bruto != null ? String(p.forn_pag_tot_bruto) : "",
    forn_pag_tot_liq: p?.forn_pag_tot_liq != null ? String(p.forn_pag_tot_liq) : "",
    forn_pag_vlr_pag_cliente_bruto:
      p?.forn_pag_vlr_pag_cliente_bruto != null ? String(p.forn_pag_vlr_pag_cliente_bruto) : "",
    forn_pag_vlr_pag_cliente_liq: p?.forn_pag_vlr_pag_cliente_liq != null ? String(p.forn_pag_vlr_pag_cliente_liq) : "",
    forn_pag_vlr_receita_bruta: p?.forn_pag_vlr_receita_bruta != null ? String(p.forn_pag_vlr_receita_bruta) : "",
    forn_pag_vlr_receita_liq: p?.forn_pag_vlr_receita_liq != null ? String(p.forn_pag_vlr_receita_liq) : "",
    forn_pag_obs: p?.forn_pag_obs ?? "",
  };
}

export function valuesToPayload(values: FornPagadoriaFormValues): Record<string, unknown> {
  const num = (v: string) => (v ? Number(v) : null);
  return {
    fornecedor_id: values.fornecedor_id ? Number(values.fornecedor_id) : null,
    forn_pag_resp: values.forn_pag_resp.trim() || null,
    forn_pag_tipo: values.forn_pag_tipo.trim() || null,
    forn_pag_tipo_detalhado: values.forn_pag_tipo_detalhado.trim() || null,
    forn_pag_competencia: values.forn_pag_competencia || null,
    forn_pag_dat: values.forn_pag_dat || null,
    forn_pag_nome_prf: values.forn_pag_nome_prf.trim() || null,
    forn_pag_qtd: num(values.forn_pag_qtd),
    forn_pag_vlr_unit: num(values.forn_pag_vlr_unit),
    forn_pag_tot_bruto: num(values.forn_pag_tot_bruto),
    forn_pag_tot_liq: num(values.forn_pag_tot_liq),
    forn_pag_vlr_pag_cliente_bruto: num(values.forn_pag_vlr_pag_cliente_bruto),
    forn_pag_vlr_pag_cliente_liq: num(values.forn_pag_vlr_pag_cliente_liq),
    forn_pag_vlr_receita_bruta: num(values.forn_pag_vlr_receita_bruta),
    forn_pag_vlr_receita_liq: num(values.forn_pag_vlr_receita_liq),
    forn_pag_obs: values.forn_pag_obs.trim() || null,
  };
}

interface FornPagadoriaFormProps {
  pagamento: FornPagadoria | null;
  /** Contexto fixo (aberto de dentro do dashboard de um fornecedor) -- some pra dar lugar a
   * um seletor de fornecedor, usado quando o form abre da tela standalone de Pagadoria. */
  fornecedorId?: number;
  fornecedorNome?: string;
  fornecedores?: Fornecedor[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: FornPagadoriaFormValues) => void;
}

export function FornPagadoriaForm({
  pagamento,
  fornecedorId,
  fornecedorNome,
  fornecedores,
  saving,
  error,
  onCancel,
  onSubmit,
}: FornPagadoriaFormProps) {
  const [values, setValues] = useState<FornPagadoriaFormValues>(() => toFormValues(pagamento, fornecedorId));

  function set<K extends keyof FornPagadoriaFormValues>(key: K, value: FornPagadoriaFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const fornecedorOptions = (fornecedores ?? []).map((f) => ({ value: String(f.fornecedor_id), label: f.fornecedor_nome }));

  return (
    <div className="modal-backdrop">
      <form
        className="modal modal-wide"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        <h2>{pagamento ? `Editar pagamento #${pagamento.forn_pag_id}` : "Novo pagamento"}</h2>

        <div className="form-row">
          <label htmlFor="fornecedor_id">Fornecedor *</label>
          {fornecedorId != null ? (
            <span className="badge">{fornecedorNome}</span>
          ) : (
            <SearchableSelect
              id="fornecedor_id"
              options={fornecedorOptions}
              value={values.fornecedor_id}
              onChange={(v) => set("fornecedor_id", v)}
              placeholder="Buscar fornecedor..."
              allowEmpty={false}
            />
          )}
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_resp">Responsável</label>
          <input id="forn_pag_resp" value={values.forn_pag_resp} onChange={(e) => set("forn_pag_resp", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_tipo">Tipo</label>
          <input id="forn_pag_tipo" value={values.forn_pag_tipo} onChange={(e) => set("forn_pag_tipo", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_tipo_detalhado">Subtipo</label>
          <input
            id="forn_pag_tipo_detalhado"
            value={values.forn_pag_tipo_detalhado}
            onChange={(e) => set("forn_pag_tipo_detalhado", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_competencia">Competência</label>
          <input
            id="forn_pag_competencia"
            type="date"
            value={values.forn_pag_competencia}
            onChange={(e) => set("forn_pag_competencia", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_dat">Pagamento</label>
          <input id="forn_pag_dat" type="date" value={values.forn_pag_dat} onChange={(e) => set("forn_pag_dat", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_nome_prf">Nome do alocado</label>
          <input
            id="forn_pag_nome_prf"
            value={values.forn_pag_nome_prf}
            onChange={(e) => set("forn_pag_nome_prf", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_qtd">Quantidade</label>
          <input id="forn_pag_qtd" type="number" step="0.01" value={values.forn_pag_qtd} onChange={(e) => set("forn_pag_qtd", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_vlr_unit">Valor unitário</label>
          <input
            id="forn_pag_vlr_unit"
            type="number"
            step="0.01"
            value={values.forn_pag_vlr_unit}
            onChange={(e) => set("forn_pag_vlr_unit", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_tot_bruto">Total pago (bruto)</label>
          <input
            id="forn_pag_tot_bruto"
            type="number"
            step="0.01"
            value={values.forn_pag_tot_bruto}
            onChange={(e) => set("forn_pag_tot_bruto", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_tot_liq">Total pago (líquido)</label>
          <input
            id="forn_pag_tot_liq"
            type="number"
            step="0.01"
            value={values.forn_pag_tot_liq}
            onChange={(e) => set("forn_pag_tot_liq", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_vlr_pag_cliente_bruto">Repasse ao cliente (bruto)</label>
          <input
            id="forn_pag_vlr_pag_cliente_bruto"
            type="number"
            step="0.01"
            value={values.forn_pag_vlr_pag_cliente_bruto}
            onChange={(e) => set("forn_pag_vlr_pag_cliente_bruto", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_vlr_pag_cliente_liq">Repasse ao cliente (líquido)</label>
          <input
            id="forn_pag_vlr_pag_cliente_liq"
            type="number"
            step="0.01"
            value={values.forn_pag_vlr_pag_cliente_liq}
            onChange={(e) => set("forn_pag_vlr_pag_cliente_liq", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_vlr_receita_bruta">Receita (bruta)</label>
          <input
            id="forn_pag_vlr_receita_bruta"
            type="number"
            step="0.01"
            value={values.forn_pag_vlr_receita_bruta}
            onChange={(e) => set("forn_pag_vlr_receita_bruta", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_vlr_receita_liq">Receita (líquida)</label>
          <input
            id="forn_pag_vlr_receita_liq"
            type="number"
            step="0.01"
            value={values.forn_pag_vlr_receita_liq}
            onChange={(e) => set("forn_pag_vlr_receita_liq", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="forn_pag_obs">Observações</label>
          <input id="forn_pag_obs" value={values.forn_pag_obs} onChange={(e) => set("forn_pag_obs", e.target.value)} />
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
