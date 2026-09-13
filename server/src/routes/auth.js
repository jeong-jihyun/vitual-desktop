import { Router } from "express";
import { db } from "../db.js";
import { verifyPassword, signUserToken } from "../auth.js";
import { isTotpEnabled, verifyTotp } from "../totp.js";
import { loginRateLimiter } from "../rateLimit.js";
import { logEvent } from "../audit.js";

export const authRouter = Router();

// 개인용 도구이므로 회원가입 절차가 없다. 소유자 접속 비밀번호는
// 서버 시작 시 OWNER_PASSWORD 환경변수로 1회 자동 등록된다 (index.js 참고).
//
// TOTP_SECRET이 설정된 경우(선택) 비밀번호 외에 인증앱 6자리 코드도 요구한다.
authRouter.post("/login", loginRateLimiter(), (req, res) => {
  const { password, totp } = req.body || {};
  const owner = db.state.users[0];

  if (!owner) {
    return res
      .status(503)
      .json({ error: "서버에 접속 비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요." });
  }
  if (!verifyPassword(password || "", owner.passwordHash)) {
    req.recordLoginFailure();
    logEvent("login_failed", { reason: "bad_password" }, req);
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }

  if (isTotpEnabled()) {
    if (!totp) {
      // 클라이언트가 아직 2FA가 필요한 줄 모르고 비밀번호만 보낸 첫 시도 -
      // 실제 유효하지 않은 코드 시도가 아니므로 무차별 대입 카운트에는 넣지 않는다.
      return res.status(401).json({ error: "인증앱 코드를 입력해주세요.", requireTotp: true });
    }
    if (!verifyTotp(totp)) {
      req.recordLoginFailure();
      logEvent("login_failed", { reason: "bad_totp" }, req);
      return res.status(401).json({ error: "인증앱 코드가 올바르지 않습니다.", requireTotp: true });
    }
  }

  req.recordLoginSuccess();
  logEvent("login_success", null, req);
  res.json({ token: signUserToken(owner) });
});
