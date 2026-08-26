import { useState } from "react";
import type { Crono, ListRespCrono } from "../api/types";

export interface CronoFormValues {
  crono_atividade: string;
  crono_tipo: string; // 'A' | 'T'
  crono_grupo: string;
  crono_topico: string;
  crono_inicio: string;
  crono_fim: string;
  crono_replan: string;
  crono_perc_atual: string; // 0-100 no formulário; convertido pra fração (0-1) no payload
  crono_status: string;
  resp_id: string;
  crono_demanda_1: string;
  crono_demanda_2: string;
  crono_demanda_3: string;
}

function toFormValues(cr: Crono | null): CronoFormValues {
  return {
    crono_atividade: cr?.crono_atividade ?? "",
    crono_tipo: cr?.crono_tipo ?? "T",
    crono_grupo: cr?.crono_grupo != null ? String(cr.crono_grupo) : "0",
    crono_topico: cr?.crono_topico != null ? String(cr.crono_topico) : "0",
    crono_inicio: cr?.crono_inicio ?? "",
    crono_fim: cr?.crono_fim ?? "",
    crono_replan: cr?.crono_replan ?? "",
    crono_perc_atual: cr?.crono_perc_atual != null ? String(Math.round(cr.crono_perc_atual * 100)) : "0",
    crono_status: cr?.crono_status ?? "",
    resp_id: cr?.resp_id != null ? String(cr.resp_id) : "",
    crono_demanda_1: cr?.crono_demanda_1 ?? "",
    crono_demanda_2: cr?.crono_demanda_2 ?? "",
    crono_demanda_3: cr?.crono_demanda_3 ?? "",
  };
}

export function valuesToPayload(values: CronoFormValues, portId: number): Record<string, unknown> {
  // Atividade tipo "A" (agregação, ex.: grupo 3 resume 3.1/3.2/3.3) é só um cabeçalho de grupo --
  // segundo o usuário, "agregadora só tem tipo e código de grupo". Início/Término/% Atual já
  // eram recalculados pela view (`crono_calculado`, ver views.pg.sql) a partir do MIN/MAX/AVG das
  // atividades do grupo, então o valor bruto salvo aqui nunca é lido de volta. Tópico/Status/
  // Responsável/Demandas são conceitos de atividade individual (tipo T), sem uso nem exibição
  // agregada em nenhuma view -- não fazem sentido pedidos pro cabeçalho do grupo. Gravar `null`
  // em vez do que o formulário mostrar (ou já mostrou antes desta leva) evita dado morto/
  // enganoso na tabela.
  const ehAgregacao = values.crono_tipo === "A";
  return {
    port_id: portId,
    crono_atividade: values.crono_atividade.trim(),
    crono_tipo: values.crono_tipo,
    crono_grupo: values.crono_grupo ? Number(values.crono_grupo) : null,
    crono_topico: ehAgregacao ? null : values.crono_topico ? Number(values.crono_topico) : null,
    crono_inicio: ehAgregacao ? null : values.crono_inicio || null,
    crono_fim: ehAgregacao ? null : values.crono_fim || null,
    crono_replan: ehAgregacao ? null : values.crono_replan || null,
    crono_perc_atual: ehAgregacao ? null : (values.crono_perc_atual ? Number(values.crono_perc_atual) / 100 : 0),
    crono_status: ehAgregacao ? null : values.crono_status || null,
    resp_id: ehAgregacao ? null : values.resp_id ? Number(values.resp_id) : null,
    crono_demanda_1: ehAgregacao ? null : values.crono_demanda_1.trim() || null,
    crono_demanda_2: ehAgregacao ? null : values.crono_demanda_2.trim() || null,
    crono_demanda_3: ehAgregacao ? null : values.crono_demanda_3.trim() || null,
  };
}

interface CronoFormProps {
  crono: Crono | null;
  respostaveis: ListRespCrono[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: CronoFormValues) => void;
}

const STATUS_OPTIONS = ["A FAZER", "EM ANDAMENTO", "HOMOLOGAÇÃO", "CONCLUÍDO", "SUSPENSO", "IMPEDIDO", "CANCELADO"];

export function CronoForm({ crono, respostaveis, saving, error, onCancel, onSubmit }: CronoFormProps) {
  const [values, setValues] = useState<CronoFormValues>(() => toFormValues(crono));
  const ehAgregacao = values.crono_tipo === "A";

  function set<K extends keyof CronoFormValues>(key: K, value: CronoFormValues[K]) {
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
        <h2>{crono ? `Editar atividade #${crono.crono_id}` : "Nova atividade"}</h2>

        <div className="form-row">
          <label htmlFor="crono_atividade">Atividade *</label>
          <input
            id="crono_atividade"
            required
            value={values.crono_atividade}
            onChange={(e) => set("crono_atividade", e.target.value)}
          />
        </div>

        <div className="form-row">
          <label>Tipo</label>
          <div className="toggle-group">
            {(["A", "T"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={values.crono_tipo === t ? "toggle-active" : ""}
                onClick={() => set("crono_tipo", t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="crono_grupo">Grupo *</label>
          <input
            id="crono_grupo"
            type="number"
            required
            min={0}
            value={values.crono_grupo}
            onChange={(e) => set("crono_grupo", e.target.value)}
          />
        </div>

        {ehAgregacao ? (
          // Tipo A = agregação (ex.: grupo 3 resume as atividades 3.1, 3.2, 3.3...), só um
          // cabeçalho de grupo -- confirmado pelo usuário: "agregadora só tem tipo e código de
          // grupo". Tópico, Início/Término/% Atual, Status, Responsável e Demandas são conceito
          // de atividade individual (tipo T); pra tipo A, os 3 primeiros já eram recalculados
          // pela view (ver comentário em `valuesToPayload`) e os outros 4 não têm uso nem
          // exibição agregada em nenhuma view. Todos vão como null no payload.
          <p className="form-hint">
            Início, Término e % Atual são calculados automaticamente a partir das atividades do
            grupo {values.crono_grupo || "?"} (menor início, maior término, média de % atual).
            Tópico, Status, Responsável e Demandas não se aplicam a uma agregação.
          </p>
        ) : (
          <>
            <div className="form-row">
              <label htmlFor="crono_topico">Tópico *</label>
              <input
                id="crono_topico"
                type="number"
                required
                min={0}
                value={values.crono_topico}
                onChange={(e) => set("crono_topico", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label htmlFor="crono_inicio">Início *</label>
              <input
                id="crono_inicio"
                type="date"
                required
                value={values.crono_inicio}
                onChange={(e) => set("crono_inicio", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label htmlFor="crono_fim">Término *</label>
              <input
                id="crono_fim"
                type="date"
                required
                value={values.crono_fim}
                onChange={(e) => set("crono_fim", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label htmlFor="crono_replan">Replan</label>
              <input id="crono_replan" type="date" value={values.crono_replan} onChange={(e) => set("crono_replan", e.target.value)} />
            </div>

            <div className="form-row">
              <label htmlFor="crono_perc_atual">% Atual *</label>
              <input
                id="crono_perc_atual"
                type="number"
                required
                min={0}
                max={100}
                value={values.crono_perc_atual}
                onChange={(e) => set("crono_perc_atual", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label htmlFor="crono_status">Status *</label>
              <select
                id="crono_status"
                required
                value={values.crono_status}
                onChange={(e) => set("crono_status", e.target.value)}
              >
                <option value="">(nenhum)</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="resp_id">Responsável</label>
              <select id="resp_id" value={values.resp_id} onChange={(e) => set("resp_id", e.target.value)}>
                <option value="">(nenhum)</option>
                {respostaveis.map((r) => (
                  <option key={r.resp_id} value={r.resp_id}>
                    {r.resp_nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="crono_demanda_1">Demanda 1</label>
              <input
                id="crono_demanda_1"
                placeholder="http://"
                value={values.crono_demanda_1}
                onChange={(e) => set("crono_demanda_1", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label htmlFor="crono_demanda_2">Demanda 2</label>
              <input
                id="crono_demanda_2"
                placeholder="http://"
                value={values.crono_demanda_2}
                onChange={(e) => set("crono_demanda_2", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label htmlFor="crono_demanda_3">Demanda 3</label>
              <input
                id="crono_demanda_3"
                placeholder="http://"
                value={values.crono_demanda_3}
                onChange={(e) => set("crono_demanda_3", e.target.value)}
              />
            </div>
          </>
        )}

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
