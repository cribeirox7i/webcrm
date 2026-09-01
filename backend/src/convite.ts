import { query } from "./db";
import { generateToken } from "./authCrypto";
import { enviarConviteEmail } from "./email";

const INVITE_TTL_HORAS = Number(process.env.INVITE_TTL_HORAS) || 48;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5183";

/** Regra única de tamanho mínimo de senha -- compartilhada por toda rota que recebe uma
 * senha nova (trocar-senha, definir-senha via convite, definir-senha pelo admin). */
export const MIN_SENHA_LEN = 8;

/** Regra única de complexidade de senha (2026-08-31, a pedido do usuário -- antes só exigia o
 * tamanho mínimo): mín. `MIN_SENHA_LEN` caracteres, com maiúscula, minúscula, número e símbolo.
 * Devolve a mensagem de erro pra mostrar (em português, pronta pra ir na resposta) ou `null`
 * quando a senha passa em tudo. Mesma regra nos 3 lugares que recebem senha nova -- ver
 * `MIN_SENHA_LEN` acima pro motivo de ser compartilhada. */
export function erroComplexidadeSenha(senha: string): string | null {
  if (senha.length < MIN_SENHA_LEN) return `A senha precisa ter ao menos ${MIN_SENHA_LEN} caracteres.`;
  if (!/[A-Z]/.test(senha)) return "A senha precisa ter ao menos 1 letra maiúscula.";
  if (!/[a-z]/.test(senha)) return "A senha precisa ter ao menos 1 letra minúscula.";
  if (!/[0-9]/.test(senha)) return "A senha precisa ter ao menos 1 número.";
  if (!/[^A-Za-z0-9]/.test(senha)) return "A senha precisa ter ao menos 1 símbolo (ex.: ! @ # $ % *).";
  return null;
}

interface UsuarioParaConvite {
  user_id: number;
  user_nome: string;
  user_mail: string;
}

/** Gera um novo token de convite (invalida o anterior, se houver) e tenta enviar por
 * e-mail -- usado tanto pelo botão "Enviar E-mail" do admin quanto pelo "Esqueci minha
 * senha" self-service. Devolve o link mesmo quando o e-mail não sai de verdade (SMTP não
 * configurado), pra quem chamou poder decidir o que mostrar. */
export async function gerarEEnviarConvite(
  usuario: UsuarioParaConvite
): Promise<{ enviado: boolean; link: string; expiraEm: string }> {
  const token = generateToken();
  const expiraEm = new Date(Date.now() + INVITE_TTL_HORAS * 60 * 60 * 1000).toISOString();
  await query("UPDATE usuarios SET user_convite_token = $1, user_convite_expira_em = $2 WHERE user_id = $3", [
    token,
    expiraEm,
    usuario.user_id,
  ]);

  const link = `${FRONTEND_URL}/definir-senha?token=${token}`;
  const { enviado } = await enviarConviteEmail({ nome: usuario.user_nome, email: usuario.user_mail, link });
  return { enviado, link, expiraEm };
}
