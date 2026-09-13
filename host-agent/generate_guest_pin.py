"""PC 소유자가 이 PC에서 직접 실행해 '1회성 게스트 접속 코드'를 발급한다.

계정 로그인 없이 임시로 다른 사람(또는 다른 기기)이 한 번만 접속할 수 있게 하고 싶을 때 사용한다.
agent.py가 먼저 한 번 이상 실행되어 페어링이 완료된 상태여야 한다.
"""

import argparse

import requests

from config import load_config


def main() -> None:
    parser = argparse.ArgumentParser(description="1회성 게스트 접속 코드 발급")
    parser.add_argument("--http", default="http://localhost:8080", help="시그널링 서버 HTTP 주소")
    args = parser.parse_args()

    cfg = load_config()
    if not cfg.get("deviceToken"):
        raise SystemExit("먼저 agent.py를 실행해 이 PC를 페어링하세요.")

    resp = requests.post(
        f"{args.http}/api/sessions/pin/create",
        headers={"Authorization": f"Bearer {cfg['deviceToken']}"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    print()
    print("=" * 44)
    print(f"  게스트 접속 코드: {data['code']}")
    print(f"  (유효시간 {data['expiresInSeconds']}초, 1회만 사용 가능)")
    print("=" * 44)
    print()


if __name__ == "__main__":
    main()
