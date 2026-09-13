import fs from "node:fs";
import path from "node:path";

// 개인용 소규모 배포(PC 3~5대) 기준으로 별도 DB 엔진 없이
// 단일 JSON 파일에 상태를 저장한다. Node는 단일 스레드이고
// 모든 쓰기가 동기(fs.writeFileSync)이므로 레이스 컨디션 없이 안전하다.

const DATA_DIR = process.env.DATA_DIR || "./data";
const DB_FILE = path.join(DATA_DIR, "db.json");

function emptyState() {
  return { users: [], devices: [], pairings: [], pins: [], auditLog: [] };
}

function load() {
  if (!fs.existsSync(DB_FILE)) return emptyState();
  try {
    return { ...emptyState(), ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
  } catch {
    return emptyState();
  }
}

const state = load();

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

export const db = {
  state,
  save,
};
