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

// Limite geral das rotas de dados (`/api/*` autenticado). Não protege contra roubo de
// credencial -- protege contra ABUSO de uma credencial válida: sem isso, uma conta comprometida
// (ou um insider) varre a base inteira de clientes/carteira/consumo no talo, sem nenhum teto.
//
// O teto é alto de propósito, pra não atrapalhar uso legítimo: as telas do CRM carregam várias
// grids de uma vez (o dashboard do cliente sozinho dispara ~6 requisições em paralelo), a
// Importação de Carteira e o "Marcar todas as permissões" do Admin disparam levas de chamadas,
// e o `listAll` do frontend pagina sozinho recurso grande (`consumo_ana` chega a 256 mil linhas,
// ~13 páginas de 20 mil). 600/min por IP cobre isso com folga e ainda assim corta um scraping
// automatizado. Janela curta (1 min) de propósito: se alguém legítimo esbarrar, destrava rápido
// em vez de ficar 15 minutos travado como no limiter de login.
//
// `keyGenerator` padrão (por IP) mantido: atrás do proxy da Vercel, `req.ip` depende do
// `trust proxy` do Express, que NÃO está ligado -- então em produção isso hoje agrupa por IP do
// proxy, não do cliente final. Ou seja: funciona como um teto global de tráfego da API, não como
// um teto por usuário. É melhor que nada e não bloqueia ninguém sozinho no teto atual; se um dia
// precisar ser por usuário de verdade, o certo é chavear por `req.usuario.user_id` (e não ligar
// `trust proxy` às cegas, que deixaria o header X-Forwarded-For ser forjado pra furar o limite).
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "muitas requisições em pouco tempo -- aguarde um instante e tente de novo" },
});
