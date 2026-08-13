import { Router } from "express";
import { query } from "../db";

export interface ParametroStorageMenu {
  menu_key: string;
  pasta: string;
}

// Onde cada menu com upload de anexo guarda seus arquivos dentro do bucket do Supabase
// Storage (ex.: propostas -> "propostas", fornecedores -> "contratos-fornecedores") --
// configurável pelo Admin em vez de fixo no código, pra não precisar de deploy só pra
// mudar o nome de uma pasta. Só os menus com upload de fato implementado (ver
// routes/anexos.ts e routes/propostaAnexo.ts) usam essa tabela hoje.
export const parametrosStorageRouter = Router();

parametrosStorageRouter.get("/parametros_storage_menu", async (_req, res) => {
  const { rows } = await query<ParametroStorageMenu>("SELECT * FROM parametros_storage_menu ORDER BY menu_key");
  res.json(rows);
});

parametrosStorageRouter.put("/parametros_storage_menu/:menuKey", async (req, res) => {
  const menuKey = req.params.menuKey;
  const { pasta } = (req.body ?? {}) as { pasta?: unknown };
  if (typeof pasta !== "string" || !pasta.trim()) {
    res.status(400).json({ error: "pasta é obrigatória" });
    return;
  }
  const { rows } = await query<ParametroStorageMenu>(
    `INSERT INTO parametros_storage_menu (menu_key, pasta) VALUES ($1, $2)
     ON CONFLICT (menu_key) DO UPDATE SET pasta = EXCLUDED.pasta
     RETURNING *`,
    [menuKey, pasta.trim()]
  );
  res.json(rows[0]);
});

/** Lida pelo próprio backend (anexos.ts/propostaAnexo.ts) ao montar o caminho do objeto no
 * bucket -- cai no próprio `menuKey` como pasta default se o Admin ainda não configurou
 * nada, pra upload continuar funcionando sem exigir esse passo antes. */
export async function getPastaStorage(menuKey: string): Promise<string> {
  const { rows } = await query<{ pasta: string }>("SELECT pasta FROM parametros_storage_menu WHERE menu_key = $1", [
    menuKey,
  ]);
  return rows[0]?.pasta || menuKey;
}
