import { api } from "../api/client";
import type { ParametrosGerais } from "../api/types";

// Cache em memória -- os parâmetros gerais (URLs de logo) mudam raramente, não faz
// sentido buscar de novo a cada render/PDF gerado na mesma sessão do navegador.
let cache: Promise<ParametrosGerais> | null = null;

export function getParametrosGerais(): Promise<ParametrosGerais> {
  if (!cache) {
    cache = api
      .get<ParametrosGerais>("parametros_gerais", 1)
      .catch(() => ({ param_id: 1, param_logo_escuro_url: null, param_logo_claro_url: null }));
  }
  return cache;
}
