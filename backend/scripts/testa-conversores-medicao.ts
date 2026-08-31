// Descartável (teste, não toca no banco): valida os conversores da importação da carteira contra
// os valores REAIS da planilha de medição -- datas em dd/mm/aaaa viram ISO (a coluna gerada
// cart_nome_plan_analitica depende disso), e valores viram número.
// Uso: npx tsx scripts/testa-conversores-medicao.ts
import { dataIso, inteiro, nomePlanAnalitica, numero, texto } from "../src/planilhaValores";

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
// do INSERT) reproduz exatamente a coluna gerada `cart_nome_plan_analitica` do banco (SQL).
const casosNome: { prod: string | null; dataBase: string | null; esperado: string | null }[] = [
  { prod: "Módulo Esc", dataBase: dataIso("31/07/2026"), esperado: "Módulo Esc_Medicao_2026-07-01_2026-07-31.xlsx" },
  { prod: "2mj_factor", dataBase: "2026-07-05", esperado: "2mj_factor_Medicao_2026-07-01_2026-07-05.xlsx" },
  { prod: null, dataBase: "2026-07-05", esperado: null },
  { prod: "2mj_factor", dataBase: null, esperado: null },
];
for (const c of casosNome) {
  const obtido = nomePlanAnalitica(c.prod, c.dataBase);
  const ok = obtido === c.esperado;
  if (!ok) falhas++;
  console.log(
    `${ok ? "OK  " : "FALHA"} nomePlanAnalitica(${JSON.stringify(c.prod)}, ${JSON.stringify(c.dataBase)}): ${JSON.stringify(obtido)}${ok ? "" : ` (esperado ${JSON.stringify(c.esperado)})`}`
  );
}

console.log(falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falharam.`);
process.exit(falhas === 0 ? 0 : 1);
