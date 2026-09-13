# deskcontrol-server

가상PC 원격제어 프로그램의 시그널링/인증 서버. 화면·입력 데이터는 중계하지 않고,
WebRTC 연결을 맺기 위한 offer/answer/ICE 후보 교환과 인증·페어링만 담당한다.

## 실행

```bash
npm install
cp .env.example .env
# .env에서 JWT_SECRET을 무작위 값으로, OWNER_PASSWORD를 원하는 접속 비밀번호로 설정
npm start
```

기본 포트는 8080. 최초 실행 시 `OWNER_PASSWORD`로 소유자 계정이 1회 자동 등록된다
(회원가입 절차 없음). 비밀번호를 바꾸려면 `DATA_DIR/db.json`의 `users` 배열을 비우고
`.env`의 `OWNER_PASSWORD`를 변경한 뒤 재시작한다.

`web-client`를 미리 빌드해두면(`cd ../web-client && npm run build`) 이 서버가
`web-client/dist`를 같은 포트에서 함께 서빙한다 - 즉 서버 하나만 실행하면 API와
웹 화면이 모두 뜬다. 빌드 결과물 경로는 `WEB_CLIENT_DIST` 환경변수로 바꿀 수 있다.

## 2단계 인증 (선택)

```bash
node scripts/generate-totp-secret.js
# 출력된 TOTP_SECRET을 .env에 넣고 서버 재시작
```

설정하면 로그인 시 비밀번호 + 인증앱(Google Authenticator 등) 6자리 코드를
함께 요구한다. 설정하지 않으면 기존처럼 비밀번호만으로 로그인한다.

## API 개요

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ password, totp? }` -> 소유자 JWT 발급 (2FA 활성 시 totp 필요) |
| GET | `/api/devices` | 등록된 내 PC 목록 (JWT 필요) |
| POST | `/api/devices/pair/start` | 호스트 에이전트가 페어링 코드 발급 요청 (인증 불필요) |
| GET | `/api/devices/pair/status/:tempId` | 에이전트가 소유자의 등록 완료를 폴링 |
| POST | `/api/devices/pair/claim` | 소유자가 코드 입력, PC를 계정에 등록 (JWT 필요) |
| DELETE | `/api/devices/:id` | PC 등록 해제 (JWT 필요) |
| POST | `/api/sessions/pin/create` | 에이전트가 1회성 게스트 코드 발급 (deviceToken 필요) |
| POST | `/api/sessions/pin/redeem` | 게스트가 코드로 1회용 접속 토큰 발급 (인증 불필요) |
| GET | `/api/audit` | 최근 활동 로그 조회 (JWT 필요, `?limit=` 최대 200) |
| WS | `/ws/agent?token=` | 호스트 에이전트 시그널링 채널 |
| WS | `/ws/client?token=&deviceId=` | 뷰어(웹/Android) 시그널링 채널 |

로그인은 같은 IP에서 10분 내 5회 실패 시 일시 차단(429)된다.

## 데이터 저장

별도 DB 엔진 없이 `DATA_DIR/db.json` 단일 파일에 저장한다 (개인용 PC 3~5대 규모 기준).
운영 배포 시 이 디렉터리를 백업 대상에 포함할 것.

## 문제가 생겼을 때

`DATA_DIR/server.log`(기본 `data/server.log`)에 콘솔 출력이 그대로 남는다.
터미널 창을 닫아버렸어도 이 파일을 열어서 알려주면 된다.

## 배포 시 주의

- HTTPS/WSS 뒤에 반드시 배치할 것 (Nginx/Caddy 리버스 프록시 권장) - 그렇지 않으면
  비밀번호와 토큰이 평문으로 전송된다.
- 방화벽에서 WebRTC 미디어 포트가 아닌 이 서버의 시그널링 포트만 노출하면 된다.
