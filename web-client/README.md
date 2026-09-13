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

- 로그인 (접속 비밀번호만 입력, 회원가입 없음)
- 1회성 코드로 게스트 접속 (원격지원용, 로그인 불필요)
- 내 PC 목록 / 새 PC 등록(페어링 코드 입력)
- 원격 화면 뷰어 (`RemoteView`) - WebRTC 영상 렌더링 + 마우스/키보드 입력 전송
