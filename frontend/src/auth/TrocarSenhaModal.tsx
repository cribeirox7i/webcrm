import { useState } from "react";
import { authApi } from "../api/authApi";
import { useAuth } from "./AuthContext";
import { PasswordInput } from "../components/PasswordInput";
import { DICA_SENHA, erroComplexidadeSenha } from "../lib/senha";

interface TrocarSenhaModalProps {
  onClose: () => void;
}

export function TrocarSenhaModal({ onClose }: TrocarSenhaModalProps) {
  const { token } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const erroSenha = erroComplexidadeSenha(novaSenha);
    if (erroSenha) { setError(erroSenha); return; }
    if (novaSenha !== confirmar) { setError("A confirmação não é igual à nova senha."); return; }
    setLoading(true);
    setError(null);
    try {
      await authApi.trocarSenha(token!, senhaAtual, novaSenha);
      setSucesso(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Trocar senha</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {sucesso ? (
          <div style={{ padding: "1.5rem 0" }}>
            <p style={{ color: "var(--color-green, green)", marginBottom: "1rem" }}>
              Senha alterada com sucesso.
            </p>
            <button className="primary" onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <PasswordInput value={senhaAtual} onChange={setSenhaAtual} placeholder="Senha atual" required />
            <PasswordInput value={novaSenha} onChange={setNovaSenha} placeholder={`Nova senha (${DICA_SENHA})`} required />
            <PasswordInput value={confirmar} onChange={setConfirmar} placeholder="Confirmar nova senha" required />
            {error && <p className="form-error">{error}</p>}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} disabled={loading}>Cancelar</button>
              <button type="submit" className="primary" disabled={loading}>
                {loading ? "Salvando..." : "Trocar senha"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
