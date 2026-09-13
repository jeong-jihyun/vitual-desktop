import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../db.js";
import { requireUser } from "../middleware.js";
import { signDeviceToken } from "../auth.js";

export const devicesRouter = Router();
const PAIR_TTL_MS = Number(process.env.PAIR_TTL_SECONDS || 300) * 1000;

function genCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// 호스트 에이전트가 최초 실행 시 호출 (인증 불필요 - 아직 등록된 기기가 아니므로)
devicesRouter.post("/pair/start", (req, res) => {
  const now = Date.now();
  db.state.pairings = db.state.pairings.filter((p) => p.expiresAt > now);

  const tempId = crypto.randomUUID();
  const code = genCode();
  db.state.pairings.push({
    tempId,
    code,
    status: "pending",
    expiresAt: now + PAIR_TTL_MS,
    deviceId: null,
    deviceToken: null,
  });
  db.save();

  res.status(201).json({ tempId, code, expiresInSeconds: PAIR_TTL_MS / 1000 });
});

// 에이전트가 소유자의 등록 완료를 폴링 (tempId를 아는 사람만 조회 가능)
devicesRouter.get("/pair/status/:tempId", (req, res) => {
  const p = db.state.pairings.find((x) => x.tempId === req.params.tempId);
  if (!p) return res.status(404).json({ error: "페어링 요청을 찾을 수 없습니다." });

  if (p.status === "claimed") {
    return res.json({ status: "claimed", deviceId: p.deviceId, deviceToken: p.deviceToken });
  }
  res.json({ status: p.expiresAt < Date.now() ? "expired" : "pending" });
});

// 소유자가 웹에서 에이전트 콘솔에 표시된 코드를 입력해 PC를 계정에 등록
devicesRouter.post("/pair/claim", requireUser, (req, res) => {
  const { code, name } = req.body || {};
  const p = db.state.pairings.find((x) => x.code === code && x.status === "pending");

  if (!p || p.expiresAt < Date.now()) {
    return res.status(400).json({ error: "코드가 올바르지 않거나 만료되었습니다." });
  }

  const device = {
    id: crypto.randomUUID(),
    userId: req.userId,
    name: name || "Windows PC",
    status: "offline",
    createdAt: new Date().toISOString(),
    lastSeenAt: null,
  };
  db.state.devices.push(device);

  p.status = "claimed";
  p.deviceId = device.id;
  p.deviceToken = signDeviceToken(device);
  db.save();

  res.status(201).json({ device });
});

// 소유자의 등록된 PC 목록
devicesRouter.get("/", requireUser, (req, res) => {
  const devices = db.state.devices
    .filter((d) => d.userId === req.userId)
    .map(({ id, name, status, lastSeenAt, createdAt }) => ({ id, name, status, lastSeenAt, createdAt }));
  res.json({ devices });
});

devicesRouter.delete("/:id", requireUser, (req, res) => {
  const before = db.state.devices.length;
  db.state.devices = db.state.devices.filter(
    (d) => !(d.id === req.params.id && d.userId === req.userId)
  );
  if (db.state.devices.length === before) {
    return res.status(404).json({ error: "기기를 찾을 수 없습니다." });
  }
  db.save();
  res.status(204).end();
});
