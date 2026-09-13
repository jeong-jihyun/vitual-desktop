# Android 앱 (Phase 3 - 미착수)

로드맵상 Phase 3에서 착수 예정. 웹 클라이언트(`web-client/`)와 동일한 서버
시그널링 프로토콜(`/ws/client?token=&deviceId=` + WebRTC offer/answer/ICE)을
그대로 재사용하므로, 서버/에이전트 변경 없이 아래 구조로 구현하면 된다.

## 계획된 구성

- 언어/프레임워크: Kotlin 네이티브
- WebRTC: `org.webrtc` (Google WebRTC Android 라이브러리)
- 시그널링: `web-client/src/components/RemoteView.tsx`의 로직과 동일하게
  OkHttp WebSocket으로 `/ws/client`에 연결, offer 생성 -> answer/ice 수신 처리
- 인증: 로그인 화면에서 접속 비밀번호 입력 -> `/api/auth/login` -> JWT를
  Android Keystore 또는 EncryptedSharedPreferences에 보관
- 입력: 터치 제스처를 `mousemove`/`mousedown`/`mouseup`/`wheel` 이벤트로 변환해
  DataChannel로 전송 (웹 클라이언트와 동일한 JSON 스키마, `host-agent/input_control.py` 참고)
- 푸시 알림: 원격지원 요청/승인 알림 (Phase 3 세부 설계 시 FCM 연동 검토)

## 시작하기 전에

1. `server/`, `host-agent/`, `web-client/`가 먼저 안정화되어야 프로토콜 변경 리스크가 없다.
2. Android Studio + Gradle 프로젝트는 실제 착수 시점에 이 디렉터리에 스캐폴딩한다.
