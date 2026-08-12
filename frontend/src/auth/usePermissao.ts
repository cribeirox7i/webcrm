import { useAuth } from "./AuthContext";

const VAZIA = { leitura: false, insercao: false, edicao: false, exclusao: false };

/** Permissão granular (insercao/edicao/exclusao) do usuário logado pro menu informado --
 * usar pra esconder "+ Novo X" e os botões Editar/Excluir de cada tela, já que
 * usuarios_permissoes_menu por muito tempo só controlava a visibilidade do item na
 * Sidebar (perm_leitura), nunca as ações dentro da tela. O backend também passou a
 * validar isso (permissaoResource.ts) -- esconder o botão aqui é só pra UX, a garantia de
 * verdade é a checagem do servidor. */
export function usePermissao(menuKey: string) {
  const { permissoes } = useAuth();
  const flags = permissoes?.get(menuKey) ?? VAZIA;
  return {
    podeInserir: flags.insercao,
    podeEditar: flags.edicao,
    podeExcluir: flags.exclusao,
  };
}
