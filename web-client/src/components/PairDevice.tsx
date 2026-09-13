import { useState, type FormEvent } from "react";
import { api } from "../api";

interface Props {
  token: string;
  onPaired: () => void;
}

export function PairDevice({ token, onPaired }: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.claimDevice(token, code, name || "Windows PC");
      setCode("");
      setName("");
      onPaired();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h3>새 PC 등록</h3>
      <p className="hint">호스트 에이전트(agent.py)를 실행하면 콘솔에 6자리 코드가 표시됩니다.</p>
      <label>
        페어링 코드
        <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} required />
      </label>
      <label>
        PC 이름
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 거실 PC" />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "등록 중..." : "등록"}
      </button>
    </form>
  );
}
