# deskcontrol-host-agent

가상PC 원격제어의 Windows 호스트 에이전트. 이 PC의 화면을 캡처해 WebRTC로 송출하고,
원격 클라이언트가 보낸 마우스/키보드 입력을 실제로 주입한다.

> Windows에서 실행하는 것을 전제로 한다 (요구사항 확정: Phase 1은 Windows 전용).

## 설치

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## 최초 실행 (페어링)

```powershell
python agent.py --http http://<서버주소>:8080 --ws ws://<서버주소>:8080
```

콘솔에 6자리 페어링 코드가 표시된다. 웹 클라이언트에 로그인한 뒤 "새 PC 등록"에서
이 코드를 입력하면 페어링이 완료되고, `device_config.json`에 접속 정보가 저장된다.
이후부터는 사람 개입 없이 자동으로 서버에 재접속한다 (계정 기반 상시 등록).

## 원격지원용 1회성 코드 발급

계정 로그인 없이 다른 사람이 이 PC에 한 번만 접속하게 하고 싶다면:

```powershell
python generate_guest_pin.py --http http://<서버주소>:8080
```

콘솔에 표시된 6자리 코드를 상대방에게 알려주면, 상대방은 웹 페이지에서
로그인 없이 이 코드만으로 1회 접속할 수 있다 (5분 후 만료, 1회 사용 후 폐기).

## 자동 시작 등록 (Windows)

작업 스케줄러에서 "로그온 시" 트리거로 `python agent.py`를 실행하도록 등록하면
PC 재부팅 후에도 자동으로 원격제어 대상이 된다.

## 참고

- 화면 캡처: `mss` (다중 모니터의 경우 `screen_track.py`의 `monitor_index` 조정)
- WebRTC: `aiortc`
- 입력 주입: `pynput` (키 매핑은 `input_control.py` 참고)
