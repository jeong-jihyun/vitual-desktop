import { useEffect, useRef, useState, type MouseEvent, type WheelEvent, type KeyboardEvent } from "react";
import type { Device } from "../types";

interface Props {
  device: Device;
  wsToken: string; // 계정 JWT 또는 게스트 토큰
  isGuest: boolean;
  onClose: () => void;
}

type SignalMessage =
  | { type: "session-ready"; sessionId: string }
  | { type: "answer"; sessionId: string; sdp: string }
  | { type: "ice"; sessionId: string; candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null };

export function RemoteView({ device, wsToken, isGuest, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const [status, setStatus] = useState("연결 중...");

  useEffect(() => {
    let closed = false;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/client?token=${wsToken}&deviceId=${device.id}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus("세션 시작 대기 중...");
    ws.onclose = () => {
      if (!closed) setStatus("연결이 종료되었습니다.");
    };

    ws.onmessage = async (evt) => {
      const msg = JSON.parse(evt.data) as SignalMessage;

      if (msg.type === "session-ready") {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        pcRef.current = pc;

        pc.ontrack = (e) => {
          if (videoRef.current) videoRef.current.srcObject = e.streams[0];
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            ws.send(
              JSON.stringify({
                type: "ice",
                candidate: e.candidate.candidate,
                sdpMid: e.candidate.sdpMid,
                sdpMLineIndex: e.candidate.sdpMLineIndex,
              })
            );
          }
        };
        pc.onconnectionstatechange = () => setStatus(`연결 상태: ${pc.connectionState}`);

        channelRef.current = pc.createDataChannel("input");
        pc.addTransceiver("video", { direction: "recvonly" });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
      }

      if (msg.type === "answer" && pcRef.current) {
        await pcRef.current.setRemoteDescription({ type: "answer", sdp: msg.sdp });
      }

      if (msg.type === "ice" && pcRef.current && msg.candidate) {
        try {
          await pcRef.current.addIceCandidate({
            candidate: msg.candidate,
            sdpMid: msg.sdpMid ?? undefined,
            sdpMLineIndex: msg.sdpMLineIndex ?? undefined,
          });
        } catch {
          // 세션 종료 시점과 겹쳐 늦게 도착한 후보는 무시해도 안전하다.
        }
      }
    };

    return () => {
      closed = true;
      channelRef.current?.close();
      pcRef.current?.close();
      ws.close();
    };
  }, [device.id, wsToken]);

  function sendInput(event: Record<string, unknown>) {
    if (channelRef.current?.readyState === "open") {
      channelRef.current.send(JSON.stringify(event));
    }
  }

  function handleMouseMove(e: MouseEvent<HTMLVideoElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    sendInput({
      type: "mousemove",
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }

  return (
    <div className="remote-view">
      <div className="remote-toolbar">
        <span className="device-name">{device.name}</span>
        {isGuest && <span className="badge">게스트 세션</span>}
        <span className="status">{status}</span>
        <button onClick={onClose}>연결 종료</button>
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        tabIndex={0}
        onMouseMove={handleMouseMove}
        onMouseDown={(e) => sendInput({ type: "mousedown", button: e.button })}
        onMouseUp={(e) => sendInput({ type: "mouseup", button: e.button })}
        onWheel={(e: WheelEvent<HTMLVideoElement>) => sendInput({ type: "wheel", deltaY: e.deltaY })}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e: KeyboardEvent<HTMLVideoElement>) => {
          e.preventDefault();
          sendInput({ type: "keydown", code: e.code, key: e.key });
        }}
        onKeyUp={(e: KeyboardEvent<HTMLVideoElement>) => {
          e.preventDefault();
          sendInput({ type: "keyup", code: e.code, key: e.key });
        }}
      />
    </div>
  );
}
