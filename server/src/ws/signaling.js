import { WebSocketServer } from "ws";
import crypto from "node:crypto";
import { verifyToken } from "../auth.js";
import { db } from "../db.js";
import { logEvent } from "../audit.js";

// 서버는 시그널링(SDP/ICE 교환)만 중계하고, 실제 화면/입력 데이터는
// 클라이언트 <-> 에이전트 간 WebRTC(P2P 우선, 실패 시 TURN)로 직접 오간다.

const agentSockets = new Map(); // deviceId -> WebSocket
const clientSessions = new Map(); // sessionId -> { ws, deviceId }

export function attachSignaling(server) {
  const agentWss = new WebSocketServer({ noServer: true });
  const clientWss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/ws/agent") {
      agentWss.handleUpgrade(req, socket, head, (ws) =>
        agentWss.emit("connection", ws, req, url.searchParams)
      );
    } else if (url.pathname === "/ws/client") {
      clientWss.handleUpgrade(req, socket, head, (ws) =>
        clientWss.emit("connection", ws, req, url.searchParams)
      );
    } else {
      socket.destroy();
    }
  });

  agentWss.on("connection", (ws, req, params) => {
    let payload;
    try {
      payload = verifyToken(params.get("token") || "");
      if (payload.type !== "device") throw new Error("invalid token type");
    } catch {
      ws.close(4001, "인증 실패");
      return;
    }

    const deviceId = payload.sub;
    const device = db.state.devices.find((d) => d.id === deviceId);
    if (!device) {
      ws.close(4004, "등록되지 않은 기기입니다.");
      return;
    }

    agentSockets.set(deviceId, ws);
    device.status = "online";
    device.lastSeenAt = new Date().toISOString();
    db.save();
    console.log(`[agent] ${device.name} (${deviceId}) 온라인`);
    logEvent("agent_online", { deviceId, name: device.name }, req);

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      // 에이전트 -> 해당 세션의 클라이언트로 그대로 전달 (answer, ice 등)
      const entry = clientSessions.get(msg.sessionId);
      if (entry) entry.ws.send(JSON.stringify(msg));
    });

    ws.on("close", () => {
      if (agentSockets.get(deviceId) === ws) agentSockets.delete(deviceId);
      device.status = "offline";
      device.lastSeenAt = new Date().toISOString();
      db.save();
      console.log(`[agent] ${device.name} (${deviceId}) 오프라인`);
      logEvent("agent_offline", { deviceId, name: device.name }, req);
    });
  });

  clientWss.on("connection", (ws, req, params) => {
    const token = params.get("token") || "";
    const deviceId = params.get("deviceId");
    let payload;

    try {
      payload = verifyToken(token);
    } catch {
      ws.close(4001, "인증 실패");
      return;
    }

    if (payload.type === "user") {
      const device = db.state.devices.find((d) => d.id === deviceId && d.userId === payload.sub);
      if (!device) {
        ws.close(4003, "해당 기기에 접근 권한이 없습니다.");
        return;
      }
    } else if (payload.type === "guest") {
      if (payload.sub !== deviceId) {
        ws.close(4003, "접근 권한이 없습니다.");
        return;
      }
    } else {
      ws.close(4001, "유효하지 않은 토큰입니다.");
      return;
    }

    const agentWs = agentSockets.get(deviceId);
    if (!agentWs) {
      ws.close(4404, "해당 PC가 오프라인입니다.");
      return;
    }

    const sessionId = crypto.randomUUID();
    clientSessions.set(sessionId, { ws, deviceId });

    ws.send(JSON.stringify({ type: "session-ready", sessionId }));
    agentWs.send(JSON.stringify({ type: "session-start", sessionId }));
    logEvent("session_start", { deviceId, sessionId, via: payload.type }, req);

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      // 클라이언트 -> 에이전트로 전달 (offer, ice 등). sessionId는 서버가 강제한다.
      msg.sessionId = sessionId;
      if (agentSockets.get(deviceId) === agentWs) {
        agentWs.send(JSON.stringify(msg));
      }
    });

    ws.on("close", () => {
      clientSessions.delete(sessionId);
      if (agentSockets.get(deviceId) === agentWs) {
        agentWs.send(JSON.stringify({ type: "session-end", sessionId }));
      }
    });
  });
}
