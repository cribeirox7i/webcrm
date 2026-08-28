import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/adminClient";
import type { IndiceCalculado } from "../api/types";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "../components/DataGrid";

interface IndicesSyncPageProps {
  token: string;
  onLogout: () => void;
}

type Resumo = Awaited<ReturnType<typeof adminApi.sincronizarIndices>>;

const MESES_PT = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatPct(v: number | null): string {
  if (v == null) return "";
  return (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}
function formatVlr(v: number | null): string {
  return v != null ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "";
}

export function IndicesSyncPage({ token, onLogout }: IndicesSyncPageProps) {
  const [indices, setIndices] = useState<IndiceCalculado[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);

  function handleAuthError(err: unknown): boolean {
    if ((err as Error).message === "não autenticado") {
      onLogout();
      return true;
    }
    return false;
  }

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await adminApi.list<IndiceCalculado>("indices_calculados", token, { limit: 20000 });
      setIndices(res.data);
    } catch (err) {
      if (!handleAuthError(err)) setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSync() {
    setSincronizando(true);
    setSyncError(null);
    try {
      const r = await adminApi.sincronizarIndices(token);
      setResumo(r);
      await loadAll();
    } catch (err) {
      if (!handleAuthError(err)) setSyncError((err as Error).message);
    } finally {
      setSincronizando(false);
    }
  }

  const ordenados = useMemo(
    () =>
      [...indices].sort(
        (a, b) =>
          a.index_nome.localeCompare(b.index_nome) ||
          b.index_ano - a.index_ano ||
          b.index_mes - a.index_mes
      ),
    [indices]
  );

  const columns: DataGridColumn<IndiceCalculado>[] = useMemo(
    () => [
      { id: "index_nome", header: "Índice", value: (i) => i.index_nome, width: 150 },
      { id: "index_ano", header: "Ano", value: (i) => i.index_ano, width: 80, align: "center" },
      {
        id: "index_mes",
        header: "Mês",
        value: (i) => i.index_mes,
        width: 80,
        align: "center",
        cell: (i) => MESES_PT[i.index_mes] ?? i.index_mes,
      },
      { id: "index_vlr", header: "Valor", value: (i) => i.index_vlr, width: 120, align: "right", cell: (i) => formatVlr(i.index_vlr) },
      {
        id: "index_var_mes",
        header: "Variação no mês",
        value: (i) => i.index_var_mes,
        width: 130,
        align: "right",
        cell: (i) => formatPct(i.index_var_mes),
      },
    ],
    []
  );

  const filters: DataGridFilter<IndiceCalculado>[] = useMemo(
    () => [{ id: "index_nome", label: "Índice", value: (i) => i.index_nome }],
    []
  );

  return (
    <div className="page">
      <h1>Índices Econômicos</h1>
      <p className="page-subtitle">
        Atualiza a tabela de índices (IPCA, INPC, IGP-M, CDI, salário mínimo) a partir da API pública
        do Banco Central do Brasil (SGS). Faz upsert dos últimos anos -- valores já existentes são
        sobrescritos com o oficial, os que faltam são inseridos. Rodar de novo é seguro.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <button className="primary" onClick={handleSync} disabled={sincronizando}>
          {sincronizando ? "Atualizando..." : "Atualizar agora (Banco Central)"}
        </button>
        {resumo && (
          <span className="page-subtitle">
            Última atualização: {new Date(resumo.atualizadoEm).toLocaleString("pt-BR")}
          </span>
        )}
      </div>

      {syncError && <p className="form-error">{syncError}</p>}

      {resumo && (
        <table className="mini-table" style={{ maxWidth: 560, marginBottom: 20 }}>
          <thead>
            <tr>
              <th>Índice</th>
              <th>Série SGS</th>
              <th>Meses gravados</th>
              <th>Último mês</th>
              <th>Último valor</th>
            </tr>
          </thead>
          <tbody>
            {resumo.indices.map((r) => (
              <tr key={r.nome}>
                <td>{r.nome}</td>
                <td>{r.serie}</td>
                <td>{r.mesesGravados}</td>
                <td>{r.ultimoMes ?? ""}</td>
                <td>{r.ultimoValor ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={ordenados}
        columns={columns}
        getRowId={(i) => `${i.index_nome}|${i.index_ano}|${i.index_mes}`}
        searchValue={(i) => `${i.index_nome} ${i.index_ano} ${i.index_mes}`}
        searchPlaceholder="Buscar por índice, ano, mês..."
        filters={filters}
        loading={loading}
        exportFilename="indices"
      />
    </div>
  );
}
