import { useEffect, useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnSizingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { exportToCsv, exportToPdf, exportToXlsx, shareExport, type ExportCell } from "../lib/export";
import { useIsMobile } from "../lib/useIsMobile";
import { CsvIcon, PdfIcon, ShareIcon, XlsIcon } from "./icons";

export interface DataGridColumn<T> {
  id: string;
  header: string;
  /** Raw value: used for sort, export and (by default) display. */
  value: (row: T) => ExportCell;
  /** Optional custom render (e.g. a colored badge). Falls back to value(). */
  cell?: (row: T) => React.ReactNode;
  width?: number;
  minWidth?: number;
  /** Alinhamento do cabeçalho e do conteúdo -- "right" pra valores monetários, "center" pra datas. */
  align?: "left" | "right" | "center";
}

export interface DataGridFilter<T> {
  id: string;
  label: string;
  value: (row: T) => string;
}

/** Checkbox por linha + "selecionar todas" (considerando só as linhas visíveis após busca/filtro).
 * Estado (`selectedIds`) mora no componente pai -- o DataGrid só renderiza e dispara os callbacks. */
export interface DataGridSelection {
  selectedIds: Set<string | number>;
  onToggle: (id: string | number) => void;
  onToggleAll: (ids: (string | number)[]) => void;
}

interface DataGridProps<T> {
  data: T[];
  columns: DataGridColumn<T>[];
  getRowId: (row: T) => string | number;
  searchValue: (row: T) => string;
  searchPlaceholder?: string;
  filters?: DataGridFilter<T>[];
  renderActions?: (row: T) => React.ReactNode;
  actionsWidth?: number;
  toolbarExtra?: React.ReactNode;
  exportFilename: string;
  loading?: boolean;
  /** Hides search/filters/export toolbar and the row-count subtitle — for grids embedded in a card. */
  hideToolbar?: boolean;
  /** Optional per-row className (e.g. bold linhas agregadoras num WBS). */
  rowClassName?: (row: T) => string | undefined;
  /** Torna a linha inteira clicável (ex.: abrir um drill-in) -- os botões de ação devem dar stopPropagation. */
  onRowClick?: (row: T) => void;
  /** Sobrescreve o ícone padrão "Exportar PDF" da toolbar com uma exportação customizada (ex.: relatório com capa). */
  onExportPdf?: () => void;
  /** Valores iniciais dos dropdowns de filtro (ex.: abrir Portfólio já filtrado em "ANDAMENTO"). */
  defaultFilterValues?: Record<string, string>;
  /** Ativa a coluna de checkbox (seleção múltipla) -- omitir pra grid sem seleção (padrão). */
  selection?: DataGridSelection;
  /** Colunas que só entram no XLS/PDF/CSV/compartilhar -- nunca aparecem na tela. Útil pra dado
   * que o usuário quer no relatório mas que deixaria a grid apertada demais (ex.: CNPJ + CNPJ de
   * faturamento + índice de reajuste + aniversário do contrato na Tabela de Preços). Só `header`
   * e `value` são usados; `width`/`cell`/`align`/`minWidth` não fazem sentido pra algo que não é
   * renderizado. Aparecem no arquivo depois das colunas visíveis, na ordem em que forem passadas. */
  extraExportColumns?: Pick<DataGridColumn<T>, "header" | "value">[];
}

const columnHelper = createColumnHelper<Record<string, unknown>>();

/** Identidade estável pro default de `filters` -- `filters = []` no destructuring criaria um
 * array novo a cada render, invalidando os useMemo que dependem dele sem nenhum motivo real. */
const NO_FILTERS: DataGridFilter<never>[] = [];
const NO_EXTRA_EXPORT: Pick<DataGridColumn<never>, "header" | "value">[] = [];

export function DataGrid<T>({
  data,
  columns,
  getRowId,
  searchValue,
  searchPlaceholder = "Buscar...",
  filters = NO_FILTERS as unknown as DataGridFilter<T>[],
  renderActions,
  actionsWidth = 150,
  toolbarExtra,
  exportFilename,
  loading = false,
  hideToolbar = false,
  rowClassName,
  onRowClick,
  onExportPdf,
  defaultFilterValues,
  selection,
  extraExportColumns = NO_EXTRA_EXPORT as unknown as Pick<DataGridColumn<T>, "header" | "value">[],
}: DataGridProps<T>) {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>(defaultFilterValues ?? {});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  // Só decide o RENDER final (cartão vs. tabela, no fim do componente) -- toda a lógica acima
  // (filtro, ordenação, tableColumns, cálculo de largura) é a mesma nos dois modos, calculada
  // do mesmo jeito mesmo quando o resultado não é usado pelo lado cartão. Isso é intencional:
  // manter os dois caminhos compartilhando a mesma lógica de dado evita a tabela e o cartão
  // divergirem (ex.: um aplicar o filtro e o outro não).
  const isMobile = useIsMobile();

  // As páginas passam `searchValue`/`getRowId`/`renderActions`/`selection` inline (identidade
  // nova a cada render). Guardar em ref e ler no momento da chamada mantém o valor sempre
  // atual SEM entrar nas listas de dependência dos useMemo abaixo -- especialmente o
  // `tableColumns`: uma função `cell` com identidade nova faz o flexRender do TanStack tratá-la
  // como outro componente, então o React desmonta e remonta a célula a cada render. Isso
  // destruía foco e clique dos botões de ação (bug real: nenhum botão da tela Financeiro abria
  // nada, o foco do Tab "piscava e sumia"), porque a remontagem impede o mousedown e o mouseup
  // de cair no mesmo elemento -- requisito do navegador pra emitir o evento de clique.
  const searchValueRef = useRef(searchValue);
  searchValueRef.current = searchValue;
  const getRowIdRef = useRef(getRowId);
  getRowIdRef.current = getRowId;
  const renderActionsRef = useRef(renderActions);
  renderActionsRef.current = renderActions;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const filteredRef = useRef<T[]>([]);

  const filterOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    filters.forEach((f) => {
      const set = new Set<string>();
      data.forEach((row) => {
        const v = f.value(row);
        if (v) set.add(v);
      });
      map[f.id] = [...set].sort((a, b) => a.localeCompare(b));
    });
    return map;
  }, [data, filters]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((row) => {
      if (term && !searchValueRef.current(row).toLowerCase().includes(term)) return false;
      for (const f of filters) {
        const active = filterValues[f.id];
        if (active && f.value(row) !== active) return false;
      }
      return true;
    });
  }, [data, search, filterValues, filters]);
  filteredRef.current = filtered;

  const alignById = useMemo(() => {
    const map: Record<string, "left" | "right" | "center"> = {};
    columns.forEach((col) => {
      if (col.align) map[col.id] = col.align;
    });
    return map;
  }, [columns]);

  // Só a PRESENÇA (não a identidade) dessas props muda o conjunto de colunas -- booleano em vez
  // da função/objeto cru pra não invalidar o useMemo a cada render.
  const hasActions = !!renderActions;
  const hasSelection = !!selection;

  const tableColumns = useMemo(() => {
    const cols: ColumnDef<Record<string, unknown>, ExportCell>[] = columns.map((col) =>
      columnHelper.accessor((row) => col.value(row as T), {
        id: col.id,
        header: col.header,
        size: col.width ?? 160,
        minSize: col.minWidth ?? 70,
        cell: (info) => {
          const row = info.row.original as T;
          const content = col.cell ? col.cell(row) : (col.value(row) ?? "");
          return (
            <span className="cell-content" style={col.align ? { textAlign: col.align } : undefined}>
              {content}
            </span>
          );
        },
      })
    );
    if (hasSelection) {
      cols.unshift(
        columnHelper.display({
          id: "__selection",
          size: 40,
          minSize: 40,
          // header/cell leem das refs (são chamados durante o render, então o valor é sempre o
          // atual) -- assim a definição da coluna não precisa ser recriada quando a seleção muda.
          header: () => {
            const sel = selectionRef.current;
            if (!sel) return null;
            const ids = filteredRef.current.map((row) => getRowIdRef.current(row));
            const allSelected = ids.length > 0 && ids.every((id) => sel.selectedIds.has(id));
            return (
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => sel.onToggleAll(ids)}
                aria-label="Selecionar todas"
              />
            );
          },
          cell: (info) => {
            const sel = selectionRef.current;
            if (!sel) return null;
            const id = getRowIdRef.current(info.row.original as T);
            return (
              <input
                type="checkbox"
                checked={sel.selectedIds.has(id)}
                onChange={() => sel.onToggle(id)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Selecionar linha"
              />
            );
          },
        })
      );
    }
    if (hasActions) {
      cols.push(
        columnHelper.display({
          id: "__actions",
          header: "",
          size: actionsWidth,
          minSize: Math.min(120, actionsWidth),
          cell: (info) => renderActionsRef.current?.(info.row.original as T) ?? null,
        })
      );
    }
    return cols;
  }, [columns, hasActions, hasSelection, actionsWidth]);

  const table = useReactTable({
    data: filtered as Record<string, unknown>[],
    columns: tableColumns,
    state: { sorting, columnSizing },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(getRowId(row as T)),
  });

  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 38,
    overscan: 12,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  // Largura livre do container (.table-scroll) -- usada pra esticar as colunas quando a soma
  // das larguras definidas é menor que o espaço disponível, em vez de deixar uma faixa em
  // branco do lado das grids em telas largas.
  const [availWidth, setAvailWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setAvailWidth(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Colunas de seleção/ações têm largura de ícone e não devem esticar nem encolher -- só as
  // colunas de dado (fixedTotal excluído) absorvem a diferença, proporcionalmente ao que já
  // tinham.
  const isFixedCol = (id: string) => id === "__selection" || id === "__actions";
  const naturalTotal = table.getTotalSize();
  const leafCols = table.getAllLeafColumns();
  const fixedTotal = leafCols.reduce((sum, c) => (isFixedCol(c.id) ? sum + c.getSize() : sum), 0);
  const scalableNatural = naturalTotal - fixedTotal;

  // Piso: soma dos minSize das colunas de dado. Abaixo disso não dá pra encolher sem deixar a
  // célula ilegível, então aí sim a rolagem volta -- é o limite físico, não uma escolha.
  const scalableMin = leafCols.reduce((sum, c) => (isFixedCol(c.id) ? sum : sum + (c.columnDef.minSize ?? 70)), 0);

  // Espaço que as colunas de dado podem ocupar de fato. `availWidth === 0` no primeiro render
  // (antes do ResizeObserver medir) -- nesse caso usa a largura natural, senão a grid pisca
  // encolhida ao montar.
  //
  // GUARD_PX: medido no navegador que, pedindo exatamente a largura do container, ainda sobrava
  // ~3px de rolagem (borda do .table-scroll + arredondamento do border-collapse sob zoom 80%).
  // Sem essa folga a barra horizontal aparece por 3px, que é justamente o que se quer evitar.
  const GUARD_PX = 4;
  const scalableAvail = availWidth > 0 ? Math.floor(availWidth) - fixedTotal - GUARD_PX : scalableNatural;
  const scalableTarget = Math.max(scalableMin, scalableAvail);

  // Antes só esticava (scale > 1 quando sobrava espaço); agora também encolhe (scale < 1 quando
  // falta), o que é o que garante "nunca rolar" sem depender de cada tela declarar largura que
  // caiba na menor tela em uso. Encolher é proporcional, então coluna larga cede mais espaço
  // absoluto que coluna estreita.
  const scale = scalableNatural > 0 ? scalableTarget / scalableNatural : 1;
  const tableWidth = fixedTotal + scalableTarget;
  const displaySize = (id: string, size: number) => (isFixedCol(id) ? size : size * scale);

  function exportRows() {
    // extraExportColumns vai depois das colunas visíveis, na ordem em que foi passado -- nunca
    // participa do que é renderizado na tela (grid/th/td), só do arquivo gerado.
    const headers = [...columns.map((c) => c.header), ...extraExportColumns.map((c) => c.header)];
    return {
      headers,
      rows: filtered.map((row) => [
        ...columns.map((c) => c.value(row)),
        ...extraExportColumns.map((c) => c.value(row)),
      ]),
    };
  }

  function handleExportXlsx() {
    const { headers, rows: exportedRows } = exportRows();
    exportToXlsx(exportFilename, headers, exportedRows);
  }

  function handleExportPdf() {
    if (onExportPdf) {
      onExportPdf();
      return;
    }
    const { headers, rows: exportedRows } = exportRows();
    exportToPdf(exportFilename, headers, exportedRows);
  }

  function handleExportCsv() {
    const { headers, rows: exportedRows } = exportRows();
    exportToCsv(exportFilename, headers, exportedRows);
  }

  function handleShare() {
    const { headers, rows: exportedRows } = exportRows();
    shareExport(exportFilename, headers, exportedRows);
  }

  return (
    <div className="datagrid">
      {!hideToolbar && (
        <>
          <div className="datagrid-toolbar">
            <div className="datagrid-toolbar-left">
              <input
                className="search"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {filters.map((f) => (
                <span className="datagrid-filter" key={f.id}>
                  <select
                    value={filterValues[f.id] ?? ""}
                    onChange={(e) =>
                      setFilterValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                    }
                  >
                    <option value="">{f.label} (todos)</option>
                    {(filterOptions[f.id] ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </span>
              ))}
            </div>
            <div className="datagrid-toolbar-right">
              <button className="icon-btn" title="Exportar XLS" aria-label="Exportar XLS" onClick={handleExportXlsx}>
                <XlsIcon />
              </button>
              <button className="icon-btn" title="Exportar CSV" aria-label="Exportar CSV" onClick={handleExportCsv}>
                <CsvIcon />
              </button>
              <button className="icon-btn" title="Exportar PDF" aria-label="Exportar PDF" onClick={handleExportPdf}>
                <PdfIcon />
              </button>
              <button className="icon-btn" title="Compartilhar" aria-label="Compartilhar" onClick={handleShare}>
                <ShareIcon />
              </button>
              {toolbarExtra}
            </div>
          </div>

          <p className="page-subtitle">
            {loading ? "Carregando..." : `${filtered.length} de ${data.length} registros`}
          </p>
        </>
      )}

      {isMobile ? (
        <div className="datagrid-cards" ref={scrollRef}>
          {filtered.length === 0 ? (
            <p className="dashboard-empty">Nenhum registro encontrado.</p>
          ) : (
            filtered.map((row) => {
              const id = getRowId(row);
              const rowClasses = ["datagrid-card", rowClassName?.(row), onRowClick ? "clickable-row" : undefined]
                .filter(Boolean)
                .join(" ");
              return (
                <div
                  key={String(id)}
                  className={rowClasses}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selection && (
                    <label className="datagrid-card-select" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selection.selectedIds.has(id)}
                        onChange={() => selection.onToggle(id)}
                        aria-label="Selecionar"
                      />
                    </label>
                  )}
                  {columns.map((col) => (
                    <div key={col.id} className="datagrid-card-field">
                      <span className="datagrid-card-label">{col.header}</span>
                      <span className="datagrid-card-value">{col.cell ? col.cell(row) : (col.value(row) ?? "")}</span>
                    </div>
                  ))}
                  {renderActions && (
                    <div className="datagrid-card-actions" onClick={(e) => e.stopPropagation()}>
                      {renderActions(row)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="table-scroll" ref={scrollRef}>
          <table style={{ width: tableWidth }}>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{
                        width: displaySize(header.column.id, header.getSize()),
                        textAlign: alignById[header.column.id],
                      }}
                      className={header.column.getCanSort() ? "sortable" : ""}
                      onClick={header.column.getToggleSortingHandler()}
                      // o header pode ser cortado por reticências quando a coluna encolhe (ver
                      // `thead th` no index.css) -- o title garante o nome completo no hover
                      title={typeof header.column.columnDef.header === "string" ? header.column.columnDef.header : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onClick={(e) => e.stopPropagation()}
                          className={`col-resizer ${header.column.getIsResizing() ? "resizing" : ""}`}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: paddingTop }} colSpan={tableColumns.length} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                const rowClasses = [rowClassName?.(row.original as T), onRowClick ? "clickable-row" : undefined]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr
                    key={row.id}
                    className={rowClasses || undefined}
                    onClick={onRowClick ? () => onRowClick(row.original as T) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} style={{ width: displaySize(cell.column.id, cell.column.getSize()) }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: paddingBottom }} colSpan={tableColumns.length} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
