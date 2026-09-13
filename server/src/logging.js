import fs from "node:fs";
import path from "node:path";

// 서버를 실행한 터미널 창을 닫아버려도 로그가 남아있도록 파일에도 기록한다.
// 버그가 생겼을 때 사용자가 이 파일(DATA_DIR/server.log)만 찾아서 보내주면
// 되게 하는 것이 목적이다.

const DATA_DIR = process.env.DATA_DIR || "./data";
fs.mkdirSync(DATA_DIR, { recursive: true });

const LOG_PATH = path.join(DATA_DIR, "server.log");
const logStream = fs.createWriteStream(LOG_PATH, { flags: "a" });

function stringify(arg) {
  if (arg instanceof Error) return arg.stack || String(arg);
  if (typeof arg === "object" && arg !== null) {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function writeLine(level, args) {
  const line = `${new Date().toISOString()} [${level}] ${args.map(stringify).join(" ")}\n`;
  logStream.write(line);
}

export function setupFileLogging() {
  const originalLog = console.log.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  console.log = (...args) => {
    originalLog(...args);
    writeLine("INFO", args);
  };
  console.warn = (...args) => {
    originalWarn(...args);
    writeLine("WARN", args);
  };
  console.error = (...args) => {
    originalError(...args);
    writeLine("ERROR", args);
  };

  // 콘솔 창이 닫혀 원인을 못 볼 수 있는 크래시도 파일에는 반드시 남긴다.
  process.on("uncaughtException", (err) => {
    console.error("처리되지 않은 예외로 서버가 종료됩니다. server.log 파일 내용을 보내주세요.", err);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("처리되지 않은 프라미스 거부:", reason);
  });

  console.log(`파일 로그 기록 시작: ${LOG_PATH}`);
}
