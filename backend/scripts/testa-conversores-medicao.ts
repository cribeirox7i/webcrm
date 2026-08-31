// Descartável (teste, não toca no banco): valida os conversores da importação da carteira contra
// os valores REAIS da planilha de medição -- datas em dd/mm/aaaa viram ISO (a coluna gerada
// cart_nome_plan_analitica depende disso), e valores viram número.
// Uso: npx tsx scripts/testa-conversores-medicao.ts
import { dataIso, inteiro, nomePlanAnalitica, nomesPlanAnaliticaCandidatos, numero, texto } from "../src/planilhaValores";

const casos: { entrada: unknown; esperado: unknown; fn: (v: unknown) => unknown; nome: string }[] = [
  { nome: "data dd/mm/aaaa", entrada: "31/07/2026", esperado: "2026-07-31", fn: (v) => dataIso(v) },
  { nome: "data ult. deferimento", entrada: "18/09/2020", esperado: "2020-09-18", fn: (v) => dataIso(v) },
  { nome: "data+hora extração", entrada: "10/08/2026 18:41", esperado: "2026-08-10 18:41:00", fn: (v) => dataIso(v, true) },
  { nome: "data já ISO (idempotente)", entrada: "2026-06-30", esperado: "2026-06-30", fn: (v) => dataIso(v) },
  { nome: "data vazia", entrada: null, esperado: null, fn: (v) => dataIso(v) },
  { nome: "número puro", entrada: 114098.49, esperado: 114098.49, fn: (v) => numero(v) },
  { nome: "zero", entrada: 0, esperado: 0, fn: (v) => numero(v) },
  { nome: "vazio -> null", entrada: null, esperado: null, fn: (v) => numero(v) },
  { nome: "moeda BR em texto", entrada: "R$ 1.631.651,25", esperado: 1631651.25, fn: (v) => numero(v) },
  { nome: "quantidade float -> int", entrada: 13.0, esperado: 13, fn: (v) => inteiro(v) },
  { nome: "texto com espaços", entrada: "  Módulo Esc  ", esperado: "Módulo Esc", fn: (v) => texto(v) },
  { nome: "texto vazio -> null", entrada: "   ", esperado: null, fn: (v) => texto(v) },
];

let falhas = 0;
for (const c of casos) {
  const obtido = c.fn(c.entrada);
  const ok = obtido === c.esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${c.nome}: ${JSON.stringify(c.entrada)} -> ${JSON.stringify(obtido)}${ok ? "" : ` (esperado ${JSON.stringify(c.esperado)})`}`);
}

// confere que `nomePlanAnalitica` (JS, usado na importação pra casar com a lista do Drive ANTES
// do INSERT) reproduz exatamente a coluna gerada `cart_nome_plan_analitica` do banco (SQL) -- base
// é cart_db (o "slug"), não cart_prod (texto descritivo); achado 2026-08-31 batendo a fórmula
// original do AppSheet contra nomes reais de arquivo no Drive (ex. "2mj_factor_Medicao_...xlsx",
// nunca "Módulo WebFactor_Medicao_...xlsx").
const casosNome: { db: string | null; dataBase: string | null; esperado: string | null }[] = [
  { db: "2mj_factor", dataBase: dataIso("31/07/2026"), esperado: "2mj_factor_Medicao_2026-07-01_2026-07-31.xlsx" },
  { db: "crefazscm_webscm", dataBase: "2026-07-05", esperado: "crefazscm_webscm_Medicao_2026-07-01_2026-07-05.xlsx" },
  { db: null, dataBase: "2026-07-05", esperado: null },
  { db: "2mj_factor", dataBase: null, esperado: null },
];
for (const c of casosNome) {
  const obtido = nomePlanAnalitica(c.db, c.dataBase);
  const ok = obtido === c.esperado;
  if (!ok) falhas++;
  console.log(
    `${ok ? "OK  " : "FALHA"} nomePlanAnalitica(${JSON.stringify(c.db)}, ${JSON.stringify(c.dataBase)}): ${JSON.stringify(obtido)}${ok ? "" : ` (esperado ${JSON.stringify(c.esperado)})`}`
  );
}

// confere `nomesPlanAnaliticaCandidatos` -- achado 2026-08-31 (2ª rodada): parte dos arquivos
// reais no Drive tem sufixo `_{rds}` antes do .xlsx (ex. "..._DB03.xlsx"), parte não, e não dá
// pra saber de antemão qual variante existe -- por isso duas tentativas de casamento, na ordem
// sem sufixo primeiro.
const casosCandidatos: { db: string | null; rds: string | null; dataBase: string | null; esperado: string[] }[] = [
  {
    db: "allesc_webesc",
    rds: "DB03",
    dataBase: "2026-07-31",
    esperado: ["allesc_webesc_Medicao_2026-07-01_2026-07-31.xlsx", "allesc_webesc_Medicao_2026-07-01_2026-07-31_DB03.xlsx"],
  },
  { db: "crefazscm_webscm", rds: null, dataBase: "2026-07-31", esperado: ["crefazscm_webscm_Medicao_2026-07-01_2026-07-31.xlsx"] },
  { db: null, rds: "DB03", dataBase: "2026-07-31", esperado: [] },
];
for (const c of casosCandidatos) {
  const obtido = nomesPlanAnaliticaCandidatos(c.db, c.rds, c.dataBase);
  const ok = JSON.stringify(obtido) === JSON.stringify(c.esperado);
  if (!ok) falhas++;
  console.log(
    `${ok ? "OK  " : "FALHA"} nomesPlanAnaliticaCandidatos(${JSON.stringify(c.db)}, ${JSON.stringify(c.rds)}, ${JSON.stringify(c.dataBase)}): ${JSON.stringify(obtido)}${ok ? "" : ` (esperado ${JSON.stringify(c.esperado)})`}`
  );
}

console.log(falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falharam.`);
process.exit(falhas === 0 ? 0 : 1);
