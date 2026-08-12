import { useState } from "react";
import { adminApi } from "../api/adminClient";

interface AdminLoginPageProps {
  onLogin: (token: string) => void;
}

export function AdminLoginPage({ onLogin }: AdminLoginPageProps) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token } = await adminApi.login(pin);
      onLogin(token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-shell">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <h1>Administração</h1>
        <p className="page-subtitle">Digite o PIN de administrador para gerenciar usuários.</p>

        <input
          type="password"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
        />

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="primary" disabled={loading || !pin}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <a className="admin-login-back" href="/">
          &larr; Voltar para o CRM
        </a>
      </form>
    </div>
  );
}
