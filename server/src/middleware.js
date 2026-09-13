import { verifyToken } from "./auth.js";

function extractToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export function requireUser(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "인증이 필요합니다." });
  try {
    const payload = verifyToken(token);
    if (payload.type !== "user") throw new Error("invalid token type");
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "유효하지 않은 토큰입니다." });
  }
}

export function requireDevice(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "인증이 필요합니다." });
  try {
    const payload = verifyToken(token);
    if (payload.type !== "device") throw new Error("invalid token type");
    req.deviceId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "유효하지 않은 디바이스 토큰입니다." });
  }
}
