import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../db.js";
import { requireDevice } from "../middleware.js";
import { signGuestToken } from "../auth.js";
import { logEvent } from "../audit.js";

export const sessionsRouter = Router();
const PIN_TTL_MS = Number(process.env.PIN_TTL_SECONDS || 300) * 1000;

function genCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// 호스트 에이전트가 1회성 게스트 접속 코드를 발급 요청
// (에이전트 자신의 deviceToken으로 인증 - 소유자가 로컬에서 트리거)
sessionsRouter.post("/pin/create", requireDevice, (req, res) => {
  const now = Date.now();
  db.state.pins = db.state.pins.filter((p) => p.expiresAt > now);

  const code = genCode();
  db.state.pins.push({ code, deviceId: req.deviceId, expiresAt: now + PIN_TTL_MS, used: false });
  db.save();

  logEvent("guest_pin_created", { deviceId: req.deviceId }, req);
  res.status(201).json({ code, expiresInSeconds: PIN_TTL_MS / 1000 });
});

// 게스트 뷰어가 코드를 입력해 계정 로그인 없이 1회용 접속 토큰을 발급받음
sessionsRouter.post("/pin/redeem", (req, res) => {
  const { code } = req.body || {};
  const p = db.state.pins.find((x) => x.code === code && !x.used);

  if (!p || p.expiresAt < Date.now()) {
    return res.status(400).json({ error: "코드가 올바르지 않거나 만료되었습니다." });
  }

  p.used = true;
  db.save();

  logEvent("guest_pin_redeemed", { deviceId: p.deviceId }, req);
  res.json({ guestToken: signGuestToken(p.deviceId), deviceId: p.deviceId });
});
