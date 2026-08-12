import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import evertecLogo from "../assets/evertec-logo.png";
import { getParametrosGerais } from "./parametros";

export type ExportCell = string | number | null;

// Cor de marca Evertec (mesma usada em --accent do CSS) -- em RGB pro jsPDF, que não lê variáveis CSS.
const ACCENT_RGB: [number, number, number] = [217, 96, 15];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Precisa vir ANTES de setar `src` -- sem isso, mesmo um servidor com CORS liberado
    // (Access-Control-Allow-Origin: *) deixa o <img> carregar visualmente mas "contamina"
    // o canvas, fazendo canvas.toDataURL() falhar silenciosamente (capturado como erro e
    // caindo no fallback do logo padrão, sem avisar que a URL configurada não foi usada).
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Converte o PNG importado (URL do bundle) num data URL, pra addImage do jsPDF. */
async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  return { dataUrl: canvas.toDataURL("image/png"), width: img.naturalWidth, height: img.naturalHeight };
}

/** Logo pra capa de PDF (fundo claro): usa a URL configurada em Parâmetros Gerais (Admin)
 * se existir; cai pro asset embutido do bundle se não houver URL configurada, ou se o
 * carregamento falhar (URL inválida, CORS bloqueando o canvas.toDataURL, etc). */
async function loadCoverLogoAsDataUrl(): Promise<{ dataUrl: string; width: number; height: number }> {
  const params = await getParametrosGerais();
  if (params.param_logo_claro_url) {
    try {
      return await loadImageAsDataUrl(params.param_logo_claro_url);
    } catch {
      // URL configurada mas não carregou (offline, CORS, link quebrado) -- não trava o PDF
    }
  }
  return loadImageAsDataUrl(evertecLogo);
}

/** Capa padrão (logo + título + linhas de subtítulo), reusada por todo PDF do app. */
async function addCoverPage(doc: jsPDF, title: string, lines: { text: string; fontSize?: number }[]) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await loadCoverLogoAsDataUrl();
  const logoWidth = 90;
  const logoHeight = (logo.height / logo.width) * logoWidth;
  doc.addImage(logo.dataUrl, "PNG", (pageWidth - logoWidth) / 2, 60, logoWidth, logoHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, pageWidth / 2, 140, { align: "center" });

  let y = 150;
  for (const line of lines) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(line.fontSize ?? 11);
    doc.text(line.text, pageWidth / 2, y, { align: "center" });
    y += 8;
  }
}

/** Numeração "Página X de Y" no rodapé de todas as páginas -- chamar por último, já com o doc completo. */
function addPageNumbers(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: "right" });
    doc.setTextColor(0);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function buildXlsxBlob(headers: string[], rows: ExportCell[][]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Dados");
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  sheet.columns.forEach((col) => {
    col.width = 20;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function exportToXlsx(filename: string, headers: string[], rows: ExportCell[][]) {
  downloadBlob(await buildXlsxBlob(headers, rows), `${filename}.xlsx`);
}

export function exportToPdf(filename: string, headers: string[], rows: ExportCell[][]) {
  const doc = new jsPDF({ orientation: "landscape" });
  autoTable(doc, {
    head: [headers],
    body: rows.map((row) => row.map((v) => (v ?? "").toString())),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [217, 96, 15] },
    margin: { top: 14 },
  });
  doc.save(`${filename}.pdf`);
}

function csvEscape(value: ExportCell): string {
  const s = (value ?? "").toString();
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(headers: string[], rows: ExportCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(";"));
  return "﻿" + lines.join("\r\n");
}

export function exportToCsv(filename: string, headers: string[], rows: ExportCell[][]) {
  downloadBlob(new Blob([buildCsv(headers, rows)], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

interface RelatorioConsumoInfo {
  competencia: string;
  clienteNome: string;
  cnpj: string;
  tipo: "BRUTO" | "LIQUIDO";
}

interface RelatorioConsumoLinha {
  produto: string;
  detalhe: string;
  qtd: number;
  valorAFaturar: number;
}

interface RelatorioConsumoAnalitico {
  produto: string;
  data: string;
  qtd: number;
  detalhe: string;
}

function formatMoneyBr(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Relatório de faturamento por cliente: capa + resumo por produto (só itens com valor,
 * já filtrado pelo chamador -- coluna única "Valor a Faturar", igual à regra Bruto/Líquido
 * já usada na grid de Faturamento) + analítico completo do mês.
 */
export async function exportRelatorioConsumoPdf(
  filename: string,
  info: RelatorioConsumoInfo,
  linhas: RelatorioConsumoLinha[],
  totalAFaturar: number,
  analitico: RelatorioConsumoAnalitico[]
) {
  const doc = new jsPDF();

  await addCoverPage(doc, "DOCUMENTO DE ACOMPANHAMENTO DE FATURAMENTO", [
    { text: `Detalhamento de Consumo - ${info.competencia}` },
    { text: `${info.clienteNome} - ${info.cnpj}` },
  ]);

  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Detalhamento de Consumo - ${info.competencia}`, 14, 15);
  doc.setFont("helvetica", "normal");
  doc.text(`${info.clienteNome} - ${info.cnpj}`, 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [["Produto", "Detalhe do Consumo", "Quantidade", "Valor a Faturar"]],
    body: [
      ...linhas.map((l) => [l.produto, l.detalhe, String(l.qtd), formatMoneyBr(l.valorAFaturar)]),
      ["", "", "TOTAL", formatMoneyBr(totalAFaturar)],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: ACCENT_RGB },
    columnStyles: { 1: { cellWidth: 70 } },
  });

  doc.addPage();
  autoTable(doc, {
    startY: 15,
    head: [["Produto", "Data", "Qtde", "Detalhe"]],
    body: analitico.map((a) => [a.produto, a.data, a.qtd.toLocaleString("pt-BR"), a.detalhe]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: ACCENT_RGB },
    columnStyles: { 0: { cellWidth: 55 } },
  });

  addPageNumbers(doc);
  doc.save(`${filename}.pdf`);
}

interface CsvProtheusLinha {
  cgc: string;
  codProd: string;
  valorUnit: number;
  condPag: string;
  mensagem: string;
}

/**
 * CSV pro import contábil do Protheus -- formato fixo (separador ";", decimal com ponto,
 * sem BOM). NATUREZA/ITEM/QUANTIDADE/CENTRO DE CUSTO são constantes fixas da integração,
 * confirmadas com o usuário -- não vêm de nenhuma coluna do banco.
 */
export function exportCsvProtheus(filename: string, linhas: CsvProtheusLinha[]) {
  const headers = ["CGC", "NATUREZA", "ITEM", "COD_PROD", "QUANTIDADE", "VALOR_UNIT", "CENTRO DE CUSTO", "COND_PAG", "MENSAGEM"];
  const rows = linhas.map((l) => [l.cgc, "10201", "01", l.codProd, "01", l.valorUnit.toFixed(2), "111909400", l.condPag, l.mensagem]);
  const lines = [headers, ...rows].map((row) => row.join(";"));
  downloadBlob(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

/**
 * Compartilha via menu nativo do navegador (Web Share API); se não suportado, baixa o CSV.
 *
 * O arquivo precisa estar pronto ANTES de chamar navigator.share, e a chamada precisa ficar
 * o mais próxima possível do clique original -- o navegador só permite compartilhar files
 * dentro da janela de "ativação do usuário" (user activation) daquele clique. Gerar um XLSX
 * via ExcelJS é assíncrono e pode levar tempo suficiente pra essa janela expirar, fazendo
 * navigator.share falhar silenciosamente (ou canShare voltar false) e cair sempre no download
 * -- por isso aqui o arquivo é um CSV, montado de forma síncrona, sem nenhum await antes do share.
 */
export function shareExport(filename: string, headers: string[], rows: ExportCell[][]) {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const file = new File([blob], `${filename}.csv`, { type: "text/csv" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };

  if (nav.share) {
    const canShareFiles = nav.canShare?.({ files: [file] }) ?? true; // sem canShare, tenta mesmo assim
    const attempt = canShareFiles ? nav.share({ files: [file], title: filename }) : nav.share({ title: filename });
    attempt.catch((err) => {
      if ((err as Error).name === "AbortError") return; // usuário cancelou o menu de compartilhamento
      downloadBlob(blob, file.name);
    });
    return;
  }
  downloadBlob(blob, file.name);
}

interface CronogramaResumo {
  responsavel: string;
  inicio: string;
  termino: string;
  percAtual: number;
  percEstim: number;
  percDesvio: number;
  status: string;
}

interface CronogramaLinha {
  numero: string; // crono_grp_tpc
  tipo: string; // 'A' | 'T'
  atividade: string;
  inicio: string;
  termino: string;
  percAtual: number;
  percEstim: number;
  percDesvio: number;
  status: string;
  responsavel: string;
}

function formatPercent(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

/**
 * Documento de acompanhamento de projeto: capa + resumo + tabela do cronograma --
 * mesmo formato do relatório original do AppSheet ("crono"), mas com marca Evertec
 * (logo + cor laranja --accent) em vez do verde/logo Dimensa do modelo antigo.
 */
export async function exportCronogramaPdf(
  filename: string,
  projeto: string,
  cliente: string,
  tipo: string,
  dataDoc: string,
  resumo: CronogramaResumo,
  linhas: CronogramaLinha[]
) {
  const doc = new jsPDF();

  // ---- capa ----
  await addCoverPage(doc, "DOCUMENTO DE ACOMPANHAMENTO DE PROJETO", [
    { text: projeto },
    { text: cliente },
    { text: `EVERTEC - ${tipo} - ${dataDoc}`, fontSize: 9 },
  ]);

  // ---- resumo do projeto ----
  doc.addPage();
  autoTable(doc, {
    startY: 15,
    head: [[{ content: "RESUMO DO PROJETO", colSpan: 2, styles: { halign: "center" } }]],
    body: [
      ["RESPONSÁVEL", resumo.responsavel],
      ["INÍCIO", resumo.inicio],
      ["TÉRMINO PREVISTO", resumo.termino],
      ["ATUAL", formatPercent(resumo.percAtual)],
      ["% ESTIMADO", formatPercent(resumo.percEstim)],
      ["DESVIO", formatPercent(resumo.percDesvio)],
      ["STATUS", resumo.status],
    ],
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: ACCENT_RGB, textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } },
  });

  // ---- cronograma ----
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`CRONOGRAMA - ${projeto}`, 14, 15);
  autoTable(doc, {
    startY: 20,
    head: [["#", "Tipo", "Atividade", "Início", "Término", "% Atual", "% Estim.", "% Desvio", "Status", "Responsável"]],
    body: linhas.map((l) => [
      l.numero,
      l.tipo,
      l.atividade,
      l.inicio,
      l.termino,
      formatPercent(l.percAtual),
      formatPercent(l.percEstim),
      formatPercent(l.percDesvio),
      l.status,
      l.responsavel,
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: ACCENT_RGB },
    didParseCell: (data) => {
      if (data.section === "body" && linhas[data.row.index]?.tipo === "A") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });

  addPageNumbers(doc);
  doc.save(`${filename}.pdf`);
}
