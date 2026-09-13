import { useEffect, useState } from "react";
import { api, type AuditEntry } from "../api";

interface Props {
  token: string;
}

const EVENT_LABELS: Record<string, string> = {
  login_success: "로그인 성공",
  login_failed: "로그인 실패",
  device_paired: "PC 등록",
  device_removed: "PC 등록 해제",
  guest_pin_created: "게스트 코드 발급",
  guest_pin_redeemed: "게스트 코드 사용",
  agent_online: "PC 온라인",
  agent_offline: "PC 오프라인",
  session_start: "원격 접속 시작",
};

function formatDetail(entry: AuditEntry): string {
  if (!entry.detail) return "";
  const { name, reason, via } = entry.detail as { name?: string; reason?: string; via?: string };
  if (name) return name;
  if (reason === "bad_password") return "비밀번호 오류";
  if (reason === "bad_totp") return "인증앱 코드 오류";
  if (via === "guest") return "게스트 접속";
  return "";
}

export function AuditLog({ token }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api
      .listAudit(token)
      .then((res) => setEntries(res.entries))
      .catch((err) => setError(err instanceof Error ? err.message : "불러오기 실패"));
  }, [open, token]);

  return (
    <section className="panel">
      <button type="button" className="link" onClick={() => setOpen((v) => !v)}>
        {open ? "활동 로그 닫기" : "활동 로그 보기"}
      </button>
      {open && (
        <>
          {error && <p className="error">{error}</p>}
          {entries.length === 0 && !error && <p className="hint">기록이 없습니다.</p>}
          <ul className="audit-list">
            {entries.map((e) => (
              <li key={e.id}>
                <span className="audit-event">{EVENT_LABELS[e.event] || e.event}</span>
                <span className="audit-detail">{formatDetail(e)}</span>
                <span className="audit-time">{new Date(e.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
