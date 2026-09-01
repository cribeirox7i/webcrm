import { useState } from "react";
import type { CartMes } from "../api/types";

export interface CartMesFormValues {
  cart_ano_mes: string;
  cart_vigencia_ativa: string;
}

function toFormValues(cartMes: CartMes | null): CartMesFormValues {
  return {
    cart_ano_mes: cartMes?.cart_ano_mes ?? "",
    // mês novo nasce vigente por padrão (decisão do usuário) -- o backend já rebaixa todo o
    // resto pra 'N' na mesma transação quando isso acontece (resource.ts).
    cart_vigencia_ativa: cartMes?.cart_vigencia_ativa ?? "S",
  };
}

export function valuesToPayload(values: CartMesFormValues): Record<string, unknown> {
  return {
    cart_ano_mes: values.cart_ano_mes.trim(),
    cart_vigencia_ativa: values.cart_vigencia_ativa || null,
  };
}

interface CartMesFormProps {
  cartMes: CartMes | null;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: CartMesFormValues) => void;
}

export function CartMesForm({ cartMes, saving, error, onCancel, onSubmit }: CartMesFormProps) {
  const [values, setValues] = useState<CartMesFormValues>(() => toFormValues(cartMes));

  function set<K extends keyof CartMesFormValues>(key: K, value: CartMesFormValues[K]) {
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
        <h2>{cartMes ? `Editar mês #${cartMes.cart_mes_id}` : "Novo mês"}</h2>

        <div className="form-row">
          <label htmlFor="cart_ano_mes">Ano / Mês *</label>
          <input
            id="cart_ano_mes"
            required
            placeholder="2026/07"
            value={values.cart_ano_mes}
            onChange={(e) => set("cart_ano_mes", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="cart_vigencia_ativa">Vigência ativa</label>
          <select
            id="cart_vigencia_ativa"
            value={values.cart_vigencia_ativa}
            onChange={(e) => set("cart_vigencia_ativa", e.target.value)}
          >
            <option value="S">S</option>
            <option value="N">N</option>
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
