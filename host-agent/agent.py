"""가상PC 원격제어 - Windows 호스트 에이전트.

역할:
  1. 최초 실행 시 서버와 페어링(6자리 코드 발급 -> 소유자가 웹에서 입력)
  2. 이후 실행부터는 저장된 deviceToken으로 시그널링 서버에 상시 연결
  3. 접속 요청이 오면 WebRTC PeerConnection을 생성해 화면을 스트리밍하고,
     DataChannel("input") 하나로 마우스/키보드 입력, 파일 전송, 클립보드 동기화,
     모니터 전환 메시지를 모두 주고받는다. 세션이 진행되는 동안 화면을 로컬에도
     녹화한다(옵션).
"""

import argparse
import asyncio
import json
import logging
import time

import mss
import requests
import websockets
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.sdp import candidate_from_sdp

import clipboard_sync
from config import load_config, save_config
from file_transfer import FileTransferManager
from input_control import apply_input_event
from logging_setup import setup_logging
from screen_track import ScreenCaptureTrack, list_monitors
from session_recorder import SessionRecorder

logger = logging.getLogger(__name__)


def get_screen_size() -> tuple[int, int]:
    with mss.mss() as sct:
        mon = sct.monitors[1]
        return mon["width"], mon["height"]


def ensure_paired(server_http: str) -> dict:
    cfg = load_config()
    if cfg.get("deviceId") and cfg.get("deviceToken"):
        return cfg

    logger.info("등록된 기기 정보가 없습니다. 페어링을 시작합니다...")
    resp = requests.post(f"{server_http}/api/devices/pair/start", timeout=10)
    resp.raise_for_status()
    data = resp.json()

    # 페어링 코드는 화면에서 바로 눈에 띄어야 하므로 로그 포맷 없이 그대로 출력하고,
    # 발급 사실 자체는 agent.log에도 남긴다.
    print()
    print("=" * 44)
    print(f"  웹 화면에서 아래 코드를 입력해 이 PC를 등록하세요")
    print(f"  페어링 코드: {data['code']}")
    print(f"  (유효시간 {data['expiresInSeconds']}초)")
    print("=" * 44)
    print()
    logger.info("페어링 코드 발급됨 (tempId=%s)", data["tempId"])

    deadline = time.time() + data["expiresInSeconds"]
    status_url = f"{server_http}/api/devices/pair/status/{data['tempId']}"

    while time.time() < deadline:
        time.sleep(2)
        status = requests.get(status_url, timeout=10).json()
        if status.get("status") == "claimed":
            cfg = {"deviceId": status["deviceId"], "deviceToken": status["deviceToken"]}
            save_config(cfg)
            logger.info("페어링이 완료되었습니다. 에이전트를 계속 실행합니다.")
            return cfg

    raise TimeoutError("페어링 코드가 만료되었습니다. 에이전트를 다시 시작해주세요.")


class Session:
    """세션 하나(= PeerConnection 하나)에 딸린 부가 상태를 묶어둔다."""

    def __init__(self, pc: RTCPeerConnection, screen_track: ScreenCaptureTrack, recorder: SessionRecorder | None):
        self.pc = pc
        self.screen_track = screen_track
        self.recorder = recorder


def create_session(ws, session_id: str, screen_size: tuple[int, int], enable_recording: bool) -> Session:
    pc = RTCPeerConnection()
    recorder = SessionRecorder() if enable_recording else None
    screen_track = ScreenCaptureTrack(on_frame=recorder.write_frame if recorder else None)
    pc.addTrack(screen_track)

    file_transfer = FileTransferManager()

    if recorder:
        recorder.start(session_id, screen_size[0], screen_size[1])

    @pc.on("datachannel")
    def on_datachannel(channel):
        @channel.on("open")
        def on_open():
            channel.send(json.dumps({"type": "monitor-list", "monitors": list_monitors()}))

        @channel.on("message")
        def on_message(message):
            try:
                if isinstance(message, (bytes, bytearray)):
                    file_transfer.handle_binary_chunk(message)
                    return

                event = json.loads(message)
                event_type = event.get("type")

                if file_transfer.is_file_message(event):
                    file_transfer.handle_control(event, channel)
                elif clipboard_sync.is_clipboard_message(event):
                    clipboard_sync.handle_control(event, channel)
                elif event_type == "select-monitor":
                    screen_track.set_monitor(int(event.get("index", 1)))
                else:
                    apply_input_event(event, screen_size)
            except Exception:  # noqa: BLE001 - 입력/제어 처리는 최대한 죽지 않아야 함
                logger.exception("메시지 처리 중 오류 발생")

    @pc.on("icecandidate")
    async def on_icecandidate(candidate):
        if candidate:
            await ws.send(json.dumps({
                "type": "ice",
                "sessionId": session_id,
                "candidate": candidate.to_sdp(),
                "sdpMid": candidate.sdpMid,
                "sdpMLineIndex": candidate.sdpMLineIndex,
            }))

    @pc.on("connectionstatechange")
    async def on_state_change():
        logger.info("[세션 %s] 연결 상태: %s", session_id[:8], pc.connectionState)

    return Session(pc, screen_track, recorder)


async def run_agent(server_http: str, server_ws: str, enable_recording: bool) -> None:
    cfg = ensure_paired(server_http)
    screen_size = get_screen_size()
    ws_url = f"{server_ws}/ws/agent?token={cfg['deviceToken']}"

    sessions: dict[str, Session] = {}

    async with websockets.connect(ws_url) as ws:
        logger.info("시그널링 서버에 연결되었습니다 (%s). 접속 대기 중...", server_ws)
        if enable_recording:
            logger.info("세션 녹화가 켜져 있습니다 (recordings/ 폴더에 저장). --no-record로 끌 수 있습니다.")

        async for raw in ws:
            msg = json.loads(raw)
            mtype = msg.get("type")
            session_id = msg.get("sessionId")

            if mtype == "session-start":
                logger.info("[세션 %s] 새 접속 요청", session_id[:8])
                sessions[session_id] = create_session(ws, session_id, screen_size, enable_recording)

            elif mtype == "offer":
                session = sessions.get(session_id)
                if not session:
                    continue
                pc = session.pc
                await pc.setRemoteDescription(RTCSessionDescription(sdp=msg["sdp"], type="offer"))
                answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                await ws.send(json.dumps({
                    "type": "answer",
                    "sessionId": session_id,
                    "sdp": pc.localDescription.sdp,
                }))

            elif mtype == "ice":
                session = sessions.get(session_id)
                if session and msg.get("candidate"):
                    candidate = candidate_from_sdp(msg["candidate"])
                    candidate.sdpMid = msg.get("sdpMid")
                    candidate.sdpMLineIndex = msg.get("sdpMLineIndex")
                    await session.pc.addIceCandidate(candidate)

            elif mtype == "session-end":
                session = sessions.pop(session_id, None)
                if session:
                    if session.recorder:
                        session.recorder.stop()
                    await session.pc.close()
                    logger.info("[세션 %s] 종료", session_id[:8])


def main() -> None:
    setup_logging()

    parser = argparse.ArgumentParser(description="가상PC 원격제어 - Windows 호스트 에이전트")
    parser.add_argument("--http", default="http://localhost:8080", help="시그널링 서버 HTTP 주소")
    parser.add_argument("--ws", default="ws://localhost:8080", help="시그널링 서버 WebSocket 주소")
    parser.add_argument("--no-record", action="store_true", help="세션 녹화를 끈다 (기본은 켜짐)")
    args = parser.parse_args()

    logger.info("에이전트 시작 (http=%s, ws=%s)", args.http, args.ws)

    try:
        asyncio.run(run_agent(args.http, args.ws, enable_recording=not args.no_record))
    except KeyboardInterrupt:
        logger.info("에이전트를 종료합니다.")
    except Exception:
        logger.exception(
            "예상치 못한 오류로 에이전트가 종료되었습니다. "
            "이 폴더의 agent.log 파일 내용을 복사해서 알려주세요."
        )
        raise


if __name__ == "__main__":
    main()
