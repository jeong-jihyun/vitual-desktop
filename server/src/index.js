import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupFileLogging } from "./logging.js";
import { db } from "./db.js";
import { hashPassword } from "./auth.js";
import { isTotpEnabled } from "./totp.js";
import { authRouter } from "./routes/auth.js";
import { devicesRouter } from "./routes/devices.js";
import { sessionsRouter } from "./routes/sessions.js";
import { auditRouter } from "./routes/audit.js";
import { attachSignaling } from "./ws/signaling.js";

setupFileLogging();

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
app.use("/api/audit", auditRouter);

app.get("/health", (req, res) => res.json({ ok: true }));

// web-client가 빌드되어 있으면(dist/) 같은 포트에서 함께 서빙한다.
// 집 와이파이 내부 테스트든, 나중에 클라우드 서버에 배포하든 코드 변경 없이
// 서버 하나만 실행하면 API+웹 화면이 한 번에 뜨도록 하기 위함이다.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webClientDist = process.env.WEB_CLIENT_DIST || path.join(__dirname, "../../web-client/dist");

if (fs.existsSync(path.join(webClientDist, "index.html"))) {
  app.use(express.static(webClientDist));
  app.get(/^\/(?!api|ws).*/, (req, res) => {
    res.sendFile(path.join(webClientDist, "index.html"));
  });
} else {
  console.warn(
    `[안내] ${webClientDist}에 빌드된 웹 클라이언트가 없습니다. ` +
      "web-client에서 'npm run build'를 실행하면 이 서버가 웹 화면도 함께 서빙합니다 " +
      "(개발 중에는 'npm run dev'로 별도 실행해도 됩니다)."
  );
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

const server = http.createServer(app);
attachSignaling(server);

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`시그널링 서버 실행 중: http://localhost:${port} (같은 네트워크의 다른 기기에서는 이 PC의 IP로 접속)`);
  console.log(`2단계 인증(TOTP): ${isTotpEnabled() ? "사용 중" : "꺼져 있음 (scripts/generate-totp-secret.js로 켤 수 있음)"}`);
});
