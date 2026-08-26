import { useState } from "react";
import type { Pessoa } from "../api/types";
import { SearchableSelect } from "./SearchableSelect";

export interface PessoaFormValues {
  pessoa_nome: string;
  pessoa_status: string;
  pessoa_funcao: string;
  pessoa_mail: string;
  pessoa_fone: string;
  pessoa_diretor: string;
  pessoa_ger_exec: string;
  pessoa_ger: string;
  pessoa_lider: string;
  pessoa_squad: string;
  pessoa_billable: string;
}

function toFormValues(pessoa: Pessoa | null): PessoaFormValues {
  return {
    pessoa_nome: pessoa?.pessoa_nome ?? "",
    pessoa_status: pessoa?.pessoa_status ?? "",
    pessoa_funcao: pessoa?.pessoa_funcao ?? "",
    pessoa_mail: pessoa?.pessoa_mail ?? "",
    pessoa_fone: pessoa?.pessoa_fone ?? "",
    pessoa_diretor: pessoa?.pessoa_diretor != null ? String(pessoa.pessoa_diretor) : "",
    pessoa_ger_exec: pessoa?.pessoa_ger_exec != null ? String(pessoa.pessoa_ger_exec) : "",
    pessoa_ger: pessoa?.pessoa_ger != null ? String(pessoa.pessoa_ger) : "",
    pessoa_lider: pessoa?.pessoa_lider != null ? String(pessoa.pessoa_lider) : "",
    pessoa_squad: pessoa?.pessoa_squad ?? "",
    pessoa_billable: pessoa?.pessoa_billable ?? "",
  };
}

export function valuesToPayload(values: PessoaFormValues): Record<string, unknown> {
  return {
    pessoa_nome: values.pessoa_nome.trim(),
    pessoa_status: values.pessoa_status || null,
    pessoa_funcao: values.pessoa_funcao.trim() || null,
    pessoa_mail: values.pessoa_mail.trim() || null,
    pessoa_fone: values.pessoa_fone.trim() || null,
    pessoa_diretor: values.pessoa_diretor ? Number(values.pessoa_diretor) : null,
    pessoa_ger_exec: values.pessoa_ger_exec ? Number(values.pessoa_ger_exec) : null,
    pessoa_ger: values.pessoa_ger ? Number(values.pessoa_ger) : null,
    pessoa_lider: values.pessoa_lider ? Number(values.pessoa_lider) : null,
    pessoa_squad: values.pessoa_squad.trim() || null,
    pessoa_billable: values.pessoa_billable || null,
  };
}

interface PessoaFormProps {
  pessoa: Pessoa | null;
  pessoas: Pessoa[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: PessoaFormValues) => void;
}

const STATUS = ["ATIVO", "INATIVO"];
const BILLABLE = ["SIM", "NÃO"];

export function PessoaForm({ pessoa, pessoas, saving, error, onCancel, onSubmit }: PessoaFormProps) {
  const [values, setValues] = useState<PessoaFormValues>(() => toFormValues(pessoa));

  function set<K extends keyof PessoaFormValues>(key: K, value: PessoaFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // não deixa a pessoa apontar pra si mesma na hierarquia
  const hierarquiaOptions = pessoas
    .filter((p) => p.pessoa_id !== pessoa?.pessoa_id)
    .map((p) => ({ value: String(p.pessoa_id), label: p.pessoa_nome }));

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
        <h2>{pessoa ? `Editar pessoa #${pessoa.pessoa_id}` : "Nova pessoa"}</h2>

        <div className="form-row">
          <label htmlFor="pessoa_nome">Nome *</label>
          <input
            id="pessoa_nome"
            required
            value={values.pessoa_nome}
            onChange={(e) => set("pessoa_nome", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="pessoa_funcao">Função</label>
          <input
            id="pessoa_funcao"
            value={values.pessoa_funcao}
            onChange={(e) => set("pessoa_funcao", e.target.value)}
            placeholder="ex.: GERENTE COMERCIAL, LIDER DE PROJETOS..."
          />
        </div>

        <div className="form-row">
          <label htmlFor="pessoa_status">Status</label>
          <select id="pessoa_status" value={values.pessoa_status} onChange={(e) => set("pessoa_status", e.target.value)}>
            <option value="">(nenhum)</option>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="pessoa_mail">E-mail</label>
          <input id="pessoa_mail" value={values.pessoa_mail} onChange={(e) => set("pessoa_mail", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="pessoa_fone">Telefone</label>
          <input id="pessoa_fone" value={values.pessoa_fone} onChange={(e) => set("pessoa_fone", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="pessoa_squad">Squad</label>
          <input id="pessoa_squad" value={values.pessoa_squad} onChange={(e) => set("pessoa_squad", e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="pessoa_billable">Billable</label>
          <select id="pessoa_billable" value={values.pessoa_billable} onChange={(e) => set("pessoa_billable", e.target.value)}>
            <option value="">(nenhum)</option>
            {BILLABLE.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="pessoa_diretor">Diretor</label>
          <SearchableSelect
            id="pessoa_diretor"
            options={hierarquiaOptions}
            value={values.pessoa_diretor}
            onChange={(v) => set("pessoa_diretor", v)}
            placeholder="Buscar diretor..."
          />
        </div>

        <div className="form-row">
          <label htmlFor="pessoa_ger_exec">Gerente executivo</label>
          <SearchableSelect
            id="pessoa_ger_exec"
            options={hierarquiaOptions}
            value={values.pessoa_ger_exec}
            onChange={(v) => set("pessoa_ger_exec", v)}
            placeholder="Buscar gerente executivo..."
          />
        </div>

        <div className="form-row">
          <label htmlFor="pessoa_ger">Gerente</label>
          <SearchableSelect
            id="pessoa_ger"
            options={hierarquiaOptions}
            value={values.pessoa_ger}
            onChange={(v) => set("pessoa_ger", v)}
            placeholder="Buscar gerente..."
          />
        </div>

        <div className="form-row">
          <label htmlFor="pessoa_lider">Líder</label>
          <SearchableSelect
            id="pessoa_lider"
            options={hierarquiaOptions}
            value={values.pessoa_lider}
            onChange={(v) => set("pessoa_lider", v)}
            placeholder="Buscar líder..."
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
