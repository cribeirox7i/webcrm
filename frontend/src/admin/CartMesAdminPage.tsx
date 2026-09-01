import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/adminClient";
import type { CartMes } from "../api/types";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "../components/DataGrid";
import { StatCards } from "../components/StatCards";
import { CartMesForm, valuesToPayload, type CartMesFormValues } from "./CartMesForm";
import { ImportarCarteiraModal } from "./ImportarCarteiraModal";
import { ImportarConsumoModal } from "./ImportarConsumoModal";
import { ChartIcon, EditIcon, TrashIcon, UploadIcon } from "../components/icons";
import { clearFilterKeys, toggleFilterValue } from "../lib/filterValues";

interface CartMesAdminPageProps {
  token: string;
  onLogout: () => void;
}

export function CartMesAdminPage({ token, onLogout }: CartMesAdminPageProps) {
  const [meses, setMeses] = useState<CartMes[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<CartMes | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [importandoPara, setImportandoPara] = useState<CartMes | null>(null);
  const [importandoConsumoPara, setImportandoConsumoPara] = useState<CartMes | null>(null);

  // Filtro do DataGrid levantado pra cá (controlado) pra os cards de StatCards poderem
  // alternar o mesmo filtro que o dropdown "Vigência ativa" já mostra.
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

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
      const res = await adminApi.list<CartMes>("cart_mes", token, { limit: 1000 });
      setMeses(res.data);
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

  async function handleDelete(cartMes: CartMes) {
    // mesma regra que o backend aplica (resource.ts) -- checar aqui evita a viagem só pra
    // voltar com erro. Excluir agora apaga em CASCATA carteira/precos_cliente/consumo_ana/
    // faturamento daquele mês (ON DELETE CASCADE, decisão do usuário), por isso só é permitido
    // no mês vigente -- excluir um mês antigo por engano exige marcá-lo como vigente antes.
    if (cartMes.cart_vigencia_ativa !== "S") {
      alert(
        `Só é possível excluir o mês com Vigência ativa = S. Edite "${cartMes.cart_ano_mes}" e marque Vigência ativa antes de excluir.`
      );
      return;
    }
    if (
      !confirm(
        `Excluir o mês "${cartMes.cart_ano_mes}" (#${cartMes.cart_mes_id})? Isto apaga em CASCATA todas as linhas de carteira, preços, consumo e faturamento desse mês. Não tem como desfazer.`
      )
    )
      return;
    try {
      await adminApi.remove("cart_mes", token, cartMes.cart_mes_id);
      setMeses((prev) => prev.filter((m) => m.cart_mes_id !== cartMes.cart_mes_id));
    } catch (err) {
      if (!handleAuthError(err)) alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(values: CartMesFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        const created = await adminApi.create<CartMes>("cart_mes", token, payload);
        setMeses((prev) => [...prev, created]);
      } else if (editing) {
        const updated = await adminApi.update<CartMes>("cart_mes", token, editing.cart_mes_id, payload);
        setMeses((prev) => prev.map((m) => (m.cart_mes_id === updated.cart_mes_id ? updated : m)));
      }
      setEditing(null);
    } catch (err) {
      if (handleAuthError(err)) return;
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const mesesOrdenados = useMemo(
    () => [...meses].sort((a, b) => b.cart_ano_mes.localeCompare(a.cart_ano_mes)),
    [meses]
  );

  const columns: DataGridColumn<CartMes>[] = useMemo(
    () => [
      { id: "cart_mes_id", header: "ID", value: (m) => m.cart_mes_id, width: 70, minWidth: 60 },
      { id: "cart_ano_mes", header: "Ano / Mês", value: (m) => m.cart_ano_mes, width: 140 },
      {
        id: "cart_vigencia_ativa",
        header: "Vigência ativa",
        value: (m) => m.cart_vigencia_ativa ?? "",
        width: 140,
        cell: (m) => (m.cart_vigencia_ativa ? <span className="badge">{m.cart_vigencia_ativa}</span> : ""),
      },
    ],
    []
  );

  const filters: DataGridFilter<CartMes>[] = useMemo(
    () => [{ id: "cart_vigencia_ativa", label: "Vigência ativa", value: (m) => m.cart_vigencia_ativa ?? "" }],
    []
  );

  return (
    <div className="page">
      <StatCards
        stats={[
          {
            label: "Meses cadastrados",
            value: meses.length,
            tone: "accent",
            onClick: () => setFilterValues((prev) => clearFilterKeys(prev, ["cart_vigencia_ativa"])),
            active: !filterValues.cart_vigencia_ativa,
          },
          {
            label: "Vigência ativa",
            value: meses.filter((m) => m.cart_vigencia_ativa === "S").length,
            tone: "green",
            onClick: () => setFilterValues((prev) => toggleFilterValue(prev, "cart_vigencia_ativa", "S")),
            active: filterValues.cart_vigencia_ativa === "S",
          },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={mesesOrdenados}
        columns={columns}
        getRowId={(m) => m.cart_mes_id}
        searchValue={(m) => m.cart_ano_mes}
        searchPlaceholder="Buscar por ano/mês..."
        filters={filters}
        loading={loading}
        exportFilename="cart_mes"
        filterValues={filterValues}
        onFilterValuesChange={setFilterValues}
        actionsWidth={180}
        renderActions={(m) => (
          <div className="row-actions">
            <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing(m)}>
              <EditIcon />
            </button>
            <button
              className="icon-btn"
              title="Importar planilha de medição para este mês"
              aria-label="Importar carteira"
              onClick={() => setImportandoPara(m)}
            >
              <UploadIcon />
            </button>
            <button
              className="icon-btn"
              title="Importar consumo analítico para este mês"
              aria-label="Importar consumo"
              onClick={() => setImportandoConsumoPara(m)}
            >
              <ChartIcon />
            </button>
            <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDelete(m)}>
              <TrashIcon />
            </button>
          </div>
        )}
        toolbarExtra={
          <button className="primary" onClick={() => setEditing("new")}>
            + Novo mês
          </button>
        }
      />

      {editing && (
        <CartMesForm
          cartMes={editing === "new" ? null : editing}
          saving={saving}
          error={formError}
          onCancel={() => {
            setEditing(null);
            setFormError(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {importandoPara && (
        <ImportarCarteiraModal
          cartMes={importandoPara}
          token={token}
          onClose={() => setImportandoPara(null)}
          onLogout={onLogout}
        />
      )}

      {importandoConsumoPara && (
        <ImportarConsumoModal
          cartMes={importandoConsumoPara}
          token={token}
          onClose={() => setImportandoConsumoPara(null)}
          onLogout={onLogout}
        />
      )}
    </div>
  );
}
