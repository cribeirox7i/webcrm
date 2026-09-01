/** Regra única de senha (2026-08-31, a pedido do usuário -- antes só exigia tamanho mínimo):
 * mín. `MIN_SENHA_LEN` caracteres, com maiúscula, minúscula, número e símbolo. Mesma regra do
 * backend (`convite.ts`, `erroComplexidadeSenha`) -- validar aqui também é só UX (evita round-trip
 * só pra descobrir que falta um número); o backend é quem garante de verdade. */
export const MIN_SENHA_LEN = 8;

export const DICA_SENHA = `mín. ${MIN_SENHA_LEN} caracteres, com maiúscula, minúscula, número e símbolo`;

export function erroComplexidadeSenha(senha: string): string | null {
  if (senha.length < MIN_SENHA_LEN) return `A senha precisa ter ao menos ${MIN_SENHA_LEN} caracteres.`;
  if (!/[A-Z]/.test(senha)) return "A senha precisa ter ao menos 1 letra maiúscula.";
  if (!/[a-z]/.test(senha)) return "A senha precisa ter ao menos 1 letra minúscula.";
  if (!/[0-9]/.test(senha)) return "A senha precisa ter ao menos 1 número.";
  if (!/[^A-Za-z0-9]/.test(senha)) return "A senha precisa ter ao menos 1 símbolo (ex.: ! @ # $ % *).";
  return null;
}
