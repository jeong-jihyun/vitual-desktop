# Android 앱 (Phase 3)

`web-client`와 동일한 서버 프로토콜(`/api/auth/login`, `/api/devices/*`,
`/api/sessions/pin/*`, `/ws/client` WebRTC 시그널링)을 그대로 사용하는
Kotlin 네이티브 앱. 서버/에이전트 쪽 변경은 전혀 없다.

## ⚠️ 이 환경에서 확인하지 못한 부분

이 프로젝트는 Android SDK가 없는 리눅스 서버 환경에서 작성됐고, 그 환경에서는
`dl.google.com`(Android SDK·Google Maven 저장소) 접속이 막혀 있어 **`./gradlew build`가
실제로 실행되지 않았다.** 즉:

- Gradle 구성/의존성 좌표는 확인했지만, 실제 컴파일까지는 검증하지 못했다.
- 실제 기기/에뮬레이터에서 화면 스트리밍·터치·키보드 입력이 동작하는지도 확인하지 못했다.

**Android Studio가 설치된 PC에서 이 프로젝트를 열어 Gradle Sync + 빌드를 한 번
해봐야 한다.** 문법 오류나 라이브러리 버전 문제가 있다면 그때 고칠 것.

## 실행 방법

1. Android Studio에서 `android/` 폴더를 프로젝트로 열기 (Gradle Sync 자동 진행)
2. 실제 기기 또는 에뮬레이터 실행 (minSdk 24 / Android 7.0 이상)
3. 앱 최초 실행 시 로그인 화면에서:
   - **서버 주소**: 집 와이파이 기준 `서버를PC의IP:8080` (예: `192.168.0.5:8080`)
   - HTTPS 체크박스는 나중에 오라클 클라우드처럼 인터넷에 공개된 서버에 붙일 때만 체크
   - **접속 비밀번호**: server의 `OWNER_PASSWORD`
4. 등록된 PC가 없으면 "새 PC 등록"에서 `host-agent` 콘솔에 뜬 페어링 코드 입력

## 구성

| 파일 | 역할 |
| --- | --- |
| `LoginActivity` | 서버 주소 입력 + 비밀번호(+선택적 2FA 코드) 로그인, 1회성 게스트 코드 접속 |
| `DeviceListActivity` | 등록된 PC 목록, 새 PC 페어링, 삭제, 로그아웃 |
| `RemoteControlActivity` | WebRTC 연결(offer 생성, recvonly 비디오, `input` DataChannel), 터치→마우스, 소프트키보드→키 입력 |
| `SignalingClient` | `server/src/ws/signaling.js`와 동일한 `/ws/client` 메시지 프로토콜 구현 |
| `ApiClient` | REST API 클라이언트 (web-client/src/api.ts와 동일 엔드포인트) |
| `TokenStore` | 서버 주소·JWT를 `EncryptedSharedPreferences`에 저장 |

## 사용 라이브러리

- WebRTC: `io.getstream:stream-webrtc-android` - Google이 더 이상 공식 Maven에
  배포하지 않는 `org.webrtc.*` API를 그대로 유지하는 커뮤니티 유지보수 빌드
- 네트워킹: OkHttp (REST + WebSocket)
- 토큰 저장: `androidx.security:security-crypto` (EncryptedSharedPreferences)

## 알려진 제약 / 다음에 다듬을 것

- 문자 키(a, b, … 일반 텍스트) 입력은 소프트 키보드에서 타이핑된 글자를 그대로
  `key`로 보내는 방식이라, `host-agent`가 실제 Windows에서 정상 동작해야 확인된다
  (개발 중 Xvfb 테스트에서도 특수키는 되고 일반 문자 키는 Xvfb 자체 한계로
  검증 못함 - `docs/requirements.md` 참고. Windows는 다른 방식이라 무관).
- 파일 전송, 클립보드 동기화 등은 Phase 4 범위.
