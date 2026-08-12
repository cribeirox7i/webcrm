import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Anexo } from "../api/types";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { AnexoUploadForm } from "./AnexoUploadForm";
import { DownloadIcon, TrashIcon } from "./icons";
import { usePermissao } from "../auth/usePermissao";

function formatDate(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR");
}

interface AnexosSectionProps {
  /** Coluna de FK usada em `anexos` (cliente_id ou fornecedor_id) -- reaproveitável em
   * outras entidades sem mudar o componente, só o filtro. */
  filterKey: "cliente_id" | "fornecedor_id";
  filterId: number;
  /** Menu dono da permissão (bate com filterKey: "clientes" ou "fornecedores") -- o
   * backend confere a mesma coisa por conta própria, ver routes/anexos.ts. */
  menuKey: "clientes" | "fornecedores";
}

export function AnexosSection({ filterKey, filterId, menuKey }: AnexosSectionProps) {
  const { podeInserir, podeExcluir } = usePermissao(menuKey);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.list<Anexo>("anexos", { [filterKey]: filterId, limit: 20000 });
      setAnexos(res.data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, filterId]);

  async function handleUpload(file: File, nome: string) {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(filterKey, String(filterId));
      if (nome.trim()) formData.append("anexo_nome", nome.trim());
      const created = await api.uploadAnexo(formData);
      setAnexos((prev) => [...prev, created]);
      setShowUpload(false);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(anexo: Anexo) {
    try {
      const { url } = await api.downloadAnexo(anexo.anexo_id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(`Não foi possível baixar o anexo: ${(err as Error).message}`);
    }
  }

  async function handleDelete(anexo: Anexo) {
    if (!confirm(`Excluir o anexo "${anexo.anexo_nome ?? anexo.anexo_id}"?`)) return;
    try {
      await api.remove("anexos", anexo.anexo_id);
      setAnexos((prev) => prev.filter((a) => a.anexo_id !== anexo.anexo_id));
    } catch (err) {
      alert(`Não foi possível excluir: ${(err as Error).message}`);
    }
  }

  const columns: DataGridColumn<Anexo>[] = [
    { id: "anexo_nome", header: "Nome do anexo", value: (a) => a.anexo_nome ?? "", width: 220 },
    { id: "anexo_data", header: "Data", value: (a) => a.anexo_data, width: 100, align: "center", cell: (a) => formatDate(a.anexo_data) },
  ];

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <h3>Anexos</h3>
        {podeInserir && (
          <button className="primary" onClick={() => setShowUpload(true)}>
            + Adicionar
          </button>
        )}
      </div>
      <div className="dashboard-card-body">
        {loadError && (
          <div className="banner-error">
            Falha ao carregar: {loadError} <button onClick={loadAll}>Tentar de novo</button>
          </div>
        )}
        {!loading && anexos.length === 0 ? (
          <p className="dashboard-empty">Nenhum anexo cadastrado.</p>
        ) : (
          <DataGrid
            data={anexos}
            columns={columns}
            getRowId={(a) => a.anexo_id}
            searchValue={(a) => a.anexo_nome ?? ""}
            exportFilename={`anexos_${filterKey}_${filterId}`}
            hideToolbar
            actionsWidth={90}
            renderActions={(a) => (
              <div className="row-actions">
                <button className="icon-btn" title="Baixar" aria-label="Baixar" onClick={() => handleDownload(a)}>
                  <DownloadIcon />
                </button>
                {podeExcluir && (
                  <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={() => handleDelete(a)}>
                    <TrashIcon />
                  </button>
                )}
              </div>
            )}
          />
        )}
      </div>

      {showUpload && (
        <AnexoUploadForm
          saving={uploading}
          error={uploadError}
          onCancel={() => {
            setShowUpload(false);
            setUploadError(null);
          }}
          onSubmit={handleUpload}
        />
      )}
    </div>
  );
}
