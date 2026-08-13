import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/adminClient";
import type { Usuario, UsuarioPermissaoMenu } from "../api/types";
import { MENUS } from "../menus";

interface UsuarioPermissoesMenuPageProps {
  usuario: Usuario;
  todosUsuarios: Usuario[];
  token: string;
  onBack: () => void;
  onInvalidToken: () => void;
}

type PermFlags = { perm_leitura: boolean; perm_insercao: boolean; perm_edicao: boolean; perm_exclusao: boolean };

const SEM_PERMISSAO: PermFlags = { perm_leitura: false, perm_insercao: false, perm_edicao: false, perm_exclusao: false };

export function UsuarioPermissoesMenuPage({ usuario, todosUsuarios, token, onBack, onInvalidToken }: UsuarioPermissoesMenuPageProps) {
  const [permissoes, setPermissoes] = useState<UsuarioPermissaoMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [herdarDeId, setHerdarDeId] = useState<string>("");
  const [herdando, setHerdando] = useState(false);

  const outrosUsuarios = useMemo(
    () => todosUsuarios.filter((u) => u.user_id !== usuario.user_id).sort((a, b) => a.user_nome.localeCompare(b.user_nome)),
    [todosUsuarios, usuario.user_id]
  );

  function handleAuthError(err: unknown): boolean {
    if ((err as Error).message === "não autenticado") {
      onInvalidToken();
      return true;
    }
    return false;
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.list<UsuarioPermissaoMenu>("usuarios_permissoes_menu", token, {
        user_id: usuario.user_id,
        limit: 1000,
      });
      setPermissoes(res.data);
    } catch (err) {
      if (!handleAuthError(err)) setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.user_id]);

  const flagsByMenu = useMemo(() => {
    const map = new Map<string, PermFlags>();
    permissoes.forEach((p) =>
      map.set(p.menu_key, {
        perm_leitura: !!p.perm_leitura,
        perm_insercao: !!p.perm_insercao,
        perm_edicao: !!p.perm_edicao,
        perm_exclusao: !!p.perm_exclusao,
      })
    );
    return map;
  }, [permissoes]);

  async function handleToggle(menuKey: string, campo: keyof PermFlags) {
    const atual = flagsByMenu.get(menuKey) ?? SEM_PERMISSAO;
    const novo = { ...atual, [campo]: !atual[campo] };
    setSavingKey(menuKey);
    try {
      const updated = await adminApi.updatePermissaoMenu<UsuarioPermissaoMenu>(token, usuario.user_id, menuKey, novo);
      setPermissoes((prev) => {
        const semEsse = prev.filter((p) => p.menu_key !== menuKey);
        return [...semEsse, updated];
      });
    } catch (err) {
      if (!handleAuthError(err)) setError((err as Error).message);
    } finally {
      setSavingKey(null);
    }
  }

  /** Checkbox "Todos" de uma linha: se já está tudo marcado, desmarca as 4; senão marca as 4. */
  async function handleToggleRow(menuKey: string) {
    const atual = flagsByMenu.get(menuKey) ?? SEM_PERMISSAO;
    const tudoMarcado = atual.perm_leitura && atual.perm_insercao && atual.perm_edicao && atual.perm_exclusao;
    const alvo = !tudoMarcado;
    const novo: PermFlags = { perm_leitura: alvo, perm_insercao: alvo, perm_edicao: alvo, perm_exclusao: alvo };
    setSavingKey(menuKey);
    try {
      const updated = await adminApi.updatePermissaoMenu<UsuarioPermissaoMenu>(token, usuario.user_id, menuKey, novo);
      setPermissoes((prev) => {
        const semEsse = prev.filter((p) => p.menu_key !== menuKey);
        return [...semEsse, updated];
      });
    } catch (err) {
      if (!handleAuthError(err)) setError((err as Error).message);
    } finally {
      setSavingKey(null);
    }
  }

  /** Marca ou desmarca as 4 permissões em TODOS os menus de uma vez, pra não precisar
   * clicar linha por linha quando o usuário deve ter acesso total (ou nenhum) ao sistema. */
  async function handleToggleTudo(alvo: boolean) {
    setSavingAll(true);
    setError(null);
    const novo: PermFlags = { perm_leitura: alvo, perm_insercao: alvo, perm_edicao: alvo, perm_exclusao: alvo };
    try {
      const updated = await Promise.all(
        MENUS.map((menu) => adminApi.updatePermissaoMenu<UsuarioPermissaoMenu>(token, usuario.user_id, menu.key, novo))
      );
      setPermissoes(updated);
    } catch (err) {
      if (!handleAuthError(err)) setError((err as Error).message);
    } finally {
      setSavingAll(false);
    }
  }

  /** Copia as 4 permissões de TODOS os menus de outro usuário (`herdarDeId`) pro usuário
   * atual, num tiro só -- útil quando um usuário novo deve ter o mesmo acesso de outro já
   * configurado, sem precisar remarcar linha por linha. Menu que o usuário de origem não
   * tem linha em `usuarios_permissoes_menu` é tratado como SEM_PERMISSAO (oculto). */
  async function handleHerdar() {
    if (!herdarDeId) return;
    setHerdando(true);
    setError(null);
    try {
      const origemRes = await adminApi.list<UsuarioPermissaoMenu>("usuarios_permissoes_menu", token, {
        user_id: Number(herdarDeId),
        limit: 1000,
      });
      const origemByMenu = new Map<string, PermFlags>();
      origemRes.data.forEach((p) =>
        origemByMenu.set(p.menu_key, {
          perm_leitura: !!p.perm_leitura,
          perm_insercao: !!p.perm_insercao,
          perm_edicao: !!p.perm_edicao,
          perm_exclusao: !!p.perm_exclusao,
        })
      );
      const updated = await Promise.all(
        MENUS.map((menu) =>
          adminApi.updatePermissaoMenu<UsuarioPermissaoMenu>(
            token,
            usuario.user_id,
            menu.key,
            origemByMenu.get(menu.key) ?? SEM_PERMISSAO
          )
        )
      );
      setPermissoes(updated);
    } catch (err) {
      if (!handleAuthError(err)) setError((err as Error).message);
    } finally {
      setHerdando(false);
    }
  }

  return (
    <div className="page">
      <div className="dashboard-header">
        <button onClick={onBack}>&larr; Voltar</button>
        <div>
          <h1>Permissões de {usuario.user_nome}</h1>
          <div className="dashboard-subtitle">{usuario.user_mail}</div>
        </div>
      </div>

      {error && (
        <div className="banner-error">
          {error} <button onClick={loadAll}>Tentar de novo</button>
        </div>
      )}

      <p className="page-subtitle">
        Um menu sem nenhuma das 4 permissões marcadas fica oculto pra este usuário.
      </p>

      <div className="modal-actions" style={{ justifyContent: "flex-start", marginBottom: 10 }}>
        <button disabled={savingAll || loading} onClick={() => handleToggleTudo(true)}>
          {savingAll ? "Salvando..." : "Marcar todas as permissões"}
        </button>
        <button disabled={savingAll || loading} onClick={() => handleToggleTudo(false)}>
          {savingAll ? "Salvando..." : "Desmarcar todas as permissões"}
        </button>
      </div>

      <div className="modal-actions" style={{ justifyContent: "flex-start", marginBottom: 10, gap: 8 }}>
        <label htmlFor="herdar-de" style={{ alignSelf: "center" }}>
          Herdar de:
        </label>
        <select id="herdar-de" value={herdarDeId} onChange={(e) => setHerdarDeId(e.target.value)} disabled={herdando || loading}>
          <option value="">Selecione um usuário...</option>
          {outrosUsuarios.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.user_nome} ({u.user_mail})
            </option>
          ))}
        </select>
        <button disabled={!herdarDeId || herdando || loading} onClick={handleHerdar}>
          {herdando ? "Copiando..." : "Copiar permissões"}
        </button>
      </div>

      <div className="table-scroll">
        <table className="mini-table">
          <thead>
            <tr>
              <th>Menu</th>
              <th className="text-center">Leitura</th>
              <th className="text-center">Inserção</th>
              <th className="text-center">Edição</th>
              <th className="text-center">Exclusão</th>
              <th className="text-center">Todos</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Carregando...</td>
              </tr>
            ) : (
              MENUS.map((menu) => {
                const flags = flagsByMenu.get(menu.key) ?? SEM_PERMISSAO;
                const disabled = savingKey === menu.key || savingAll;
                const tudoMarcado = flags.perm_leitura && flags.perm_insercao && flags.perm_edicao && flags.perm_exclusao;
                return (
                  <tr key={menu.key}>
                    <td>{menu.label}</td>
                    {(["perm_leitura", "perm_insercao", "perm_edicao", "perm_exclusao"] as const).map((campo) => (
                      <td key={campo} className="text-center">
                        <input
                          type="checkbox"
                          checked={flags[campo]}
                          disabled={disabled}
                          onChange={() => handleToggle(menu.key, campo)}
                        />
                      </td>
                    ))}
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={tudoMarcado}
                        disabled={disabled}
                        title="Marcar/desmarcar as 4 permissões deste menu"
                        onChange={() => handleToggleRow(menu.key)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
