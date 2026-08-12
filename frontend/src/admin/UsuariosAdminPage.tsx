import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/adminClient";
import type { Usuario } from "../api/types";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "../components/DataGrid";
import { StatCards } from "../components/StatCards";
import { UsuarioForm, valuesToPayload, type UsuarioFormValues } from "./UsuarioForm";
import { UsuarioPermissoesMenuPage } from "./UsuarioPermissoesMenuPage";
import { PasswordInput } from "../components/PasswordInput";
import { EditIcon, KeyIcon, MailIcon, ShieldIcon, TrashIcon } from "../components/icons";

const MIN_SENHA_LEN = 8;
const SENHA_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function gerarSenhaAleatoria(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => SENHA_CHARSET[b % SENHA_CHARSET.length])
    .join("");
}

interface UsuariosAdminPageProps {
  token: string;
  onLogout: () => void;
}

export function UsuariosAdminPage({ token, onLogout }: UsuariosAdminPageProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Usuario | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [permissoesFor, setPermissoesFor] = useState<Usuario | null>(null);
  const [senhaProvisoria, setSenhaProvisoria] = useState<{ nome: string; senha: string } | null>(null);
  const [convitePendente, setConvitePendente] = useState<number | null>(null);

  const [definindoSenhaFor, setDefinindoSenhaFor] = useState<Usuario | null>(null);
  const [novaSenhaAdmin, setNovaSenhaAdmin] = useState("");
  const [confirmarSenhaAdmin, setConfirmarSenhaAdmin] = useState("");
  const [savingSenha, setSavingSenha] = useState(false);
  const [senhaError, setSenhaError] = useState<string | null>(null);

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
      const res = await adminApi.list<Usuario>("usuarios", token, { limit: 1000 });
      setUsuarios(res.data);
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

  async function handleDelete(usuario: Usuario) {
    if (!confirm(`Excluir o usuário "${usuario.user_nome}" (#${usuario.user_id})?`)) return;
    try {
      await adminApi.remove("usuarios", token, usuario.user_id);
      setUsuarios((prev) => prev.filter((u) => u.user_id !== usuario.user_id));
    } catch (err) {
      if (!handleAuthError(err)) alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  async function handleEnviarConvite(usuario: Usuario) {
    setConvitePendente(usuario.user_id);
    try {
      const { enviado, link } = await adminApi.enviarConvite(token, usuario.user_id);
      if (enviado) {
        alert(`E-mail enviado para ${usuario.user_mail}.`);
      } else {
        alert(
          `SMTP ainda não configurado no backend -- o e-mail não foi enviado de verdade.\n\nCopie e envie este link manualmente para ${usuario.user_mail}:\n\n${link}`
        );
      }
    } catch (err) {
      if (!handleAuthError(err)) alert(`Não foi possível gerar o convite: ${(err as Error).message}`);
    } finally {
      setConvitePendente(null);
    }
  }

  function abrirDefinirSenha(usuario: Usuario) {
    setDefinindoSenhaFor(usuario);
    setNovaSenhaAdmin("");
    setConfirmarSenhaAdmin("");
    setSenhaError(null);
  }

  async function handleDefinirSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!definindoSenhaFor) return;
    if (novaSenhaAdmin.length < MIN_SENHA_LEN) {
      setSenhaError(`A senha precisa ter ao menos ${MIN_SENHA_LEN} caracteres.`);
      return;
    }
    if (novaSenhaAdmin !== confirmarSenhaAdmin) {
      setSenhaError("A confirmação não é igual à senha.");
      return;
    }
    setSavingSenha(true);
    setSenhaError(null);
    try {
      await adminApi.definirSenha(token, definindoSenhaFor.user_id, novaSenhaAdmin);
      alert(`Senha de ${definindoSenhaFor.user_nome} atualizada. Sessões anteriores dele(a) foram encerradas.`);
      setDefinindoSenhaFor(null);
    } catch (err) {
      if (handleAuthError(err)) return;
      setSenhaError((err as Error).message);
    } finally {
      setSavingSenha(false);
    }
  }

  async function handleSubmit(values: UsuarioFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = valuesToPayload(values);
      if (editing === "new") {
        const created = await adminApi.create<Usuario & { senhaProvisoria: string }>("usuarios", token, payload);
        setUsuarios((prev) => [...prev, created]);
        setSenhaProvisoria({ nome: created.user_nome, senha: created.senhaProvisoria });
      } else if (editing) {
        const updated = await adminApi.update<Usuario>("usuarios", token, editing.user_id, payload);
        setUsuarios((prev) => prev.map((u) => (u.user_id === updated.user_id ? updated : u)));
      }
      setEditing(null);
    } catch (err) {
      if (handleAuthError(err)) return;
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns: DataGridColumn<Usuario>[] = useMemo(
    () => [
      { id: "user_id", header: "ID", value: (u) => u.user_id, width: 60, minWidth: 50 },
      { id: "user_nome", header: "Nome", value: (u) => u.user_nome, width: 220 },
      { id: "user_mail", header: "E-mail", value: (u) => u.user_mail, width: 240 },
      {
        id: "user_status",
        header: "Status",
        value: (u) => u.user_status,
        width: 100,
        cell: (u) =>
          u.user_status ? <span className={`badge badge-${u.user_status.toLowerCase()}`}>{u.user_status}</span> : "",
      },
    ],
    []
  );

  const filters: DataGridFilter<Usuario>[] = useMemo(
    () => [{ id: "user_status", label: "Status", value: (u) => u.user_status ?? "" }],
    []
  );

  if (permissoesFor) {
    return (
      <UsuarioPermissoesMenuPage
        usuario={permissoesFor}
        token={token}
        onBack={() => setPermissoesFor(null)}
        onInvalidToken={onLogout}
      />
    );
  }

  return (
    <div className="page">
      <StatCards
        stats={[
          { label: "Total de usuários", value: usuarios.length, tone: "accent" },
          { label: "Ativos", value: usuarios.filter((u) => u.user_status === "ATIVO").length, tone: "green" },
        ]}
      />

      {loadError && (
        <div className="banner-error">
          Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <DataGrid
        data={usuarios}
        columns={columns}
        getRowId={(u) => u.user_id}
        searchValue={(u) => `${u.user_nome} ${u.user_mail}`}
        searchPlaceholder="Buscar por nome ou e-mail..."
        filters={filters}
        loading={loading}
        exportFilename="usuarios"
        actionsWidth={200}
        renderActions={(u) => (
          <div className="row-actions">
            <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing(u)}>
              <EditIcon />
            </button>
            <button className="icon-btn" title="Permissões" aria-label="Permissões" onClick={() => setPermissoesFor(u)}>
              <ShieldIcon />
            </button>
            <button className="icon-btn" title="Definir senha" aria-label="Definir senha" onClick={() => abrirDefinirSenha(u)}>
              <KeyIcon />
            </button>
            <button
              className="icon-btn"
              title={convitePendente === u.user_id ? "Enviando..." : "Enviar e-mail de convite"}
              aria-label="Enviar e-mail de convite"
              disabled={convitePendente === u.user_id}
              onClick={() => handleEnviarConvite(u)}
            >
              <MailIcon />
            </button>
            <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDelete(u)}>
              <TrashIcon />
            </button>
          </div>
        )}
        toolbarExtra={
          <button className="primary" onClick={() => setEditing("new")}>
            + Novo usuário
          </button>
        }
      />

      {editing && (
        <UsuarioForm
          usuario={editing === "new" ? null : editing}
          saving={saving}
          error={formError}
          onCancel={() => {
            setEditing(null);
            setFormError(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {senhaProvisoria && (
        <div className="modal-backdrop" onClick={() => setSenhaProvisoria(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Usuário criado: {senhaProvisoria.nome}</h2>
            <p className="page-subtitle">
              Senha provisória gerada (anote agora, não será mostrada de novo). Use o botão "Enviar E-mail" pra
              mandar um link de acesso, ou comunique esta senha manualmente:
            </p>
            <p className="form-row">
              <code style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{senhaProvisoria.senha}</code>
            </p>
            <div className="modal-actions">
              <button className="primary" onClick={() => setSenhaProvisoria(null)}>
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {definindoSenhaFor && (
        <div className="modal-backdrop" onClick={() => setDefinindoSenhaFor(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleDefinirSenha}>
            <h2>Definir senha: {definindoSenhaFor.user_nome}</h2>
            <p className="page-subtitle">
              Define a senha de login direto (sem precisar do usuário clicar num link de convite). As sessões
              abertas dele(a) serão encerradas.
            </p>

            <div className="form-row">
              <label htmlFor="nova_senha_admin">Nova senha</label>
              <PasswordInput id="nova_senha_admin" value={novaSenhaAdmin} onChange={setNovaSenhaAdmin} required />
            </div>
            <button
              type="button"
              onClick={() => {
                const gerada = gerarSenhaAleatoria();
                setNovaSenhaAdmin(gerada);
                setConfirmarSenhaAdmin(gerada);
              }}
            >
              Gerar senha
            </button>

            <div className="form-row">
              <label htmlFor="confirmar_senha_admin">Confirmar senha</label>
              <PasswordInput id="confirmar_senha_admin" value={confirmarSenhaAdmin} onChange={setConfirmarSenhaAdmin} required />
            </div>

            {senhaError && <p className="form-error">{senhaError}</p>}

            <div className="modal-actions">
              <button type="button" onClick={() => setDefinindoSenhaFor(null)} disabled={savingSenha}>
                Cancelar
              </button>
              <button type="submit" className="primary" disabled={savingSenha}>
                {savingSenha ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
