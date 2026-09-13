"""클립보드 동기화 - pyperclip으로 시스템 클립보드를 읽고 쓴다.

프로토콜(수동 트리거 방식 - 자동 실시간 동기화가 아니라 버튼으로 명시적 요청):
  {"type":"clipboard-set","text":..}  -> 상대방이 이 텍스트를 자기 클립보드에 저장
  {"type":"clipboard-get"}            -> 상대방의 현재 클립보드 텍스트를 clipboard-set으로 응답
"""

import json
import logging

import pyperclip

logger = logging.getLogger(__name__)


def is_clipboard_message(event: dict) -> bool:
    return str(event.get("type", "")).startswith("clipboard-")


def handle_control(event: dict, channel) -> None:
    kind = event.get("type")

    if kind == "clipboard-set":
        text = event.get("text", "")
        pyperclip.copy(text)
        logger.info("[클립보드] 원격에서 받은 텍스트를 붙여넣었습니다 (%d자)", len(text))

    elif kind == "clipboard-get":
        text = pyperclip.paste()
        channel.send(json.dumps({"type": "clipboard-set", "text": text}))
        logger.info("[클립보드] 현재 클립보드 텍스트를 전송했습니다 (%d자)", len(text))
