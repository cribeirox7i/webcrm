import { useState } from "react";

interface AnexoUploadFormProps {
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (file: File, nome: string) => void;
}

export function AnexoUploadForm({ saving, error, onCancel, onSubmit }: AnexoUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState("");

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (file) onSubmit(file, nome);
        }}
      >
        <h2>Novo anexo</h2>

        <div className="form-row">
          <label htmlFor="anexo_arquivo">Arquivo *</label>
          <input
            id="anexo_arquivo"
            type="file"
            // espelha a whitelist do backend (storage.ts) -- aqui é só UX, quem barra de
            // verdade é o backend
            accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.webp,.zip,.msg,.eml"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="anexo_nome">Nome do anexo</label>
          <input
            id="anexo_nome"
            value={nome}
            placeholder={file?.name ?? "usa o nome do arquivo se vazio"}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={saving || !file}>
            {saving ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
