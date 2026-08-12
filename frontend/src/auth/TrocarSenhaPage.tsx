import { useState } from "react";
import { authApi } from "../api/authApi";
import { useAuth } from "./AuthContext";
import { PasswordInput } from "../components/PasswordInput";

const MIN_SENHA_LEN = 8;

export function TrocarSenhaPage() {
  const { token, usuario, onSenhaTrocada, logout } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (novaSenha.length < MIN_SENHA_LEN) {
      setError(`A nova senha precisa ter ao menos ${MIN_SENHA_LEN} caracteres.`);
      return;
    }
    if (novaSenha !== confirmar) {
      setError("A confirmação não é igual à nova senha.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authApi.trocarSenha(token!, senhaAtual, novaSenha);
      onSenhaTrocada();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Troca de senha obrigatória</h1>
        <p className="page-subtitle">
          Olá, {usuario?.nome}. Antes de continuar, defina uma nova senha (a atual é provisória).
        </p>

        <PasswordInput value={senhaAtual} onChange={setSenhaAtual} placeholder="Senha atual (provisória)" required />
        <PasswordInput
          value={novaSenha}
          onChange={setNovaSenha}
          placeholder={`Nova senha (mín. ${MIN_SENHA_LEN} caracteres)`}
          required
        />
        <PasswordInput value={confirmar} onChange={setConfirmar} placeholder="Confirmar nova senha" required />

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Salvando..." : "Trocar senha"}
        </button>

        <button type="button" className="auth-link" onClick={logout}>
          Sair
        </button>
      </form>
    </div>
  );
}
