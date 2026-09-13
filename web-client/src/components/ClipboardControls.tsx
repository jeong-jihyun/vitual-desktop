import { useState } from "react";

interface Props {
  onSend: (text: string) => void;
  onRequest: () => void;
  receivedText: string | null;
}

// navigator.clipboard는 "보안 컨텍스트"(HTTPS 또는 localhost)에서만 제공된다.
// 집 와이파이(http://사설IP) 접속 시에는 브라우저가 이 API 자체를 막아두므로,
// 오라클 클라우드 등 HTTPS 배포 이후에만 완전히 동작한다 (README 참고).
export function ClipboardControls({ onSend, onRequest, receivedText }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof navigator !== "undefined" && !!navigator.clipboard;

  if (!open) {
    return (
      <button className="panel-toggle" onClick={() => setOpen(true)}>
        클립보드
      </button>
    );
  }

  async function sendClipboard() {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      onSend(text);
    } catch {
      setError("클립보드를 읽을 수 없습니다 (브라우저 권한 또는 HTTPS 필요).");
    }
  }

  async function applyReceivedText() {
    if (receivedText == null) return;
    try {
      await navigator.clipboard.writeText(receivedText);
    } catch {
      setError("클립보드에 쓸 수 없습니다 (브라우저 권한 또는 HTTPS 필요).");
    }
  }

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <span>클립보드 동기화</span>
        <button className="link" onClick={() => setOpen(false)}>
          닫기
        </button>
      </div>

      {!supported && (
        <p className="hint">
          이 브라우저/접속 방식에서는 클립보드 API를 쓸 수 없습니다. HTTPS로 접속하면 사용할 수 있습니다.
        </p>
      )}

      <button disabled={!supported} onClick={sendClipboard}>
        내 클립보드를 PC로 보내기
      </button>
      <button disabled={!supported} className="secondary" onClick={onRequest}>
        PC의 클립보드 가져오기
      </button>

      {receivedText != null && (
        <div className="clipboard-preview">
          <p className="hint">PC에서 받은 텍스트:</p>
          <p className="clipboard-text">{receivedText}</p>
          <button disabled={!supported} onClick={applyReceivedText}>
            내 클립보드에 붙여넣기
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
