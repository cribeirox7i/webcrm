import nodemailer, { Transporter } from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
const smtpConfigured = !!SMTP_HOST && !!SMTP_USER && !!SMTP_PASS;

let transporter: Transporter | null = null;
if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
} else {
  console.log(
    "[email] SMTP não configurado (SMTP_HOST/SMTP_USER/SMTP_PASS) -- e-mails de convite só serão logados no console, não enviados de verdade."
  );
}

interface EnviarConviteInput {
  nome: string;
  email: string;
  link: string;
}

/** Retorna { enviado: true } se de fato mandou pelo SMTP configurado, ou { enviado: false }
 * quando cai no fallback de log (SMTP não configurado ainda) -- nos dois casos o link
 * também volta na resposta da API, pra dar pro admin copiar manualmente se precisar. */
export async function enviarConviteEmail({ nome, email, link }: EnviarConviteInput): Promise<{ enviado: boolean }> {
  if (!transporter) {
    console.log(`[email] (SMTP não configurado) convite para ${nome} <${email}>: ${link}`);
    return { enviado: false };
  }

  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: email,
    subject: "Acesso ao WebCRM",
    text: `Olá, ${nome}!\n\nClique no link abaixo para definir sua senha e acessar o WebCRM:\n${link}\n\nSe você não esperava este e-mail, ignore-o.`,
    html: `<p>Olá, ${nome}!</p><p>Clique no link abaixo para definir sua senha e acessar o WebCRM:</p><p><a href="${link}">${link}</a></p><p>Se você não esperava este e-mail, ignore-o.</p>`,
  });
  return { enviado: true };
}
