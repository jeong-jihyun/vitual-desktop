# deskcontrol-web-client

가상PC 원격제어 웹 클라이언트 (React + Vite). 데스크톱/모바일 브라우저에서
접속 비밀번호로 로그인해 등록된 PC 목록을 보고 원격 제어한다.

## 개발 실행

```bash
npm install
npm run dev
```

기본적으로 `/api`, `/ws` 요청을 `http://localhost:8080`(서버)로 프록시한다
(`vite.config.ts` 참고). 서버를 먼저 실행해두어야 한다.

## 빌드

```bash
npm run build
```

`dist/`를 서버와 같은 도메인(또는 리버스 프록시) 아래 정적 파일로 배포한다.

## 화면 구성

- 로그인 (접속 비밀번호 + 선택적 2FA 코드, 회원가입 없음)
- 1회성 코드로 게스트 접속 (원격지원용, 로그인 불필요)
- 내 PC 목록 / 새 PC 등록(페어링 코드 입력) / 활동 로그
- 원격 화면 뷰어 (`RemoteView`) - WebRTC 영상 렌더링 + 마우스/키보드 입력 전송,
  화면 우상단 오버레이 패널로 파일 전송/클립보드/모니터 선택 제공

## 파일 전송·클립보드

- **파일 전송** (`FileTransferPanel`, `fileTransfer.ts`): "input" DataChannel
  하나로 JSON 제어 메시지와 바이너리 조각을 함께 보낸다. 업로드는 16KB 단위로
  나눠 보내며, `bufferedAmountLowThreshold`로 배압(backpressure)을 처리한다.
- **클립보드** (`ClipboardControls`): `navigator.clipboard`는 보안 컨텍스트
  (HTTPS 또는 `localhost`)에서만 제공되므로, `http://사설IP`로 접속하는 지금
  단계에서는 브라우저가 API 자체를 막아 버튼이 비활성 표시된다.
