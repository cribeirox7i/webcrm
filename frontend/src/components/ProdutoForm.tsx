import { useState } from "react";
import type { Produto } from "../api/types";

export interface ProdutoFormValues {
  produto_nome: string;
  produto_area: string;
  produto_detalhe: string;
  produto_suite: string;
  produto_tip_apuracao: string;
  produto_sku: string;
  produto_franquia: string;
  produto_grupo: string;
  produto_preco: string;
  produto_recorrencia: string;
  produto_regra_apuracao: string;
}

function toFormValues(produto: Produto | null): ProdutoFormValues {
  return {
    produto_nome: produto?.produto_nome ?? "",
    produto_area: produto?.produto_area ?? "",
    produto_detalhe: produto?.produto_detalhe ?? "",
    produto_suite: produto?.produto_suite ?? "",
    produto_tip_apuracao: produto?.produto_tip_apuracao ?? "",
    produto_sku: produto?.produto_sku ?? "",
    produto_franquia: produto?.produto_franquia ?? "",
    produto_grupo: produto?.produto_grupo != null ? String(produto.produto_grupo) : "",
    produto_preco: produto?.produto_preco != null ? String(produto.produto_preco) : "",
    produto_recorrencia: produto?.produto_recorrencia ?? "",
    produto_regra_apuracao: produto?.produto_regra_apuracao ?? "",
  };
}

export function valuesToPayload(values: ProdutoFormValues): Record<string, unknown> {
  return {
    produto_nome: values.produto_nome.trim(),
    produto_area: values.produto_area.trim() || null,
    produto_detalhe: values.produto_detalhe.trim() || null,
    produto_suite: values.produto_suite.trim() || null,
    produto_tip_apuracao: values.produto_tip_apuracao.trim() || null,
    produto_sku: values.produto_sku.trim() || null,
    produto_franquia: values.produto_franquia.trim() || null,
    produto_grupo: values.produto_grupo ? Number(values.produto_grupo) : null,
    produto_preco: values.produto_preco ? Number(values.produto_preco) : null,
    produto_recorrencia: values.produto_recorrencia.trim() || null,
    produto_regra_apuracao: values.produto_regra_apuracao.trim() || null,
  };
}

interface ProdutoFormProps {
  produto: Produto | null;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: ProdutoFormValues) => void;
}

export function ProdutoForm({ produto, saving, error, onCancel, onSubmit }: ProdutoFormProps) {
  const [values, setValues] = useState<ProdutoFormValues>(() => toFormValues(produto));

  function set<K extends keyof ProdutoFormValues>(key: K, value: ProdutoFormValues[K]) {
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
        <h2>{produto ? `Editar produto #${produto.produto_id}` : "Novo produto"}</h2>

        <div className="form-row">
          <label htmlFor="produto_nome">Nome *</label>
          <input
            id="produto_nome"
            required
            value={values.produto_nome}
            onChange={(e) => set("produto_nome", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="produto_area">Área</label>
          <input id="produto_area" value={values.produto_area} onChange={(e) => set("produto_area", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="produto_suite">Suíte</label>
          <input id="produto_suite" value={values.produto_suite} onChange={(e) => set("produto_suite", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="produto_detalhe">Detalhe</label>
          <input
            id="produto_detalhe"
            value={values.produto_detalhe}
            onChange={(e) => set("produto_detalhe", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="produto_sku">SKU</label>
          <input id="produto_sku" value={values.produto_sku} onChange={(e) => set("produto_sku", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="produto_tip_apuracao">Tipo de apuração</label>
          <input
            id="produto_tip_apuracao"
            value={values.produto_tip_apuracao}
            onChange={(e) => set("produto_tip_apuracao", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="produto_regra_apuracao">Regra de apuração</label>
          <input
            id="produto_regra_apuracao"
            value={values.produto_regra_apuracao}
            onChange={(e) => set("produto_regra_apuracao", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="produto_franquia">Franquia</label>
          <input
            id="produto_franquia"
            value={values.produto_franquia}
            onChange={(e) => set("produto_franquia", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="produto_grupo">Grupo (franquia agrupada)</label>
          <input
            id="produto_grupo"
            type="number"
            value={values.produto_grupo}
            onChange={(e) => set("produto_grupo", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="produto_preco">Preço</label>
          <input
            id="produto_preco"
            type="number"
            step="0.01"
            value={values.produto_preco}
            onChange={(e) => set("produto_preco", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="produto_recorrencia">Recorrência</label>
          <input
            id="produto_recorrencia"
            value={values.produto_recorrencia}
            onChange={(e) => set("produto_recorrencia", e.target.value)}
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
