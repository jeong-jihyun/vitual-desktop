import { useState } from "react";
import { getDiagnosticReport } from "../diagnostics";

// 로그인 화면을 포함해 앱 어디서든 눌러서 진단 정보를 볼 수 있어야 하므로
// (로그인 자체가 안 되는 버그도 있을 수 있음) 별도 화면 상태에 의존하지 않는다.
export function DiagnosticButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // navigator.clipboard가 없는 환경(http 등)에서는 아래 textarea를 직접
      // 선택해서 복사하면 되므로, 실패해도 조용히 넘어간다.
    }
  }

  if (!open) {
    return (
      <button type="button" className="diagnostic-trigger" onClick={() => setOpen(true)}>
        문제가 있었나요? 진단 정보 보기
      </button>
    );
  }

  const report = getDiagnosticReport();

  return (
    <div className="diagnostic-overlay" role="dialog" aria-label="진단 정보">
      <div className="diagnostic-modal">
        <div className="side-panel-header">
          <span>진단 정보</span>
          <button className="link" onClick={() => setOpen(false)}>
            닫기
          </button>
        </div>
        <p className="hint">
          아래 내용을 전부 선택해 복사한 다음, 무슨 문제가 있었는지와 함께 대화창에 붙여넣어 주세요.
        </p>
        <textarea readOnly value={report} onClick={(e) => e.currentTarget.select()} />
        <button onClick={() => copy(report)}>{copied ? "복사됨!" : "복사하기"}</button>
      </div>
    </div>
  );
}
