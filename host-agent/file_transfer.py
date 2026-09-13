"""웹/Android 클라이언트와의 파일 전송을 처리한다.

기존 "input" DataChannel 하나를 그대로 재사용한다 - JSON 제어 메시지(문자열)와
파일 조각(바이너리)을 같은 채널에서 타입으로 구분해 주고받는다.

프로토콜:
  업로드(클라이언트 -> 호스트):
    {"type":"file-upload-start","id":..,"name":..,"size":..} (JSON)
    <바이너리 조각> * N
    {"type":"file-upload-end","id":..} (JSON)
    -> RECEIVED_DIR에 저장

  목록 조회:
    {"type":"file-list-request"} (JSON)
    -> {"type":"file-list-response","files":[{"name":..,"size":..}, ...]}

  다운로드(호스트 -> 클라이언트):
    {"type":"file-download-start","name":..} (JSON)
    -> {"type":"file-download-meta","name":..,"size":..}
    -> <바이너리 조각> * N
    -> {"type":"file-download-end","name":..}
    (SHARED_DIR에 없는 파일이면 {"type":"file-download-error", "name":.., "error":..})
"""

import json
import os

RECEIVED_DIR = os.environ.get("DESKCONTROL_RECEIVED_DIR", "received_files")
SHARED_DIR = os.environ.get("DESKCONTROL_SHARED_DIR", "shared_files")
CHUNK_SIZE = 16 * 1024


def _safe_filename(name: str) -> str:
    # 디렉터리 탈출(경로 조작) 방지 - 경로 구분자를 제거하고 파일명만 남긴다.
    name = os.path.basename(name or "unnamed")
    return name.replace("..", "_") or "unnamed"


class FileTransferManager:
    def __init__(self, received_dir: str = RECEIVED_DIR, shared_dir: str = SHARED_DIR):
        self._received_dir = received_dir
        self._shared_dir = shared_dir
        self._upload_file = None
        self._upload_received_size = 0
        os.makedirs(self._received_dir, exist_ok=True)
        os.makedirs(self._shared_dir, exist_ok=True)

    def is_file_message(self, event: dict) -> bool:
        return str(event.get("type", "")).startswith("file-")

    def handle_control(self, event: dict, channel) -> None:
        kind = event.get("type")

        if kind == "file-upload-start":
            name = _safe_filename(event.get("name"))
            path = os.path.join(self._received_dir, name)
            self._upload_file = open(path, "wb")
            self._upload_received_size = 0
            print(f"[파일 수신 시작] {name} (예상 {event.get('size', '?')} bytes)")

        elif kind == "file-upload-end":
            if self._upload_file:
                self._upload_file.close()
                print(f"[파일 수신 완료] {self._upload_received_size} bytes 저장됨")
            self._upload_file = None
            self._upload_received_size = 0

        elif kind == "file-list-request":
            files = []
            for name in sorted(os.listdir(self._shared_dir)):
                path = os.path.join(self._shared_dir, name)
                if os.path.isfile(path):
                    files.append({"name": name, "size": os.path.getsize(path)})
            channel.send(json.dumps({"type": "file-list-response", "files": files}))

        elif kind == "file-download-start":
            name = _safe_filename(event.get("name"))
            path = os.path.join(self._shared_dir, name)
            if not os.path.isfile(path):
                channel.send(json.dumps({
                    "type": "file-download-error",
                    "name": name,
                    "error": "파일을 찾을 수 없습니다.",
                }))
                return

            size = os.path.getsize(path)
            channel.send(json.dumps({"type": "file-download-meta", "name": name, "size": size}))
            with open(path, "rb") as f:
                while True:
                    chunk = f.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    channel.send(chunk)
            channel.send(json.dumps({"type": "file-download-end", "name": name}))
            print(f"[파일 송신 완료] {name} ({size} bytes)")

    def handle_binary_chunk(self, chunk: bytes) -> None:
        if self._upload_file:
            self._upload_file.write(chunk)
            self._upload_received_size += len(chunk)
