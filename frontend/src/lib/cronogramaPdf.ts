import { api } from "../api/client";
import type { CronoCalculado, ListRespCrono, PortfolioProgresso } from "../api/types";
import { exportCronogramaPdf } from "./export";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function hoje(): string {
  return formatDate(new Date().toISOString().slice(0, 10));
}

/**
 * Monta o "Documento de acompanhamento de projeto" (capa + resumo + tabela do cronograma)
 * pra um portfólio -- usada tanto no ícone rápido da lista de Portfólio Completo quanto no
 * botão "Salvar Cronograma" da tela de drill-in (Cronograma Detalhado). Auto-contida: busca
 * o cronograma calculado (crono_calculado) e os nomes de responsável direto da API.
 */
export async function gerarPdfCronograma(portfolio: PortfolioProgresso, clienteNome: string) {
  const [cronoRes, respRes] = await Promise.all([
    api.list<CronoCalculado>("crono_calculado", { port_id: portfolio.port_id, limit: 5000 }),
    api.list<ListRespCrono>("list_resp_crono", { limit: 200 }),
  ]);

  const respNomeById = new Map<number, string>();
  respRes.data.forEach((r) => respNomeById.set(r.resp_id, r.resp_nome));

  const linhasOrdenadas = [...cronoRes.data].sort((a, b) => {
    const grupoDiff = (a.crono_grupo ?? 0) - (b.crono_grupo ?? 0);
    if (grupoDiff !== 0) return grupoDiff;
    return (a.crono_topico ?? 0) - (b.crono_topico ?? 0);
  });

  const desvioPortfolio = portfolio.port_perc_atual - portfolio.port_perc_estim;

  await exportCronogramaPdf(
    `cronograma_${portfolio.port_id}_${(portfolio.port_nome ?? "projeto").replace(/\s+/g, "_")}`,
    portfolio.port_nome ?? "",
    clienteNome,
    portfolio.port_tipo ?? "",
    hoje(),
    {
      responsavel: portfolio.port_pm ?? "",
      inicio: formatDate(portfolio.port_inicio),
      termino: formatDate(portfolio.port_fim),
      percAtual: portfolio.port_perc_atual,
      percEstim: portfolio.port_perc_estim,
      percDesvio: desvioPortfolio,
      status: portfolio.port_status ?? "",
    },
    linhasOrdenadas.map((l) => ({
      numero: l.crono_grp_tpc ?? "",
      tipo: l.crono_tipo ?? "",
      atividade: l.crono_atividade ?? "",
      inicio: formatDate(l.crono_inicio_calc),
      termino: formatDate(l.crono_fim_calc),
      percAtual: l.crono_perc_atual_calc,
      percEstim: l.crono_perc_esperado,
      percDesvio: l.crono_perc_atual_calc - l.crono_perc_esperado,
      status: l.crono_status ?? "",
      responsavel: l.resp_id != null ? respNomeById.get(l.resp_id) ?? "" : "",
    }))
  );
}
