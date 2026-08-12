import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cliente, Portfolio, PortfolioProgresso } from "../api/types";
import { PortfolioForm, valuesToPayload, type PortfolioFormValues } from "./PortfolioForm";
import { StatCards } from "./StatCards";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";
import { CronogramaDetalhadoPage } from "./CronogramaDetalhadoPage";
import { paceDoPortfolio } from "../lib/pace";
import { gerarPdfCronograma } from "../lib/cronogramaPdf";
import { EditIcon, ExternalLinkIcon, PdfIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function formatPercent(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function statusBadgeClass(status: string): string {
  if (status === "CONCLUÍDO") return "badge-concluido";
  if (status === "CANCELADO") return "badge-cancelado";
  if (status === "ANDAMENTO") return "badge-andamento";
  return "";
}

export function PortfolioPage() {
  const { podeInserir, podeEditar } = usePermissao("projetos");
  const [portfolios, setPortfolios] = useState<PortfolioProgresso[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Portfolio | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [gerandoPdfId, setGerandoPdfId] = useState<number | null>(null);

  const [openPortId, setOpenPortId] = useState<number | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [portfoliosRes, clientesRes] = await Promise.all([
        api.list<PortfolioProgresso>("portfolios_progresso", { limit: 20000 }),
        api.list<Cliente>("clientes", { limit: 20000 }),
      ]);
      setPortfolios(portfoliosRes.data);
      setClientes(clientesRes.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const clienteById = useMemo(() => {
    const map = new Map<number, Cliente>();
    clientes.forEach((c) => map.set(c.cliente_id, c));
    return map;
  }, [clientes]);

  function clienteNome(p: Portfolio): string {
    return clienteById.get(p.cliente_id)?.cliente_nome ?? "";
  }

  function desvio(p: PortfolioProgresso): number {
    return p.port_perc_atual - p.port_perc_estim;
  }

  async function handleSubmit(values: PortfolioFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        await api.create<Portfolio>("portfolios", payload);
      } else if (editing) {
        await api.update<Portfolio>("portfolios", editing.port_id, payload);
      }
      setEditing(null);
      await loadAll();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGerarPdf(p: PortfolioProgresso) {
    setGerandoPdfId(p.port_id);
    try {
      await gerarPdfCronograma(p, clienteNome(p));
      await api.update<Portfolio>("portfolios", p.port_id, { port_pdf: (p.port_pdf ?? 0) + 1 });
      setPortfolios((prev) =>
        prev.map((port) => (port.port_id === p.port_id ? { ...port, port_pdf: (port.port_pdf ?? 0) + 1 } : port))
      );
    } catch (err) {
      alert(`Não foi possível gerar o PDF: ${(err as Error).message}`);
    } finally {
      setGerandoPdfId(null);
    }
  }

  const columns: DataGridColumn<PortfolioProgresso>[] = useMemo(
    () => [
      { id: "port_id", header: "ID", value: (p) => p.port_id, width: 60, minWidth: 50 },
      { id: "port_tipo", header: "Tipo", value: (p) => p.port_tipo, width: 120 },
      { id: "cliente", header: "Cliente", value: clienteNome, width: 220 },
      { id: "port_nome", header: "Projeto", value: (p) => p.port_nome, width: 180 },
      { id: "port_pm", header: "PM", value: (p) => p.port_pm, width: 150 },
      { id: "port_inicio", header: "Início", value: (p) => p.port_inicio, width: 100, align: "center", cell: (p) => formatDate(p.port_inicio) },
      { id: "port_fim", header: "Término", value: (p) => p.port_fim, width: 100, align: "center", cell: (p) => formatDate(p.port_fim) },
      { id: "port_perc_atual", header: "% Atual", value: (p) => p.port_perc_atual, width: 90, align: "right", cell: (p) => formatPercent(p.port_perc_atual) },
      { id: "port_perc_estim", header: "% Estimado", value: (p) => p.port_perc_estim, width: 100, align: "right", cell: (p) => formatPercent(p.port_perc_estim) },
      { id: "port_perc_desv", header: "% Desvio", value: desvio, width: 90, align: "right", cell: (p) => formatPercent(desvio(p)) },
      {
        id: "port_status",
        header: "Status",
        value: (p) => p.port_status,
        width: 140,
        cell: (p) => (p.port_status ? <span className={`badge ${statusBadgeClass(p.port_status)}`}>{p.port_status}</span> : ""),
      },
      {
        id: "pace",
        header: "Pace",
        value: (p) => paceDoPortfolio(p.port_status, desvio(p)).label,
        width: 110,
        cell: (p) => {
          const pace = paceDoPortfolio(p.port_status, desvio(p));
          return (
            <>
              <span className={`pace-dot pace-dot-${pace.color}`} />
              {pace.label}
            </>
          );
        },
      },
    ],
    [clienteById]
  );

  const filters: DataGridFilter<PortfolioProgresso>[] = useMemo(
    () => [
      { id: "port_status", label: "Status", value: (p) => p.port_status ?? "" },
      { id: "port_tipo", label: "Tipo", value: (p) => p.port_tipo ?? "" },
      { id: "port_pm", label: "PM", value: (p) => p.port_pm ?? "" },
    ],
    []
  );

  if (openPortId != null) {
    const portfolio = portfolios.find((p) => p.port_id === openPortId);
    if (portfolio) {
      return (
        <CronogramaDetalhadoPage
          portfolio={portfolio}
          clienteNome={clienteNome(portfolio)}
          onBack={() => setOpenPortId(null)}
        />
      );
    }
    return (
      <div className="page">
        <button onClick={() => setOpenPortId(null)}>&larr; Voltar</button>
      </div>
    );
  }

  return (
    <div className="page">
      <StatCards
        stats={[
          { label: "Total de projetos", value: portfolios.length, tone: "accent" },
          { label: "Em andamento", value: portfolios.filter((p) => p.port_status === "ANDAMENTO").length, tone: "green" },
          { label: "Concluídos", value: portfolios.filter((p) => p.port_status === "CONCLUÍDO").length, tone: "gray" },
          { label: "Cancelados", value: portfolios.filter((p) => p.port_status === "CANCELADO").length, tone: "red" },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={portfolios}
        columns={columns}
        getRowId={(p) => p.port_id}
        searchValue={(p) => `${p.port_nome ?? ""} ${clienteNome(p)} ${p.port_pm ?? ""}`}
        searchPlaceholder="Buscar por projeto, cliente ou PM..."
        filters={filters}
        defaultFilterValues={{ port_status: "ANDAMENTO" }}
        loading={loading}
        exportFilename="portfolio_completo"
        actionsWidth={140}
        onRowClick={(p) => setOpenPortId(p.port_id)}
        renderActions={(p) => (
          <div className="row-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="icon-btn"
              title="Abrir pasta do projeto"
              aria-label="Abrir pasta do projeto"
              disabled={!p.port_diretorio}
              onClick={() => window.open(p.port_diretorio!, "_blank", "noopener,noreferrer")}
            >
              <ExternalLinkIcon />
            </button>
            {podeEditar && (
              <button className="icon-btn" title="Editar projeto" aria-label="Editar projeto" onClick={() => setEditing(p)}>
                <EditIcon />
              </button>
            )}
            <button
              className="icon-btn"
              title="Gerar PDF do cronograma"
              aria-label="Gerar PDF do cronograma"
              disabled={gerandoPdfId === p.port_id}
              onClick={() => handleGerarPdf(p)}
            >
              <PdfIcon />
            </button>
          </div>
        )}
        toolbarExtra={
          podeInserir ? (
            <button className="primary" onClick={() => setEditing("new")}>
              + Adicionar
            </button>
          ) : undefined
        }
      />

      {editing && (
        <PortfolioForm
          portfolio={editing === "new" ? null : editing}
          clientes={clientes}
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
