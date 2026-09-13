import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api";

interface Props {
  onAuthenticated: (token: string) => void;
}

// 회원가입 절차 없음: 서버(.env의 OWNER_PASSWORD)에 미리 설정된
// 접속 비밀번호 하나로 로그인한다. 개인 소유 PC 원격제어 용도이므로
// 계정을 여러 개 만들 필요가 없다.
//
// 서버에 TOTP_SECRET이 설정돼 있으면(선택 기능) 비밀번호 확인 후
// 인증앱 6자리 코드 입력 단계가 한 번 더 나타난다.
export function LoginForm({ onAuthenticated }: Props) {
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token } = await api.login(password, needsTotp ? totp : undefined);
      localStorage.setItem("deskcontrol-token", token);
      onAuthenticated(token);
    } catch (err) {
      if (err instanceof ApiError && err.requireTotp) {
        setNeedsTotp(true);
      }
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>내 PC 접속</h2>
      <label>
        접속 비밀번호
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          disabled={needsTotp}
          required
        />
      </label>
      {needsTotp && (
        <label>
          인증앱 코드
          <input
            type="text"
            inputMode="numeric"
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            maxLength={6}
            autoFocus
            required
          />
        </label>
      )}
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "확인 중..." : "접속"}
      </button>
    </form>
  );
}
