import { useEffect, useState } from "react";
import { authApi } from "../api/authApi";
import { useAuth } from "./AuthContext";
import { PasswordInput } from "../components/PasswordInput";

const MIN_SENHA_LEN = 8;

export function DefinirSenhaPage() {
  const { applySessao } = useAuth();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [convite, setConvite] = useState<{ nome: string; email: string } | "invalido" | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    if (!token) {
      setConvite("invalido");
      return;
    }
    authApi
      .convite(token)
      .then(setConvite)
      .catch(() => setConvite("invalido"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (novaSenha.length < MIN_SENHA_LEN) {
      setError(`A senha precisa ter ao menos ${MIN_SENHA_LEN} caracteres.`);
      return;
    }
    if (novaSenha !== confirmar) {
      setError("A confirmação não é igual à senha.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.definirSenha(token, novaSenha);
      applySessao(res.token, res.usuario, res.mustChangePassword);
      setConcluido(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (convite === null) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="page-subtitle">Carregando...</p>
        </div>
      </div>
    );
  }

  if (convite === "invalido") {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Link inválido</h1>
          <p className="page-subtitle">
            Este link de convite não existe, já foi usado ou expirou. Peça ao administrador para gerar um novo.
          </p>
          <a className="auth-link" href="/">
            &larr; Voltar para o CRM
          </a>
        </div>
      </div>
    );
  }

  if (concluido) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Senha definida!</h1>
          <p className="page-subtitle">Entrando no WebCRM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Bem-vindo(a)!</h1>
        <p className="page-subtitle">
          {convite.nome}, defina a senha da sua conta ({convite.email}) para acessar o WebCRM.
        </p>

        <PasswordInput
          value={novaSenha}
          onChange={setNovaSenha}
          placeholder={`Senha (mín. ${MIN_SENHA_LEN} caracteres)`}
          required
        />
        <PasswordInput value={confirmar} onChange={setConfirmar} placeholder="Confirmar senha" required />

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Salvando..." : "Definir senha e entrar"}
        </button>
      </form>
    </div>
  );
}
