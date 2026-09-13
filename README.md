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

## 빠른 시작

1. **서버**
   ```bash
   cd server && npm install
   cp .env.example .env   # JWT_SECRET, OWNER_PASSWORD 설정
   npm start
   ```
2. **호스트 에이전트** (제어 대상 Windows PC에서)
   ```powershell
   cd host-agent
   pip install -r requirements.txt
   python agent.py --http http://<서버주소>:8080 --ws ws://<서버주소>:8080
   ```
   콘솔에 표시되는 페어링 코드를 다음 웹 클라이언트에서 입력해 등록한다.
3. **웹 클라이언트**
   ```bash
   cd web-client && npm install
   npm run dev
   ```
   브라우저에서 `.env`의 `OWNER_PASSWORD`로 로그인 -> 페어링 코드 입력 -> 접속.

각 디렉터리의 README에 더 자세한 설명이 있다.

## 인증 모델

- **소유자(상시) 접속**: 서버 `.env`의 `OWNER_PASSWORD` 하나로 로그인. 별도 회원가입 없음.
- **게스트(1회성) 접속**: 호스트 PC에서 `python generate_guest_pin.py` 실행 -> 6자리 코드 발급
  -> 웹에서 로그인 없이 코드 입력만으로 해당 PC에 1회 접속 (원격지원용).

## 보안 관련 주의

- 반드시 HTTPS/WSS 뒤에서 운영할 것 (리버스 프록시 + 인증서).
- `.env`의 `JWT_SECRET`, `OWNER_PASSWORD`는 저장소에 커밋하지 말 것 (`.gitignore`에 포함됨).
- 원격 제어 프로그램은 기술적으로 해킹 도구와 동일한 능력을 가지므로, 접속 비밀번호와
  게스트 코드를 신뢰할 수 있는 경로로만 공유할 것.
