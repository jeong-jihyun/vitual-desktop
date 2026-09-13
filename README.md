# 가상PC 원격제어 (개인용)

Android/웹으로 개인 소유 Windows PC를 원격제어하는 도구. 회원가입 없이 서버에 미리
설정한 접속 비밀번호로 로그인하며, 원격지원이 필요할 때는 1회성 코드로 로그인 없이
접속할 수 있다.

요구사항 검토 및 확정 경위는 [`docs/requirements.md`](docs/requirements.md) 참고.

## 구성

| 디렉터리 | 역할 | 상태 |
| --- | --- | --- |
| [`server/`](server) | 인증·페어링·WebRTC 시그널링 서버 (Node.js) | Phase 1 구현 완료 |
| [`host-agent/`](host-agent) | Windows 호스트 에이전트 (Python, 화면 캡처/입력 주입) | Phase 1 구현 완료 |
| [`web-client/`](web-client) | 웹 뷰어 (React) | Phase 1 구현 완료 |
| [`android/`](android) | Android 네이티브 앱 | Phase 3 예정 (미착수) |

## 빠른 시작 (집 와이파이 안에서 테스트)

지금 단계는 비용이 드는 서버 없이, **제어할 PC와 핸드폰이 같은 와이파이에 연결된 상태**로
테스트하는 것을 목표로 한다. 서버 하나가 API와 웹 화면을 모두 서빙하므로, 핸드폰에서는
주소 하나만 접속하면 된다.

1. **웹 클라이언트를 빌드해서 서버에 포함시킨다** (PC에서 1회)
   ```bash
   cd web-client && npm install && npm run build
   ```
2. **서버 실행** (제어할 그 PC, 또는 같은 와이파이의 다른 PC에서)
   ```bash
   cd server && npm install
   cp .env.example .env   # JWT_SECRET, OWNER_PASSWORD 설정
   npm start
   ```
   `web-client/dist`가 있으면 서버가 자동으로 웹 화면도 같이 서빙한다.
3. **호스트 에이전트** (제어 대상 Windows PC에서)
   ```powershell
   cd host-agent
   pip install -r requirements.txt
   python agent.py --http http://<2번 서버를 실행한 PC의 IP>:8080 --ws ws://<같은 IP>:8080
   ```
   Windows 방화벽이 "네트워크 접근을 허용할까요?" 물어보면 허용한다. 콘솔에 표시되는
   페어링 코드를 기억해둔다.
4. **핸드폰에서 접속** (같은 와이파이에 연결된 상태)
   - 서버를 실행한 PC의 IP 확인: Windows는 `ipconfig`에서 "IPv4 주소" (예: `192.168.0.5`)
   - 핸드폰 브라우저에서 `http://192.168.0.5:8080` 접속
   - `OWNER_PASSWORD`로 로그인 -> 3번에서 나온 페어링 코드 입력해 PC 등록 -> 접속

와이파이를 벗어나면(외부 LTE 등) 이 방식으로는 접속되지 않는다. 외부에서도 접속하고
싶어지면, 마지막 단계로 **오라클 클라우드 무료 티어**를 서버 실행 위치로 쓰는 옵션을
추가할 예정이다 (아래 "배포 옵션" 참고). 지금 구조는 서버 위치만 바뀔 뿐 코드 변경 없이
그대로 옮길 수 있게 만들어져 있다.

각 디렉터리의 README에 더 자세한 설명이 있다.

## 배포 옵션 (나중에 추가 예정)

- **지금**: 집 와이파이 내부에서만 사용 (위 "빠른 시작" 참고, 비용 없음)
- **마지막 단계(옵션)**: 오라클 클라우드 Always Free 인스턴스에 `server/`를 그대로 배포해
  집 밖에서도 접속 가능하게 함. 코드는 이미 `PORT`/`JWT_SECRET`/`OWNER_PASSWORD`를 환경변수로
  받고, 웹 화면도 같은 포트에서 서빙하도록 되어 있어 별도 코드 수정 없이 그대로 옮길 수 있다.
  실제 배포 가이드(Ubuntu 설정, HTTPS 인증서 등)는 이 옵션을 실제로 진행할 때 작성한다.

## 인증 모델

- **소유자(상시) 접속**: 서버 `.env`의 `OWNER_PASSWORD` 하나로 로그인. 별도 회원가입 없음.
- **게스트(1회성) 접속**: 호스트 PC에서 `python generate_guest_pin.py` 실행 -> 6자리 코드 발급
  -> 웹에서 로그인 없이 코드 입력만으로 해당 PC에 1회 접속 (원격지원용).

## 보안 관련 주의

- 반드시 HTTPS/WSS 뒤에서 운영할 것 (리버스 프록시 + 인증서).
- `.env`의 `JWT_SECRET`, `OWNER_PASSWORD`는 저장소에 커밋하지 말 것 (`.gitignore`에 포함됨).
- 원격 제어 프로그램은 기술적으로 해킹 도구와 동일한 능력을 가지므로, 접속 비밀번호와
  게스트 코드를 신뢰할 수 있는 경로로만 공유할 것.
