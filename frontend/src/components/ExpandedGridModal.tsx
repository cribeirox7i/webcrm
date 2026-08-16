import type { ReactNode } from "react";
import { DataGrid, type DataGridColumn, type DataGridFilter } from "./DataGrid";

interface ExpandedGridModalProps<T> {
  title: string;
  onClose: () => void;
  data: T[];
  columns: DataGridColumn<T>[];
  getRowId: (row: T) => string | number;
  searchValue: (row: T) => string;
  searchPlaceholder?: string;
  filters?: DataGridFilter<T>[];
  renderActions?: (row: T) => ReactNode;
  actionsWidth?: number;
  exportFilename: string;
  loading?: boolean;
  emptyMessage: string;
  /** Ex.: o "+ Adicionar" que o card já tinha, pra continuar disponível expandido. */
  headerExtra?: ReactNode;
}

/** Versão tela-cheia de uma subgrid de dashboard (Contatos, Carteira, Contratos etc.) -- reusa os
 * mesmos dados/colunas já carregados no card compacto, só com a toolbar do DataGrid ligada
 * (busca, filtro, export), que nos cards fica escondida via `hideToolbar`. Não é uma tela nova
 * nem faz requisição própria; é literalmente o mesmo conteúdo do card, maior. */
export function ExpandedGridModal<T>({
  title,
  onClose,
  data,
  columns,
  getRowId,
  searchValue,
  searchPlaceholder,
  filters,
  renderActions,
  actionsWidth,
  exportFilename,
  loading,
  emptyMessage,
  headerExtra,
}: ExpandedGridModalProps<T>) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-fullscreen" onClick={(e) => e.stopPropagation()}>
        <div className="dashboard-card-header">
          <h2>{title}</h2>
          <div className="dashboard-card-header-actions">
            {headerExtra}
            <button type="button" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
        <div className="dashboard-card-body">
          {data.length === 0 ? (
            <p className="dashboard-empty">{emptyMessage}</p>
          ) : (
            <DataGrid
              data={data}
              columns={columns}
              getRowId={getRowId}
              searchValue={searchValue}
              searchPlaceholder={searchPlaceholder}
              filters={filters}
              renderActions={renderActions}
              actionsWidth={actionsWidth}
              exportFilename={exportFilename}
              loading={loading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
