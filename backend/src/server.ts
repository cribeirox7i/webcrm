import express from "express";
import cors from "cors";
import { metaRouter } from "./routes/meta";
import { resourceRouter } from "./routes/resource";
import { adminRouter } from "./routes/admin";
import { permissoesRouter } from "./routes/permissoes";
import { indicesRouter } from "./routes/indices";
import { adminIndicesRouter } from "./routes/adminIndices";
import { anexosRouter } from "./routes/anexos";
import { propostaAnexoRouter } from "./routes/propostaAnexo";
import { parametrosRouter } from "./routes/parametros";
import { parametrosStorageRouter } from "./routes/parametrosStorage";
import { importarCarteiraRouter } from "./routes/importarCarteira";
import { importarConsumoRouter } from "./routes/importarConsumo";
import { authRouter } from "./routes/auth";
import { usuariosRouter } from "./routes/usuarios";
import { requireAdmin } from "./adminAuth";
import { requireUserAuth, requireUserOrAdminAuth } from "./mainAuth";
import { apiRateLimiter } from "./rateLimit";

// CORS_ORIGINS: lista separada por vírgula das origens que podem chamar a API (ex.:
// "https://webcrm.evertec.com.br,https://webcrm-staging.evertec.com.br" em produção).
// Sem a variável definida, cai no default de desenvolvimento local (porta fixa do Vite,
// ver vite.config.ts) -- NÃO usar esse default em produção, é só pra não travar o dev local.
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5183")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
// não anunciar o framework/versão na resposta -- só facilita procurar exploit conhecido
app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      // sem "origin" no header (curl, server-to-server, health check) -- deixa passar;
      // quem decide se autentica ou não é requireAdmin/requireUserAuth, não o CORS.
      // callback(null, false) -- nunca "throw"/erro aqui: só omite o header de CORS (o
      // navegador bloqueia a leitura da resposta do lado dele); um erro faria o Express
      // devolver 500 com stack trace, verboso demais pra uma origem só não-permitida.
      callback(null, !origin || corsOrigins.includes(origin));
    },
  })
);
// limite padrão do express.json() é só 100kb -- a importação de carteira manda a planilha de
// medição inteira (centenas de linhas) + a lista de planilhas do Drive num POST só, e passa
// disso fácil (achado 2026-08-31, HTTP 413 testando com 244 linhas + 245 links). 10mb cobre
// isso com folga sem abrir a porta pra payload absurdo.
app.use(express.json({ limit: "10mb" }));

// Headers de segurança básicos em toda resposta -- sem isso a tela de login/admin (protegida
// só por PIN, sem 2FA) podia ser embutida num <iframe> de terceiro (clickjacking), e faltava
// a camada de defesa em profundidade dos demais headers padrão contra XSS/sniffing. Vale pra
// toda resposta da API, incluindo dev local (`npm run dev`), que não passa pelo `headers` do
// `vercel.json` (esse aqui é aplicado direto pelo Express).
app.use((_req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  next();
});

// /health fora do rate limit de propósito -- é o que a Vercel/monitoramento bate, e não
// devolve dado nenhum.
app.get("/health", (_req, res) => res.json({ ok: true }));

// Teto geral de requisições em tudo sob /api (ver comentário em rateLimit.ts). Montado antes
// dos routers, então vale também pras rotas de login -- que continuam com o limiter próprio,
// bem mais restrito, por cima deste.
app.use("/api", apiRateLimiter);

app.use("/api/admin", adminRouter);
// login do app principal (e-mail+senha, convite por e-mail) -- mecanismo independente do PIN mestre
app.use("/api/auth", authRouter);

// usuarios/usuarios_permissoes_menu guardam senha/PIN/permissões -- só acessíveis com o PIN mestre
app.use("/api/usuarios", requireAdmin);
app.use("/api/usuarios_permissoes_menu", requireAdmin);
// usuario_sessoes guarda o token de sessão (bearer) de todo usuário -- antes deste fix, essa
// tabela não estava em nenhum mapa de permissão (permissaoResource.ts) nem tinha mount próprio
// aqui, então caía no comportamento padrão do roteador genérico de "libera se não tem menu
// mapeado": qualquer usuário autenticado, mesmo sem nenhuma permissão de menu, conseguia listar
// (GET) o token de sessão de TODOS os usuários -- inclusive admins -- e reutilizá-lo para
// assumir a identidade de outra conta (escalada de privilégio completa). Igual às tabelas
// acima, só o PIN mestre pode ler/escrever aqui via API genérica agora.
app.use("/api/usuario_sessoes", requireAdmin);
app.use("/api/parametros_storage_menu", requireAdmin);
// importação da planilha de medição -> carteira (apaga e regrava o mês inteiro): só com o PIN
app.use("/api/admin/importar-carteira", requireAdmin);
// importação do consumo analítico -> consumo_ana + precos_cliente (duplicado) + faturamento
// (apaga e regrava o mês inteiro nas 3 tabelas): só com o PIN
app.use("/api/admin/importar-consumo", requireAdmin);
// sync dos índices econômicos com o Banco Central (SGS): só com o PIN mestre
app.use("/api/admin/indices", requireAdmin, adminIndicesRouter);
// rotas dedicadas de /api/usuarios (criar com senha provisória, enviar convite) --
// registradas depois do requireAdmin acima (mesmo prefixo), então só respondem autenticado
app.use("/api/usuarios", usuariosRouter);
app.use("/api", parametrosStorageRouter);
app.use("/api", importarCarteiraRouter);
app.use("/api", importarConsumoRouter);

// parametros_gerais (branding) precisa aceitar tanto o PIN mestre (tela de Admin, sem
// sessão de usuário) quanto a sessão do app principal -- montado antes do requireUserAuth
// genérico porque faz essa checagem dupla por conta própria (ver routes/parametros.ts).
app.use("/api", parametrosRouter);

// cart_mes tem CRUD tanto em Financeiro (app principal) quanto na aba Carteira do Admin
// (sem sessão de usuário, só o PIN) -- mesma lógica dual do parametrosRouter, mas
// reaproveitável via middleware porque aqui o CRUD inteiro (não só GET) precisa dela.
app.use("/api/cart_mes", requireUserOrAdminAuth);

// tudo daqui pra baixo exige sessão de usuário válida -- exceto quando a requisição já
// veio autenticada como admin (req.isAdmin, setado pelo requireAdmin acima), caso em que
// requireUserAuth deixa passar direto.
app.use("/api", requireUserAuth);

app.use("/api", permissoesRouter);
// indices_economicos tem PK composta -- rota dedicada (upsert/delete), mesmo motivo de permissoesRouter
app.use("/api", indicesRouter);
// montado antes do resourceRouter -- upload/download/exclusão de anexos precisam de
// tratamento de storage próprio (ver routes/anexos.ts), o resto (GET lista/por id) cai
// no genérico normalmente.
app.use("/api", anexosRouter);
app.use("/api", propostaAnexoRouter);
app.use("/api", metaRouter);
app.use("/api", resourceRouter);

// Sob Vercel (serverless), `process.env.VERCEL` é definido automaticamente em todo
// deployment -- checagem mais confiável que `require.main === module`, que pode se
// comportar de forma inesperada dentro do bundler serverless (achado real: chamar
// .listen() ali causava FUNCTION_INVOCATION_FAILED em todo request, mesmo com as env vars
// certas configuradas). Local dev (`npm run dev`) não tem essa variável -- chama .listen() normal.
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, () => {
    console.log(`[server] WEBCRM backend em http://localhost:${PORT}`);
  });
}

export default app;
