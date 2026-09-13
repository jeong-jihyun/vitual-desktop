import { Router } from "express";
import { db } from "../db.js";
import { verifyPassword, signUserToken } from "../auth.js";

export const authRouter = Router();

// 개인용 도구이므로 회원가입 절차가 없다. 소유자 접속 비밀번호는
// 서버 시작 시 OWNER_PASSWORD 환경변수로 1회 자동 등록된다 (index.js 참고).
authRouter.post("/login", (req, res) => {
  const { password } = req.body || {};
  const owner = db.state.users[0];

  if (!owner) {
    return res
      .status(503)
      .json({ error: "서버에 접속 비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요." });
  }
  if (!verifyPassword(password || "", owner.passwordHash)) {
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }

  res.json({ token: signUserToken(owner) });
});
