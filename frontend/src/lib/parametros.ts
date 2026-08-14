import { api } from "../api/client";
import type { ParametrosGerais } from "../api/types";

// Cache em memória com TTL curto -- os parâmetros gerais (URLs de logo) mudam raramente,
// não faz sentido buscar de novo a cada render/PDF gerado na mesma sessão do navegador.
// Mas um cache "pra sempre" (sem TTL) já causou confusão real: admin troca a URL da logo
// no painel, gera um PDF de teste na mesma aba sem recarregar a página, e continua vendo a
// logo antiga -- parece bug, mas era só o cache nunca invalidando. TTL curto (1 min) resolve
// sem perder o benefício de não bater na API a cada PDF gerado em sequência.
const CACHE_TTL_MS = 60_000;
let cache: { promise: Promise<ParametrosGerais>; fetchedAt: number } | null = null;

export function getParametrosGerais(): Promise<ParametrosGerais> {
  if (!cache || Date.now() - cache.fetchedAt > CACHE_TTL_MS) {
    cache = {
      promise: api
        .get<ParametrosGerais>("parametros_gerais", 1)
        .catch(() => ({ param_id: 1, param_logo_escuro_url: null, param_logo_claro_url: null })),
      fetchedAt: Date.now(),
    };
  }
  return cache.promise;
}
