import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Crono, CronoCalculado, ListRespCrono, PortfolioProgresso } from "../api/types";
import { CronoForm, valuesToPayload, type CronoFormValues } from "./CronoForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { usePageTitle } from "../PageTitleContext";
import { corDesvio } from "../lib/pace";
import { gerarPdfCronograma } from "../lib/cronogramaPdf";
import { EditIcon, ExternalLinkIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function formatPercent(v: number | null): string {
  return v != null ? `${(v * 100).toFixed(0)}%` : "";
}

interface CronogramaDetalhadoPageProps {
  portfolio: PortfolioProgresso;
  clienteNome: string;
  onBack: () => void;
}

export function CronogramaDetalhadoPage({ portfolio, clienteNome, onBack }: CronogramaDetalhadoPageProps) {
  const { podeInserir, podeEditar, podeExcluir } = usePermissao("projetos");
  const [crono, setCrono] = useState<CronoCalculado[]>([]);
  const [respostaveis, setRespostaveis] = useState<ListRespCrono[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Crono | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [salvandoPdf, setSalvandoPdf] = useState(false);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [cronoRes, respRes] = await Promise.all([
        api.list<CronoCalculado>("crono_calculado", { port_id: portfolio.port_id, limit: 5000 }),
        api.list<ListRespCrono>("list_resp_crono", { limit: 200 }),
      ]);
      setCrono(cronoRes.data);
      setRespostaveis(respRes.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio.port_id]);

  const gruposDisponiveis = useMemo(
    () =>
      crono
        // crono_grupo é obrigatório no formulário pra tipo A, mas o tipo (`number | null`)
        // permite null -- filtra fora por segurança (evita opção de grupo sem número no
        // seletor, ou key duplicada se mais de uma linha tiver null).
        .filter((c) => c.crono_tipo === "A" && c.crono_grupo != null)
        .sort((a, b) => (a.crono_grupo ?? 0) - (b.crono_grupo ?? 0)),
    [crono]
  );

  const cronoOrdenado = useMemo(
    () =>
      [...crono].sort((a, b) => {
        const grupoDiff = (a.crono_grupo ?? 0) - (b.crono_grupo ?? 0);
        if (grupoDiff !== 0) return grupoDiff;
        return (a.crono_topico ?? 0) - (b.crono_topico ?? 0);
      }),
    [crono]
  );

  const respNomeById = useMemo(() => {
    const map = new Map<number, string>();
    respostaveis.forEach((r) => map.set(r.resp_id, r.resp_nome));
    return map;
  }, [respostaveis]);

  async function handleDelete(cr: Crono) {
    if (cr.crono_tipo === "A" && crono.some((c) => c.crono_id !== cr.crono_id && c.crono_grupo === cr.crono_grupo)) {
      alert(
        `Não é possível excluir "${cr.crono_atividade}" (${cr.crono_grp_tpc}) -- existem atividades do grupo ${cr.crono_grupo} associadas a ela. Exclua-as primeiro.`
      );
      return;
    }
    if (!confirm(`Excluir a atividade "${cr.crono_atividade}" (#${cr.crono_id})?`)) return;
    try {
      await api.remove("crono", cr.crono_id);
      setCrono((prev) => prev.filter((c) => c.crono_id !== cr.crono_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: CronoFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values, portfolio.port_id);
      if (editing === "new") {
        await api.create<Crono>("crono", payload);
      } else if (editing) {
        await api.update<Crono>("crono", editing.crono_id, payload);
      }
      setEditing(null);
      await loadAll();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleExportPdf() {
    if (salvandoPdf) return;
    setSalvandoPdf(true);
    try {
      await gerarPdfCronograma(portfolio, clienteNome);
      await api.update("portfolios", portfolio.port_id, { port_pdf: (portfolio.port_pdf ?? 0) + 1 });
    } catch (err) {
      alert(`Não foi possível gerar o PDF: ${(err as Error).message}`);
    } finally {
      setSalvandoPdf(false);
    }
  }

  const columns: DataGridColumn<CronoCalculado>[] = useMemo(
    () => [
      { id: "crono_grp_tpc", header: "#", value: (c) => c.crono_grp_tpc, width: 60, minWidth: 50 },
      { id: "crono_atividade", header: "Atividade", value: (c) => c.crono_atividade, width: 280 },
      { id: "crono_inicio_calc", header: "Início", value: (c) => c.crono_inicio_calc, width: 95, align: "center", cell: (c) => formatDate(c.crono_inicio_calc) },
      { id: "crono_fim_calc", header: "Término", value: (c) => c.crono_fim_calc, width: 95, align: "center", cell: (c) => formatDate(c.crono_fim_calc) },
      { id: "crono_replan", header: "Replan", value: (c) => c.crono_replan, width: 95, align: "center", cell: (c) => formatDate(c.crono_replan) },
      { id: "crono_perc_atual_calc", header: "% Atual", value: (c) => c.crono_perc_atual_calc, width: 80, align: "right", cell: (c) => formatPercent(c.crono_perc_atual_calc) },
      { id: "crono_perc_esperado", header: "% Esperado", value: (c) => c.crono_perc_esperado, width: 90, align: "right", cell: (c) => formatPercent(c.crono_perc_esperado) },
      {
        id: "perc_desvio",
        header: "% Desvio",
        value: (c) => c.crono_perc_atual_calc - c.crono_perc_esperado,
        width: 85,
        align: "right",
        cell: (c) => formatPercent(c.crono_perc_atual_calc - c.crono_perc_esperado),
      },
      {
        id: "crono_status",
        header: "Status",
        value: (c) => c.crono_status,
        width: 150,
        cell: (c) => (
          <>
            <span className={`pace-dot pace-dot-${corDesvio(c.crono_perc_atual_calc - c.crono_perc_esperado)}`} />
            {c.crono_status ?? ""}
          </>
        ),
      },
      {
        id: "resp_id",
        header: "Responsável",
        value: (c) => (c.resp_id != null ? respNomeById.get(c.resp_id) ?? "" : ""),
        width: 120,
      },
    ],
    [respNomeById]
  );

  const podeAdicionar = portfolio.port_status !== "CONCLUÍDO" && portfolio.port_status !== "CANCELADO";

  usePageTitle(["Projetos", "Cronograma Detalhado"]);

  return (
    <div className="page">
      <div className="dashboard-header">
        <button onClick={onBack}>&larr; Voltar</button>
      </div>

      <StatCards
        stats={[
          { label: "Projeto", value: portfolio.port_nome ?? "", tone: "accent" },
          { label: "Cliente", value: clienteNome, tone: "gray" },
          { label: "% Atual", value: formatPercent(portfolio.port_perc_atual), tone: "green" },
          { label: "% Estimado", value: formatPercent(portfolio.port_perc_estim), tone: "gray" },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={cronoOrdenado}
        columns={columns}
        getRowId={(c) => c.crono_id}
        searchValue={(c) => c.crono_atividade ?? ""}
        searchPlaceholder="Buscar por atividade..."
        loading={loading}
        exportFilename={`cronograma_${portfolio.port_id}`}
        actionsWidth={210}
        rowClassName={(c) => (c.crono_tipo === "A" ? "row-grupo" : undefined)}
        onExportPdf={handleExportPdf}
        renderActions={(c) => (
          <div className="row-actions">
            {[c.crono_demanda_1, c.crono_demanda_2, c.crono_demanda_3].map(
              (url, i) =>
                url && (
                  <button
                    key={i}
                    className="icon-btn"
                    title={`Demanda ${i + 1}`}
                    aria-label={`Demanda ${i + 1}`}
                    onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLinkIcon />
                  </button>
                )
            )}
            {podeEditar && (
              <button className="icon-btn" title="Editar atividade" aria-label="Editar atividade" onClick={() => setEditing(c)}>
                <EditIcon />
              </button>
            )}
            {podeExcluir && (
              <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDelete(c)}>
                <TrashIcon />
              </button>
            )}
          </div>
        )}
        toolbarExtra={
          podeInserir ? (
            <button
              className="primary"
              onClick={() => setEditing("new")}
              disabled={!podeAdicionar}
              title={podeAdicionar ? undefined : "Projeto concluído ou cancelado -- não é possível incluir novas atividades"}
            >
              + Adicionar
            </button>
          ) : undefined
        }
      />

      {editing && (
        <CronoForm
          crono={editing === "new" ? null : editing}
          respostaveis={respostaveis}
          gruposDisponiveis={gruposDisponiveis}
          saving={saving}
          error={formError}
          onCancel={() => {
            setEditing(null);
            setFormError(null);
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
