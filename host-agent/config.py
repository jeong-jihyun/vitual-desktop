"""페어링 결과(deviceId, deviceToken)를 로컬 파일에 영구 저장한다.

계정 기반 상시 등록 기기 인증의 핵심 - 최초 페어링 이후에는
이 파일만 있으면 재부팅 후에도 사람 개입 없이 서버에 재접속할 수 있다.
"""

import json
import os

CONFIG_PATH = os.environ.get("DESKCONTROL_CONFIG", "device_config.json")


def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_config(data: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
