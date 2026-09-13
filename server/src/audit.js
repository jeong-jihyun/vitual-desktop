import crypto from "node:crypto";
import { db } from "./db.js";

const MAX_ENTRIES = 500;

function clientIp(req) {
  // 리버스 프록시(Nginx/Caddy) 뒤에 있을 경우 X-Forwarded-For를 신뢰한다.
  // 이 값은 프록시가 붙여준다고 가정하고 쓰므로, 신뢰할 수 있는 리버스 프록시
  // 없이 서버를 직접 인터넷에 노출하지 않는다는 전제(README 참고)가 깔려 있다.
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// event: 예) "login_success", "login_failed", "device_paired", "device_removed",
//           "guest_pin_created", "guest_pin_redeemed", "agent_online", "agent_offline"
export function logEvent(event, detail, req) {
  db.state.auditLog.push({
    id: crypto.randomUUID(),
    event,
    detail: detail || null,
    ip: req ? clientIp(req) : null,
    at: new Date().toISOString(),
  });
  if (db.state.auditLog.length > MAX_ENTRIES) {
    db.state.auditLog = db.state.auditLog.slice(-MAX_ENTRIES);
  }
  db.save();
}
