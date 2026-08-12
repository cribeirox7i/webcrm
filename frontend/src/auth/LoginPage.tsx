import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { authApi } from "../api/authApi";
import { PasswordInput } from "../components/PasswordInput";
import { getParametrosGerais } from "../lib/parametros";
import loginBg from "../assets/login-bg.png";
import evertecLogo from "../assets/evertec-logo.png";

export function LoginPage() {
  const { login } = useAuth();
  const [modo, setModo] = useState<"login" | "esqueci">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoEsqueci, setAvisoEsqueci] = useState<string | null>(null);
  const [logoClaroUrl, setLogoClaroUrl] = useState<string | null>(null);

  useEffect(() => {
    getParametrosGerais().then((params) => setLogoClaroUrl(params.param_logo_claro_url));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, senha);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEsqueciSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authApi.esqueciSenha(email);
      setAvisoEsqueci(
        "Se esse e-mail estiver cadastrado e ativo, você vai receber um link para redefinir a senha em breve."
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell auth-shell-photo">
      <div className="auth-photo-frame">
        <img className="auth-photo-bg" src={loginBg} alt="" />

        {modo === "esqueci" ? (
          <form className="auth-overlay-card" onSubmit={handleEsqueciSubmit}>
            <div className="auth-overlay-header">
              <div className="auth-overlay-brand">
                <span className="auth-overlay-logo-icon">
                  <img src={logoClaroUrl || evertecLogo} alt="" />
                </span>
                {!logoClaroUrl && <span className="auth-overlay-brand-text">evertec</span>}
              </div>
              <h1 className="auth-overlay-title auth-overlay-title-sm">Recuperar senha</h1>
              <hr className="auth-overlay-separator" />
            </div>

            <div className="auth-overlay-field">
              <label htmlFor="esqueci-email">E-mail</label>
              <input
                id="esqueci-email"
                type="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu e-mail"
              />
            </div>

            {avisoEsqueci && <p className="page-subtitle">{avisoEsqueci}</p>}
            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="auth-overlay-submit" disabled={loading || !email}>
              {loading ? "Enviando..." : "Enviar link"}
            </button>
            <button
              type="button"
              className="auth-overlay-link"
              onClick={() => {
                setModo("login");
                setAvisoEsqueci(null);
                setError(null);
              }}
            >
              &larr; Voltar para o login
            </button>
          </form>
        ) : (
          <form className="auth-overlay-card" onSubmit={handleSubmit}>
            <div className="auth-overlay-header">
              <div className="auth-overlay-brand">
                <span className="auth-overlay-logo-icon">
                  <img src={logoClaroUrl || evertecLogo} alt="" />
                </span>
                {!logoClaroUrl && <span className="auth-overlay-brand-text">evertec</span>}
              </div>
              <h1 className="auth-overlay-title auth-overlay-title-webcrm">WebCRM - Entrar</h1>
              <hr className="auth-overlay-separator" />
            </div>

            <div className="auth-overlay-field">
              <label htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                type="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu e-mail"
              />
            </div>

            <div className="auth-overlay-field">
              <label htmlFor="login-senha">Senha</label>
              <PasswordInput id="login-senha" value={senha} onChange={setSenha} placeholder="Digite sua senha" required />
            </div>

            <button type="button" className="auth-overlay-link" onClick={() => setModo("esqueci")}>
              Esqueceu sua senha?
            </button>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="auth-overlay-submit" disabled={loading || !email || !senha}>
              {loading ? "Entrando..." : "Login"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
