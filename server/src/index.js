import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import { db } from "./db.js";
import { hashPassword } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { devicesRouter } from "./routes/devices.js";
import { sessionsRouter } from "./routes/sessions.js";
import { attachSignaling } from "./ws/signaling.js";

// 회원가입 화면 없이, 서버에 미리 설정한 접속 비밀번호로 로그인한다.
// 최초 실행 시에만 OWNER_PASSWORD를 읽어 등록하고, 이후에는 db.json에
// 저장된 값을 그대로 사용한다 (비밀번호 변경은 README 참고).
function ensureOwnerSeeded() {
  if (db.state.users.length > 0) return;
  const password = process.env.OWNER_PASSWORD;
  if (!password) {
    console.warn(
      "[경고] OWNER_PASSWORD가 설정되지 않아 아직 로그인할 수 없습니다. .env에 설정 후 서버를 다시 시작하세요."
    );
    return;
  }
  db.state.users.push({
    id: "owner",
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  });
  db.save();
  console.log("소유자 접속 비밀번호가 등록되었습니다.");
}
ensureOwnerSeeded();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/devices", devicesRouter);
app.use("/api/sessions", sessionsRouter);

app.get("/health", (req, res) => res.json({ ok: true }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

const server = http.createServer(app);
attachSignaling(server);

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`시그널링 서버 실행 중: http://localhost:${port}`);
});
