import { useState } from "react";
import type { Cliente, ListUrlStatus, Produto, Servidor, Url } from "../api/types";
import { SearchableSelect } from "./SearchableSelect";

export interface UrlFormValues {
  cliente_id: string;
  url_path: string;
  server_id: string;
  produto_id: string;
  url_status: string;
  url_dt_status: string;
  url_exc: string;
  url_dt_exc: string;
  url_pasta_raiz: string;
  url_pasta_anexos: string;
  urb_bd: string;
  url_obs: string;
}

// Não existe tabela de lookup pra url_exc (só url_status tem list_url_status) -- únicos 2
// valores encontrados nos dados reais migrados da planilha, mesmo padrão do STATUS_OPTIONS
// hardcoded em CronoForm.tsx.
const EXCLUSAO_OPTIONS = ["EXCLUÍDO", "MOVER PARA S3 E EXCLUIR"];

function toFormValues(url: Url | null): UrlFormValues {
  return {
    cliente_id: url?.cliente_id != null ? String(url.cliente_id) : "",
    url_path: url?.url_path ?? "",
    server_id: url?.server_id != null ? String(url.server_id) : "",
    produto_id: url?.produto_id != null ? String(url.produto_id) : "",
    url_status: url?.url_status ?? "",
    url_dt_status: url?.url_dt_status ?? "",
    url_exc: url?.url_exc ?? "",
    url_dt_exc: url?.url_dt_exc ?? "",
    url_pasta_raiz: url?.url_pasta_raiz ?? "",
    url_pasta_anexos: url?.url_pasta_anexos ?? "",
    urb_bd: url?.urb_bd ?? "",
    url_obs: url?.url_obs ?? "",
  };
}

export function valuesToPayload(values: UrlFormValues): Record<string, unknown> {
  return {
    cliente_id: values.cliente_id ? Number(values.cliente_id) : null,
    url_path: values.url_path.trim(),
    server_id: values.server_id ? Number(values.server_id) : null,
    produto_id: values.produto_id ? Number(values.produto_id) : null,
    url_status: values.url_status || null,
    url_dt_status: values.url_dt_status || null,
    url_exc: values.url_exc || null,
    url_dt_exc: values.url_dt_exc || null,
    url_pasta_raiz: values.url_pasta_raiz.trim() || null,
    url_pasta_anexos: values.url_pasta_anexos.trim() || null,
    urb_bd: values.urb_bd.trim() || null,
    url_obs: values.url_obs.trim() || null,
  };
}

interface UrlFormProps {
  url: Url | null;
  clientes: Cliente[];
  produtos: Produto[];
  servidores: Servidor[];
  statusOptions: ListUrlStatus[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: UrlFormValues) => void;
}

export function UrlForm({
  url,
  clientes,
  produtos,
  servidores,
  statusOptions,
  saving,
  error,
  onCancel,
  onSubmit,
}: UrlFormProps) {
  const [values, setValues] = useState<UrlFormValues>(() => toFormValues(url));

  function set<K extends keyof UrlFormValues>(key: K, value: UrlFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const clienteOptions = clientes.map((c) => ({ value: String(c.cliente_id), label: c.cliente_nome }));
  const produtoOptions = produtos.map((p) => ({ value: String(p.produto_id), label: p.produto_nome }));
  const servidorOptions = servidores.map((s) => ({ value: String(s.server_id), label: s.server_nome }));
  const exclusaoOptions =
    values.url_exc && !EXCLUSAO_OPTIONS.includes(values.url_exc)
      ? [values.url_exc, ...EXCLUSAO_OPTIONS]
      : EXCLUSAO_OPTIONS;

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
        <h2>{url ? `Editar URL #${url.url_id}` : "Nova URL"}</h2>

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
          <label htmlFor="url_path">Caminho (URL) *</label>
          <input
            id="url_path"
            required
            value={values.url_path}
            onChange={(e) => set("url_path", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="produto_id">Produto</label>
          <SearchableSelect
            id="produto_id"
            options={produtoOptions}
            value={values.produto_id}
            onChange={(v) => set("produto_id", v)}
            placeholder="Buscar produto..."
          />
        </div>

        <div className="form-row">
          <label htmlFor="server_id">Servidor</label>
          <SearchableSelect
            id="server_id"
            options={servidorOptions}
            value={values.server_id}
            onChange={(v) => set("server_id", v)}
            placeholder="Buscar servidor..."
          />
        </div>

        <div className="form-row">
          <label htmlFor="url_status">Status da URL</label>
          <select id="url_status" value={values.url_status} onChange={(e) => set("url_status", e.target.value)}>
            <option value="">(nenhum)</option>
            {statusOptions.map((s) => (
              <option key={s.url_status} value={s.url_status}>
                {s.url_status}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="url_dt_status">Data status</label>
          <input
            id="url_dt_status"
            type="date"
            value={values.url_dt_status}
            onChange={(e) => set("url_dt_status", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="url_exc">Exclusão</label>
          <select id="url_exc" value={values.url_exc} onChange={(e) => set("url_exc", e.target.value)}>
            <option value="">(nenhum)</option>
            {exclusaoOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="url_dt_exc">Data exclusão</label>
          <input
            id="url_dt_exc"
            type="date"
            value={values.url_dt_exc}
            onChange={(e) => set("url_dt_exc", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="url_pasta_raiz">Pasta raiz</label>
          <input
            id="url_pasta_raiz"
            value={values.url_pasta_raiz}
            onChange={(e) => set("url_pasta_raiz", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="url_pasta_anexos">Pasta anexos</label>
          <input
            id="url_pasta_anexos"
            value={values.url_pasta_anexos}
            onChange={(e) => set("url_pasta_anexos", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="urb_bd">Banco de dados</label>
          <input id="urb_bd" value={values.urb_bd} onChange={(e) => set("urb_bd", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="url_obs">Observações</label>
          <input id="url_obs" value={values.url_obs} onChange={(e) => set("url_obs", e.target.value)} />
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
