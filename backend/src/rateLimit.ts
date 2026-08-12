import rateLimit from "express-rate-limit";

// Login (e-mail+senha, PIN mestre, esqueci-senha) não tinha nenhum limite de tentativas --
// força bruta era viável sem rastro nenhum. Limite por IP, não por conta: sem isso alguém
// tentando várias contas ao mesmo tempo do mesmo IP escaparia de um limite por e-mail.
// Conta tentativa com sucesso E com falha (não usa skipSuccessfulRequests) -- um PIN/senha
// correto adivinhado por força bruta também deve contar contra o limite.
//
// Fábrica, não uma instância única: cada `rateLimit(...)` tem seu próprio armazenamento
// interno. Uma instância COMPARTILHADA entre /auth/login, /admin/login e /auth/esqueci-senha
// faria uso legítimo de um endpoint consumir o orçamento dos outros dois vindos do mesmo
// IP (ex.: um escritório inteiro atrás do mesmo IP corporativo logando normalmente já
// travaria o PIN de admin pra todo mundo) -- bug real encontrado no teste desta correção.
function novoLoginRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "muitas tentativas -- aguarde alguns minutos antes de tentar de novo" },
  });
}

export const loginRateLimiter = novoLoginRateLimiter();
export const adminLoginRateLimiter = novoLoginRateLimiter();
export const esqueciSenhaRateLimiter = novoLoginRateLimiter();
