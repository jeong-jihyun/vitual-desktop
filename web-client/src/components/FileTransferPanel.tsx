import { useState, type ChangeEvent } from "react";
import { FileTransferChannel, type SharedFile } from "../fileTransfer";

interface Props {
  transfer: FileTransferChannel | null;
  files: SharedFile[];
  onRefresh: () => void;
  externalError?: string | null;
}

export function FileTransferPanel({ transfer, files, onRefresh, externalError }: Props) {
  const [open, setOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; sent: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button className="panel-toggle" onClick={() => setOpen(true)}>
        파일 전송
      </button>
    );
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !transfer) return;
    setError(null);
    setUploadProgress({ name: file.name, sent: 0, total: file.size });
    try {
      await transfer.uploadFile(file, (sent, total) => setUploadProgress({ name: file.name, sent, total }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했습니다.");
    } finally {
      setUploadProgress(null);
      e.target.value = "";
    }
  }

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <span>파일 전송</span>
        <button className="link" onClick={() => setOpen(false)}>
          닫기
        </button>
      </div>

      <section>
        <h4>PC로 업로드</h4>
        <input type="file" onChange={handleUpload} disabled={!!uploadProgress} />
        {uploadProgress && (
          <p className="hint">
            {uploadProgress.name} 업로드 중... {Math.round((uploadProgress.sent / uploadProgress.total) * 100)}%
          </p>
        )}
      </section>

      <section>
        <div className="side-panel-row">
          <h4>공유 폴더에서 다운로드</h4>
          <button className="link" onClick={onRefresh}>
            새로고침
          </button>
        </div>
        {files.length === 0 ? (
          <p className="hint">shared_files 폴더가 비어있습니다.</p>
        ) : (
          <ul className="file-list">
            {files.map((f) => (
              <li key={f.name}>
                <span className="file-name">{f.name}</span>
                <span className="hint">{(f.size / 1024).toFixed(1)} KB</span>
                <button className="link" onClick={() => transfer?.requestDownload(f.name)}>
                  다운로드
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(error || externalError) && <p className="error">{error ?? externalError}</p>}
    </div>
  );
}
