import express from "express";
import cors from "cors";
import { metaRouter } from "./routes/meta";
import { resourceRouter } from "./routes/resource";
import { adminRouter } from "./routes/admin";
import { permissoesRouter } from "./routes/permissoes";
import { anexosRouter } from "./routes/anexos";
import { propostaAnexoRouter } from "./routes/propostaAnexo";
import { parametrosRouter } from "./routes/parametros";
import { authRouter } from "./routes/auth";
import { usuariosRouter } from "./routes/usuarios";
import { requireAdmin } from "./adminAuth";
import { requireUserAuth, requireUserOrAdminAuth } from "./mainAuth";

// CORS_ORIGINS: lista separada por vírgula das origens que podem chamar a API (ex.:
// "https://webcrm.evertec.com.br,https://webcrm-staging.evertec.com.br" em produção).
// Sem a variável definida, cai no default de desenvolvimento local (porta fixa do Vite,
// ver vite.config.ts) -- NÃO usar esse default em produção, é só pra não travar o dev local.
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5183")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
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
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/admin", adminRouter);
// login do app principal (e-mail+senha, convite por e-mail) -- mecanismo independente do PIN mestre
app.use("/api/auth", authRouter);

// usuarios/usuarios_permissoes_menu guardam senha/PIN/permissões -- só acessíveis com o PIN mestre
app.use("/api/usuarios", requireAdmin);
app.use("/api/usuarios_permissoes_menu", requireAdmin);
// rotas dedicadas de /api/usuarios (criar com senha provisória, enviar convite) --
// registradas depois do requireAdmin acima (mesmo prefixo), então só respondem autenticado
app.use("/api/usuarios", usuariosRouter);

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
