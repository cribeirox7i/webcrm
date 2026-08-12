import { useEffect, useState } from "react";
import { adminApi } from "../api/adminClient";
import type { ParametrosGerais } from "../api/types";

interface ParametrosGeraisPageProps {
  token: string;
  onLogout: () => void;
}

export function ParametrosGeraisPage({ token, onLogout }: ParametrosGeraisPageProps) {
  const [logoEscuroUrl, setLogoEscuroUrl] = useState("");
  const [logoClaroUrl, setLogoClaroUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

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
      const params = await adminApi.getOne<ParametrosGerais>("parametros_gerais", token, 1);
      setLogoEscuroUrl(params.param_logo_escuro_url ?? "");
      setLogoClaroUrl(params.param_logo_claro_url ?? "");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);
    try {
      await adminApi.update<ParametrosGerais>("parametros_gerais", token, 1, {
        param_logo_escuro_url: logoEscuroUrl.trim() || null,
        param_logo_claro_url: logoClaroUrl.trim() || null,
      });
      setSavedOk(true);
    } catch (err) {
      if (handleAuthError(err)) return;
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
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
      <h1>Parâmetros Gerais</h1>
      <p className="page-subtitle">
        URLs de imagem usadas na marca do sistema. Precisam ser links públicos e acessíveis pelo navegador (ex.:
        Cloud Storage, Drive com compartilhamento público).
      </p>

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <form className="page" style={{ maxWidth: 600, padding: 0 }} onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="logo_escuro_url">Logo para fundo escuro (barra de título do app)</label>
          <input
            id="logo_escuro_url"
            type="url"
            placeholder="https://.../logo-fundo-escuro.png"
            value={logoEscuroUrl}
            onChange={(e) => setLogoEscuroUrl(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="logo_claro_url">Logo para fundo claro (capa dos PDFs)</label>
          <input
            id="logo_claro_url"
            type="url"
            placeholder="https://.../logo-fundo-claro.png"
            value={logoClaroUrl}
            onChange={(e) => setLogoClaroUrl(e.target.value)}
          />
        </div>

        {saveError && <p className="form-error">{saveError}</p>}
        {savedOk && <p className="page-subtitle">Salvo.</p>}

        <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
