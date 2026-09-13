import { useState, type FormEvent } from "react";
import { api } from "../api";

interface Props {
  onConnected: (guestToken: string, deviceId: string) => void;
}

export function GuestAccess({ onConnected }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { guestToken, deviceId } = await api.redeemPin(code);
      onConnected(guestToken, deviceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>1회성 코드로 접속</h2>
      <p className="hint">PC 소유자에게 받은 6자리 코드를 입력하세요. 계정 로그인 없이 한 번만 접속할 수 있습니다.</p>
      <label>
        접속 코드
        <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="123456" required />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "접속 중..." : "접속"}
      </button>
    </form>
  );
}
