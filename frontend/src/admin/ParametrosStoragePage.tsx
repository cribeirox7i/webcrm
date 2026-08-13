import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/adminClient";
import type { ParametroStorageMenu } from "../api/adminClient";

interface ParametrosStoragePageProps {
  token: string;
  onLogout: () => void;
}

// Só os menus com upload de anexo de fato implementado (ver backend/src/routes/anexos.ts
// e propostaAnexo.ts) -- os demais menus do sistema não têm onde usar essa pasta ainda.
const MENUS_COM_UPLOAD = [
  { key: "propostas", label: "Propostas" },
  { key: "fornecedores", label: "Fornecedores (contratos/anexos)" },
];

export function ParametrosStoragePage({ token, onLogout }: ParametrosStoragePageProps) {
  const [pastas, setPastas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

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
      const rows = await adminApi.listParametrosStorage(token);
      const map: Record<string, string> = {};
      rows.forEach((r: ParametroStorageMenu) => (map[r.menu_key] = r.pasta));
      setPastas(map);
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

  const valores = useMemo(
    () => Object.fromEntries(MENUS_COM_UPLOAD.map((m) => [m.key, pastas[m.key] ?? m.key])),
    [pastas]
  );

  async function handleSalvar(menuKey: string) {
    setSavingKey(menuKey);
    setSaveError(null);
    setSavedKey(null);
    try {
      await adminApi.updateParametroStorage(token, menuKey, valores[menuKey]);
      setPastas((prev) => ({ ...prev, [menuKey]: valores[menuKey] }));
      setSavedKey(menuKey);
    } catch (err) {
      if (!handleAuthError(err)) setSaveError((err as Error).message);
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p className="page-subtitle">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Armazenamento de Arquivos</h1>
      <p className="page-subtitle">
        Pasta usada dentro do bucket do Supabase Storage pra cada menu que aceita anexo. Só o nome da
        pasta muda aqui -- cada arquivo continua indo pra uma subpasta própria do registro (cliente,
        fornecedor, proposta), essa configuração só decide o nível acima disso.
      </p>

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <div className="page" style={{ maxWidth: 600, padding: 0 }}>
        {MENUS_COM_UPLOAD.map((menu) => (
          <div className="form-row" key={menu.key}>
            <label htmlFor={`pasta-${menu.key}`}>{menu.label}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id={`pasta-${menu.key}`}
                type="text"
                value={valores[menu.key]}
                onChange={(e) => setPastas((prev) => ({ ...prev, [menu.key]: e.target.value }))}
              />
              <button disabled={savingKey === menu.key} onClick={() => handleSalvar(menu.key)}>
                {savingKey === menu.key ? "Salvando..." : "Salvar"}
              </button>
            </div>
            {savedKey === menu.key && <p className="page-subtitle">Salvo.</p>}
          </div>
        ))}
        {saveError && <p className="form-error">{saveError}</p>}
      </div>
    </div>
  );
}
